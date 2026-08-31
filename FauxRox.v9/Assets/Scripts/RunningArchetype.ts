// ============================================================================
// RunningArchetype.ts — what kind of running a running session is
// ============================================================================
// Eight times four hundred metres is a tempo run at one pace and a maximal
// aerobic session at another. Same geometry, different workout, different
// recovery cost, different place in a week - and nothing in a session built
// only from distances and rep counts tells the athlete which one they were
// handed.
//
// The archetype is that missing thing. It is not a label on top of the
// existing shapes: each one owns its own topology, its legal distances, its
// recovery band and its effort cue, which is what makes five sessions out of
// what is currently one session with five sets of numbers.
//
// This file is B1 - the vocabulary and the pace model. The topologies that
// use them come next.
//
// Pure: no Lens Studio imports.
// ============================================================================

/**
 * The five kinds of running session, ordered by intensity.
 *
 * Five and not six. Twenty-metre shuttles in a small room were considered and
 * left out: the focus is hidden in SMALL, so the archetype would be
 * unreachable without reversing "no running in a room", and what a shuttle
 * loads - braking, planting, re-accelerating - is not what any of these load.
 * It already exists under ENGINE and MIXED, correctly named.
 *
 * No LONG either. Thirty-five minutes is not a long run for anybody this is
 * aimed at, and the name would be a claim the session cannot support.
 */
import { SchedulingContext, scheduleRunning } from './RunningSchedule';

export type { SchedulingContext } from './RunningSchedule';

export type RunningArchetype =
  | 'EASY_BASE'
  | 'HYROX_PACE'
  | 'THRESHOLD'
  | 'VO2'
  | 'SPEED_REPETITION';

export const ALL_RUNNING_ARCHETYPES: RunningArchetype[] = [
  'EASY_BASE',
  'HYROX_PACE',
  'THRESHOLD',
  'VO2',
  'SPEED_REPETITION',
];

// ── The pace model ──────────────────────────────────────────────────────────
//
// The duration model needs to know how fast each archetype is run, and
// nobody's actual pace is known. What goes in is a prior for fitting sessions
// to a duration. It is not a claim about anyone's physiology and nothing in
// the app shows it to an athlete as their pace.
//
// The names carry the direction because a comment will not survive the
// refactor that inverts it. These are multipliers on PACE - seconds per
// kilometre - so a factor below one is FASTER. A bare 0.93 sitting next to a
// speed reads as slower to whoever meets it next, and would be, and the bug
// would be a silently miscalculated session rather than anything that throws.

/** Seconds per kilometre the model treats as threshold pace: 5:08 /km */
export const MODEL_THRESHOLD_PACE_SEC_PER_KM = 308;

/**
 * Pace relative to threshold, per archetype. Above one is slower.
 *
 * Ratios of the kind every pace table in the sport is built on, and like
 * those they are a population average rather than a constant: the
 * relationship between an individual's threshold and their maximal aerobic
 * pace moves with economy and anaerobic reserve. They are here to decide how
 * many repetitions fit in a session, and they get replaced the moment a
 * personal anchor exists.
 *
 * The anchor is chosen so that nothing regresses: at 5:08/km threshold, easy
 * pace lands on 2.50 m/s, which is exactly the constant the duration model
 * has been using for every run of any kind. Easy running stays where it was;
 * only the harder archetypes move, and they move toward the truth.
 */
export const MODEL_PACE_FACTOR: { [K in RunningArchetype]: number } = {
  EASY_BASE:        1.30,
  HYROX_PACE:       1.05,
  THRESHOLD:        1.00,
  VO2:              0.93,
  SPEED_REPETITION: 0.87,
};

/** Seconds per kilometre the model expects this archetype to be run at */
export function modelPaceSecPerKm(archetype: RunningArchetype): number {
  var factor = MODEL_PACE_FACTOR[archetype];
  return MODEL_THRESHOLD_PACE_SEC_PER_KM * (factor === undefined ? 1 : factor);
}

/** Metres per second, for callers that think in speed rather than pace */
export function modelSpeedMs(archetype: RunningArchetype): number {
  return 1000 / modelPaceSecPerKm(archetype);
}

/**
 * How long the model expects this many metres to take at this archetype.
 *
 * The one place the duration estimate can be wrong about a person, and it is
 * wrong by the ratio between their pace and the model's. A timed run needs
 * none of this - it costs what it prescribes.
 */
export function modelRunSeconds(
  archetype: RunningArchetype,
  metres: number
): number {
  if (metres <= 0) return 0;
  return (metres / 1000) * modelPaceSecPerKm(archetype);
}

/**
 * The same distance, priced at a pace somebody actually runs.
 *
 * Used wherever a personal pace is known. The model factors above are a
 * population prior; this is the athlete, and a session built to a duration
 * for somebody running 6:30 kilometres should not be the session built for
 * somebody running 4:10 ones.
 */
export function runSecondsAt(metres: number, paceSecPerKm: number): number {
  if (metres <= 0 || !isFinite(paceSecPerKm) || paceSecPerKm <= 0) return 0;
  return (metres / 1000) * paceSecPerKm;
}

// ── Fitting ─────────────────────────────────────────────────────────────────

/**
 * How far past a tier's target an archetype's minimum dose may sit.
 *
 * An engineering margin for the fitter, not a physiological quantity. The
 * fitter aims at the target rather than the ceiling, so an archetype whose
 * smallest honest version only fits at the top of the band would be
 * under-dosed most of the times it was offered - and a session called
 * threshold that is two repetitions long is not one.
 *
 * A dial. At 0.15 a short speed session misses by seventy-nine seconds; at
 * 0.30 it would be admitted. That trade is the reason this has a name instead
 * of being 1.15 inside an expression.
 */
export const ARCHETYPE_FIT_HEADROOM = 0.15;

/** The largest minimum dose a tier with this working budget can hold */
export function fitAllowanceSeconds(targetWorkingSeconds: number): number {
  return targetWorkingSeconds * (1 + ARCHETYPE_FIT_HEADROOM);
}

// ── Topology ────────────────────────────────────────────────────────────────
//
// What each archetype is, as a shape rather than a set of numbers. This is
// the part that makes them five sessions: the distances a coach would write
// for that kind of work, the recovery that keeps it that kind of work, and
// the smallest version still worth calling by the name.

/**
 * The recovery an archetype needs to remain itself.
 *
 * These are v1 policy values chosen to make the archetypes distinguishable,
 * not universal constants - interval prescription does not reduce to one
 * formula, and work duration and recovery structure both shape what the
 * session becomes.
 *
 * What they are not is interchangeable. Today every running session uses one
 * band of 0.75-1.25, which is right for exactly one of the five: threshold
 * rests six times too long, so the float becomes a recovery and the session
 * stops being threshold at all, and speed work rests four times too short, so
 * every repetition after the second is run tired - the one thing that session
 * exists to prevent.
 *
 * Note that the reasons differ even where the shape does not. VO2's short
 * recovery is chosen for incomplete metabolic clearance: starting the next
 * repetition before recovery is what keeps the athlete in the zone. Speed
 * work's long recovery is chosen for quality preservation, which is the
 * opposite intent through the same mechanism.
 */
export interface RecoveryBand {
  /** Seconds of rest per second of work */
  ratio: number;
  floorSeconds: number;
  ceilingSeconds: number;
  /** What the athlete does with those seconds */
  kind: RecoveryKind;
}

/**
 * What a break is, as distinct from how long it is.
 *
 * The seconds alone leave the athlete to guess, and guessing wrong changes
 * the session rather than their comfort. Forty-six seconds of a threshold
 * float walked is not a short break in a threshold session - it is a normal
 * break, and the lactate clears, and the session stops being the one that was
 * written. Three and a half minutes of speed-work recovery jogged is not a
 * generous break either; it is the reason the fifth repetition is slower than
 * the first.
 *
 * Same station at runtime. The kind changes what the athlete is told and what
 * the analysis calls it, not what is spawned.
 */
export type RecoveryKind =
  /** Short and moving, so that it never fully clears - a threshold float */
  | 'FLOAT_JOG'
  /** Moving, and long enough to be a recovery */
  | 'EASY_JOG'
  /** Near-full recovery, and walking it is the point rather than a concession */
  | 'WALK_OR_JOG';

export type PrescriptionShape = 'CONTINUOUS' | 'REPS';

export type MinimumWork =
  | { unit: 'SECONDS'; value: number }
  | { unit: 'METRES'; value: number }
  | { unit: 'REPS'; value: number };

export interface ArchetypeTopology {
  shape: PrescriptionShape;

  /**
   * Distances a coach would write for this kind of work, per tier.
   *
   * Per tier rather than one list, because a distance can be right for the
   * work and wrong for the time available: twelve hundred metres is a proper
   * threshold repetition and four of them do not fit a medium session.
   */
  legalMetres?: { [K in DurationTier]?: number[] };

  /** Minutes of continuous running, per tier */
  legalMinutes?: { [K in DurationTier]?: number };

  /** Recovery between repetitions. Continuous work has none. */
  recovery?: RecoveryBand;

  /**
   * The smallest version still worth the name, in the unit that decides it.
   *
   * Three archetypes, three currencies, and they are not interchangeable. A
   * threshold session is a quantity of metres at pace. A maximal aerobic one
   * is a quantity of minutes in the zone. A speed session is a count of
   * repetitions - the exposures are the dose, and six two-hundreds and three
   * four-hundreds are not the same session however similar their arithmetic
   * looks.
   *
   * This was one number in seconds doing both this job and the legality one,
   * and it produced four repetitions where the contract says six: the seconds
   * that mean six reps at a hundred metres mean three at two hundred.
   */
  minimumWork: MinimumWork;

  /**
   * True when the run is its own warm-up.
   *
   * Only easy running. The first minutes of an easy run are the warm-up -
   * that is what easy means - so putting four and a half minutes of drills in
   * front of a ten minute jog is warming up for a warm-up. Everything else
   * here starts at an intensity that needs preparing for.
   */
  absorbsWarmup: boolean;

  /** RPE, in the only language available until a personal pace exists */
  effortCue: string;

  /**
   * The same thing, at panel length.
   *
   * The long one is written to be said out loud by a coach mid-session. On a
   * heads-up display it would be three lines the athlete reads instead of
   * looking where they are going.
   */
  effortShort: string;
}

/** The duration tiers, named here so this file does not import the generator */
export type DurationTier = 'SHORT' | 'MEDIUM' | 'FULL';

export const RUNNING_TOPOLOGY: { [K in RunningArchetype]: ArchetypeTopology } = {
  EASY_BASE: {
    shape: 'CONTINUOUS',
    legalMinutes: { SHORT: 15, MEDIUM: 24, FULL: 36 },
    minimumWork: { unit: 'SECONDS', value: 600 },
    absorbsWarmup: true,
    effortCue: 'RPE 3-4. You could hold a conversation the whole way. ' +
               "If you couldn't, it wasn't this session.",
    effortShort: 'RPE 3-4 · conversational',
  },

  HYROX_PACE: {
    shape: 'REPS',
    // One distance, because it is the race distance and that is the point.
    legalMetres: { MEDIUM: [1000], FULL: [1000] },
    recovery: { ratio: 0.30, floorSeconds: 45, ceilingSeconds: 150, kind: 'EASY_JOG' },
    // The race is eight of these. Fewer than three does not teach the pace.
    minimumWork: { unit: 'REPS', value: 3 },
    absorbsWarmup: false,
    effortCue: 'Race pace. The speed you mean to still be running at the ' +
               'eighth kilometre, not the one you can hold for two.',
    effortShort: 'Race pace · the one you can hold for eight km',
  },

  THRESHOLD: {
    shape: 'REPS',
    legalMetres: { MEDIUM: [800, 1000], FULL: [800, 1000, 1200] },
    recovery: { ratio: 0.15, floorSeconds: 25, ceilingSeconds: 75, kind: 'FLOAT_JOG' },
    minimumWork: { unit: 'METRES', value: 2400 },
    absorbsWarmup: false,
    effortCue: 'Comfortably hard. You could say a sentence, not a paragraph. ' +
               'It should feel like you are holding something back, and you are.',
    effortShort: 'Comfortably hard · a sentence, not a paragraph',
  },

  VO2: {
    shape: 'REPS',
    // Three to five minutes is the window; 600 m is the short end of it and
    // the only one a medium session has room for.
    legalMetres: { MEDIUM: [600], FULL: [600, 800, 1000] },
    recovery: { ratio: 0.85, floorSeconds: 60, ceilingSeconds: 240, kind: 'EASY_JOG' },
    // Time in the zone is the dose, and eight minutes is the least of it
    // worth the trip.
    minimumWork: { unit: 'SECONDS', value: 480 },
    absorbsWarmup: false,
    effortCue: 'Hard. The last minute of every repetition should feel like ' +
               'the end of a race, and the next one starts before you have recovered.',
    effortShort: 'Hard · the last minute should feel like a finish',
  },

  SPEED_REPETITION: {
    shape: 'REPS',
    legalMetres: { MEDIUM: [150, 200], FULL: [200, 300] },
    recovery: { ratio: 4.0, floorSeconds: 90, ceilingSeconds: 300, kind: 'WALK_OR_JOG' },
    // The exposures are the dose. Two fast two-hundreds with four minutes
    // between them is a warm-up with delusions.
    minimumWork: { unit: 'REPS', value: 6 },
    absorbsWarmup: false,
    effortCue: 'Fast and relaxed. Quality over fatigue - if your shape falls ' +
               'apart the repetition is over.',
    effortShort: 'Fast and relaxed · quality over fatigue',
  },
};

/** What the athlete does between repetitions, or null for continuous work */
export function recoveryKindFor(archetype: RunningArchetype): RecoveryKind | null {
  var band = RUNNING_TOPOLOGY[archetype].recovery;
  return band ? band.kind : null;
}

/** Seconds of rest earned by a bout of work, for this archetype */
export function archetypeRecoverySeconds(
  archetype: RunningArchetype,
  workSeconds: number
): number {
  var band = RUNNING_TOPOLOGY[archetype].recovery;
  if (!band || workSeconds <= 0) return 0;

  return Math.max(
    band.floorSeconds,
    Math.min(band.ceilingSeconds, Math.round(workSeconds * band.ratio))
  );
}

/** Repetitions of this distance needed before the session earns its name */
export function minimumRounds(
  archetype: RunningArchetype,
  metres: number
): number {
  return minimumRoundsAt(archetype, metres, null);
}

/**
 * The same minimum, counted at a pace somebody actually runs.
 *
 * The dose does not move: six repetitions is still six, twenty-four hundred
 * metres is still twenty-four hundred, eight minutes of maximal aerobic work
 * is still eight minutes. Only the arithmetic that turns a dose expressed in
 * seconds into a number of repetitions knows who is running - and it has to,
 * because eight minutes of work is four six-hundreds for one athlete and
 * three for another, and pricing both at the model's pace gives one of them
 * a session they did not ask for.
 */
export function minimumRoundsAt(
  archetype: RunningArchetype,
  metres: number,
  paceSecPerKm: number | null
): number {
  var min = RUNNING_TOPOLOGY[archetype].minimumWork;
  if (metres <= 0) return 0;

  switch (min.unit) {
    case 'REPS':
      return min.value;
    case 'METRES':
      return Math.ceil(min.value / metres);
    default:
      var seconds = paceSecPerKm !== null && paceSecPerKm > 0
        ? runSecondsAt(metres, paceSecPerKm)
        : modelRunSeconds(archetype, metres);
      return Math.ceil(min.value / seconds);
  }
}

/** Seconds one repetition and the recovery it earns take together */
export function cycleSeconds(
  archetype: RunningArchetype,
  metres: number
): number {
  var work = modelRunSeconds(archetype, metres);
  return work + archetypeRecoverySeconds(archetype, work);
}

/** The smallest honest version of this archetype at this distance, in seconds */
export function minimumDoseSeconds(
  archetype: RunningArchetype,
  metres: number
): number {
  return minimumRounds(archetype, metres) * cycleSeconds(archetype, metres);
}

/**
 * Distances whose smallest honest session fits the time available.
 *
 * The legality question and the building question are the same question, so
 * they are asked once. A distance that is right for the work and wrong for
 * the time - twelve hundred metre threshold repetitions in a medium session -
 * drops out here rather than being listed as legal and then quietly
 * under-built.
 */
export function affordableMetresFor(
  archetype: RunningArchetype,
  tier: DurationTier,
  targetWorkingSeconds: number
): number[] {
  var allowance = fitAllowanceSeconds(targetWorkingSeconds);
  var out: number[] = [];

  var candidates = legalMetresFor(archetype, tier);
  for (var i = 0; i < candidates.length; i++) {
    if (minimumDoseSeconds(archetype, candidates[i]) <= allowance) {
      out.push(candidates[i]);
    }
  }

  return out;
}

/**
 * Whether a tier has room for this archetype at a dose worth the name.
 *
 * Against the target plus the fitter margin rather than against the band's
 * ceiling: the fitter aims at the target, so an archetype that only fits at
 * the top would be under-dosed most of the times it was offered - and a
 * session called threshold that is two repetitions long is not one. Offering
 * it would be worse than not offering it, because the athlete would believe
 * they had done the session.
 */
export function tierHoldsArchetype(
  archetype: RunningArchetype,
  tier: DurationTier,
  targetWorkingSeconds: number
): boolean {
  var topology = RUNNING_TOPOLOGY[archetype];

  if (topology.shape === 'CONTINUOUS') {
    var minutes = topology.legalMinutes ? topology.legalMinutes[tier] : undefined;
    if (minutes === undefined) return false;

    var min = topology.minimumWork;
    return min.unit === 'SECONDS' ? minutes * 60 >= min.value : true;
  }

  return affordableMetresFor(archetype, tier, targetWorkingSeconds).length > 0;
}

/** Distances this archetype may be run at in this tier */
export function legalMetresFor(
  archetype: RunningArchetype,
  tier: DurationTier
): number[] {
  var byTier = RUNNING_TOPOLOGY[archetype].legalMetres;
  var metres = byTier ? byTier[tier] : undefined;
  return metres ? metres.slice() : [];
}

// ── Selection ───────────────────────────────────────────────────────────────
//
// Two questions that look like one and are not:
//
//   legality    what IS this archetype, and can this session hold it?
//   scheduling  which one should this athlete be given today?
//
// The first is a property of the archetype and the request. The second is a
// property of the athlete's recent weeks - not to repeat an archetype they
// just did, not to put a hard session after a hard session - and it needs
// their history, which is nothing to do with what a threshold session is.
//
// Keeping them apart is what lets legality be tested without a history at
// all, and lets scheduling be tested without building a single session. Mixed
// together, "is VO2 legal in a medium session" and "should they do VO2 today"
// become one function that can only be tested by simulating a training year.

/** Archetypes this request could legally be built as, in intensity order */
export function legalArchetypes(
  tier: DurationTier,
  targetWorkingSeconds: number
): RunningArchetype[] {
  var out: RunningArchetype[] = [];

  for (var i = 0; i < ALL_RUNNING_ARCHETYPES.length; i++) {
    var archetype = ALL_RUNNING_ARCHETYPES[i];
    if (tierHoldsArchetype(archetype, tier, targetWorkingSeconds)) {
      out.push(archetype);
    }
  }

  return out;
}

/**
 * Which one of the legal archetypes to build.
 *
 * The seed picks, and it picks last. When a scheduling policy arrives it
 * narrows or weights the candidates first and the seed breaks the tie among
 * whatever survives - rather than the seed choosing and the policy vetoing,
 * which turns every rejection into a fallback and the fallbacks into the
 * behaviour nobody designed.
 *
 * @param context reserved for that policy; ignored while there is none
 */
export function selectRunningArchetype(
  candidates: RunningArchetype[],
  seed: number,
  context?: SchedulingContext
): RunningArchetype | null {
  if (!candidates || candidates.length === 0) return null;

  // The policy narrows, then the seed picks - in that order, so that the seed
  // is choosing among sessions the athlete should be offered rather than
  // choosing first and being overruled. Overruling turns every rejection into
  // a fallback, and the fallbacks become the behaviour nobody designed.
  var eligible = scheduleRunning(candidates, context);
  if (eligible.length === 0) return null;

  return eligible[seededIndex(seed, eligible.length)];
}

/**
 * A stable index in [0, count), from a seed.
 *
 * The same hash the generator uses for every other deterministic choice, so
 * a session is reproducible from its seed the whole way down.
 */
function seededIndex(seed: number, count: number): number {
  var h = 2166136261 ^ (seed | 0);
  var key = 'archetype';

  for (var i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  h ^= h >>> 16;

  return ((h >>> 0) % 100000) % count;
}
