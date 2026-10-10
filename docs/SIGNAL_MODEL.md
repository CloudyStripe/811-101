<!-- Generated from src/signal/constants.ts by `npm run docs`. Do not edit by hand. -->

# Frequency Lab signal model

The lab shows eight states: two setups × four frequencies. The model is a small, pure function of setup and frequency, not a circuit solver. Every value below is a teaching calibration, chosen so the lab behaves the way experienced locators expect, and pending their review.

## What it models

- **What carries the signal:** the steel main itself, or, on the plastic main, its tracer wire. Plastic pipe can't carry a locate signal.
- **Fade:** the current falls off exponentially along the line, at a rate set per conductor (steel main or tracer wire) and per frequency. What fades leaks into the soil.
- **Bleed-over:** along the parallel run, the telecom cable carries a share of the target's current, set per frequency. It flows back toward the stake, in the return direction.
- **Earth return:** everything that leaves the target returns to the ground stake. That includes the fade and what continues past the chart. The telecom cable's share is part of that return, not added to it.
- **Direction:** outgoing on the target, returning on the telecom cable, and through the earth toward the stake.
- **Transmitter readout:** circuit resistance is set per setup and frequency. Current follows from a fixed output with internal resistance.
- **Water main:** it isn't connected to anything, so the model gives it no signal. An unconnected crossing line picks up too little to show.

**Left out:** a circuit solver, receiver field math, depth, passive modes, clamp and induction coupling, and stake placement.

## Values

### Block length

Distance along the target line from the hookup to the far end of the block shown in 3D.

**Value:** 140 ft

**Why:** Long enough to see the signal fade in the 3D view, short enough to show street detail.

### Chart length

How far the inset chart follows each line past the hookup.

**Value:** 500 ft

**Why:** Reach differences between frequencies show clearly over a few hundred feet.

### Water main crossing

Where the unconnected water main crosses the target line, measured from the hookup.

**Value:** 100 ft

**Why:** Inside the block and well away from the hookup, so it reads as a separate feature.

### Fade along the line

- **Fade on the coated steel main:** Share of the current still on the steel main after another 100 ft. The rest leaks into the soil.
- **Fade on the tracer wire:** Share of the current still on the tracer wire after another 100 ft. The rest leaks into the soil.

Unit: share left per 100 ft.

| | 512 Hz | 8 kHz | 33 kHz | 83 kHz |
|---|---|---|---|---|
| Coated steel main | 0.93 | 0.72 | 0.4 | 0.15 |
| Tracer wire | 0.95 | 0.8 | 0.5 | 0.34 |

**Why (fade on the coated steel main):** Higher frequencies leak through the pipe coating into the soil more easily, so they fade sooner and don't travel as far. Compressed so the difference shows within one block: real lines fade far more gradually, in the same order.

**Why (fade on the tracer wire):** The same trend as the steel main, compressed the same way. A thin insulated wire leaks less than the big coated main at every frequency.

### Bleed-over onto the telecom cable

- **Bleed-over onto the telecom cable:** Current on the parallel telecom cable as a share of the target current at the same spot. It flows back toward the stake.

Unit: share of target current.

| | 512 Hz | 8 kHz | 33 kHz | 83 kHz |
|---|---|---|---|---|
| Telecom cable | 0.02 | 0.06 | 0.15 | 0.32 |

**Why (bleed-over onto the telecom cable):** Coupling onto a nearby metal line grows with frequency, so higher frequencies bleed over more.

### Circuit resistance

- **Circuit resistance, steel main:** Resistance the transmitter sees when hooked up to the steel main.
- **Circuit resistance, tracer wire:** Resistance the transmitter sees when hooked up to the tracer wire on the plastic main.

Unit: Ω.

| | 512 Hz | 8 kHz | 33 kHz | 83 kHz |
|---|---|---|---|---|
| Steel main | 60 | 56 | 52 | 48 |
| Tracer wire | 500 | 490 | 480 | 470 |

**Why (circuit resistance, steel main):** A long, well-grounded metal main is a good circuit at every frequency. Higher frequencies find a little more path through the soil.

**Why (circuit resistance, tracer wire):** A thin wire grounded at its far end makes a higher-resistance circuit than a big steel main, so less current flows.

### Transmitter output

Voltage the generic transmitter drives into the circuit.

**Value:** 50 V

**Why:** An illustrative output that gives readings in a familiar range.

### Transmitter internal resistance

Resistance inside the transmitter, in series with the circuit.

**Value:** 50 Ω

**Why:** Keeps the current on a good circuit in the hundreds of milliamps rather than unlimited.

### Enough signal to trace

The target current the lab treats as enough to trace at the far end of the block. A frequency "works" when it meets this.

**Value:** 20 mA

**Why:** An illustrative threshold. Real needs depend on depth, soil and the receiver.

## The eight states, computed

| Setup | Frequency | Transmitter | Resistance | Far end of block | Telecom at hookup | Works? |
|---|---|---|---|---|---|---|
| Steel main | 512 Hz | 454.5 mA | 60 Ω | 410.6 mA | 9.1 mA | Yes |
| Steel main | 8 kHz | 471.7 mA | 56 Ω | 297.8 mA | 28.3 mA | Yes |
| Steel main | 33 kHz | 490.2 mA | 52 Ω | 135.9 mA | 73.5 mA | Yes |
| Steel main | 83 kHz | 510.2 mA | 48 Ω | 35.8 mA | 163.3 mA | Yes |
| Plastic main (tracer wire) | 512 Hz | 90.9 mA | 500 Ω | 84.6 mA | 1.8 mA | Yes |
| Plastic main (tracer wire) | 8 kHz | 92.6 mA | 490 Ω | 67.7 mA | 5.6 mA | Yes |
| Plastic main (tracer wire) | 33 kHz | 94.3 mA | 480 Ω | 35.7 mA | 14.2 mA | Yes |
| Plastic main (tracer wire) | 83 kHz | 96.2 mA | 470 Ω | 21.2 mA | 30.8 mA | Yes |

**Lowest frequency that works:** Steel main: 512 Hz; Plastic main (tracer wire): 512 Hz.
