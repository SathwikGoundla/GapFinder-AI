# Study Notes: PLC Fundamentals (DEMO CONTENT)

Original sample notes written for the GapFinder AI demo.

## PLC Components
A programmable logic controller (PLC) is an industrial computer that reads inputs, runs a user program, and drives outputs. The power supply converts mains voltage to the low DC voltage used by the CPU and modules, usually 24 V DC. The CPU stores and executes the program. Input modules convert field signals, such as a 24 V signal from a push button, into logic states the CPU can read. Output modules switch field devices such as contactors, lamps, and solenoid valves. A programming device, usually a laptop running the vendor's software, is used to write, download, and monitor the program.

## Discrete and Analog Signals
A discrete signal has only two states, on or off. Limit switches, push buttons, and proximity sensors are discrete inputs. An analog signal varies continuously across a range, for example 4 to 20 mA or 0 to 10 V. Temperature transmitters and pressure transmitters are analog inputs. The 4 to 20 mA range is popular because a reading of 0 mA clearly indicates a broken wire, while 4 mA represents the bottom of the measuring range.

## Sinking and Sourcing
A sourcing device supplies current to the load, so it switches the positive side of the supply. A sinking device provides the path to ground, so it switches the negative (common) side. A sourcing sensor must be connected to a sinking input module, and a sinking sensor to a sourcing input module. Mixing two sourcing devices means no current can flow, so the input never turns on.

## The Scan Cycle
A PLC runs its program in a repeating loop called the scan cycle. First, during the input scan, the CPU copies the state of every input terminal into the input image table. Second, during program execution, the CPU solves the ladder logic from top to bottom and left to right, using only the values in the image table. Third, during the output update, the results are written from the output image table to the physical output terminals. Finally, housekeeping handles communication and diagnostics. Because inputs are read only once per scan, a pulse shorter than the scan time can be missed completely. For very fast signals, high-speed counter modules or interrupt inputs are used instead.

## Contacts and Coils
In ladder logic, a normally open (NO) contact passes logic when its referenced bit is 1 (true). A normally closed (NC) contact passes logic when its referenced bit is 0 (false). These symbols describe the instruction in the program, not the physical button. An output coil is energized when there is a continuous true path from the left power rail to the coil. Contacts placed in series form AND logic: every contact must be true. Contacts placed in parallel form OR logic: any one branch can complete the path.

## Seal-in Circuits
A momentary start push button only stays closed while pressed. To keep a motor running after the button is released, a seal-in (latching) contact is placed in parallel with the start button. This contact is a normally open contact addressed to the motor's own output coil. Once the coil turns on, the seal-in contact holds the rung true. The stop button is placed in series so that opening it breaks the rung and drops the seal.

## Set and Reset Instructions
A set (latch) instruction turns a bit on and leaves it on even after the rung goes false. A reset (unlatch) instruction turns the same bit off. Unlike a seal-in circuit, a latched bit stays on after a power cycle in many PLCs if it is stored in retentive memory, which can restart machinery unexpectedly. For this reason, seal-in circuits are generally preferred for motor control.

## Timers
An on-delay timer (TON) starts timing when its rung becomes true. When the accumulated time reaches the preset, the done bit turns on. If the rung goes false before the preset is reached, the accumulated value resets to zero. An off-delay timer (TOF) turns its done bit on immediately when the rung goes true, and keeps it on for the preset time after the rung goes false. A typical use is keeping a cooling fan running after a motor stops. A retentive timer (RTO) keeps its accumulated value when the rung goes false, so it can total time across several intervals. It must be cleared with a separate reset instruction.

## Counters
An up counter (CTU) adds one to its accumulated value on each false-to-true transition of its rung, not while the rung stays true. When the accumulated value reaches the preset, the done bit turns on. A down counter (CTD) subtracts one on each transition. Counters keep their values until a reset instruction clears them.

## Safety Practices
Stop buttons are wired as normally closed physical contacts. If the wire breaks, the input turns off, which the program reads as a stop. This is called fail-safe wiring. Emergency stop circuits must be hardwired to remove power from the outputs directly, through a safety relay, because a PLC program or CPU fault must never be the only thing preventing hazardous motion. Forcing an input or output in online mode overrides the program and can move machinery unexpectedly, so forces should only be used with the machine in a safe state and should be removed immediately after testing.
