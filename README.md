
# FauxRox

**FauxRox is a realtime AR race engine for Spectacles.**

It combines movement tracking, Bluetooth heart-rate data, Gemini Live voice coaching, Supabase cloud persistence, personal-best comparison, and dynamic station spawning into one hands-free fitness race lens.

This is not a static workout overlay. FauxRox runs a full HYROX-inspired race loop on Spectacles: the athlete calibrates the ground, crosses a start line, runs between dynamically spawned stations, completes movement-tracked exercises, gets short AI coaching, finishes through a real finish gate, and saves race results to the cloud.

Built with **Lens Studio 5.x**, **TypeScript**, **Spectacles**, **Gemini Live**, **Bluetooth LE**, and **Supabase Snap Cloud**.

## Demo

Add demo video here.

Recommended demo structure:

1. Onboarding and goal selection
2. Bluetooth heart-rate connection
3. Ground calibration and start line
4. Run arrow guidance
5. Hand-tracked station
6. Burpee hard-gate station
7. AI coach question
8. Finish gate and race summary

## Core Systems

### Realtime Race Engine

`RaceStateMachine.ts` controls the full race lifecycle:

```text
Onboarding
→ Bluetooth HR flow
→ Ground calibration
→ Countdown
→ Start line crossing
→ Run segment
→ Station approach
→ Station execution
→ Next run segment
→ Finish gate crossing
→ Race summary
→ Cloud save
```

The engine tracks:

- elapsed race time
- pause-adjusted timing
- run distance
- station progress
- split durations
- average and peak heart rate
- current station context
- personal best comparison
- finish state
- stopped / completed race outcomes

The race flow is split into explicit states so stations do not accidentally start before the athlete reaches the station line, and the finish behaves like an actual race crossing rather than an instant UI transition.

### Dynamic Course System

`CourseManager.ts` defines the race as station configuration data instead of hardcoded one-off scenes.

Stations are spawned dynamically relative to the athlete’s current position and heading. This means FauxRox does not depend on a fixed physical map; the course follows the runner through the available space.

Each station config includes:

- station name
- station mode
- completion requirement
- movement instruction
- prefab type
- run distance before station
- optional motion detection type
- finish marker handling

### XR Interaction Systems

FauxRox includes several Spectacles-specific interaction systems:

- ground calibration with floor-height detection and Y-offset correction
- player-relative station spawning
- start, station, and finish gate crossing logic
- run-arrow guidance during run segments
- station-specific visual guides
- SkiErg pull-down guide animations
- wrist menu auto-hide during two-handed stations to reduce accidental input
- animated rep feedback with pop / float / fade motion
- finish gate VFX and finish panel flow

## Motion Detection

FauxRox uses different tracking strategies depending on the station.

| Motion System | Detection | Used By |
|---|---|---|
| `AIR_SKIERG` | Hands high → pull down | Air SkiErg |
| `BACKWARD_PULL` | Arms extended → pull back toward body | Standing Row |
| `OVERHEAD_REACH` | Squat / reach up toward target | Squat Target Reach |
| Camera drop / rise / jump | Camera Y drop + rise + forward displacement | Burpee Broad Jump |
| Camera distance tracking | World-space camera movement | Carry, crawl, lunge-style stations |
| Camera bounce feedback | Vertical camera rhythm | Walking lunges form feedback |

## Race Stations

| # | Station | Mode | Tracking |
|---|---|---|---|
| 1 | Air SkiErg | `ZONE_HIT` | Hand pull-down detection |
| 2 | Dumbbell Bear Crawl | `DISTANCE` | Camera distance + form cues |
| 3 | Goblet Reverse Walk | `DISTANCE` | Camera distance |
| 4 | Burpee Broad Jump | `REPS` | Drop / rise / forward jump validation |
| 5 | Standing Row | `ZONE_HIT` | Backward pull hand tracking |
| 6 | Heavy Carry | `DISTANCE` | Camera distance |
| 7 | DB Walking Lunges | `DISTANCE` | Camera distance + bounce feedback |
| 8 | Squat Target Reach | `ZONE_HIT` | Overhead target reach |

## Bluetooth Heart Rate

`HeartRateTracker.ts` implements Bluetooth Low Energy heart-rate support using the standard Heart Rate service.

- HR service UUID: `0x180D`
- HR characteristic UUID: `0x2A37`

The heart-rate system handles:

- BLE scanning
- device selection
- GATT connection
- HR service discovery
- notification registration
- BPM parsing
- live BPM display
- HR zone calculation
- session average HR
- session peak HR
- editor-mode HR simulation

The athlete’s birth year from onboarding is used to estimate max heart rate and personalize HR zones.

FauxRox still works without a heart-rate monitor, but connecting one unlocks better pacing feedback, split stats, and AI coaching context.

## AI Coach

`AICoach.ts` connects to **Gemini Live** through Lens Studio Remote Service Gateway.

The coach supports:

- realtime audio responses
- push-to-talk mode
- continuous toggle mode
- ASR voice input
- interruption when the user starts speaking
- mute mode
- short exercise-safe responses
- motivational shouts
- form reminders
- race summary narration
- cloud-aware personal best and leaderboard context

The AI coach receives live context from:

- race state
- current station
- next station
- station instructions
- exercise guide
- elapsed time
- heart rate
- HR zone
- user profile
- fitness level
- personal goal
- personal best
- leaderboard data
- cloud race history

Example voice prompts:

```text
How do I do this movement?
How am I doing?
Should I slow down?
Compare me with John.
Pause the race.
Resume.
Stop the race.
```

### Gemini Function Calling

The coach can trigger race actions through Gemini function calls:

| Function | Purpose |
|---|---|
| `pauseRace` | Pause the current race |
| `resumeRace` | Resume after pause |
| `stopRace` | End the race early |
| `compareWithUser` | Search cloud race history and compare PBs by name |

## Supabase Snap Cloud

`CloudManager.ts` integrates Supabase through `supabase-snapcloud`.

Cloud features:

- Snapchat authentication
- profile upsert
- race history save
- completed race filtering
- personal best lookup
- leaderboard query
- friend / name search
- cloud context generation for AI coaching

Core tables:

```text
profiles
race_history
leaderboard
```

Race records include:

- user id
- display name
- total time
- completed status
- split data
- average HR
- peak HR
- created timestamp

The AI coach can use this cloud data to answer questions like:

```text
What is my personal best?
Am I ahead of my PB?
How do I compare with John?
Who is on the leaderboard?
```

## Onboarding and Personalization

FauxRox includes a lightweight onboarding flow for:

- display name
- birth year
- fitness level
- race goal
- guest mode

Profile data is used for:

- AI coaching tone
- HR zone personalization
- goal-aware motivation
- personal best context
- race result identity

Users can continue as guest if they do not want to save cloud results.

## Visual Feedback

The lens uses lightweight AR feedback instead of heavy UI panels during movement.

Examples:

- `+1` rep popup animation
- station name zoom
- countdown punch animation
- run arrows
- SkiErg visual guides
- form reminders
- good-form chimes
- finish gate VFX
- race summary panel

## Project Structure

```text
Assets/
  Scripts/
    RaceStateMachine.ts      # Main race lifecycle and timing engine
    CourseManager.ts         # Dynamic station config and spawning
    HandZoneDetector.ts      # Hand-tracked movement detection
    HeartRateTracker.ts      # BLE heart-rate monitor integration
    BLEConnectionUI.ts       # Heart-rate pairing flow
    AICoach.ts               # Gemini Live voice coach
    CloudManager.ts          # Supabase Snap Cloud persistence
    ProfileManager.ts        # Local profile and HR zone personalization
    OnboardingUI.ts          # Profile setup UI
    RunArrowGuide.ts         # Runtime run-direction arrows
    GroundCalibration.ts     # Floor detection and calibration
    WristMenu.ts             # In-race controls
    MotivationalShouts.ts    # Contextual AI encouragement
```

## Setup

1. Install Lens Studio 5.x.
2. Clone this repository.
3. Open the project in Lens Studio.
4. Configure required packages / assets:
   - Remote Service Gateway / Gemini
   - Supabase Snap Cloud
   - Bluetooth Central Module
5. Assign the Supabase project asset in Lens Studio.
6. Connect Spectacles.
7. Push the lens to Spectacles.
8. Test in a clear, safe open space.

## Requirements

- Spectacles
- Lens Studio 5.x
- Bluetooth heart-rate monitor, optional
- Supabase project, optional for cloud features
- Internet connection for Gemini Live and cloud features

## Safety

FauxRox is an experimental AR fitness prototype.

Use it only in a safe open area with enough space to move. Do not use it near traffic, stairs, obstacles, unstable surfaces, or crowded areas. Stop immediately if you feel pain, dizziness, or discomfort.

## Status

Built as an open-source Spectacles project for the Lenslist / Snap AR Spectacles Community Challenge.

## License

MIT
