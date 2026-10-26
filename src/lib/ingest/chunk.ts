import type { ExtractedPage } from "./extract";

export interface Chunk { ordinal: number; page: number | null; section: string | null; content: string }
export interface ChunkOptions { size: number; overlap: number }

const HEADING = /^(#{1,4}\s+.+|\d+(\.\d+)*[.)]?\s+[A-Z][^.!?]{2,80}|[A-Z][A-Za-z0-9 ,&/()-]{2,60}:)$/;

export function isHeading(line: string): boolean {
  const l = line.trim();
  if (l.length < 3 || l.length > 90) return false;
  if (/[.!?]$/.test(l) && !/^#/.test(l)) return false;
  return HEADING.test(l);
}

function cleanHeading(line: string): string {
  return line.replace(/^#+\s*/, "").replace(/:$/, "").trim();
}

function splitLong(para: string, size: number): string[] {
  if (para.length <= size) return [para];
  const sentences = para.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && cur.length + s.length + 1 > size) { out.push(cur); cur = ""; }
    if (s.length > size) { for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size)); continue; }
    cur += (cur ? " " : "") + s;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Paragraph-aware chunking. Chunks never cross page boundaries, so each chunk keeps exactly one page number.
 * The nearest preceding heading is carried as the section label, including across pages.
 */
export function chunkPages(pages: ExtractedPage[], opts: ChunkOptions): Chunk[] {
  if (opts.overlap >= opts.size) throw new Error("overlap must be smaller than size");
  const chunks: Chunk[] = [];
  let section: string | null = null;

  for (const { page, text } of pages) {
    let buf = "";
    let bufSection: string | null = section;
    let fresh = 0; // characters added since the last flush (excludes overlap)
    const push = () => {
      const content = buf.trim();
      if (content.length >= 40 && fresh > 0) chunks.push({ ordinal: chunks.length, page, section: bufSection, content });
    };
    const flush = () => {
      push();
      const tail = buf.trim().slice(-opts.overlap);
      const cut = tail.search(/[.!?]\s/);
      buf = opts.overlap > 0 && cut >= 0 ? tail.slice(cut + 2) : "";
      fresh = 0;
      bufSection = section;
    };

    for (const para of text.split(/\n\n+/)) {
      const first = para.split("\n")[0] ?? "";
      if (isHeading(first)) {
        if (fresh > 0) flush();
        buf = "";
        section = cleanHeading(first);
        bufSection = section;
      }
      for (const piece of splitLong(para, opts.size)) {
        if (fresh > 0 && buf.length + piece.length + 2 > opts.size) flush();
        buf += (buf ? "\n\n" : "") + piece;
        fresh += piece.length;
      }
    }
    push();
  }
  return chunks;
}
