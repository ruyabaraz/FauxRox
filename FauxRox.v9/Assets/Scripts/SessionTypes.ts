// ============================================================================
// SessionTypes.ts — the workout vocabulary
// ============================================================================
// Station and session definitions, the markers every plan needs, and the cost
// model that prices them. Pure data and pure functions: no Lens Studio
// imports, no scene knowledge, no component.
//
// This is deliberately separate from CourseManager. CourseManager is a
// component that owns prefabs, spawning and the live course; this file is the
// vocabulary those things are described in. Keeping them apart is what lets
// AdaptiveSessionGenerator and the test suite work without an editor.
// ============================================================================

// ── Stations ────────────────────────────────────────────────────────────────

/** How a station is completed */
export enum StationMode {
  TIMED    = 'TIMED',       // after X seconds
  DISTANCE = 'DISTANCE',    // after walking X metres
  REPS     = 'REPS',        // after X repetitions
  RUN      = 'RUN',         // run segment
  ZONE_HIT = 'ZONE_HIT',    // after X hand-tracked repetitions

  // Accessory movements. Both count camera oscillations and neither asks the
  // athlete to travel, which is what makes them usable in a room. REPS is left
  // alone: it drives the burpee, whose thresholds are tuned on the device.
  VERTICAL_REPS = 'VERTICAL_REPS',  // drop and rise on the spot - push up, air squat
  LATERAL_REPS  = 'LATERAL_REPS',   // drop, rise, hop sideways - burpee over dumbbell

  /**
   * Counted by where the head is looking rather than how high it is.
   *
   * A sit up moves the head about as far as a squat does, and counting the
   * distance counted squats: down and up is the same signal in both. What is
   * not the same is the view. On your back you are looking at the ceiling; at
   * the top you are looking across the room, and no squat ever does that.
   */
  PITCH_REPS = 'PITCH_REPS',
}

/** Which motion HandZoneDetector should look for at a ZONE_HIT station */
export enum MotionType {
  OVERHEAD_REACH = 'OVERHEAD_REACH',
  AIR_SKIERG     = 'AIR_SKIERG',
  FORWARD_PUSH   = 'FORWARD_PUSH',
  BACKWARD_PULL  = 'BACKWARD_PULL',
}

/**
 * The athlete's level. Lives here rather than in the generator because the
 * station variant table needs it, and the generator imports this file.
 */
export type Level = 'BEGINNER' | 'REGULAR' | 'ATHLETE';
export const ALL_LEVELS: Level[] = ['BEGINNER', 'REGULAR', 'ATHLETE'];

/**
 * How a run is asked for.
 *
 * Two kinds, because the athlete's pace is unknown and the two prescriptions
 * behave differently under that ignorance. Two kilometres easy is nine minutes
 * for one athlete and sixteen for another, and only one of those is the
 * session that was meant; ten minutes easy is ten minutes easy for everybody.
 * Where the stimulus is a duration - an easy run, a rep held at maximal
 * aerobic effort - time is the prescription that survives not knowing the
 * pace. Where it is a distance - a threshold rep, a race-pace kilometre - the
 * distance is the point and the clock is the observation.
 *
 * A union rather than two optional fields on the station. Two nullable
 * numbers can both be set, and every copy-then-override loop in this file
 * would carry both through without complaint; this cannot be half-set.
 */
import { RunningArchetype, RecoveryKind, modelRunSeconds, runSecondsAt } from './RunningArchetype';
import { PaceTarget, targetPaceSecPerKm } from './PaceTarget';

export type RunPrescription =
  | { kind: 'DISTANCE'; metres: number }
  | { kind: 'TIME'; seconds: number; phases?: RunPhase[] };

/**
 * A stretch within one continuous run that is run differently.
 *
 * An easy run does not need a warm-up in front of it - the first minutes of
 * it are the warm-up, which is what easy means - so four and a half minutes
 * of drills before a ten minute jog is warming up for a warm-up. Absorbing
 * them turns a short session from drills-then-running into one fifteen minute
 * run, which is a better session and one station instead of four.
 *
 * A phase is a reading of the clock, not an event. The run does not stop, no
 * prefab is spawned or destroyed, and nothing in the plan is divided: the
 * panel simply names the stretch the athlete is in. Splitting it into two
 * runs would have put a seam in the middle of something whose whole point is
 * not having one.
 */
export interface RunPhase {
  /** Seconds from the start of the run at which this stretch begins */
  fromSeconds: number;
  /** What the panel calls it */
  label: string;
  /** One line, the way a coach would say it */
  cue: string;
  /**
   * Whether this stretch is part of what the session is measured on.
   *
   * The settling minutes of an easy run are not. They are deliberately slower
   * than the run - that is what settling means - so a pace averaged across
   * them is a pace nobody was asked to hold, and a fade computed from them
   * would find the athlete speeding up and call it inconsistency.
   *
   * Stated rather than inferred from position. "The first stretch does not
   * count" is true of the one run that has stretches today and is not a rule
   * about stretches.
   */
  counts: boolean;
}

/**
 * What a run produced, whichever way it was asked for.
 *
 * Both fields are always filled: a distance run finishes on the metre and the
 * clock is read, a timed run finishes on the clock and the path accumulator
 * is read. So a pace falls out of either - which is the whole reason the
 * timed run is worth building, and the reason this type is shared rather than
 * one per kind.
 */
export interface RunResult {
  /**
   * The part of the run the session is measured on.
   *
   * The same as the whole for every run that has no preparatory stretch,
   * which is all of them but the easy run.
   */
  measured: { movingSeconds: number; distanceMetres: number };
  /**
   * Seconds of running. Time spent standing still is not in here, which is
   * what makes it the number a pace should be divided by - and the number a
   * time prescription is measured against, since a run written in minutes is
   * asking for minutes of running.
   */
  movingSeconds: number;
  /** Wall time from the start of the run, pauses excluded */
  elapsedSeconds: number;
  distanceMetres: number;
}

export function distanceRun(metres: number): RunPrescription {
  return { kind: 'DISTANCE', metres: Math.max(0, Math.round(metres)) };
}

export function timedRun(seconds: number, phases?: RunPhase[]): RunPrescription {
  var out: RunPrescription = { kind: 'TIME', seconds: Math.max(1, Math.round(seconds)) };
  if (phases && phases.length > 0) out.phases = phases;
  return out;
}

/**
 * Which stretch of a run the athlete is in, or null when it has none.
 *
 * The last phase whose start has passed. Phases are expected in order and a
 * caller that hands them over out of order gets the same answer, because
 * being wrong about which minute of a run somebody is in is not worth a
 * defensive sort on every frame - but it is worth not crashing.
 */
export function phaseAt(
  run: RunPrescription | undefined,
  seconds: number
): RunPhase | null {
  if (!run || run.kind !== 'TIME' || !run.phases) return null;

  var current: RunPhase | null = null;

  for (var i = 0; i < run.phases.length; i++) {
    var phase = run.phases[i];
    if (phase.fromSeconds > seconds) continue;
    if (!current || phase.fromSeconds >= current.fromSeconds) current = phase;
  }

  return current;
}

/** True when there is any running to do before this station */
export function hasRun(run?: RunPrescription): boolean {
  if (!run) return false;
  return run.kind === 'TIME' ? run.seconds > 0 : run.metres > 0;
}

/**
 * Metres asked for, or zero.
 *
 * Zero for a timed run is not a claim that no distance is covered - it is a
 * statement that no distance was prescribed. Callers that want to know how
 * far the athlete actually went read the RunResult.
 */
export function runMetresOf(run?: RunPrescription): number {
  return run && run.kind === 'DISTANCE' ? run.metres : 0;
}

/** Seconds asked for, or zero for a distance run */
export function runSecondsOf(run?: RunPrescription): number {
  return run && run.kind === 'TIME' ? run.seconds : 0;
}

/**
 * Pace in seconds per kilometre, or null when the run covered no ground.
 *
 * Null rather than zero or Infinity: a run with no distance has no pace, and
 * a caller that treats a missing pace as a fast one would read a tracking
 * failure as a personal best.
 */
/**
 * The same station with a different run.
 *
 * Copy-then-override, like every other transform in this file. Rebuilding
 * field by field is how dropCm, blockIndex and legMetres each went missing.
 */
export function withRun(
  cfg: StationConfig,
  run: RunPrescription | undefined
): StationConfig {
  var out: StationConfig = {} as StationConfig;

  for (var key in cfg) {
    if (Object.prototype.hasOwnProperty.call(cfg, key)) {
      (out as any)[key] = (cfg as any)[key];
    }
  }

  out.run = run;

  // The leg cap describes a distance being shuttled. A run on the clock has
  // no distance to divide into legs.
  if (run && run.kind === 'TIME' && out.runLegMetres !== undefined) {
    delete out.runLegMetres;
  }

  return out;
}

/**
 * A run duration as it is said out loud: "0:08", "12:00".
 *
 * One function because three layers print it - the block label, the plan log
 * and the HUD - and two of them had already drifted to different shapes for
 * the same eight seconds.
 */
export function formatRunClock(seconds: number): string {
  var whole = Math.max(0, Math.round(seconds));
  var mins = Math.floor(whole / 60);
  var secs = whole % 60;
  return mins + ':' + (secs < 10 ? '0' : '') + secs;
}

export function runPaceSecPerKm(result: RunResult): number | null {
  if (!result || result.distanceMetres <= 0) return null;
  if (result.movingSeconds <= 0) return null;
  return (result.movingSeconds * 1000) / result.distanceMetres;
}

/**
 * The pace of the part that counts, or null.
 *
 * What the analysis reads. For an easy run this is the run without its
 * settling minutes; for everything else it is the whole repetition.
 */
export function measuredPaceSecPerKm(result: RunResult): number | null {
  if (!result || !result.measured) return runPaceSecPerKm(result);
  if (result.measured.distanceMetres <= 0) return null;
  if (result.measured.movingSeconds <= 0) return null;

  return (result.measured.movingSeconds * 1000) / result.measured.distanceMetres;
}

export interface StationConfig {
  name: string;
  mode: StationMode;
  /** seconds, metres, reps or zone hits, depending on mode */
  requirement: number;
  instruction: string;
  prefabType: string;
  /** the run that precedes this station, if any */
  run?: RunPrescription;
  motionType?: MotionType;
  /**
   * Head travel required per rep, cm. Only read by VERTICAL_REPS and
   * LATERAL_REPS - a push up and an air squat move the head by very different
   * amounts. Race stations do not use this; their tuning lives where it always
   * has.
   */
  dropCm?: number;
  /**
   * Which block of the session this entry belongs to, and what that block is
   * called. Set when blocks are flattened. The state machine walks a flat
   * list, so without this it cannot tell the warm-up from the work.
   */
  blockIndex?: number;
  blockLabel?: string;
  blockScheme?: string;
  /** Which round of its block this entry belongs to, 1-based */
  roundIndex?: number;
  roundCount?: number;
  /** true for the finish marker, which is not a workout station */
  isFinish?: boolean;

  /**
   * The kind of running this station's run belongs to, when it is running.
   *
   * Carried down from the block so the cost model can price the run at the
   * pace it is actually run at. A threshold kilometre and an easy kilometre
   * are the same distance and not the same five minutes.
   */
  archetype?: string;

  /**
   * The pace band this run was prescribed at, when the athlete has an anchor
   * to prescribe from. Null for every session until one exists, and for every
   * session of an athlete who has never run anything.
   */
  paceTarget?: PaceTarget | null;

  /**
   * What kind of break this is, when it is one.
   *
   * A RecoveryKind value, carried as a string so the analysis can read what
   * the break was without the whole running vocabulary coming with it. Forty
   * seconds walked and forty seconds jogged are not the same forty seconds,
   * and in a threshold session the difference is the session.
   */
  recoveryKind?: string;

  /**
   * Longest straight leg available, metres — set only in a small room.
   *
   * The requirement is untouched: distance is tracked as path length, so the
   * dose is completed by shuttling. This tells the presentation layer, and
   * the instruction text, how far the athlete can go before turning.
   */
  legMetres?: number;

  /**
   * Longest straight leg for the RUN before this station, metres.
   *
   * Separate from legMetres, which is about this station's own travelling
   * work. A round can shuttle its run and not its station, or the reverse.
   */
  runLegMetres?: number;
}

/**
 * True when a station keeps the athlete on one spot. The distinction matters
 * for small spaces: hand-tracked and timed work needs no room, while DISTANCE
 * stations ask the athlete to cover ground.
 */
export function isStationary(cfg: StationConfig): boolean {
  return cfg.mode === StationMode.ZONE_HIT ||
         cfg.mode === StationMode.TIMED ||
         cfg.mode === StationMode.REPS ||
         cfg.mode === StationMode.VERTICAL_REPS ||
         cfg.mode === StationMode.LATERAL_REPS ||
         cfg.mode === StationMode.PITCH_REPS;
}

/**
 * True for movements that are not part of the race.
 *
 * The eight race stations are the test; these are what builds the qualities
 * the test measures. They never appear on Race Day - a race with press ups in
 * it is not the race - but a training session that can only ever rehearse the
 * test is a poor training session.
 */
export function isAccessory(cfg: StationConfig): boolean {
  return ACCESSORY_PREFABS[cfg.prefabType] === true;
}


// ── Accessory movements ─────────────────────────────────────────────────────
//
// Movements that are not in the race but build what the race tests. A weak
// burpee is not fixed by more burpees; it is fixed by the pressing and the
// squat pattern underneath it. Each one records which race station it feeds,
// so a verdict naming a limiter can be answered with the thing that develops
// it rather than with more of the thing that exposed it.
//
// All of them are stationary, which is the other reason they exist: a small
// room currently offers four choices, and three of those are hand-tracked.
//
// None of these have their own prefab yet. CourseManager.getPrefab falls back
// to defaultWorkoutPrefab for unknown types, so they render as the generic
// station until artwork exists.

export interface AccessoryStation extends StationConfig {
  /** prefabTypes of the race stations this movement develops */
  develops: string[];
}

export const ACCESSORY_STATIONS: AccessoryStation[] = [
  {
    name: 'PUSH UP',
    mode: StationMode.VERTICAL_REPS,
    requirement: 20,
    instruction: 'Chest to the floor, push up. Keep a straight line.',
    prefabType: 'PUSH_UP',
    dropCm: 25,
    develops: ['BURPEE_BROAD_JUMP', 'POWER_LANE'],
  },
  {
    name: 'BURPEE OVER DUMBBELL',
    mode: StationMode.LATERAL_REPS,
    requirement: 15,
    instruction: 'Drop, stand, hop sideways over the dumbbell. Both directions.',
    prefabType: 'BURPEE_LATERAL',
    dropCm: 35,
    develops: ['BURPEE_BROAD_JUMP'],
  },
  {
    name: 'AIR SQUAT',
    mode: StationMode.VERTICAL_REPS,
    requirement: 30,
    instruction: 'Full depth, stand tall. Chest up throughout.',
    prefabType: 'AIR_SQUAT',
    dropCm: 30,
    develops: ['TARGET_PRESS', 'WALKING_LUNGES'],
  },
  {
    name: 'SIT UP',
    mode: StationMode.PITCH_REPS,
    requirement: 25,
    instruction: 'Shoulders to the floor, then all the way up.',
    prefabType: 'SIT_UP',
    dropCm: 40,
    develops: ['HEAVY_CARRY', 'POWER_LANE'],
  },
  {
    name: 'OVERHEAD PRESS',
    mode: StationMode.ZONE_HIT,
    requirement: 25,
    instruction: 'Dumbbells at shoulders, press straight overhead.',
    prefabType: 'OVERHEAD_PRESS',
    motionType: MotionType.OVERHEAD_REACH,
    develops: ['TARGET_PRESS', 'AIR_SKIERG'],
  },
  {
    name: 'PLANK HOLD',
    mode: StationMode.TIMED,
    requirement: 45,
    instruction: 'Hold the plank. Hips level, core braced.',
    prefabType: 'PLANK',
    develops: ['HEAVY_CARRY', 'POWER_LANE', 'CRAB_WALK'],
  },
  {
    name: 'FARMERS CARRY',
    mode: StationMode.DISTANCE,
    requirement: 60,
    instruction: 'Heavy in both hands. Stand tall and walk.',
    prefabType: 'FARMERS_CARRY',
    develops: ['HEAVY_CARRY'],
  },
  {
    name: 'HIGH KNEES',
    mode: StationMode.TIMED,
    requirement: 40,
    instruction: 'Run on the spot, knees high, fast feet.',
    prefabType: 'HIGH_KNEES',
    develops: ['AIR_SKIERG'],
  },
];

/** Fast lookup for isAccessory */
const ACCESSORY_PREFABS: { [prefabType: string]: boolean } = (function () {
  var out: { [k: string]: boolean } = {};
  for (var i = 0; i < ACCESSORY_STATIONS.length; i++) {
    out[ACCESSORY_STATIONS[i].prefabType] = true;
  }
  return out;
})();

/** Accessories that develop the given race station, best first */
export function accessoriesFor(racePrefabType: string): AccessoryStation[] {
  var out: AccessoryStation[] = [];

  for (var i = 0; i < ACCESSORY_STATIONS.length; i++) {
    var station = ACCESSORY_STATIONS[i];
    if (station.develops.indexOf(racePrefabType) >= 0) {
      out.push(station);
    }
  }

  return out;
}

// ── Sessions ────────────────────────────────────────────────────────────────

export enum SessionKind {
  RACE     = 'RACE',       // full timed race, counts for leaderboard and PB
  TRAINING = 'TRAINING',   // shorter focused session, does not count
}

export interface SessionPlan {
  id: string;
  kind: SessionKind;
  title: string;
  /** Why this session — shown in the picker and the verdict card */
  rationale: string;
  estimatedMinutes: number;
  stations: StationConfig[];
  source: 'authored' | 'generated' | 'ai';
  /** Present on generated training sessions - the structure behind the list */
  blocks?: SessionBlock[];
}



// ── Warm-up movements ───────────────────────────────────────────────────────
//
// A warm-up is drills, not light training. Nobody opens a track session with
// press ups, and nobody rests between mobility movements — they are done
// straight through to raise temperature and open the joints.
//
// Kept apart from both the race stations and the accessories so it can never
// be selected as work, and tagged by what it prepares: a running session warms
// up with running drills, everything else with general mobility.

export type WarmupTag = 'RUNNING' | 'GENERAL';

/**
 * How hard a drill is, so the warm-up can match the athlete.
 *
 * A warm-up prepares somebody for the work they are about to do, and that
 * work is not the same at every level - so neither is the preparation. A
 * beginner marching their knees up and an advanced athlete running theirs are
 * the same movement at two intensities, and giving both the same drill either
 * leaves one cold or asks the other for a sprint before they have moved.
 *
 * EASY   controlled, low impact - available to everyone
 * BRISK  raises the heart rate, both feet leaving the floor
 */
export type WarmupIntensity = 'EASY' | 'BRISK';

export interface WarmupMovement extends StationConfig {
  tag: WarmupTag;
  intensity: WarmupIntensity;
}

export const WARMUP_MOVEMENTS: WarmupMovement[] = [
  // Running drills
  { name: 'A SKIPS', mode: StationMode.TIMED, requirement: 30, tag: 'RUNNING', intensity: 'BRISK',
    instruction: 'Drive the knee, land under the hip. Light and quick.',
    prefabType: 'WARMUP_A_SKIPS', },

  { name: 'BUTT KICKS', mode: StationMode.TIMED, requirement: 30, tag: 'RUNNING', intensity: 'BRISK',
    instruction: 'Heels to the glutes, stay tall.',
    prefabType: 'WARMUP_BUTT_KICKS', },

  { name: 'HIGH KNEE MARCH', mode: StationMode.TIMED, requirement: 30, tag: 'RUNNING', intensity: 'EASY',
    instruction: 'Tall posture, knee above the hip, controlled.',
    prefabType: 'WARMUP_HIGH_KNEE_MARCH', },

  { name: 'LEG SWINGS', mode: StationMode.TIMED, requirement: 30, tag: 'RUNNING', intensity: 'EASY',
    instruction: 'Swing front to back, then side to side. Relaxed.',
    prefabType: 'WARMUP_LEG_SWINGS', },

  // General mobility
  { name: 'HIGH KNEE RUNS', mode: StationMode.TIMED, requirement: 45, tag: 'GENERAL', intensity: 'BRISK',
    instruction: 'Fast feet on the spot, knees up to hip height.',
    prefabType: 'WARMUP_HIGH_KNEE_RUNS', },

  { name: 'JUMPING JACKS', mode: StationMode.TIMED, requirement: 40, tag: 'GENERAL', intensity: 'BRISK',
    instruction: 'Full range, arms all the way overhead.',
    prefabType: 'WARMUP_JUMPING_JACKS', },

  { name: 'DYNAMIC QUAD STRETCH', mode: StationMode.TIMED, requirement: 30, tag: 'GENERAL', intensity: 'EASY',
    instruction: 'Heel to glute, alternate. Do not hold, keep moving.',
    prefabType: 'WARMUP_QUAD_STRETCH', },

  { name: 'ALTERNATING LATERAL LUNGE', mode: StationMode.TIMED, requirement: 40, tag: 'GENERAL', intensity: 'EASY',
    instruction: 'Step wide, sit into the hip, push back to the middle.',
    prefabType: 'WARMUP_LATERAL_LUNGE', },

  { name: 'ARM CIRCLES', mode: StationMode.TIMED, requirement: 25, tag: 'GENERAL', intensity: 'EASY',
    instruction: 'Big circles forward, then backward.',
    prefabType: 'WARMUP_ARM_CIRCLES', },

  { name: 'WORLD\'S GREATEST STRETCH', mode: StationMode.TIMED, requirement: 40, tag: 'GENERAL', intensity: 'EASY',
    instruction: 'Lunge, elbow to instep, rotate and reach. Alternate sides.',
    prefabType: 'WARMUP_WGS', },
];

/** Warm-up drills suited to a focus. Running gets running drills. */
export function warmupFor(tag: WarmupTag): WarmupMovement[] {
  var out: WarmupMovement[] = [];

  for (var i = 0; i < WARMUP_MOVEMENTS.length; i++) {
    if (WARMUP_MOVEMENTS[i].tag === tag) out.push(WARMUP_MOVEMENTS[i]);
  }

  return out;
}

/**
 * Whether a drill is the kind this athlete should be warming up with.
 *
 * A preference, not a filter. A beginner is not asked to sprint on the spot
 * before they have moved and an advanced athlete is not warmed up by arm
 * circles alone - but there are only two brisk general drills in the
 * catalogue, so filtering on this gave every advanced session the same two,
 * every time. The caller sorts by it and takes what it needs, which keeps the
 * character of the warm-up without spending the variety.
 */
export function warmupSuitsLevel(drill: WarmupMovement, level?: Level): boolean {
  if (!level || level === 'REGULAR') return true;
  return level === 'BEGINNER'
    ? drill.intensity === 'EASY'
    : drill.intensity === 'BRISK';
}


// ── Training blocks ─────────────────────────────────────────────────────────
//
// A training session is not a short race. Real HYROX programming is written in
// blocks of rounds:
//
//   3X   15m Sled Push · 400m Run · 60" rest
//   4 Rounds   250m Run · 10m Sled Push · 60s rest
//   6 Rounds   500m SkiErg · 500m Row
//   Finisher   8 min EMOM, 10 Wall Balls
//
// The shape that matters is repetition with rest, and pairs of movements done
// back to back. A flat list of stations with a run between each one is the
// race, which is the thing training prepares for rather than the thing
// training is.
//
// Blocks are flattened into the linear station list the race engine already
// walks, so none of this needs the state machine to change: a round's run
// becomes the run on its first movement, and rest becomes a timed
// station between rounds.

/**
 * How the rounds of a block are written.
 *
 * Real programmes do not repeat one number. A strength block climbs and comes
 * back down; a finisher is often written to the clock. The scheme is what
 * turns "three rounds of this" into a session someone would actually write.
 */
export enum BlockScheme {
  /** Same work every round */
  STRAIGHT = 'STRAIGHT',
  /** Reps climb and fall — 6-8-10-8-6 */
  LADDER = 'LADDER',
  /** Every minute on the minute: short work, the rest of the minute is rest */
  EMOM = 'EMOM',
  /** Easy movement to open the session */
  WARMUP = 'WARMUP',
}

export interface SessionBlock {
  /** Shown to the athlete, e.g. "3 × Push Up + Air Squat" */
  label: string;
  scheme: BlockScheme;
  rounds: number;
  /** Metres to run at the start of every round, 0 for none */
  run?: RunPrescription;
  /** Movements performed back to back within a round */
  items: StationConfig[];

  /**
   * True when this block does not want a warm-up in front of it.
   *
   * Only a continuous easy run, whose opening minutes are the warm-up - which
   * is what easy means. On the block rather than derived from the focus,
   * because the same request builds an easy run on one seed and threshold
   * repetitions on the next, and only one of them arrives warm.
   */
  selfWarming?: boolean;

  /**
   * The kind of running this block is, when it is running.
   *
   * Its distances are canonical: eight hundred metres is a threshold
   * repetition and six hundred is a maximal aerobic one, and the numbers
   * between them are not weaker versions of either. So a block that has this
   * set is telling the fitter that its distance is the prescription and not a
   * dial - the fitter adjusts how many, never how far.
   */
  archetype?: string;

  /** The pace band this block's runs were prescribed at, when there is one */
  paceTarget?: PaceTarget | null;
  /** Rest between rounds, seconds */
  restSeconds: number;
  /**
   * Longest straight leg available, metres.
   *
   * Set only when the room is smaller than the distance being prescribed. The
   * distance itself is unchanged - tracking accumulates path length rather
   * than displacement, so a hundred metres shuttled across a room is a
   * hundred metres. Capping the prescription instead of the leg turned a 200m
   * carry into 20m, which is a different and much easier workout.
   */
  legMetres?: number;
  /**
   * Multiplier on each item's requirement, one per round. A straight block is
   * all ones; a ladder rises and falls. Always the same length as rounds.
   */
  roundScales: number[];
}

/** Requirement floors so a scaled-down round never reaches zero */
/**
 * The smallest prescription worth writing down.
 *
 * These used to be 5m, 5s and 3 reps, which is what a whole session collapsed
 * to once the duration fitter had scaled it: a five-second plank, a five-metre
 * carry, three rows. Small enough to be either an insult or a joke, and the
 * floor is what a coach would refuse to write rather than what the arithmetic
 * can represent.
 */
function floorFor(mode: StationMode): number {
  if (mode === StationMode.DISTANCE) return MIN_STATION_METRES;
  if (mode === StationMode.TIMED) return MIN_HOLD_SECONDS;
  return MIN_STATION_REPS;
}

/** A carry shorter than this is a step, not a carry */
export const MIN_STATION_METRES = 20;
/** A hold shorter than this has not begun to be hard */
export const MIN_HOLD_SECONDS = 20;
/** Fewer than this is a demonstration, not a set */
export const MIN_STATION_REPS = 8;

/** A pyramid of the given odd length, peaking at 1.0 */
export function ladderScales(rounds: number): number[] {
  var out: number[] = [];
  var peak = Math.floor(rounds / 2);

  for (var i = 0; i < rounds; i++) {
    var distance = Math.abs(peak - i);
    out.push(Math.max(0.5, 1 - distance * 0.2));
  }

  return out;
}

export function straightScales(rounds: number): number[] {
  var out: number[] = [];
  for (var i = 0; i < rounds; i++) out.push(1);
  return out;
}

/** Rest between rounds by level — a beginner needs longer to repeat the work */
export const REST_SECONDS: { [K in Level]: number } = {
  BEGINNER: 70,
  REGULAR: 60,
  ATHLETE: 45,
};

// ── Recovery ────────────────────────────────────────────────────────────────
//
// Rest used to be a flat sixty seconds, whatever it was resting from. Measured
// across the parameter space that produced this:
//
//   RUNNING  MEDIUM   1.0-2.2 min work,  17.0-24.1 min rest   1:14.8
//   STRENGTH SHORT    1.2-3.5 min work,   4.5-15.1 min rest   1:4.5
//
// A twenty-minute session containing four minutes of work is not a session.
// And the shorter the athlete asked for, the worse it got, because work
// scaled with the duration tier while rest did not: shortening a workout
// shortened only the working half of it.
//
// So rest is a function of the bout it follows. Three seconds of interval
// does not earn sixty seconds of walking; two and a half minutes under a
// heavy carry does earn real rest.

/** How rest relates to the work it follows, as a band per kind of session */
export interface RecoveryPolicy {
  /** Multiples of the work bout: rest = bout x ratio */
  minRatio: number;
  maxRatio: number;
  /** Absolute bounds, so a preview artefact cannot produce a 4-second rest */
  floorSeconds: number;
  ceilingSeconds: number;
}

/**
 * The grammars that still price their own rest here.
 *
 * Running is not among them any more. It had a single band of 0.75-1.25 for
 * every kind of running, which was right for one of the five archetypes and
 * wrong by factors of four and six for two others; each archetype declares
 * its own band now, and there is nothing left for a shared one to describe.
 */
export type RecoveryProfile = 'STRENGTH' | 'ENGINE' | 'MIXED';

/**
 * Ratios per kind of work, as bands rather than single numbers.
 *
 * These are HYROX strength-endurance movements - carries, lunges, crawls -
 * not maximal lifting, so even the strength band stays near parity rather
 * than the two-to-one a powerlifter would take. Engine work is dense by
 * definition. Compromised work rests least, because arriving at a station
 * already tired is the demand being trained.
 *
 * The bounds are generator safety, not coaching: they stop a three-second
 * bout from earning a two-second rest, and stop a very long carry from
 * earning five minutes off.
 */
export const RECOVERY_POLICY: { [K in RecoveryProfile]: RecoveryPolicy } = {
  STRENGTH: { minRatio: 1.0,  maxRatio: 1.5,  floorSeconds: 30, ceilingSeconds: 180 },
  ENGINE:   { minRatio: 0.4,  maxRatio: 0.75, floorSeconds: 15, ceilingSeconds: 90  },
  MIXED:    { minRatio: 0.25, maxRatio: 0.5,  floorSeconds: 15, ceilingSeconds: 60  },
};

/**
 * The range of bouts over which the ratio band is the binding constraint.
 *
 * Outside it one of the absolute bounds takes over, deliberately: a very long
 * carry does not earn the rest of the session off, and a bout shortened to
 * nothing by an indoor tuning still earns a usable break. Callers that want
 * to assert the ratio itself have to stay inside this range, because outside
 * it the ratio is not what is being promised.
 */
export function ratioBindingRange(
  profile: RecoveryProfile
): { minBout: number, maxBout: number } {
  var policy = RECOVERY_POLICY[profile] || RECOVERY_POLICY.MIXED;

  return {
    minBout: policy.floorSeconds / policy.minRatio,
    maxBout: policy.ceilingSeconds / policy.maxRatio,
  };
}

/**
 * How much longer each level rests.
 *
 * A multiplier rather than a shift in the bounds. Moving only the ceiling
 * changes nothing for a bout whose rest already lands mid-band, which is most
 * of them - so a beginner and an athlete would have received identical rest
 * for the same work, which is the opposite of what levels are for.
 */
export const LEVEL_RECOVERY: { [K in Level]: number } = {
  BEGINNER: 1.25,
  REGULAR: 1.0,
  ATHLETE: 0.75,
};

/**
 * Why the athlete's multiplier is 0.75 rather than something nearer parity.
 *
 * Rest is earned by the work bout, and an athlete's bout is larger:
 * LEVEL_VOLUME puts them at 1.2. At 0.875 the bigger bout outweighed the
 * smaller multiplier - 1.2 x 0.875 = 1.05 - and the fittest athlete ended up
 * resting longer than a regular one, which is backwards. It has to undo the
 * volume increase before it can shorten anything:
 *
 *   LEVEL_VOLUME[ATHLETE] * LEVEL_RECOVERY[ATHLETE] < 1
 *
 * And it has to survive the grid the prescription is snapped to, which rounds
 * volume up: eight reps become ten, a 25 per cent rise where the level asked
 * for 20. At 0.8 that landed exactly on parity and rounding decided the
 * ordering; 0.75 clears the worst snap the grid can produce.
 *
 * A test asserts this rather than a comment alone, because the two constants
 * live apart and only their product matters.
 */

/**
 * Rest earned by a bout of work.
 *
 * @param workBoutSeconds the round this rest follows
 * @param profile         which band applies
 * @param level           the athlete's level
 * @param position        where in the band to sit, 0..1, from the seed - so
 *                        two sessions of the same shape are not identical
 */
export function recoverySeconds(
  workBoutSeconds: number,
  profile: RecoveryProfile,
  level: Level,
  position: number
): number {
  var policy = RECOVERY_POLICY[profile] || RECOVERY_POLICY.MIXED;
  var at = Math.max(0, Math.min(1, position || 0));
  var ratio = policy.minRatio + (policy.maxRatio - policy.minRatio) * at;

  var seconds = Math.max(0, workBoutSeconds) * ratio;
  seconds *= LEVEL_RECOVERY[level] || 1.0;

  // The level multiplier applies inside the bounds too. Clamping first and
  // scaling after would let a lower level rest less than a higher one at the
  // ceiling, which must never happen.
  var floor = policy.floorSeconds * (LEVEL_RECOVERY[level] || 1.0);
  var ceiling = policy.ceilingSeconds * (LEVEL_RECOVERY[level] || 1.0);

  return Math.round(Math.max(floor, Math.min(ceiling, seconds)));
}

/**
 * The walk between hard efforts in a running block.
 *
 * Distinct from REST: rest is standing still between rounds of work, this is
 * the easy half of an interval and is part of the round rather than a break
 * from it.
 */
/**
 * The same station, made completable without hand tracking.
 *
 * Used by the editor preview, where a rep-counting station can never finish
 * because there are no hands. It has to be a copy-then-override rather than a
 * rebuild: rebuilding field by field drops whichever field was added last,
 * and it did - blockIndex went missing, so a block whose first movement was
 * hand-tracked never announced itself and the athlete was told the working
 * set had begun only after finishing its first station.
 *
 * Every field but the two named here is carried through, by construction.
 */
export function simplifyForPreview(
  cfg: StationConfig,
  seconds: number
): StationConfig {
  var out: StationConfig = {} as StationConfig;

  for (var key in cfg) {
    if (Object.prototype.hasOwnProperty.call(cfg, key)) {
      (out as any)[key] = (cfg as any)[key];
    }
  }

  out.mode = StationMode.TIMED;
  out.requirement = Math.max(1, Math.round(seconds));

  return out;
}

/**
 * True when this station is part of the warm-up.
 *
 * Two ways of knowing, because a warm-up drill reaches here by two routes:
 * inside a WARMUP block, or as a loose station carrying a warm-up prefab.
 */
export function isWarmupStation(cfg: StationConfig): boolean {
  if (cfg.blockScheme === BlockScheme.WARMUP) return true;
  return !!cfg.prefabType && cfg.prefabType.indexOf('WARMUP_') === 0;
}

/**
 * The same stretches, in a run that has been cut short.
 *
 * A fifteen minute easy run settles for its first two minutes. Cut to eight
 * seconds for the editor with the boundaries left alone, it is eight seconds
 * of settling and the second stretch never arrives - so the one thing the
 * preview was opened to look at is the one thing it cannot show. Scaled, the
 * shape survives the shortening the way the rest of the plan does.
 */
function scalePhases(
  phases: RunPhase[] | undefined,
  fromSeconds: number,
  toSeconds: number
): RunPhase[] | undefined {
  if (!phases || phases.length === 0 || fromSeconds <= 0) return phases;

  var scale = toSeconds / fromSeconds;
  var out: RunPhase[] = [];

  for (var i = 0; i < phases.length; i++) {
    var phase = phases[i];
    out.push({
      fromSeconds: i === 0 ? 0 : Math.round(phase.fromSeconds * scale),
      label: phase.label,
      cue: phase.cue,
      counts: phase.counts,
    });
  }

  return out;
}

/**
 * The same station with a run short enough to do indoors.
 *
 * Copy-then-override, like every other transform here: listing the fields to
 * keep is how dropCm, blockIndex and legMetres each went missing in turn.
 */
export function shortenRunForPreview(
  cfg: StationConfig,
  maxMetres: number,
  maxSeconds: number
): StationConfig {
  var out: StationConfig = {} as StationConfig;

  for (var key in cfg) {
    if (Object.prototype.hasOwnProperty.call(cfg, key)) {
      (out as any)[key] = (cfg as any)[key];
    }
  }

  // A timed run is shortened on the clock and a distance run on the ground,
  // because that is what each one is asking for. Cutting a fifteen-minute
  // easy run to six metres would not be a shorter version of it.
  out.run = cfg.run && cfg.run.kind === 'TIME'
    ? timedRun(maxSeconds, scalePhases(cfg.run.phases, cfg.run.seconds, maxSeconds))
    : distanceRun(Math.max(1, Math.round(maxMetres)));

  // The leg cap described a room the athlete is no longer crossing
  if (out.runLegMetres !== undefined) delete out.runLegMetres;

  return out;
}

// ── Round numbers ───────────────────────────────────────────────────────────
//
// The duration fitter scales volume by whatever factor lands the session in
// its band, and that factor is a real number: a 300m compromised run came out
// as "137m run", a carry as 14m, a hold as 5s. No coach has ever written 137
// metres. The scaling is right - the session does have to fit - but the
// number the athlete is given should be one a person would say out loud.
//
// So the prescription snaps to a grid after scaling. The session then lands
// near its target rather than exactly on it, which is the correct trade: the
// promise was always a band of minutes, never an exact minute.

/** Distances a run is ever prescribed at, metres */
const RUN_GRID = [50, 100, 150, 200, 300, 400, 500, 600, 800, 1000, 1200, 1600, 2000];
/** Distances a loaded carry or crawl is prescribed at, metres */
const CARRY_GRID = [20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200];
/** Seconds a hold is prescribed for */
const HOLD_GRID = [20, 30, 40, 45, 60, 75, 90, 120, 150, 180];
/** Rep counts worth writing down */
const REP_GRID = [8, 10, 12, 15, 18, 20, 25, 30, 35, 40, 50, 60, 75, 100];

function snapTo(grid: number[], value: number): number {
  if (value <= grid[0]) return grid[0];
  if (value >= grid[grid.length - 1]) {
    // Past the top of the grid, keep the grid's own spacing rather than
    // pinning every large prescription to the same number
    var step = grid[grid.length - 1] - grid[grid.length - 2];
    return Math.round(value / step) * step;
  }

  var best = grid[0];
  var bestGap = Math.abs(value - best);

  for (var i = 1; i < grid.length; i++) {
    var gap = Math.abs(value - grid[i]);
    if (gap < bestGap) {
      best = grid[i];
      bestGap = gap;
    }
  }

  return best;
}

/** A run distance a person would say out loud */
export function snapRunMetres(metres: number): number {
  return metres <= 0 ? 0 : snapTo(RUN_GRID, metres);
}

/**
 * A run duration a coach would say out loud.
 *
 * The same argument as the distance grid, in the other unit: nobody is told
 * to run for eleven minutes and forty-seven seconds. Half-minute steps above
 * the floor, and the floor is a minute because a run shorter than that is a
 * stride, and a stride is prescribed in metres.
 */
export function snapRunSeconds(seconds: number): number {
  if (seconds <= 0) return 0;
  return Math.max(MIN_RUN_SECONDS, Math.round(seconds / 30) * 30);
}

export const MIN_RUN_SECONDS = 60;

/** A station requirement a person would say out loud */
export function snapRequirement(mode: StationMode, value: number): number {
  switch (mode) {
    case StationMode.DISTANCE: return snapTo(CARRY_GRID, value);
    case StationMode.TIMED:    return snapTo(HOLD_GRID, value);
    case StationMode.RUN:      return snapRunMetres(value);
    default:                   return snapTo(REP_GRID, value);
  }
}

// ── Ladders ─────────────────────────────────────────────────────────────────
//
// A ladder is a rep scheme, and it applies to countable work: reps and metres
// climb and come back down. It does not apply to a hold - a plank written as
// 12-16-20-16-12 seconds is not a ladder, it is a plank with a rounding
// error - and it never applied to the run, which stays the same distance
// every round.
//
// It was also being displayed and applied by two different pieces of code
// that disagreed. The label computed its rungs with no floor, so it printed
// "(5-6-8-6-5)" while the athlete, whose prescription was floored at eight
// reps, did 8-8-8-8-8 five times. The label was describing a session that
// did not happen.
//
// One function now answers both, so they cannot drift.

/** True when a movement is counted, and can therefore be laddered */
export function laddersWith(cfg: StationConfig): boolean {
  return cfg.mode !== StationMode.TIMED;
}

/**
 * What this movement is actually prescribed at, round by round.
 *
 * The floor is applied here, which is what makes the rungs real: a ladder
 * whose lower rungs fall under the smallest prescription a coach would write
 * is not a ladder at all, and this is where that becomes visible.
 */
export function ladderRungs(
  cfg: StationConfig,
  roundScales: number[]
): number[] {
  var out: number[] = [];

  for (var i = 0; i < (roundScales ? roundScales.length : 0); i++) {
    var scale = laddersWith(cfg) ? roundScales[i] : 1;

    // A rung is a prescription like any other, so it lands on the same grid.
    // Multiplying and rounding gave 24m and 32m carries - numbers no coach
    // writes, arrived at by scaling one that they would.
    out.push(Math.max(
      floorFor(cfg.mode),
      snapRequirement(cfg.mode, cfg.requirement * scale)
    ));
  }

  return out;
}

/** True when the rungs are all the same, so the ladder is one in name only */
export function ladderIsFlat(rungs: number[]): boolean {
  for (var i = 1; i < rungs.length; i++) {
    if (rungs[i] !== rungs[0]) return false;
  }
  return true;
}

/** True when this station is a break rather than work */
export function isRestStation(cfg: StationConfig): boolean {
  return cfg.prefabType === 'REST' || cfg.prefabType === 'RECOVERY';
}

/** True when a station cannot be completed without hand tracking */
export function needsHandTracking(cfg: StationConfig): boolean {
  return cfg.mode === StationMode.ZONE_HIT ||
         cfg.mode === StationMode.REPS ||
         cfg.mode === StationMode.VERTICAL_REPS ||
         cfg.mode === StationMode.LATERAL_REPS ||
         cfg.mode === StationMode.PITCH_REPS;
}

/**
 * A run that is the whole of its block.
 *
 * Every other run in this file is attached to the station it leads to,
 * because that is what a run is in a race: the thing between two stations. A
 * continuous easy run leads nowhere - it is the session - so it needs a
 * station of its own with no work in it but the running.
 *
 * The requirement is zero on purpose. The work is entirely in the run, and
 * the cost model already reads that from the prescription; a duplicate of it
 * here would be a second number to keep in step.
 */
/**
 * The running archetype a session was built as, or '' when it was not running.
 *
 * Read off the first block that declares one. A running session has exactly
 * one working block, so there is nothing to choose between.
 */
export function archetypeOf(plan: SessionPlan): string {
  if (!plan || !plan.blocks) return '';

  for (var i = 0; i < plan.blocks.length; i++) {
    if (plan.blocks[i].archetype) return plan.blocks[i].archetype;
  }

  return '';
}

/**
 * True when the run is the whole of this station.
 *
 * Everywhere else a station's run is the run that LEADS TO it: run, then do
 * the thing. A continuous easy run leads nowhere, and the engine served it
 * that way anyway - it ran the fifteen minutes, then entered a station with
 * no work in it and no way to finish, and stood there.
 */
export function isRunOnlyStation(cfg: StationConfig): boolean {
  return !!cfg && cfg.mode === StationMode.RUN && !(cfg.requirement > 0);
}

export function makeRunStation(run: RunPrescription, name: string): StationConfig {
  return {
    name: name,
    mode: StationMode.RUN,
    requirement: 0,
    instruction: 'Keep it easy. Nothing to chase.',
    prefabType: 'RUN',
    run: run,
  };
}

/**
 * The easy half of an interval.
 *
 * Two things decide what it is, and they are not the same thing. The kind
 * comes from the session: a threshold float is short and moving because that
 * is what stops lactate clearing, and walking it turns the session into a
 * different one. Speed work's recovery is near-full and walking it is the
 * point rather than a concession, because the fifth repetition has to be as
 * good as the first.
 *
 * The level decides the rest of it. A beginner between intervals needs the
 * heart rate to actually come down and walking is what does that; a trained
 * athlete jogging the same recovery keeps the aerobic system loaded the whole
 * way through, so the session stays one piece of work instead of eight
 * separated by rests.
 *
 * Where the kind is definitive the kind wins. A float that is walked is not a
 * float at any level of fitness.
 */
export function makeRecoveryStation(
  seconds: number,
  level: Level,
  kind?: RecoveryKind
): StationConfig {
  var requirement = Math.max(5, Math.round(seconds));

  if (kind === 'FLOAT_JOG') {
    return {
      name: 'FLOAT',
      mode: StationMode.TIMED,
      requirement: requirement,
      instruction: 'Keep jogging. Short on purpose - do not let it all come back.',
      prefabType: 'RECOVERY',
      recoveryKind: kind,
    };
  }

  // Named for what this athlete should do, not for what the archetype allows.
  //
  // The kind is WALK_OR_JOG because both are correct recoveries between
  // repetitions run at speed - the point is that they come back fully. Which
  // of the two it is depends on who is doing it, and the panel has to say one
  // of them: "walk or jog" is a menu, and somebody mid-session reading a menu
  // is somebody who has stopped.
  var walks = level === 'BEGINNER';

  if (kind === 'WALK_OR_JOG') {
    return {
      name: walks ? 'WALK' : 'JOG',
      mode: StationMode.TIMED,
      requirement: requirement,
      instruction: walks
        ? 'Walk it out. Take all of it - the next one has to be as good as this one.'
        : 'Jog it out. Take all of it - the next one has to be as good as this one.',
      prefabType: 'RECOVERY',
      recoveryKind: kind,
    };
  }

  return {
    name: walks ? 'WALK' : 'JOG',
    mode: StationMode.TIMED,
    requirement: requirement,
    instruction: walks
      ? 'Easy walk. Let the heart rate come down.'
      : 'Easy jog. Keep moving - do not let it all come down.',
    prefabType: 'RECOVERY',
    recoveryKind: kind || 'EASY_JOG',
  };
}

/**
 * The conditioning a run was there to provide, done on the spot.
 *
 * A room has no running in it, but a compromised-work round still needs the
 * athlete to arrive at the station with their heart rate already up. Knees to
 * hip height rather than an easy jog on the spot: the point is the heart
 * rate, and a march does not raise one.
 */
export function makeOnTheSpotRun(seconds: number): StationConfig {
  return {
    name: 'HIGH KNEE RUNS',
    mode: StationMode.TIMED,
    requirement: Math.max(MIN_HOLD_SECONDS, Math.round(seconds)),
    instruction: 'Knees to hip height, fast feet. This is the run.',
    prefabType: ON_THE_SPOT_RUN_PREFAB,
  };
}

/** The stand-in for a run indoors */
export const ON_THE_SPOT_RUN_PREFAB = 'HIGH_KNEE_RUNS';

export function makeRestStation(seconds: number): StationConfig {
  return {
    name: 'REST',
    mode: StationMode.TIMED,
    requirement: Math.max(1, Math.round(seconds)),
    instruction: 'Recover. Next round coming up.',
    prefabType: 'REST',
  };
}

/**
 * Expand blocks into the flat station list the engine walks.
 *
 * Rest is emitted between rounds and between blocks, never after the last one:
 * a session ends on work, not on standing still.
 */
export function flattenBlocks(blocks: SessionBlock[]): StationConfig[] {
  var out: StationConfig[] = [];
  if (!blocks) return out;

  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b];
    if (!block) continue;

    // A block with a run and nothing else is a continuous run, and it still
    // has to reach the engine as a station: the engine walks a flat list and
    // an empty block would simply not be in it. Dropping these silently is
    // what the old guard did, back when no block could be only a run.
    if (!block.items || block.items.length === 0) {
      if (!hasRun(block.run)) continue;

      var only = makeRunStation(block.run, block.label || 'RUN');
      if (block.archetype) only.archetype = block.archetype;
      if (block.paceTarget) only.paceTarget = block.paceTarget;
      only.blockIndex = b;
      only.blockLabel = block.label;
      only.blockScheme = block.scheme;
      only.roundIndex = 1;
      only.roundCount = 1;
      out.push(only);
      continue;
    }

    for (var r = 0; r < block.rounds; r++) {
      var roundScale = block.roundScales && block.roundScales.length > r
        ? block.roundScales[r]
        : 1;

      for (var i = 0; i < block.items.length; i++) {
        var item = block.items[i];

        // Copy, then override. Listing the fields to keep loses whichever
        // one was added last, and this has now bitten three times: dropCm in
        // applyLevel, blockIndex in the editor preview, and legMetres here.
        var station: StationConfig = {} as StationConfig;
        for (var key in item) {
          if (Object.prototype.hasOwnProperty.call(item, key)) {
            (station as any)[key] = (item as any)[key];
          }
        }

        // Reps and metres ladder; a hold keeps its prescribed duration. The
        // rung comes from the same function the label reads, so the two
        // cannot disagree, and it lands on the same grid of numbers a coach
        // would say.
        //
        // Warm-up drills are exempt from the grid. They are not prescriptions
        // in their own right, they are shares of a fixed warm-up length, and
        // snapping each one to the nearest round number pulled the total off
        // its target by up to half a minute - differently per level, since
        // the levels are offered different drills, which fed the level
        // straight back into the duration fit.
        //
        // Recovery is exempt on the same grounds. The grid exists so nobody
        // is asked to run a hundred and thirty-seven metres; a break is not
        // asked for in that sense, it is worked out from the bout it follows.
        // Snapping it made the two printed layers disagree - the plan said
        // seventy-six seconds and the station ran seventy-five.
        station.requirement = block.scheme === BlockScheme.WARMUP ||
                              isRestStation(item)
          ? item.requirement
          : Math.max(
              floorFor(item.mode),
              snapRequirement(item.mode, item.requirement * (laddersWith(item) ? roundScale : 1))
            );
        station.blockIndex = b;
        station.blockLabel = block.label;
        station.blockScheme = block.scheme;
        station.roundIndex = r + 1;
        station.roundCount = block.rounds;

        // Only the first movement of a round carries the run; the rest of the
        // round is done back to back, which is what makes it a superset
        station.run = i === 0 ? block.run : undefined;
        if (block.archetype) station.archetype = block.archetype;
        if (block.paceTarget) station.paceTarget = block.paceTarget;

        // A run longer than the room is shuttled, like any other travelling
        // work - the distance is not reduced. Only a distance run can be:
        // there are no legs in a fifteen-minute easy run.
        if (i === 0 && block.legMetres !== undefined &&
            block.legMetres < runMetresOf(block.run)) {
          station.runLegMetres = block.legMetres;
        }

        out.push(station);
      }

      var lastRound = r === block.rounds - 1;
      var lastBlock = b === blocks.length - 1;

      if (block.restSeconds > 0 && !(lastRound && lastBlock)) {
        var rest = makeRestStation(block.restSeconds);
        rest.blockIndex = b;
        rest.blockLabel = block.label;
        rest.blockScheme = block.scheme;
        rest.roundIndex = r + 1;
        rest.roundCount = block.rounds;
        out.push(rest);
      }
    }
  }

  return out;
}

/** Total work in a block list, for the picker's estimate */
export function estimateBlockMinutes(blocks: SessionBlock[]): number {
  return estimateMinutes(flattenBlocks(blocks));
}

// ── Plan markers ────────────────────────────────────────────────────────────
//
// RaceStateMachine treats getStationConfig(1) as the first workout station and
// keys the finish flow off isFinish, so every plan needs both of these in
// exactly these positions.

export function makeStartMarker(): StationConfig {
  return {
    name: 'START',
    mode: StationMode.TIMED,
    requirement: 0,
    instruction: '',
    prefabType: 'START',
  };
}

export function makeFinishMarker(instruction: string): StationConfig {
  return {
    name: 'FINISH',
    mode: StationMode.TIMED,
    requirement: 0,
    instruction: instruction,
    prefabType: 'FINISH',
    isFinish: true,
  };
}

/** Wrap workout stations with the markers a loadable plan requires */
export function wrapPlanStations(
  stations: StationConfig[],
  finishText: string
): StationConfig[] {
  return [makeStartMarker()].concat(stations, [makeFinishMarker(finishText)]);
}


// ── Level variants ──────────────────────────────────────────────────────────
//
// Scaling here follows the load-first principle used by mainstream training
// apps rather than the movement-replacement of CrossFit's scaled division:
// a beginner does the same movement for the same reps, without the weight.
// Volume only moves upward, for athletes.
//
// Nothing here changes what the Lens measures. The detection thresholds in
// RaceStateMachine and HandZoneDetector were tuned on the device and are left
// exactly as they are; a variant only changes the name the athlete sees and
// what they are told to do. That is the same thing a coach does when they say
// "drop the dumbbells for this one" — the movement is prescribed, not policed.
//
// Race Day never applies these: the race is the race, and a leaderboard whose
// entries were run at different difficulties means nothing.

export interface StationVariant {
  /** Overrides the split name — only when the movement itself changes */
  name?: string;
  instruction: string;
}

/** Volume multiplier per level. Beginners keep the rep scheme; only load drops. */
export const LEVEL_VOLUME: { [K in Level]: number } = {
  BEGINNER: 1.0,
  REGULAR: 1.0,
  ATHLETE: 1.2,
};

/** Keyed by prefabType, which is the station's stable identity */
export const STATION_VARIANTS: { [prefabType: string]: { [K in Level]: StationVariant } } = {
  AIR_SKIERG: {
    BEGINNER: { instruction: 'Hands empty. Reach UP and PULL DOWN' },
    REGULAR:  { instruction: 'Dumbbells in hands. Reach UP and PULL DOWN' },
    ATHLETE:  { instruction: 'Heavy dumbbells. Full range, UP and PULL DOWN' },
  },

  POWER_LANE: {
    BEGINNER: { name: 'BEAR CRAWL', instruction: 'Bear crawl the lane, no weight' },
    REGULAR:  { instruction: 'Push through the lane!' },
    ATHLETE:  { instruction: 'Heavier dumbbells. Push through the lane!' },
  },

  CRAB_WALK: {
    BEGINNER: { name: 'REVERSE DUCK WALK', instruction: 'Reverse duck walk, hands free' },
    REGULAR:  { instruction: 'Walk backward with goblet hold' },
    ATHLETE:  { instruction: 'Heavier goblet. Walk backward' },
  },

  BURPEE_BROAD_JUMP: {
    BEGINNER: {
      name: 'BURPEE STEP-FORWARD',
      instruction: 'Drop DOWN, rise UP, then walk forward',
    },
    REGULAR: {
      instruction: 'Drop DOWN, rise UP, JUMP forward!',
    },
    ATHLETE: {
      instruction: 'Drop DOWN, rise UP, JUMP far!',
    },
  },

  POWER_ROW: {
    BEGINNER: { instruction: 'Hands empty. Reach forward then PULL BACK' },
    REGULAR:  { instruction: 'Dumbbells in hands. Reach forward then PULL BACK' },
    ATHLETE:  { instruction: 'Heavy dumbbells. Reach forward then PULL BACK' },
  },

  HEAVY_CARRY: {
    BEGINNER: { instruction: 'Light weight. Carry through the lane' },
    REGULAR:  { instruction: 'Carry through the lane!' },
    ATHLETE:  { instruction: 'Heavy weight. Carry through the lane!' },
  },

  WALKING_LUNGES: {
    BEGINNER: { instruction: 'Walking lunges, bodyweight' },
    REGULAR:  { instruction: 'Walking Lunges with dumbbells' },
    ATHLETE:  { instruction: 'Heavier dumbbells. Walking lunges' },
  },

  TARGET_PRESS: {
    BEGINNER: { instruction: 'Hands empty. Squat DOWN then reach UP' },
    REGULAR:  { instruction: 'Dumbbells at shoulders. Squat then press UP' },
    ATHLETE:  { instruction: 'Heavy dumbbells. Squat then press UP' },
  },
};

/**
 * Apply a level to a station. Returns a copy — the template is shared, and a
 * generated session must never mutate the course it was derived from.
 *
 * Volume is NOT applied here; the generator owns that so duration and level
 * scale in one place.
 */
export function applyLevel(cfg: StationConfig, level: Level): StationConfig {
  var family = STATION_VARIANTS[cfg.prefabType];
  var variant = family ? family[level] : null;

  if (!variant) {
    // Unknown station, or one with no variants declared — leave it alone
    return cfg;
  }

  // Copy, then override. This was a field-by-field rebuild and it was the
  // fourth one in this file: listing what to keep means whatever is added
  // next is silently dropped, which is how dropCm went missing once already.
  var out: StationConfig = {} as StationConfig;

  for (var key in cfg) {
    if (Object.prototype.hasOwnProperty.call(cfg, key)) {
      (out as any)[key] = (cfg as any)[key];
    }
  }

  if (variant.name) out.name = variant.name;
  if (variant.instruction) out.instruction = variant.instruction;

  return out;
}

// ── Cost model ──────────────────────────────────────────────────────────────
//
// RaceStateMachine records the run and the station work as separate splits
// ("Run to AIR SKIERG" then "AIR SKIERG"), so they are priced separately.
//
// These numbers are estimates. RaceAnalysis divides them out via its global
// scale factor, so being wrong by a constant across the board is harmless —
// what matters is that the relative cost of stations is roughly right.

/** Modelled jog speed, metres per second */
export const RUN_SPEED_MS = 2.5;
/** Modelled speed for loaded or technical distance work, metres per second */
export const LOADED_SPEED_MS = 0.8;
/** Modelled seconds per hard-gated full body rep (burpee broad jump) */
export const REP_SECONDS = 4.0;
/** Modelled seconds per hand-zone oscillation (skierg, row, press) */
export const ZONE_HIT_SECONDS = 2.0;
/** Modelled seconds per on-the-spot rep (push up, air squat, sit up) */
export const VERTICAL_REP_SECONDS = 3.0;
/** Modelled seconds per lateral hop rep (burpee over dumbbell) */
export const LATERAL_REP_SECONDS = 3.5;

export function runCostSeconds(metres: number): number {
  return metres / RUN_SPEED_MS;
}

/** Cost of the work at a station, excluding the run before it */
export function stationWorkCostSeconds(cfg: StationConfig): number {
  switch (cfg.mode) {
    case StationMode.TIMED:
      return cfg.requirement;
    case StationMode.DISTANCE:
      return cfg.requirement / LOADED_SPEED_MS;
    case StationMode.REPS:
      return cfg.requirement * REP_SECONDS;
    case StationMode.ZONE_HIT:
      return cfg.requirement * ZONE_HIT_SECONDS;
    case StationMode.VERTICAL_REPS:
    case StationMode.PITCH_REPS:
      return cfg.requirement * VERTICAL_REP_SECONDS;
    case StationMode.LATERAL_REPS:
      return cfg.requirement * LATERAL_REP_SECONDS;
    case StationMode.RUN:
      return runCostSeconds(cfg.requirement);
    default:
      return 0;
  }
}

/** Run plus work — used for the picker's duration estimate */
export function stationCostSeconds(cfg: StationConfig): number {
  return runPrescriptionCostSeconds(cfg.run, cfg.archetype, cfg.paceTarget) +
         stationWorkCostSeconds(cfg);
}

/**
 * How long a run takes, whichever way it was asked for.
 *
 * A timed run costs exactly what it prescribes; there is nothing to model.
 * A distance run has to be divided by an assumed speed, and that assumption
 * is the one place the duration estimate can be wrong about an athlete.
 *
 * Where the athlete has given us something to derive a pace from, it is their
 * pace that prices the run. This is the whole of what a personal pace is
 * allowed to change: how long the session is estimated to take, and through
 * that how many repetitions fit. The distances themselves, the recovery and
 * the minimum dose are properties of the archetype and stay where they are -
 * a slower athlete does not get a different session, they get the same
 * session with the right number of repetitions in the time they asked for.
 */
export function runPrescriptionCostSeconds(
  run?: RunPrescription,
  archetype?: string,
  paceTarget?: PaceTarget | null
): number {
  if (!run) return 0;
  if (run.kind === 'TIME') return run.seconds;

  var personal = targetPaceSecPerKm(paceTarget);
  if (personal !== null) return runSecondsAt(run.metres, personal);

  // An archetype knows how fast its own repetitions are run. Without this the
  // duration estimate prices a threshold kilometre at easy pace, the fitter
  // and the archetype disagree about how long the same session is, and the
  // fitter wins - by dropping a repetition the session needed.
  return archetype
    ? modelRunSeconds(archetype as RunningArchetype, run.metres)
    : runCostSeconds(run.metres);
}

export function estimateMinutes(stations: StationConfig[]): number {
  var seconds = 0;
  for (var i = 0; i < (stations ? stations.length : 0); i++) {
    seconds += stationCostSeconds(stations[i]);
  }
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * Modelled baseline in milliseconds for every split a plan produces, keyed the
 * way RaceStateMachine names them. RaceAnalysis uses this before an athlete
 * has personal history.
 */
export function buildModelBaselines(
  stations: StationConfig[]
): { [splitName: string]: number } {
  var out: { [splitName: string]: number } = {};

  for (var i = 0; i < (stations ? stations.length : 0); i++) {
    var cfg = stations[i];
    if (cfg.prefabType === 'START' || cfg.isFinish) continue;

    if (hasRun(cfg.run)) {
      out['Run to ' + cfg.name] = runPrescriptionCostSeconds(cfg.run) * 1000;
    }

    out[cfg.name] = stationWorkCostSeconds(cfg) * 1000;
  }

  return out;
}
