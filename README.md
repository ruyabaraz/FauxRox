Bunu **README.md’nin tamamı olarak** eski metnin yerine koy. Submission hikâyesini özellikle v1 → v2 dönüşümü üzerinden kurdum; teknik ama jürinin okuyabileceği kadar temiz.

````markdown
# FauxRox

**FauxRox is an adaptive spatial fitness framework and HYROX-inspired training experience for Spectacles.**

Originally built as a realtime AR race engine, FauxRox now supports two experiences:

- **Race** — the original HYROX-inspired spatial race
- **Training** — dynamically generated Running, Strength, Engine and Mixed sessions adapted to the athlete, available space and session duration

The update turns the original fixed race architecture into a more modular training system with space-aware workout generation, evidence-based running personalization, persistent training history, voice-based session setup and training-specific analytics.

Built for **Snap Spectacles with Lens Studio 5.x**.

---

## What's New

The original FauxRox was centered around a custom race state machine.

This update keeps the Race experience while separating the new training logic into a reusable, data-driven core.

### Adaptive Training Generator

Training sessions are generated from:

- available space
- session duration
- training focus
- athlete fitness level
- recent training history
- available running-performance evidence

Four training focuses are supported:

- **RUNNING**
- **STRENGTH**
- **ENGINE**
- **MIXED**

Focus changes the actual structure of the workout — not simply which exercise is selected.

Strength sessions use loaded strength-endurance structures, Engine rotates conditioning modalities, Running uses dedicated running archetypes, and Mixed combines running and stations into compromised-work sessions.

---

## Space-Aware Training

FauxRox does not assume a fixed gym layout.

Spatial work is generated around the athlete's calibrated environment.

Travelling movements such as:

- carries
- crawls
- lunges
- burpee broad jumps

can use shuttle structures in smaller spaces while preserving the intended total workload.

Locomoting work also relocates the training zone to the athlete's new position, allowing the workout to move naturally through the environment.

Running is treated differently: if the available space cannot honestly support the intended running stimulus, FauxRox does not silently shorten the workout and call it the same session.

---

## Running Physiology Layer

Running is now a first-class training system rather than a generic distance interval.

FauxRox supports five running archetypes:

| Archetype | Purpose |
|---|---|
| `EASY_BASE` | Continuous conversational running |
| `HYROX_PACE` | Clean HYROX race-pace practice |
| `THRESHOLD` | Controlled threshold intervals |
| `VO2` | Higher-intensity aerobic intervals |
| `SPEED_REPETITION` | Short, high-quality repetitions with generous recovery |

Each archetype owns its own:

- work structure
- canonical distances or durations
- minimum meaningful dose
- recovery type
- recovery duration
- effort cue

The generator adjusts how many repetitions fit the requested session duration, but does not distort the canonical workout simply to fill time.

---

## Evidence-Based Pace Personalization

FauxRox distinguishes between an internal model used for duration estimation and actual athlete-specific evidence.

**Model pace estimates are never presented to the athlete as their personal pace.**

Personal pace targets are only created when supported by evidence.

Supported evidence includes:

### Recent 5K

When Running is selected, the athlete can optionally enter a recent 5K time.

That raw performance is stored as evidence and pace ranges are derived dynamically using a Daniels-Gilbert-style running model.

The system can derive provisional ranges for:

- Easy
- Threshold
- VO2
- Speed Repetition

HYROX pace is intentionally not inferred from a road 5K.

### HYROX Race History

Completed race run splits can provide HYROX-specific pace evidence.

This evidence is used **only for `HYROX_PACE`** and is never converted into threshold or VO2 performance.

### Training Observations

Measured training runs are stored as observations rather than immediately treated as physiological truth.

Threshold observations require repeated agreement across multiple sessions before they can become a calibration anchor.

In other words:

```text
Observation ≠ Anchor
````

If FauxRox does not have enough evidence, it simply gives the athlete an effort cue instead of inventing a pace.

---

## Training Scheduling

Training history is persistent.

Running selection includes a lightweight scheduling policy designed to avoid repeatedly stacking demanding sessions.

For example:

* Easy sessions may repeat
* Recent quality sessions can temporarily block another quality session
* Recent repetition is treated as a preference, not as universal workout law

The current quality-recovery window is a **v1 coaching policy**, not a claim that every athlete requires exactly the same recovery.

FauxRox intentionally does not impose a global 80/20 or polarized-training distribution because it cannot see the athlete's complete training outside the Lens.

---

## Voice-Based Session Setup

Training can be configured through the UI or through the AI coach.

Instead of manually selecting every option, the athlete can tell FauxRox what they want to do.

For example:

```text
I have about twenty minutes.
I want to work on strength.
I don't have much space.
```

The coach extracts only information the athlete actually provides and asks for missing constraints rather than inventing them.

The AI does not choose arbitrary exercises itself — it provides constraints to the deterministic workout generator.

---

## Modular Training Core

The new training architecture separates pure training logic from Lens Studio runtime behavior.

Core systems such as:

* workout generation
* running archetypes
* duration fitting
* recovery policies
* training scheduling
* pace derivation
* training analysis

are implemented as pure TypeScript modules without Lens Studio runtime dependencies.

Lens Studio components handle:

* sensors
* spatial execution
* UI
* hand tracking
* audio
* cloud access
* Spectacles-specific runtime state

while the training core determines what the workout means.

This allows the training logic to be tested independently of the headset and makes the exercise catalogue and session framework easier to extend.

The current project includes **1,648 automated tests** covering generator invariants, duration fitting, running physiology, recovery, preview separation, analytics and scheduling behavior.

---

# Race Mode

The original FauxRox Race experience remains available.

It runs a complete HYROX-inspired spatial race:

```text
Onboarding
→ Bluetooth HR flow
→ Ground calibration
→ Start
→ Run
→ Station
→ Run
→ Station
→ ...
→ Finish
→ Results
```

The Race mode includes:

* dynamic station spawning
* movement tracking
* run-distance tracking
* start and finish gates
* split timing
* heart-rate integration
* Gemini Live coaching
* personal-best comparison
* Supabase persistence
* leaderboard support

---

## Race Stations

| # | Station             | Mode       | Tracking                            |
| - | ------------------- | ---------- | ----------------------------------- |
| 1 | Air SkiErg          | `ZONE_HIT` | Hand pull-down detection            |
| 2 | Dumbbell Bear Crawl | `DISTANCE` | Camera distance + form cues         |
| 3 | Goblet Reverse Walk | `DISTANCE` | Camera distance                     |
| 4 | Burpee Broad Jump   | `REPS`     | Drop / rise / forward displacement  |
| 5 | Standing Row        | `ZONE_HIT` | Backward-pull hand tracking         |
| 6 | Heavy Carry         | `DISTANCE` | Camera distance                     |
| 7 | DB Walking Lunges   | `DISTANCE` | Camera distance + movement feedback |
| 8 | Squat Target Reach  | `ZONE_HIT` | Overhead target reach               |

---

## Movement Tracking

Different exercises use different tracking strategies.

| System                     | Detection                              |
| -------------------------- | -------------------------------------- |
| Hand zones                 | SkiErg, Row, target-reaching movements |
| Camera displacement        | Carries, crawls, lunges                |
| Drop / rise / displacement | Burpee Broad Jump                      |
| Timed prescription         | Holds and timed movements              |
| Path accumulation          | Travelling distance work               |
| Run tracking               | Distance- and time-prescribed running  |

The training generator is separate from these detectors: movement definitions describe what a session requires, while the Spectacles runtime handles how that work is observed.

---

## Spatial Execution

FauxRox uses Spectacles-specific spatial systems including:

* floor calibration
* athlete-relative spawning
* persistent training zones
* start and finish gates
* run guidance
* movement-specific guides
* hand-tracked rep feedback
* locomotion-aware zone relocation

The goal is for the workout to exist in the athlete's environment rather than as a conventional 2D workout overlay.

---

## Bluetooth Heart Rate

`HeartRateTracker.ts` supports Bluetooth Low Energy heart-rate monitors using the standard Heart Rate service.

* Service UUID: `0x180D`
* Characteristic UUID: `0x2A37`

The system supports:

* scanning
* device selection
* GATT connection
* notification registration
* BPM parsing
* HR zones
* average HR
* peak HR

Heart rate is optional. FauxRox continues to work without a connected monitor.

---

## AI Coach

`AICoach.ts` connects to Gemini Live through Lens Studio Remote Service Gateway.

The coach supports:

* realtime voice interaction
* workout setup
* exercise questions
* contextual coaching
* pause / resume / stop controls
* short motivational cues
* post-session summaries

Training and Race use different semantics.

Training is not treated as a race: there is no personal-best verdict or leaderboard framing unless the athlete is actually using Race mode.

The coach is also constrained not to make performance claims that FauxRox did not measure.

---

## Training Analytics

Training analysis is separate from Race analysis.

Depending on the prescription, FauxRox can evaluate:

* seconds per repetition
* seconds per metre
* run pace
* pace fade
* repetition consistency
* target-band alignment when a real pace target exists

Different movements are never ranked against one another as if their numbers were directly comparable.

Preview-mode measurements are also excluded from persistent history and performance analytics.

---

## Preview vs Production

Lens Studio Preview deliberately shortens some movements so the full experience can be tested without performing a complete workout.

For example:

```text
15:00 prescribed run
→ shortened runtime execution in Preview
```

The prescription itself remains unchanged.

Preview execution data is never allowed to contaminate:

* training history
* personal bests
* pace calibration
* cloud race results
* competitive analytics

---

## Cloud

FauxRox uses Supabase through Snap Cloud for features including:

* Snapchat authentication
* profile persistence
* race history
* personal bests
* leaderboard data
* AI context

Training history and pace evidence also have dedicated semantics so race performance, training observations and generated-session state are not treated as the same kind of data.

---

## Project Architecture

```text
Assets/
  Scripts/
    RaceStateMachine.ts
    CourseManager.ts
    SessionTypes.ts

    AdaptiveGenerator.ts
    TrainingPrescription.ts
    TrainingHistory.ts
    TrainingAnalysis.ts

    RunningArchetypes.ts
    PaceModel.ts
    PaceEvidence.ts

    HandZoneDetector.ts
    HeartRateTracker.ts
    BLEConnectionUI.ts

    AICoach.ts
    MotivationalShouts.ts

    CloudManager.ts
    ProfileManager.ts

    GroundCalibration.ts
    RunArrowGuide.ts
    WristMenu.ts

    SessionPickerUI.ts
    OnboardingUI.ts
```

The exact filenames may evolve, but the architectural boundary is intentional:

```text
Pure training logic
        ↓
Session prescription
        ↓
Spectacles runtime execution
        ↓
Measured results
        ↓
Training history / analysis / future personalization
```

---

## Setup

1. Install Lens Studio 5.x.
2. Clone this repository.
3. Open the FauxRox Lens Studio project.
4. Configure required services / packages:

   * Remote Service Gateway / Gemini
   * Supabase Snap Cloud
   * Bluetooth Central Module
5. Configure the required Lens Studio scene references.
6. Connect Spectacles.
7. Push the Lens to the device.
8. Test in a safe movement area.

---

## Requirements

* Snap Spectacles
* Lens Studio 5.x
* Internet connection for Gemini Live and cloud functionality
* Bluetooth heart-rate monitor — optional
* Supabase project — required for cloud-backed features

---

## Safety

FauxRox is an experimental spatial fitness prototype.

Use it only in an appropriate movement environment with enough clear space.

Do not use it near:

* traffic
* stairs
* obstacles
* unstable surfaces
* crowded areas

Stop immediately if you feel pain, dizziness or discomfort.

---

## Version History

### v2 — Adaptive Training Framework

Adds:

* adaptive Training mode
* Running / Strength / Engine / Mixed focuses
* space-aware workout generation
* modular pure-TypeScript training core
* training history and scheduling
* running physiology layer
* evidence-based pace personalization
* voice-based session setup
* training-specific analytics
* adaptive recovery
* improved spatial training behavior

### v1 — Realtime AR Race Engine

The original FauxRox release:

* HYROX-inspired Race mode
* custom race state machine
* dynamic stations
* movement tracking
* Bluetooth HR
* Gemini Live coaching
* Supabase results and leaderboards

---

## Status

Built as an open-source Spectacles project for the Lenslist / Snap AR Spectacles Community Challenge.

FauxRox v2 was developed as an update to the original project, with a particular focus on turning the race-specific architecture into a more adaptive and reusable training system.

---

## License

MIT

```

