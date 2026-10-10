<!-- Generated from src/signal/constants.ts by `npm run docs`. Do not edit by hand. -->

# Frequency Lab signal model

The lab shows eight states: two setups × four frequencies. The model is a small, pure function of setup and frequency, not a circuit solver. Every value below is a teaching calibration, chosen so the lab behaves the way experienced locators expect, and pending their review.

## What it models

- **Fade:** each line's current falls off exponentially along its length, at a rate set per line type and per frequency. What fades leaks into the soil.
- **Bleed-over:** along the parallel run, the telecom cable carries a share of the target's current, set per frequency. It flows back toward the stake, in the return direction.
- **The break:** in the plastic-main setup, a share of the tracer's current crosses the break, set per frequency. What doesn't cross leaks into the soil at the break.
- **Earth return:** everything that leaves the target returns to the ground stake. That includes the fade, what's lost at the break, and what continues past the chart. The telecom cable's share is part of that return, not added to it.
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

### Break position

Where the tracer wire is broken, measured from the hookup.

**Value:** 70 ft

**Why:** Mid-block, so both sides of the break are in view.

### Water main crossing

Where the unconnected water main crosses the target line, measured from the hookup.

**Value:** 100 ft

**Why:** Inside the block and away from the break, so it reads as a separate feature.

### Fade along the line

- **Fade on the coated steel main:** Share of the current still on the steel main after another 100 ft. The rest leaks into the soil.
- **Fade on the tracer wire:** Share of the current still on the tracer wire after another 100 ft. The rest leaks into the soil.

Unit: share left per 100 ft.

| | 512 Hz | 8 kHz | 33 kHz | 83 kHz |
|---|---|---|---|---|
| Coated steel main | 0.97 | 0.93 | 0.85 | 0.72 |
| Tracer wire | 0.98 | 0.95 | 0.88 | 0.78 |

**Why (fade on the coated steel main):** Higher frequencies leak through the pipe coating into the soil more easily, so they fade sooner.

**Why (fade on the tracer wire):** The same trend as the steel main. A thin insulated wire leaks a little less at every frequency.

### Bleed-over onto the telecom cable

- **Bleed-over onto the telecom cable:** Current on the parallel telecom cable as a share of the target current at the same spot. It flows back toward the stake.

Unit: share of target current.

| | 512 Hz | 8 kHz | 33 kHz | 83 kHz |
|---|---|---|---|---|
| Telecom cable | 0.02 | 0.06 | 0.15 | 0.32 |

**Why (bleed-over onto the telecom cable):** Coupling onto a nearby metal line grows with frequency, so higher frequencies bleed over more.

### Crossing the break

- **Crossing the break:** Share of the tracer current that gets past the break through the soil. The rest leaks into the soil at the break.

Unit: share of current at the break.

| | 512 Hz | 8 kHz | 33 kHz | 83 kHz |
|---|---|---|---|---|
| Tracer break | 0.01 | 0.04 | 0.45 | 0.65 |

**Why (crossing the break):** Higher frequencies couple across a gap more easily, so they can jump a break that stops low ones.

### Circuit resistance

- **Circuit resistance, steel main:** Resistance the transmitter sees when hooked up to the steel main.
- **Circuit resistance, broken tracer:** Resistance the transmitter sees when hooked up to the broken tracer wire.

Unit: Ω.

| | 512 Hz | 8 kHz | 33 kHz | 83 kHz |
|---|---|---|---|---|
| Steel main | 60 | 56 | 52 | 48 |
| Broken tracer | 4000 | 2200 | 650 | 320 |

**Why (circuit resistance, steel main):** A long, well-grounded metal main is a good circuit at every frequency.

**Why (circuit resistance, broken tracer):** The break makes a poor circuit. Higher frequencies find paths through the soil, so resistance falls.

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
| Steel main | 512 Hz | 454.5 mA | 60 Ω | 435.6 mA | 9.1 mA | Yes |
| Steel main | 8 kHz | 471.7 mA | 56 Ω | 426.1 mA | 28.3 mA | Yes |
| Steel main | 33 kHz | 490.2 mA | 52 Ω | 390.4 mA | 73.5 mA | Yes |
| Steel main | 83 kHz | 510.2 mA | 48 Ω | 322.1 mA | 163.3 mA | Yes |
| Plastic main, broken tracer | 512 Hz | 12.3 mA | 4000 Ω | 0.1 mA | 0.2 mA | No |
| Plastic main, broken tracer | 8 kHz | 22.2 mA | 2200 Ω | 0.8 mA | 1.3 mA | No |
| Plastic main, broken tracer | 33 kHz | 71.4 mA | 650 Ω | 26.9 mA | 10.7 mA | Yes |
| Plastic main, broken tracer | 83 kHz | 135.1 mA | 320 Ω | 62.0 mA | 43.2 mA | Yes |

**Lowest frequency that works:** Steel main: 512 Hz; Plastic main, broken tracer: 33 kHz.
