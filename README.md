# FauxRox

**FauxRox is an adaptive spatial fitness framework for Spectacles.**

It runs the original HYROX-inspired AR race — and now composes training sessions for the athlete and the space they have.

Movement tracking, Bluetooth heart rate, Gemini Live voice coaching, Supabase cloud persistence, personal bests, dynamic station spawning, and a training layer that turns stated constraints into a session.

Built with **Lens Studio 5.15.4**, for **Spectacles (2024)**.

---

## Two modes

**Race** is the original eight-station competitive course, unscaled, and it is what counts for a personal best and the leaderboard. What this update changed for it: the runs in a finished race now contribute measured evidence of the pace that athlete holds between stations — which nothing else can measure — and the countdown and start gun are gated on what a session is rather than on what it will count for.

**Training** did not exist before this update. The athlete chooses — or tells the coach — how much space they have, how long they have and what they want to work on, and the generator composes the session from it: distances, rounds, recovery, dose. It then runs through the same engine the race does.

Race Day was the whole Lens before this update. It remains the competitive core of FauxRox.

---

## The training framework is separate from the Lens

Session generation, running physiology, scheduling, pace derivation and post-session analysis are **pure TypeScript with no Lens Studio imports**. They run in plain Node and are covered by **1,856 assertions that need no headset**.

```text
Pure training modules            no Lens Studio imports, no scene, no device
  AdaptiveSessionGenerator         what a session is
  RunningArchetype / Schedule      what a running session is
  PaceModel / PaceTarget           what may be said about an athlete's pace
  TrainingAnalysis / RaceAnalysis  what a finished session did
         ↓  read by
Lens Studio runtime shells       scene objects, sensors, UI, audio
  RaceStateMachine · CourseManager · SessionPickerUI · OnboardingUI
```

Both halves live under `Assets/Scripts` because Lens Studio compiles that folder; the boundary is the import list, not the directory. A module in the top half imports nothing from Lens Studio and can be lifted out of the Lens as it stands.

Every rule that can be stated without a headset is stated without one: what follows what in the picker, which archetypes a duration can hold, how a pace band is derived, what a session is allowed to say about an athlete. The shells own scene objects and nothing else.

```bash
cd FauxRox.v9/Tests
npm install
npm test          # everything, ~3.5 min
npm run test:fast # everything but the two sweeps, ~10 s
```

---

## Adaptive sessions

```
SPACE      SMALL | NORMAL          chosen, or said out loud
DURATION   SHORT | MEDIUM | FULL   11-20 · 21-29 · 31-45 minutes
FOCUS      RUNNING | ENGINE | STRENGTH | MIXED
LEVEL      BEGINNER | REGULAR | ATHLETE   from their profile
```

The generator adapts the shape of the session rather than swapping exercises:

- **Blocks, rounds and dose** are fitted to the duration band, and the fit is checked at all three levels so a beginner and an athlete get the same session at different doses rather than two different sessions.
- **A small space** turns travelling work into shuttles that preserve the intended workload.
- **Running is refused** in a small space rather than shortened. A shortened run is a different session wearing the same name, so the focus is cleared and the athlete is asked again — never quietly substituted.
- **Recovery is earned by the bout it follows**, not a flat number.
- **Movements the athlete just did** are pushed down the ranking, and a station named as their limiter pulls the accessories that develop it up.

Sessions are deterministic: the same request and seed always produce the same session, and the seed moves when a session is finished or abandoned.

---

## Running

Running is five session types, each with its own topology rather than a distance and a stopwatch:

| Archetype | Shape | Distances | Recovery | Minimum dose |
|---|---|---|---|---|
| `EASY_BASE` | continuous | 15 / 24 / 36 min | — | 10 min |
| `HYROX_PACE` | reps | 1000 m | 30% · easy jog | 3 reps |
| `THRESHOLD` | reps | 800 / 1000 / 1200 m | 15% · float jog | 2400 m |
| `VO2` | reps | 600 / 800 / 1000 m | 85% · easy jog | 8 min |
| `SPEED_REPETITION` | reps | 150 / 200 / 300 m | 400% · walk or jog | 6 reps |

A session is only offered an archetype the available time can genuinely hold at a dose worth the name. Scheduling will not stack a hard session on top of another hard session, and prefers a different kind of quality to the same one twice.

**A run's clock counts running, not waiting.** Distance comes from where the athlete actually went; standing at a crossing does not enter the average as very slow running.

---

## Pace targets come from evidence, or they do not exist

Three sources, each allowed to speak for exactly what it measured:

| Source | Evidence | Answers for |
|---|---|---|
| `5K_ENTRY` | a recent 5K the athlete enters | every archetype except race pace |
| `HYROX_HISTORY` | measured runs from their own races | race pace only |
| `CALIBRATION` | their own threshold sessions, agreeing | every archetype except race pace |

- Bands are **derived on every read** from stored evidence, never persisted. A better model improves everyone's paces on their next session rather than only new athletes'.
- **Race pace is measured, not modelled.** No road running predicts what somebody holds over eight kilometres with eight stations between them.
- **An observation is not an anchor.** Five threshold repetitions across two sessions, agreeing to within twenty seconds a kilometre, promote to a fitness index. Anything less stays an observation.
- **With no evidence there is no number.** The athlete is told how the effort should feel, which is the prescription in that state rather than a fallback for it.

The model is Daniels–Gilbert: a fitness index from a race result, and paces derived from their own physiological meanings rather than by scaling one anchor.

---

## Setting a session up by talking

On the setup panel the athlete can say what they are up for instead of tapping.

```
"Twenty minutes, small space, strength."
→ SMALL / SHORT / STRENGTH → ready to start
```

- It records **only what was actually said**. Nothing missing is invented.
- Whatever is missing is asked **once**, out loud, highest priority first — space, then duration, then focus — and whatever is still missing after that is the buttons, which never went anywhere.
- The turn is **bounded**: it ends when the session is described, when nothing is said for twelve seconds, when the athlete goes back, or when the panel closes.
- What is on screen is **what was understood**, not the transcript.
- It **never starts a session**. Both paths end on the same ready screen.

---

## Race engine

`RaceStateMachine.ts` controls the full lifecycle:

```
Onboarding
→ Bluetooth HR flow
→ Ground calibration
→ Countdown            (race only — a training session has no start gun)
→ Start line crossing
→ Run segment
→ Station approach
→ Station execution
→ Next run segment
→ Finish gate crossing
→ Summary
→ Cloud save           (race only)
```

The engine tracks elapsed and pause-adjusted time, run distance and moving time, station progress, split durations, average and peak heart rate, block and round position, and the outcome the session is allowed to claim.

**One eligibility policy** decides what a session may become — a leaderboard entry, a personal best, a line in the athlete's history — asked in every place the answer matters, so the panel, the cloud save and the personal-best check cannot disagree. A preview-simplified session counts for nothing and is still, in every other respect, the session.

---

## Dynamic course

`CourseManager.ts` defines the course as station configuration data rather than a fixed scene. Stations spawn relative to the athlete's position and heading, so the course follows the runner through the available space.

A station config carries its name, mode, requirement, instruction, prefab type, the run before it, its motion detection type, and — for generated sessions — its block, round, archetype and pace target.

---

## Motion detection

| System | Detection | Used by |
|---|---|---|
| `AIR_SKIERG` | hands high → pull down | Air SkiErg |
| `BACKWARD_PULL` | arms extended → pull back | Standing Row |
| `OVERHEAD_REACH` | squat → reach toward target | Squat Target Reach |
| Camera drop / rise / jump | vertical drop, rise, forward displacement | Burpee Broad Jump |
| Camera distance | world-space movement, floor-projected | carries, crawls, lunges, runs |
| Camera bounce | vertical rhythm | walking-lunge form feedback |

### Race stations

| # | Station | Mode | Tracking |
|---|---|---|---|
| 1 | Air SkiErg | `ZONE_HIT` | hand pull-down |
| 2 | Dumbbell Bear Crawl | `DISTANCE` | camera distance + form cues |
| 3 | Goblet Reverse Walk | `DISTANCE` | camera distance |
| 4 | Burpee Broad Jump | `REPS` | drop / rise / jump validation |
| 5 | Standing Row | `ZONE_HIT` | backward pull |
| 6 | Heavy Carry | `DISTANCE` | camera distance |
| 7 | DB Walking Lunges | `DISTANCE` | camera distance + bounce |
| 8 | Squat Target Reach | `ZONE_HIT` | overhead reach |

Training sessions draw on these plus an accessory catalogue — push ups, burpees over dumbbell, holds, carries, jumps — declared as data with the movement they develop, so the generator pairs accessories to the stations they support.

---

## Bluetooth heart rate

`HeartRateTracker.ts` implements the standard BLE Heart Rate service.

- service `0x180D`, characteristic `0x2A37`
- scanning, device selection, GATT connection, notification registration, BPM parsing
- live BPM, HR zones, session average and peak
- editor-mode simulation

Max heart rate is estimated from the birth year given at onboarding. FauxRox works without a monitor; connecting one adds pacing feedback, split stats and coaching context.

---

## AI coach

`AICoach.ts` connects to **Gemini Live** through the Lens Studio Remote Service Gateway: realtime audio, ASR input, push-to-talk and continuous modes, interruption handling, mute, motivational shouts, form reminders and session narration.

The coach reads what happened rather than guessing at it — splits measured against what was expected of them, and for a training session, the training analysis instead of a race verdict, because they are different questions with different answers available.

### Function calling

| Function | Purpose |
|---|---|
| `pauseSession` | pause whatever is running |
| `resumeSession` | resume it |
| `stopSession` | end it early |
| `prescribeSession` | choose space, duration and focus for a complete session |
| `setSessionIntent` | report only what the athlete just said while they set one up |
| `compareWithUser` | compare personal bests by name from cloud history |

The coach chooses parameters; it never writes a workout. Everything it sends is validated against the same closed sets the picker offers — the generator's own lists, not a copy of them — so a hallucinated movement or an impossible request cannot reach the athlete.

---

## Supabase Snap Cloud

`CloudManager.ts` integrates Supabase through `supabase-snapcloud`: Snapchat authentication, profile upsert, race history, personal best lookup, leaderboard queries, name search, and cloud context for coaching.

```
profiles
race_history
leaderboard
```

Only races that count for ranking are written. A training session and a preview-simplified race never reach the race table, which is what keeps a personal best comparable to the races it is compared against.

---

## Onboarding and personalization

Display name, birth year, fitness level, goal, guest mode. Used for coaching tone, HR zones, session dose, goal-aware motivation and result identity. Guest mode skips cloud entirely.

---

## What the athlete sees

- one question at a time when setting a session up, ending on a ready screen showing the session itself
- a card at the start of each block — the movements, the rounds, roughly how long — which then clears, so the middle of the view is the room rather than a list
- `+1` rep popups, station name zoom, countdown punch, run arrows, station guides, form chimes, finish VFX
- a post-session summary written from what was measured, and nothing that was not

---

## Project structure

```text
FauxRox.v9/
  Assets/Scripts/
    ── pure logic (no Lens Studio imports, fully tested) ──
    AdaptiveSessionGenerator.ts   Session composition from stated constraints
    TrainingPrescription.ts       Duration bands, recovery policy, level dose
    SessionTypes.ts               Stations, blocks, runs, plans
    RunningArchetype.ts           Five running session types and their topology
    RunningSchedule.ts            What to give an athlete today
    RunningAnalysis.ts            Pace, fade and spread across a session
    PaceModel.ts                  Daniels-Gilbert fitness index and bands
    PaceTarget.ts                 Which evidence may speak for which session
    PaceEvidence.ts               Stored evidence; bands derived, never stored
    PaceMeter.ts                  Rolling pace over a live run
    MovingClock.ts                A run's clock counts running, not waiting
    PathTracker.ts                Floor-projected distance from head position
    PickerFlow.ts                 One question at a time, and voice intent
    BlockIntro.ts                 What a block holds, said before it starts
    TrainingAnalysis.ts           What a session did, from what was measured
    TrainingHistory.ts            Completions, recency, deterministic seed
    RaceAnalysis.ts               Splits against what was expected of them
    RaceComparability.ts          When two races may be compared
    SessionEligibility.ts         What a session is allowed to become
    SessionSemantics.ts           The words each session kind is described in
    SpeechLifecycle.ts            One listening turn, one answer
    BirthYear.ts / EffortCue.ts / RaceResult.ts

    ── runtime shells ──
    RaceStateMachine.ts           Lifecycle, timing, station flow, HUD
    CourseManager.ts              Station config and spawning
    SessionPickerUI.ts            Setup panel, voice turn, pace evidence entry
    OnboardingUI.ts               Profile setup
    AICoach.ts                    Gemini Live voice coach
    CloudManager.ts               Supabase persistence
    ProfileManager.ts             Profile, history, pace evidence
    HeartRateTracker.ts           BLE heart rate
    HandZoneDetector.ts           Hand-tracked movement detection
    GroundCalibration.ts          Floor detection
    RunArrowGuide.ts / WristMenu.ts / LeaderboardController.ts
    BLEConnectionUI.ts / MotivationalShouts.ts / StartTrigger.ts

  Tests/                          35 suites, 1,856 assertions, no headset
```

---

## Setup

1. Install Lens Studio 5.x.
2. Clone this repository and open `FauxRox.v9` in Lens Studio.
3. Install the required packages: Remote Service Gateway (Gemini), Supabase Snap Cloud, Bluetooth Central Module, Spectacles Interaction Kit, Spectacles UI Kit.
4. Assign the Supabase project asset.
5. Connect Spectacles and push the Lens.
6. Test in a clear, safe open space.

To run the logic tests without Lens Studio:

```bash
cd FauxRox.v9/Tests && npm install && npm test
```

## Requirements

- Spectacles (2024)
- Lens Studio 5.x
- Bluetooth heart-rate monitor — optional
- Supabase project — optional, for cloud features
- Internet connection for Gemini Live and cloud features

## Safety

FauxRox is an experimental AR fitness prototype.

Use it only in a safe open area with enough space to move. Do not use it near traffic, stairs, obstacles, unstable surfaces or crowded areas. Stop immediately if you feel pain, dizziness or discomfort.

## Status

Built as an open-source Spectacles project for the Lenslist / Snap AR Spectacles Community Challenge.

## License

MIT
