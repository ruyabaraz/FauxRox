// ============================================================================
// AdaptiveSessionGenerator.ts — workouts from constraints
// ============================================================================
// Turns "small space, twenty minutes, engine work" into a loadable SessionPlan.
// Pure: it is handed the station templates and returns data, so every
// combination it can produce is verifiable outside the editor.
//
// Deterministic by construction. The same request always yields the same plan;
// variety comes from an explicit seed, never from Math.random(). That is what
// lets the test suite assert over the whole parameter space, and what lets the
// AI coach prescribe a session by choosing parameters rather than inventing
// exercises, rep counts or distances of its own.
//
// Constraint precedence:
//   space    is a hard constraint  — a room the athlete does not have cannot
//            be conjured, so this always wins
//   duration sets how much work    — nested tiers, see selection below
//   focus    is a preference       — it reorders candidates, it never
//            overrides what the space allows
// ============================================================================

import {
  StationConfig,
  StationMode,
  SessionKind,
  SessionPlan,
  Level,
  ALL_LEVELS,
  LEVEL_VOLUME,
  applyLevel,
  isStationary,
  isAccessory,
  wrapPlanStations,
  estimateMinutes,
  ACCESSORY_STATIONS,
  SessionBlock,
  BlockScheme,
  makeRecoveryStation,
  makeOnTheSpotRun,
  ON_THE_SPOT_RUN_PREFAB,
  warmupFor,
  warmupSuitsLevel,
  WarmupMovement,
  flattenBlocks,
  ladderScales,
  straightScales,
  stationCostSeconds,
  stationWorkCostSeconds,
  runCostSeconds,
  recoverySeconds,
  RecoveryProfile,
  snapRunMetres,
  snapRequirement,
  laddersWith,
  ladderRungs,
  ladderIsFlat,
  MIN_STATION_METRES,
  MIN_HOLD_SECONDS,
  MIN_STATION_REPS,
  distanceRun,
  timedRun,
  hasRun,
  runMetresOf,
  runSecondsOf,
  RunPrescription,
  runPrescriptionCostSeconds,
  snapRunSeconds,
  formatRunClock,
  RunPhase,
  makeRunStation,
} from './SessionTypes';

import {
  COMPROMISED_RUN_METRES,
  SMALL_SPACE_LEG_METRES,
  SMALL_SPACE_RUN_METRES,
  shuttleInstruction,
  shuttleLegs,
  shuttleRemainder,
  bandFor,
  withinBand,
} from './TrainingPrescription';

import {
  RunningArchetype,
  RUNNING_TOPOLOGY,
  archetypeRecoverySeconds,
  recoveryKindFor,
  affordableMetresFor,
  minimumRounds,
  minimumRoundsAt,
  fitAllowanceSeconds,
  modelRunSeconds,
  runSecondsAt,
  tierHoldsArchetype,
  legalArchetypes,
  selectRunningArchetype,
  SchedulingContext,
} from './RunningArchetype';

import { PaceAnchor, PaceTarget, resolveTarget, targetPaceSecPerKm } from './PaceTarget';

import { effortLine } from './EffortCue';

// Level lives in SessionTypes because the station variant table needs it.
// Re-exported so callers keep importing the whole request vocabulary here.
export type { Level } from './SessionTypes';
export { ALL_LEVELS } from './SessionTypes';

// ── Request ─────────────────────────────────────────────────────────────────

export type Space    = 'SMALL' | 'NORMAL';
export type Duration = 'SHORT' | 'MEDIUM' | 'FULL';
export type Focus    = 'RUNNING' | 'ENGINE' | 'STRENGTH' | 'MIXED';

export const ALL_SPACES: Space[]       = ['SMALL', 'NORMAL'];
export const ALL_DURATIONS: Duration[] = ['SHORT', 'MEDIUM', 'FULL'];
export const ALL_FOCUSES: Focus[]      = ['RUNNING', 'ENGINE', 'STRENGTH', 'MIXED'];

export interface SessionRequest {
  space: Space;
  duration: Duration;
  focus: Focus;
  /**
   * The athlete's fitness level, from their profile. Scales volume without
   * touching which stations are chosen — the same session, sized for them.
   * Defaults to REGULAR when there is no profile.
   */
  level?: Level;
  /** Same seed, same plan. Vary it to vary the workout. */
  seed?: number;
}

export interface GeneratorInput {
  /** The race's workout stations, without START / FINISH */
  templates: StationConfig[];
  /** Run distance between stations in a normal space, metres */
  baseRunMetres: number;

  /**
   * What is known of the athlete's recent training, when anything is.
   *
   * On the input rather than the request because it describes the athlete
   * rather than what they asked for: the same request from the same person on
   * two different days should not always produce the same session, and the
   * reason it does not is here.
   */
  history?: SchedulingContext;

  /**
   * What is known about the athlete's paces, most specific first.
   *
   * Absent for anybody who has neither told us a time nor raced, which is
   * everybody's first session. Sessions are built to say nothing about pace
   * in that state rather than to fill it in with a model's guess.
   *
   * A list because two kinds of knowledge can be held at once and they answer
   * different questions: races say what somebody holds on race day and
   * nothing else, a 5K speaks for the rest.
   */
  paceAnchors?: PaceAnchor[];
  /**
   * Accessory movements available to training sessions. Defaults to the full
   * catalogue; pass an empty array for race-stations-only sessions.
   */
  accessories?: StationConfig[];
  /**
   * prefabType of the station the athlete's verdict named as their limiter.
   * Accessories that develop it are preferred, so a session answering "your
   * burpees cost you time" contains the pressing and squatting underneath the
   * burpee rather than simply more burpees.
   */
  limiterPrefabType?: string;
  /**
   * prefabTypes the athlete trained in their last session. Equally suitable
   * movements that appear here are pushed down the ranking.
   */
  recentMovements?: string[];
}

// ── Tuning ──────────────────────────────────────────────────────────────────

/**
 * Working blocks per duration tier. A session is a warm-up, these, and a
 * finisher, so the totals are 3, 4 and 5.
 */
const WORKING_BLOCKS: { [k: string]: number } = { SHORT: 1, MEDIUM: 2, FULL: 3 };

/** Round counts a working block may use, chosen per block */
const STRAIGHT_ROUNDS = [3, 4, 5];
/** Ladders are pyramids, so they need an odd number of rounds */
const LADDER_ROUNDS = [5, 7];
/** A minute-based finisher runs longer */
const EMOM_ROUNDS = [6, 8, 10];
/** The clock an EMOM round is written to, seconds */
const EMOM_WINDOW_SECONDS = 60;

/**
 * Running blocks descend: long intervals while fresh, shorter and faster as
 * the session goes on. Rounds climb as the distance falls, which is how a real
 * session is written - a long main set, then repeats.
 */
const RUNNING_LADDER = [
  { distanceScale: 2.0, rounds: 3 },
  { distanceScale: 1.2, rounds: 5 },
  { distanceScale: 0.75, rounds: 6 },
];
/** Easy walk between efforts, seconds */
const RUNNING_RECOVERY_SECONDS = 60;

/** Drills in the warm-up, done straight through */
const WARMUP_MOVEMENT_COUNT = 3;

/**
 * How long the warm-up takes, seconds. The same for everybody.
 *
 * A target rather than a sum of whatever drills came up. A coach writes "five
 * minutes to warm up" and then chooses what fills it; letting the total float
 * with the draw also made it float with the athlete's level, since the levels
 * are offered different drills - and a warm-up costing different seconds per
 * level fed the level straight back into the duration fit, which answered by
 * giving them different round counts.
 *
 * It does not scale with the session or the athlete. Warming up is not part
 * of the dose: the tissue takes as long as it takes to be ready, and a short
 * session does not earn a shorter one - if anything it earns the same, since
 * the work starts sooner. What the level changes is which drills fill it.
 */
const WARMUP_SECONDS = 270;
/** A warm-up is one pass of drills, not rounds of work */
const WARMUP_ROUNDS = 1;
/** Fraction of race volume each duration tier asks for */
const VOLUME_SCALE: { [k: string]: number } = { SHORT: 0.4, MEDIUM: 0.6, FULL: 1.0 };
// Volume per level comes from SessionTypes: beginners keep the rep scheme and
// drop the load, so only athletes move the number. Uniform across stations, so
// a level change cannot reorder the duration tiers.

/** Distance-station work is cut to this fraction in a small space */
const SMALL_SPACE_DISTANCE_SCALE = 0.25;
/**
 * Hard ceiling on distance work in a small space, metres.
 *
 * Scaling proportionally is not enough on its own: a quarter of the 200m
 * heavy carry is still 50m, which is a corridor rather than a room. Whatever
 * a station asks for in a race, in a small space it asks for at most this.
 */
export const SMALL_SPACE_MAX_DISTANCE_METRES = 20;
/** At most this fraction of a small-space session may be distance stations */
export const SMALL_SPACE_MAX_DISTANCE_RATIO = 0.4;

/**
 * Roughly a third of a training session is accessory work.
 *
 * Left to scoring alone the mix collapsed: with a strength focus the four
 * loaded race stations outscored every accessory, so a five station session
 * held one and a full one held none. A session is race work plus the work that
 * builds it, so the split is decided rather than emergent.
 */
const ACCESSORY_SHARE = 1 / 3;
/** Bonus for an accessory that develops the athlete's named limiter */
const LIMITER_BONUS = 1.5;

/**
 * How far a movement drops for having been trained last session.
 *
 * Deliberately smaller than every real constraint, so it can separate equally
 * suitable movements but never overrule one:
 *
 *   space   stationary vs travelling   3.5 apart
 *   focus   preferred vs not           1.4 apart
 *   limiter develops it vs not         1.5 apart
 *
 * At 0.5 a penalised movement still outranks anything the constraints put
 * below it. Repetition is a preference; a room the athlete does not have is
 * not.
 */
const RECENCY_PENALTY = 0.5;

/** Requirement floors, so no station is ever generated at zero */
const MIN_DISTANCE_METRES = MIN_STATION_METRES;
const MIN_REPS = MIN_STATION_REPS;
const MIN_SECONDS = MIN_HOLD_SECONDS;

// ── Level ───────────────────────────────────────────────────────────────────

function requestLevel(request: SessionRequest): Level {
  return request.level || 'REGULAR';
}

function levelScale(request: SessionRequest): number {
  return LEVEL_VOLUME[requestLevel(request)] || 1.0;
}

// ── Deterministic jitter ────────────────────────────────────────────────────

/**
 * A stable pseudo-random value in [0, 1) from a seed and a key. Used only to
 * break ties between equally suitable stations, so a different seed gives a
 * different-but-equally-valid workout.
 */
function jitter(seed: number, key: string): number {
  var h = 2166136261 ^ (seed | 0);

  for (var i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  // xorshift finish, then map to [0, 1)
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  h ^= h >>> 16;

  return ((h >>> 0) % 100000) / 100000;
}

// ── Scoring ─────────────────────────────────────────────────────────────────

/**
 * How well a station suits the request. Higher is better.
 *
 * Space dominates: in a small room a DISTANCE station asks the athlete to
 * cover ground they do not have, so it is pushed far down whatever the focus
 * asks for. Focus then nudges the remaining order.
 */
function score(cfg: StationConfig, request: SessionRequest, input: GeneratorInput): number {
  var value = 1.0;

  if (request.space === 'SMALL') {
    value += isStationary(cfg) ? 2.0 : -1.5;
  }

  if (isAccessory(cfg)) {
    if (input.limiterPrefabType && developsLimiter(cfg, input.limiterPrefabType)) {
      value += LIMITER_BONUS;
    }
  } else if (input.limiterPrefabType === cfg.prefabType) {
    // The station that held the athlete back has to be in the session, not
    // only the accessories that build it. Accessories are paired to whichever
    // race station leads their block, so if the limiter never leads one, its
    // helpers never get chosen either.
    value += LIMITER_BONUS;
  }

  if (input.recentMovements && input.recentMovements.indexOf(cfg.prefabType) >= 0) {
    value -= RECENCY_PENALTY;
  }

  // Focus is deliberately absent.
  //
  // It used to nudge the ranking by a point either way, which is how ENGINE
  // and MIXED ended up producing byte-identical sessions with different
  // movement names in them. Focus now chooses the candidate pool and the
  // block topology - see grammarFor - and scoring ranks within whatever pool
  // it was handed. Scoring it here as well would count the same preference
  // twice and would let a focus preference outrank the room the athlete is
  // standing in.
  return value;
}

/** The mode of the first race station this accessory develops */
function inheritedMode(cfg: StationConfig, input: GeneratorInput): StationMode {
  var develops = (cfg as any).develops as string[];
  if (!develops || develops.length === 0) return cfg.mode;

  for (var i = 0; i < input.templates.length; i++) {
    if (develops.indexOf(input.templates[i].prefabType) >= 0) {
      return input.templates[i].mode;
    }
  }

  return cfg.mode;
}

function developsLimiter(cfg: StationConfig, limiterPrefabType: string): boolean {
  var develops = (cfg as any).develops as string[];
  return !!develops && develops.indexOf(limiterPrefabType) >= 0;
}

/**
 * Rank one pool for this request.
 *
 * Blocks are then taken from the top, which is what makes the duration tiers
 * nested: a longer session contains everything a shorter one did.
 */
function rankPool(
  pool: StationConfig[],
  input: GeneratorInput,
  request: SessionRequest
): StationConfig[] {
  var seed = request.seed === undefined ? 0 : request.seed;

  var ranked = pool.slice();
  ranked.sort(function (a, b) {
    var scoreDelta = score(b, request, input) - score(a, request, input);
    if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;

    var jitterDelta = jitter(seed, b.name) - jitter(seed, a.name);
    if (Math.abs(jitterDelta) > 1e-9) return jitterDelta;

    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });

  return ranked;
}

/**
 * Per-round volume.
 *
 * A movement done in three rounds is not done at race volume three times, so
 * the session's total volume is divided across its rounds. A race burpee
 * station of 25 becomes roughly 5 per round in a medium session, which is the
 * shape the real programmes use.
 */
function roundRequirement(
  cfg: StationConfig,
  request: SessionRequest,
  rounds: number
): number {
  // Level is deliberately absent: it is applied after the session has been
  // fitted to its duration. See applyLevelVolume.
  var total = cfg.requirement * VOLUME_SCALE[request.duration];
  var perRound = total / Math.max(1, rounds);

  // A small room shortens the leg, never the prescription. Distance is
  // tracked as accumulated path length, so a hundred metres of carry is a
  // hundred metres whether it is walked in a line or shuttled across a room.
  // Capping the total here is what turned a 200m carry into 20m.
  var snapped = snapRequirement(cfg.mode, perRound);

  switch (cfg.mode) {
    case StationMode.DISTANCE:
      return Math.max(MIN_DISTANCE_METRES, snapped);
    case StationMode.TIMED:
      return Math.max(MIN_SECONDS, snapped);
    default:
      return Math.max(MIN_REPS, snapped);
  }
}

function sizedItem(
  cfg: StationConfig,
  request: SessionRequest,
  rounds: number
): StationConfig {
  var leveled = applyLevel(cfg, requestLevel(request));
  var requirement = roundRequirement(cfg, request, rounds);

  var item: StationConfig = {
    name: leveled.name,
    mode: leveled.mode,
    requirement: requirement,
    instruction: leveled.instruction,
    prefabType: leveled.prefabType,
    motionType: leveled.motionType,
    dropCm: leveled.dropCm,
  };

  return item;
}

/**
 * The accessory that belongs with this station.
 *
 * A block is a pair, and a pair is only coaching if the two halves are
 * related. Walking lunges next to a plank is two movements in a row; walking
 * lunges next to air squats is the pattern and the thing that builds it.
 * Every accessory records which race stations it develops, so the pairing
 * follows that rather than whatever happened to rank next.
 *
 * Falls back to the best unused accessory when nothing declares a link, and
 * only then to the top of the ranking.
 */
function pairFor(
  race: StationConfig,
  accessories: StationConfig[],
  used: { [prefabType: string]: boolean },
  space: Space
): StationConfig {
  if (accessories.length === 0) return null;

  var fallback: StationConfig = null;
  var related: StationConfig = null;

  for (var i = 0; i < accessories.length; i++) {
    var candidate = accessories[i];
    if (used[candidate.prefabType]) continue;

    if (!fallback) fallback = candidate;

    var develops = (candidate as any).develops as string[];
    if (!develops || develops.indexOf(race.prefabType) < 0) continue;

    // The room is still the room. Pairing by what develops what bypasses the
    // ranking, so the space rule has to be applied again here - otherwise a
    // carry pairs with a carry and a small room ends up with two travelling
    // movements in every round.
    if (space === 'SMALL' && !isStationary(candidate)) {
      if (!related) related = candidate;
      continue;
    }

    return candidate;
  }

  return related || fallback || accessories[0];
}

/** Deterministically pick one of a list */
function pick<T>(options: T[], seed: number, key: string): T {
  return options[Math.floor(jitter(seed, key) * options.length) % options.length];
}

function itemNames(items: StationConfig[]): string {
  var names: string[] = [];
  for (var i = 0; i < items.length; i++) names.push(items[i].name);
  return names.join(' + ');
}

/**
 * How the run reads.
 *
 * "80m run" in a room the athlete has to turn round in four times is a fair
 * description of the distance and a poor description of the work. Where the
 * leg is shorter than the run, the label says so - and the athlete knows to
 * put a marker at the wall before they start rather than discovering it at
 * a sprint.
 */
function runLabel(block: SessionBlock): string {
  // A timed run has no legs and no distance to divide: it is a duration, and
  // the only honest label for it is that duration.
  if (block.run && block.run.kind === 'TIME') {
    return formatRunClock(block.run.seconds) + ' run';
  }

  var metres = runMetresOf(block.run);

  if (block.legMetres === undefined || block.legMetres >= metres) {
    return metres + 'm run';
  }

  // The distance first, always. A leg count multiplies to the wrong number
  // whenever the distance does not divide - fifty metres is not three
  // twenties - so the count only appears when it adds up.
  var shuttle = shuttleRemainder(metres, block.legMetres) === 0
    ? ' (' + shuttleLegs(metres, block.legMetres) + ' × ' +
      block.legMetres + 'm)'
    : ' (' + block.legMetres + 'm lengths)';

  return metres + 'm shuttle' + shuttle;
}

/**
 * The same run, more or less of it.
 *
 * Both knobs the fitter turns - per-round volume and the level dose - scale a
 * run, and what scaling means depends on which kind it is. Metres get the
 * room's cap applied and land on the distance grid; seconds get neither,
 * because a room does not shorten a twelve-minute run and there is no leg to
 * cap. Keeping that fork in one function is the point: a caller that reaches
 * for block.run and multiplies would silently do the wrong thing to one of
 * the two kinds.
 */
function scaleRun(
  run: RunPrescription | undefined,
  scale: number,
  space: Space,
  canonical?: boolean
): RunPrescription | undefined {
  if (!run) return undefined;

  // An archetype's distances are the prescription. Scaled to fill a gap in
  // the timing they stop being what they were: six hundred metres at maximal
  // aerobic pace is just under three minutes, which is the bottom of the
  // window that makes it maximal aerobic work, and four hundred is not a
  // smaller version of that session - it is a different one wearing its name.
  if (canonical) return run;

  if (run.kind === 'TIME') {
    return timedRun(snapRunSeconds(run.seconds * scale));
  }

  var metres = snapRunMetres(roomRunLimit(run.metres * scale, space));
  return metres > 0 ? distanceRun(metres) : undefined;
}

/** The movement a ladder climbs - the first that is counted rather than held */
function ladderingItem(block: SessionBlock): StationConfig {
  for (var i = 0; i < block.items.length; i++) {
    if (laddersWith(block.items[i])) return block.items[i];
  }
  return null;
}

function blockLabel(block: SessionBlock, isFinisher?: boolean): string {
  // A continuous run is the whole block, so it is the whole label. Falling
  // through to the rounds branch would have called a fifteen minute easy run
  // "1 × 15:00 run + ", which is three lies in six words.
  if (hasRun(block.run) && (!block.items || block.items.length === 0)) {
    return runLabel(block);
  }

  var run = hasRun(block.run) ? runLabel(block) + ' + ' : '';
  var body = run + itemNames(block.items);

  switch (block.scheme) {
    case BlockScheme.WARMUP:
      return 'Warm-up · ' + itemNames(block.items);

    case BlockScheme.LADDER:
      // The rungs come from the same function that prescribes them, so the
      // label cannot describe a session the athlete does not do: it printed
      // "(5-6-8-6-5)" while they did eight reps five times, because the label
      // applied no floor and the prescription did.
      //
      // And they come from the movement that actually climbs. A block of a
      // carry and a plank ladders the carry; a plank written as
      // 12-16-20-16-12 seconds is not a ladder.
      var climbing = ladderingItem(block);
      if (!climbing) return block.rounds + ' × ' + body;

      return 'Ladder · ' + body + '  (' + climbing.name + ' ' +
             ladderRungs(climbing, block.roundScales).join('-') + ')';

    case BlockScheme.EMOM:
      return 'Finisher · EMOM ' + block.rounds + ' min · ' + body;

    default:
      return (isFinisher ? 'Finisher · ' : '') + block.rounds + ' × ' + body;
  }
}

/**
 * Rest between rounds.
 *
 * An EMOM is written to the clock rather than to a rest period: whatever the
 * work does not use of the minute is the rest, so it is derived rather than
 * chosen.
 */
/**
 * Rest between rounds, earned by the round before it.
 *
 * It used to be a flat sixty seconds whatever it followed, which measured out
 * as sessions that were 70 to 93 per cent rest - and worst at SHORT, because
 * the duration tier scaled the work and left the rest alone. Three seconds of
 * interval does not earn a minute of walking.
 */
/**
 * True when the round already contains its own recovery.
 *
 * An interval is an effort and the easy half that follows it, so a block
 * holding a recovery walk has its rest inside the round. Adding a break on
 * top gives every interval two recoveries.
 *
 * Written as "contains one" rather than "is one": when a room replaced the
 * run with fast feet on the spot, the round stopped being recovery-only and
 * the second rest came straight back - a beginner's indoor running session
 * was ninety seconds of standing after every forty seconds of work.
 */
function carriesOwnRecovery(items: StationConfig[]): boolean {
  for (var i = 0; i < (items ? items.length : 0); i++) {
    if (items[i].prefabType === 'RECOVERY') return true;
  }
  return false;
}

function restFor(
  scheme: BlockScheme,
  items: StationConfig[],
  run: RunPrescription | undefined,
  request: SessionRequest,
  seed: number
): number {
  // Drills run straight through. Resting between mobility movements defeats
  // the point of doing them.
  if (scheme === BlockScheme.WARMUP) return 0;

  // A block with no movements in it is one continuous bout - an easy run -
  // and rest sits between rounds. There is nothing here to sit between, and
  // the recovery model, asked anyway, priced a break for a fifteen minute
  // run as though it were a set.
  if (!items || items.length === 0) return 0;

  // The walk IS the rest half of an interval; a break on top is a second one.
  if (carriesOwnRecovery(items)) return 0;

  // An EMOM's rest is whatever is left of the minute, by definition.
  if (scheme === BlockScheme.EMOM) {
    var work = 0;
    for (var i = 0; i < items.length; i++) work += stationCostSeconds(items[i]);
    return Math.max(5, Math.round(EMOM_WINDOW_SECONDS - work));
  }

  return recoverySeconds(
    roundWorkSeconds(items, run),
    profileFor(request.focus),
    requestLevel(request),
    jitter(seed, 'rest')
  );
}

/**
 * Seconds of work in one round of this block.
 *
 * What the rest that follows is earned by. Includes the run, because on a
 * compromised-work round the run is most of the effort.
 */
function roundWorkSeconds(
  items: StationConfig[],
  run?: RunPrescription,
  archetype?: string
): number {
  var seconds = runPrescriptionCostSeconds(run, archetype);
  for (var i = 0; i < items.length; i++) {
    seconds += stationWorkCostSeconds(items[i]);
  }
  return seconds;
}

/** True when a ladder's rungs would all floor to the same number */
function ladderCollapses(
  scheme: BlockScheme,
  rounds: number,
  items: StationConfig[]
): boolean {
  if (scheme !== BlockScheme.LADDER) return false;

  var scales = ladderScales(rounds);

  for (var i = 0; i < items.length; i++) {
    if (!laddersWith(items[i])) continue;
    if (!ladderIsFlat(ladderRungs(items[i], scales))) return false;
  }

  return true;
}

function makeBlock(
  scheme: BlockScheme,
  rounds: number,
  run: RunPrescription | undefined,
  items: StationConfig[],
  request: SessionRequest,
  seed: number,
  isFinisher?: boolean,
  legMetres?: number
): SessionBlock {
  // A ladder needs room above the floor to climb. When the dose is already
  // near the smallest prescription a coach would write, every rung floors to
  // the same number and the block is straight sets wearing a ladder's name.
  //
  // Decided here rather than papered over in the label, so the scheme the HUD
  // shows, the scheme the analysis reads and the work the athlete does are
  // one thing.
  var actual = ladderCollapses(scheme, rounds, items)
    ? BlockScheme.STRAIGHT
    : scheme;

  var block: SessionBlock = {
    label: '',
    scheme: actual,
    rounds: rounds,
    run: run,
    items: items,
    // At REGULAR, whatever level asked. The athlete's own recovery is applied
    // with the rest of their dose, after the session has been fitted - and
    // rest here fed the level into the fit's starting point, which is how a
    // beginner ended up with more work in them than a regular athlete.
    restSeconds: restFor(actual, items, run, neutralRequest(request), seed),
    roundScales: actual === BlockScheme.LADDER
      ? ladderScales(rounds)
      : straightScales(rounds),
  };

  if (legMetres !== undefined && legMetres < runMetresOf(run)) {
    block.legMetres = legMetres;
  }

  block.label = blockLabel(block, isFinisher);
  return block;
}

/**
 * A round count from the grammar's legal options, sized to the tier.
 *
 * A short session is fewer rounds, not the same rounds shrunk to nothing.
 * Left to the seed alone, a SHORT strength session drew seven ladder rounds
 * and the fitter then squeezed each one to fifteen seconds of work - which
 * the rest floor answered with thirty seconds off, so a twelve-minute session
 * was three minutes of training. Fewer, fuller rounds is both the better
 * workout and the honest way to be short.
 */
function roundsFor(
  options: number[],
  duration: Duration,
  seed: number,
  key: string
): number {
  if (options.length === 0) return 1;
  if (options.length === 1) return options[0];

  var half = Math.ceil(options.length / 2);
  var allowed = duration === 'SHORT'
    ? options.slice(0, half)                 // the low end
    : duration === 'FULL'
      ? options.slice(options.length - half) // the high end
      : options.slice();                     // anywhere

  return pick(allowed, seed, key);
}

// ── Grammar ─────────────────────────────────────────────────────────────────
//
// Focus used to change two scoring weights and one boolean, and ENGINE and
// MIXED came out of the same loop with the same silhouette:
//
//   ENGINE     3 x 6m run + STANDING ROW + HIGH KNEES
//   MIXED      3 x 6m run + STANDING ROW + FARMERS HOLD
//
// Same shape, different names. Focus now decides two things instead - which
// movements are candidates, and what the session is built out of - and the
// four options produce four different workouts rather than one workout with
// four vocabularies.
//
// Everything below the grammar is shared: warm-up, level scaling, limiter and
// recency ranking, rest, flattening. Scoring still ranks candidates, but only
// within the pool the grammar handed it, which is why a burpee limiter cannot
// turn an engine day into a burpee session - burpees are not in the pool, and
// a bonus cannot add them to it.

type Grammar = 'STRENGTH' | 'ENGINE' | 'RUNNING' | 'MIXED';

/**
 * Recovery profile per grammar - see RECOVERY_POLICY.
 *
 * Running is absent on purpose and falls through to MIXED, which never
 * happens: an archetype block prices its own recovery and does not ask, and
 * an archetype block is the only kind a running session produces. The cast
 * this replaced would have answered with undefined and been found later, by
 * a session with no rest in it.
 */
function profileFor(focus: Focus): RecoveryProfile {
  switch (focus) {
    case 'STRENGTH': return 'STRENGTH';
    case 'ENGINE':   return 'ENGINE';
    default:         return 'MIXED';
  }
}

/**
 * The movements a grammar may draw on.
 *
 * Strength wants loaded work that travels: carries, crawls, lunges. Engine
 * wants continuous work that does not: the hand-tracked stations, which are
 * the only repeatable no-travel modalities this app can measure. Mixed takes
 * everything, because arriving tired at whatever comes next is the point.
 *
 * There is no erg. AIR SKIERG and STANDING ROW are hand-tracked mimes counted
 * in oscillations, so an engine session is a rotation between modalities at a
 * rep target - not "500m ski", which this cannot measure and must not claim.
 */
function racePoolFor(
  focus: Focus,
  templates: StationConfig[],
  space: Space
): StationConfig[] {
  var out: StationConfig[] = [];

  for (var i = 0; i < templates.length; i++) {
    var cfg = templates[i];
    var keep = true;

    if (focus === 'STRENGTH') {
      // Strength wants loaded work that travels. In a room, everything that
      // travels has to be shuttled, so a session built only from those is a
      // session of turning round - space outranks focus, and the pool opens
      // up rather than the room being ignored.
      keep = space === 'SMALL' || cfg.mode === StationMode.DISTANCE;
    } else if (focus === 'ENGINE') {
      keep = cfg.mode === StationMode.ZONE_HIT || cfg.mode === StationMode.REPS;
    }

    if (keep) out.push(cfg);
  }

  return out.length > 0 ? out : templates.slice();
}

function accessoryPoolFor(focus: Focus, accessories: StationConfig[]): StationConfig[] {
  var out: StationConfig[] = [];

  for (var i = 0; i < accessories.length; i++) {
    var cfg = accessories[i];
    var keep = true;

    if (focus === 'ENGINE') {
      // Holds are not engine work; they are the absence of movement.
      keep = cfg.mode !== StationMode.TIMED || cfg.prefabType === 'HIGH_KNEES';
    }

    if (keep) out.push(cfg);
  }

  return out.length > 0 ? out : accessories.slice();
}

// ── Shared pieces ───────────────────────────────────────────────────────────

/** Drills, matched to the session, done straight through */
function buildWarmup(request: SessionRequest, seed: number): SessionBlock {
  var level = requestLevel(request);
  var drills = warmupFor(request.focus === 'RUNNING' ? 'RUNNING' : 'GENERAL');

  // Order by what suits the level first, then by the seed, and take a prefix.
  //
  // Preference rather than restriction: there are only two brisk general
  // drills, so filtering on intensity gave every advanced session the same
  // two every time. Sorting keeps the warm-up's character - a beginner's
  // opens with mobility, an athlete's with fast feet - while the drills below
  // the preferred ones still fill the remaining slots and still vary.
  //
  // Picking one at a time and checking for collisions can still collide; a
  // prefix of a sorted list cannot.
  var shuffled = drills.slice();
  shuffled.sort(function (a, b) {
    var suitsA = warmupSuitsLevel(a, level) ? 0 : 1;
    var suitsB = warmupSuitsLevel(b, level) ? 0 : 1;
    if (suitsA !== suitsB) return suitsA - suitsB;

    var delta = jitter(seed, 'warmup' + a.name) - jitter(seed, 'warmup' + b.name);
    if (Math.abs(delta) > 1e-9) return delta;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });

  var chosen: WarmupMovement[] = [];
  for (var c = 0; c < Math.min(WARMUP_MOVEMENT_COUNT, shuffled.length); c++) {
    chosen.push(shuffled[c]);
  }

  // Share the warm-up's minutes out in proportion to how long each drill asks
  // for, so a mobility drill and a set of high knees keep their relative
  // weight while the total stays what it was promised to be.
  var asked = 0;
  for (var a = 0; a < chosen.length; a++) asked += chosen[a].requirement;
  var share = asked > 0 ? WARMUP_SECONDS / asked : 1;

  var items: StationConfig[] = [];
  for (var w = 0; w < chosen.length; w++) {
    var drill = chosen[w];
    items.push({
      name: drill.name,
      mode: drill.mode,
      // The drill's share of the warm-up, at REGULAR. The level's own timing
      // is applied after the session has been fitted, with everything else it
      // changes.
      requirement: Math.max(MIN_SECONDS, Math.round(drill.requirement * share)),
      instruction: drill.instruction,
      prefabType: drill.prefabType,
      dropCm: drill.dropCm,
    });
  }

  if (items.length === 0) return null;

  return makeBlock(BlockScheme.WARMUP, WARMUP_ROUNDS, undefined, items, request, 0);
}

/**
 * A finisher, when the grammar wants one.
 *
 * Optional on purpose: a running session closing with three sit-ups was the
 * shared template asserting itself over the session's own purpose.
 */
function buildFinisher(
  races: StationConfig[],
  accessories: StationConfig[],
  request: SessionRequest,
  seed: number
): SessionBlock {
  var pool = accessories.length > 0 ? accessories : races;
  if (pool.length === 0) return null;

  var finisher = pool[pool.length - 1];
  for (var f = pool.length - 1; f >= 0; f--) {
    if (pool[f].mode !== StationMode.TIMED) {
      finisher = pool[f];
      break;
    }
  }

  var emomPossible = finisher.mode !== StationMode.TIMED;
  var scheme = emomPossible
    ? pick([BlockScheme.EMOM, BlockScheme.EMOM, BlockScheme.STRAIGHT], seed, 'finisher')
    : BlockScheme.STRAIGHT;

  var rounds = scheme === BlockScheme.EMOM
    ? roundsFor(EMOM_ROUNDS, request.duration, seed, 'finisherRounds')
    : roundsFor(STRAIGHT_ROUNDS, request.duration, seed, 'finisherRounds');

  var item = sizedItem(finisher, request, rounds);

  if (scheme === BlockScheme.EMOM) fillEmomWindow(item);

  return makeBlock(scheme, rounds, undefined, [item], request, seed, true);
}

/** Fraction of the minute an EMOM's work should occupy */
const EMOM_FILL = 0.7;

/**
 * Size an EMOM's work to the minute it is written to.
 *
 * The rest in an EMOM is whatever is left of the window, so the work has to
 * fill it. It used to be trimmed when too large and left alone when too
 * small, and a finisher of three sit-ups against a sixty-second clock meant
 * eight rounds of nine seconds' work and fifty-one seconds of standing - a
 * session that came out 80 per cent rest.
 */
function fillEmomWindow(item: StationConfig): void {
  var target = EMOM_WINDOW_SECONDS * EMOM_FILL;

  for (var i = 0; i < 12; i++) {
    var cost = stationWorkCostSeconds(item);
    if (cost <= 0) return;

    var wanted = snapRequirement(item.mode, item.requirement * (target / cost));
    var next = Math.max(floorForMode(item.mode), wanted);

    if (next === item.requirement) return;
    item.requirement = next;
  }
}

// ── STRENGTH ────────────────────────────────────────────────────────────────

/**
 * Warm-up, loaded blocks, finisher. No run.
 *
 * A run used to be prefixed to the first block of every session whatever the
 * focus, so a strength day opened with a jog to nowhere. Compromised running
 * is a specific thing and it belongs to MIXED, deliberately, not to block
 * zero of everything by accident.
 */
function buildStrengthBlocks(
  races: StationConfig[],
  accessories: StationConfig[],
  request: SessionRequest,
  seed: number,
  blockCount: number
): SessionBlock[] {
  var blocks: SessionBlock[] = [];
  var used: { [prefabType: string]: boolean } = {};

  for (var b = 0; b < blockCount; b++) {
    // A ladder suits loaded work, where climbing and coming back down is the
    // point; straight sets suit the days it is not.
    var scheme = pick([BlockScheme.LADDER, BlockScheme.STRAIGHT], seed, 'sScheme' + b);
    var rounds = scheme === BlockScheme.LADDER
      ? roundsFor(LADDER_ROUNDS, request.duration, seed, 'sRounds' + b)
      : roundsFor(STRAIGHT_ROUNDS, request.duration, seed, 'sRounds' + b);

    var race = races.length > 0 ? races[b % races.length] : null;
    var accessory = race
      ? pairFor(race, accessories, used, request.space)
      : (accessories.length > 0 ? accessories[b % accessories.length] : null);

    var items: StationConfig[] = [];
    if (race) { items.push(sizedItem(race, request, rounds)); used[race.prefabType] = true; }
    if (accessory) { items.push(sizedItem(accessory, request, rounds)); used[accessory.prefabType] = true; }
    if (items.length === 0) continue;

    blocks.push(makeBlock(scheme, rounds, undefined, items, request, seed + b));
  }

  return blocks;
}

// ── ENGINE ──────────────────────────────────────────────────────────────────

/** Modalities rotated per round in an engine block */
const ENGINE_ROTATION_SIZE = 2;
/** Rounds an engine block may run for - density is the point */
const ENGINE_ROUNDS = [5, 6, 8];

/**
 * Warm-up, then rotation intervals, then more of them.
 *
 * Not the race-station-plus-accessory pairing: an engine session is the same
 * two or three continuous modalities coming round again, at a rep target,
 * with short recovery. What makes it engine work is density and repetition,
 * not which movement is on top.
 */
function buildEngineBlocks(
  races: StationConfig[],
  accessories: StationConfig[],
  request: SessionRequest,
  seed: number,
  blockCount: number
): SessionBlock[] {
  var modalities = races.concat(accessories);
  if (modalities.length === 0) return [];

  var blocks: SessionBlock[] = [];

  for (var b = 0; b < blockCount; b++) {
    var rounds = roundsFor(ENGINE_ROUNDS, request.duration, seed, 'eRounds' + b);
    var items: StationConfig[] = [];

    for (var m = 0; m < ENGINE_ROTATION_SIZE; m++) {
      var cfg = modalities[(b * ENGINE_ROTATION_SIZE + m) % modalities.length];
      items.push(sizedItem(cfg, request, rounds));
    }

    blocks.push(makeBlock(BlockScheme.STRAIGHT, rounds, undefined, items, request, seed + b));
  }

  return blocks;
}

// ── RUNNING: the archetypes ─────────────────────────────────────────────────

/**
 * How long the settling stretch of an easy run lasts.
 *
 * Long enough to be a warm-up and short enough that a ten minute run is still
 * mostly a run. It replaces four and a half minutes of drills and is shorter
 * than them because it is not standing still doing lunges - the athlete is
 * already running, and the drills were only ever a way of getting warm
 * without a run to do it in.
 *
 * Two minutes, which is what it was decided as. It reached the first build as
 * two and a half through nothing but my own drift, which is the argument for
 * it having a name of its own rather than being a number inside the phase
 * builder: a policy that is written down in one place can be changed on
 * purpose and cannot be changed by accident.
 */
export const EASY_SETTLE_SECONDS = 120;

/** The two stretches of a continuous easy run */
function easyRunPhases(totalSeconds: number): RunPhase[] {
  // A run too short to have two stretches is one stretch. Below about four
  // minutes the settling would be most of the session.
  if (totalSeconds < EASY_SETTLE_SECONDS * 1.6) {
    return [{
      fromSeconds: 0,
      label: 'EASY',
      cue: 'Conversational the whole way.',
      counts: true,
    }];
  }

  return [
    {
      fromSeconds: 0,
      label: 'SETTLE IN',
      cue: 'Start slower than easy. Let it come to you.',
      // Deliberately slower than the run, which is what settling means. A
      // pace averaged across it is a pace nobody was asked to hold.
      counts: false,
    },
    {
      fromSeconds: EASY_SETTLE_SECONDS,
      label: 'EASY',
      cue: 'Settled. Conversational from here.',
      counts: true,
    },
  ];
}

/**
 * One archetype, as blocks.
 *
 * The rounds are worked out rather than written down: reps times the cost of
 * a rep and its recovery is what has to fit the budget, and hard-coding a
 * count per tier would be the same arithmetic stored in a second place, ready
 * to disagree with the first the next time a recovery band moves.
 */
/**
 * One repetition, priced at the athlete's pace where there is one.
 *
 * How many repetitions fit in the time is a costing question, and costing is
 * the one thing a personal pace is allowed to change. Somebody who runs
 * six-thirty kilometres, given five threshold kilometres because the model
 * priced them at five-oh-eight, has been handed a fifty minute session with a
 * thirty minute label on it.
 */
function pacedRunSeconds(
  archetype: RunningArchetype,
  metres: number,
  target?: PaceTarget | null
): number {
  var pace = targetPaceSecPerKm(target);
  return pace !== null
    ? runSecondsAt(metres, pace)
    : modelRunSeconds(archetype, metres);
}

/**
 * A repetition and the recovery it earns, together.
 *
 * The recovery half is deliberately still the model's: the ratio, floor and
 * ceiling are the archetype's contract with the physiology, and a slower
 * runner given proportionally longer walks would quietly be doing a different
 * session rather than the same one at their pace.
 */
function pacedCycleSeconds(
  archetype: RunningArchetype,
  metres: number,
  target?: PaceTarget | null
): number {
  return pacedRunSeconds(archetype, metres, target) +
         archetypeRecoverySeconds(archetype, modelRunSeconds(archetype, metres));
}

/**
 * The distances that still fit once the athlete's own pace is priced in.
 *
 * Never empty: where nothing fits, the shortest allowed distance is the
 * closest this archetype can come to the time asked for, and a session that
 * runs long is a better answer than no session. The picker then reports the
 * length it really is, which it does for every other overrun too.
 */
function affordableForAthlete(
  archetype: RunningArchetype,
  distances: number[],
  targetWorkingSeconds: number,
  target?: PaceTarget | null
): number[] {
  var pace = targetPaceSecPerKm(target);
  if (pace === null || distances.length < 2) return distances;

  var allowance = fitAllowanceSeconds(targetWorkingSeconds);
  var fits: number[] = [];
  var shortest = distances[0];

  for (var i = 0; i < distances.length; i++) {
    var metres = distances[i];
    if (metres < shortest) shortest = metres;

    var dose = minimumRoundsAt(archetype, metres, pace) *
               pacedCycleSeconds(archetype, metres, target);
    if (dose <= allowance) fits.push(metres);
  }

  return fits.length > 0 ? fits : [shortest];
}

export function buildArchetypeBlocks(
  archetype: RunningArchetype,
  request: SessionRequest,
  seed: number,
  targetWorkingSeconds: number,
  paceAnchors?: PaceAnchor[]
): SessionBlock[] {
  var topology = RUNNING_TOPOLOGY[archetype];
  var level = requestLevel(request);

  if (topology.shape === 'CONTINUOUS') {
    var minutes = topology.legalMinutes
      ? topology.legalMinutes[request.duration]
      : undefined;
    if (minutes === undefined) return [];

    var seconds = snapRunSeconds(minutes * 60);

    var continuous: SessionBlock = {
      label: '',
      scheme: BlockScheme.STRAIGHT,
      rounds: 1,
      run: timedRun(seconds, easyRunPhases(seconds)),
      items: [],
      restSeconds: 0,
      roundScales: [1],
    };

    continuous.selfWarming = topology.absorbsWarmup;
    continuous.archetype = archetype;
    continuous.paceTarget = resolveTarget(archetype, paceAnchors);
    continuous.label = blockLabel(continuous);
    return [continuous];
  }

  // Only distances whose smallest honest session fits the time. A distance
  // that is right for the work and wrong for the time drops out here rather
  // than being built at half a dose and still carrying the name.
  var distances = affordableMetresFor(archetype, request.duration, targetWorkingSeconds);
  if (distances.length === 0) return [];

  var target = resolveTarget(archetype, paceAnchors);

  // Among the distances the archetype allows, the ones whose smallest honest
  // version fits the time THIS athlete needs for it.
  //
  // The canonical set does not change and no new distance is invented - a
  // slower runner is still offered eight hundreds and kilometres at
  // threshold. What changes is which of them the session is built from: three
  // kilometres at nine minute pace is a thirty-five minute session, and
  // offering it under a twenty-five minute label is the one thing the fitter
  // cannot repair afterwards, because a canonical distance may not be
  // shortened.
  var metres = pick(affordableForAthlete(archetype, distances, targetWorkingSeconds, target),
                    seed, 'archDistance');

  // The recovery is earned by the work the archetype prescribes, not by how
  // long this particular athlete takes over it. The ratio, the floor and the
  // ceiling are the archetype's contract with the physiology; a slower runner
  // getting proportionally longer walks would quietly turn their threshold
  // session into a different one.
  var modelWork = modelRunSeconds(archetype, metres);
  var restSeconds = archetypeRecoverySeconds(archetype, modelWork);
  var workSeconds = pacedRunSeconds(archetype, metres, target);
  var cycle = pacedCycleSeconds(archetype, metres, target);

  // Nearest rather than floor: flooring left a session a repetition short of
  // the time it was given, and the fitter would then have to rescue what it
  // was only meant to adjust.
  var rounds = Math.max(
    minimumRoundsAt(archetype, metres, targetPaceSecPerKm(target)),
    Math.round(targetWorkingSeconds / cycle)
  );

  var block: SessionBlock = {
    label: '',
    scheme: BlockScheme.STRAIGHT,
    rounds: rounds,
    run: distanceRun(metres),
    items: [makeRecoveryStation(restSeconds, level, recoveryKindFor(archetype))],
    // The recovery IS the rest half of the interval. A break on top of it
    // would be a second one.
    restSeconds: 0,
    roundScales: straightScales(rounds),
  };

  block.archetype = archetype;
  block.paceTarget = target;
  block.label = blockLabel(block);
  return [block];
}

/**
 * The same block with some of it changed.
 *
 * Copy, then override. Both places that resize a block rebuilt it field by
 * field, which is the pattern that has now dropped dropCm, blockIndex,
 * legMetres and - one commit after it was added - the flag saying a block
 * warms itself up. Listing what to keep means whatever is added next is
 * silently lost, and the loss is always quiet: the session still generates,
 * still fits its band, and is simply not the session that was written.
 */
function reviseBlock(
  block: SessionBlock,
  changes: Partial<SessionBlock>
): SessionBlock {
  var out: SessionBlock = {} as SessionBlock;

  for (var key in block) {
    if (Object.prototype.hasOwnProperty.call(block, key)) {
      (out as any)[key] = (block as any)[key];
    }
  }

  for (var change in changes) {
    if (Object.prototype.hasOwnProperty.call(changes, change)) {
      (out as any)[change] = (changes as any)[change];
    }
  }

  return out;
}

/**
 * Seconds of working time a tier has, once the warm-up is paid for.
 *
 * The number every legality question is asked against. Derived from the band
 * rather than written down, because the bands moved once already - when the
 * warm-up stopped scaling with level - and a copy of this arithmetic would
 * have gone on answering with the old ones.
 */
/**
 * True when the session opens with work that is its own warm-up.
 *
 * Asked of the blocks rather than the request, because it is a property of
 * what was built: the same RUNNING request produces an easy run one seed and
 * a set of threshold repetitions the next, and only one of them arrives warm.
 */
function warmsItself(working: SessionBlock[]): boolean {
  return !!working && working.length > 0 && working[0].selfWarming === true;
}

export function workingBudgetSeconds(duration: Duration): number {
  var band = bandFor(duration);
  return Math.max(0, band.targetMinutes * 60 - WARMUP_SECONDS);
}

// ── RUNNING ─────────────────────────────────────────────────────────────────

/**
 * A running session, as one of the five archetypes.
 *
 * There is no fallback under this. A running session is an archetype or it is
 * nothing, because the thing a fallback would build is not a running session
 * and calling it one is the failure the archetypes exist to end.
 */
function buildRunningBlocks(
  request: SessionRequest,
  seed: number,
  history?: SchedulingContext,
  paceAnchors?: PaceAnchor[]
): SessionBlock[] {
  var budget = workingBudgetSeconds(request.duration);

  var archetype = selectRunningArchetype(
    legalArchetypes(request.duration, budget),
    seed,
    history
  );

  return archetype
    ? buildArchetypeBlocks(archetype, request, seed, budget, paceAnchors)
    : [];
}

/** What a room allows of a prescribed run */
function roomRunLimit(metres: number, space: Space): number {
  return space === 'SMALL' ? Math.min(metres, SMALL_SPACE_RUN_METRES) : metres;
}

/** Rounds of compromised work - each one carries a run, so there are few */
const MIXED_ROUNDS = [3, 4, 5];
/** A pyramid of runs and stations; five is already a long session */
const MIXED_LADDER_ROUNDS = [3, 5];

// ── MIXED ───────────────────────────────────────────────────────────────────

/**
 * The compromised-work grammar, and now its only user.
 *
 * Run, then a station on tired legs, then round again. This is the HYROX
 * demand, and the run belongs here on purpose rather than by accident.
 */
function buildMixedBlocks(
  races: StationConfig[],
  accessories: StationConfig[],
  request: SessionRequest,
  seed: number,
  blockCount: number
): SessionBlock[] {
  // Everything else that travels is shuttled at full distance, but a run is
  // the one movement whose whole point is pace, and pace does not survive a
  // turn every twenty metres. In a room there is no run at all - the
  // conditioning it was there to provide is done on the spot.
  var prescribedRun = COMPROMISED_RUN_METRES[request.duration];
  var runMetres = snapRunMetres(roomRunLimit(prescribedRun, request.space));
  var onTheSpot = request.space === 'SMALL'
    ? runCostSeconds(prescribedRun)
    : 0;

  var blocks: SessionBlock[] = [];
  var used: { [prefabType: string]: boolean } = {};

  for (var b = 0; b < blockCount; b++) {
    // Compromised work is written in a handful of long rounds, not many
    // short ones. Two blocks of seven, each carrying its own run, was 12
    // rounds and three and a half kilometres - the running ate the entire
    // time budget and the fitter answered by squeezing every station down to
    // its floor: three rows, a five metre carry, a five second plank.
    var scheme = pick(
      [BlockScheme.STRAIGHT, BlockScheme.STRAIGHT, BlockScheme.LADDER],
      seed, 'mScheme' + b
    );
    var rounds = scheme === BlockScheme.LADDER
      ? roundsFor(MIXED_LADDER_ROUNDS, request.duration, seed, 'mRounds' + b)
      : roundsFor(MIXED_ROUNDS, request.duration, seed, 'mRounds' + b);

    var race = races.length > 0 ? races[b % races.length] : null;
    var accessory = race
      ? pairFor(race, accessories, used, request.space)
      : (accessories.length > 0 ? accessories[b % accessories.length] : null);

    var items: StationConfig[] = [];

    // The round still opens with conditioning, so the athlete still arrives
    // at the station tired. It is simply not a run.
    //
    // High knees are then off the table as the accessory: a round reading
    // "HIGH KNEE RUNS + AIR SKIERG + HIGH KNEES" is the same movement twice
    // with the pool none the wiser, because they carry different prefabs.
    if (onTheSpot > 0) {
      items.push(makeOnTheSpotRun(onTheSpot));
      used['HIGH_KNEES'] = true;
    }

    if (race) { items.push(sizedItem(race, request, rounds)); used[race.prefabType] = true; }
    if (accessory) { items.push(sizedItem(accessory, request, rounds)); used[accessory.prefabType] = true; }
    if (items.length === 0) continue;

    var legMetres = request.space === 'SMALL' ? SMALL_SPACE_LEG_METRES : runMetres;

    blocks.push(makeBlock(scheme, rounds, distanceRun(runMetres), items, request, seed + b,
                          false, legMetres));
  }

  return blocks;
}

// ── Fitting the promise ─────────────────────────────────────────────────────
//
// SHORT, MEDIUM and FULL are a promise about the athlete's time. Measured
// before this existed, the tiers overlapped badly - a SHORT could run to 21
// minutes while a MEDIUM came in at 14 - so the words told the athlete
// nothing at all.
//
// The knob is per-round volume, and only that. Rounds, schemes, ladders and
// the warm-up are the grammar's decisions and are left exactly as it made
// them: a session trimmed to fit is the same workout at a different size, not
// a different workout. Trimming rounds instead would turn a seven-round
// ladder into a four-round one, which is a different session wearing the same
// label.

/** How far the volume may be moved before the session stops being the session */
const MIN_FIT_SCALE = 0.25;
const MAX_FIT_SCALE = 4.0;
/**
 * Scales tried between those bounds.
 *
 * A scan rather than a binary search, because the prescription is snapped to
 * a grid of numbers a coach would say and the estimate therefore moves in
 * steps rather than smoothly. A search that assumes monotone continuity walks
 * confidently into the middle of a step and stops.
 */
const FIT_SAMPLES = 48;

/**
 * The same blocks at a different size.
 *
 * Rest is recomputed rather than scaled: it is earned by the work bout, so a
 * lighter round earns a shorter break by construction and the work-to-rest
 * ratio survives the resize.
 */
function scaleBlocks(
  blocks: SessionBlock[],
  scale: number,
  request: SessionRequest,
  seed: number,
  roundScale?: number
): SessionBlock[] {
  var out: SessionBlock[] = [];

  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b];

    // A warm-up is a warm-up. It does not get trimmed to make the numbers
    // work, and it does not get longer either.
    //
    // An EMOM is the same: its volume is set by the minute it is written to,
    // not by the duration tier. Scaling it would leave the work no longer
    // filling the window and turn the block back into mostly standing.
    if (block.scheme === BlockScheme.WARMUP || block.scheme === BlockScheme.EMOM) {
      out.push(block);
      continue;
    }

    var items: StationConfig[] = [];
    for (var i = 0; i < block.items.length; i++) {
      var item = block.items[i];
      var scaled: StationConfig = {} as StationConfig;

      for (var key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          (scaled as any)[key] = (item as any)[key];
        }
      }

      // The walk between intervals is recovery, not work, and is recomputed
      // below from the effort it follows.
      if (item.prefabType !== 'RECOVERY') {
        scaled.requirement = Math.max(
          floorForMode(item.mode),
          snapRequirement(item.mode, item.requirement * scale)
        );
      }

      items.push(scaled);
    }

    // The room is not something the fitter may spend. It scaled the capped
    // eighty metres back up to four hundred to fill the time, and the label
    // duly offered fifteen shuttles.
    var scaledRun = scaleRun(block.run, scale, request.space, !!block.archetype);
    var runMetres = runMetresOf(scaledRun);

    var rounds = legalRounds(block, roundScale);

    if (block.archetype && hasRun(block.run)) {
      rounds = Math.max(rounds, minimumRounds(
        block.archetype as RunningArchetype, runMetresOf(block.run)));
    }

    var resized = reviseBlock(block, {
      label: '',
      rounds: rounds,
      run: scaledRun,
      items: items,
      restSeconds: restFor(block.scheme, items, scaledRun, request, seed + b),
      roundScales: rounds === block.rounds
        ? block.roundScales
        : (block.scheme === BlockScheme.LADDER
            ? ladderScales(rounds)
            : straightScales(rounds)),
    });

    if (block.legMetres !== undefined) {
      resized.legMetres = Math.min(block.legMetres, runMetres);
    }

    resized.label = blockLabel(resized, isFinisherBlock(block));
    out.push(resized);
  }

  return out;
}

/**
 * Fewer rounds, but only where the grammar allows it.
 *
 * The second knob, used when volume alone cannot reach the band - a full
 * strength session of three seven-round ladders is already thirty-five
 * minutes at the smallest prescription a coach would write, so shrinking the
 * work further is not available.
 *
 * A ladder stays a pyramid, so it stays odd, and nothing drops below three
 * rounds: two rounds of anything is not the session that was described.
 */
function legalRounds(block: SessionBlock, roundScale?: number): number {
  if (roundScale === undefined || roundScale === 1) return block.rounds;
  if (block.scheme === BlockScheme.EMOM) return block.rounds;

  var wanted = Math.round(block.rounds * roundScale);
  wanted = Math.max(MIN_LEGAL_ROUNDS, Math.min(MAX_LEGAL_ROUNDS, wanted));

  // A pyramid needs a middle
  if (block.scheme === BlockScheme.LADDER && wanted % 2 === 0) wanted++;

  return wanted;
}

/** The same request as asked, at the level the session is written for */
function neutralRequest(request: SessionRequest): SessionRequest {
  return {
    space: request.space,
    duration: request.duration,
    focus: request.focus,
    level: 'REGULAR',
    seed: request.seed,
  };
}

/** Below this a block stops being the block it was described as */
const MIN_LEGAL_ROUNDS = 3;
/**
 * Above this nobody is counting rounds any more.
 *
 * High enough for the case that needs it: a running session indoors, where
 * every interval is capped at what the room holds and the only way to reach
 * the promised time is more of them. Twenty twenty-metre shuttles is a real
 * indoor session; nothing else gets near this ceiling.
 */
const MAX_LEGAL_ROUNDS = 30;

/**
 * Round counts the fitter may fall back on, in order of preference.
 *
 * Both directions, because a room can make a session too short as well as too
 * long: running is capped at what the room holds, and a capped interval
 * repeated the eight times the grammar chose is twelve minutes of a session
 * promised as twenty-two. More intervals is the honest answer there, and it
 * is what anyone training indoors actually does.
 */
const ROUND_SCALES = [1.0, 0.8, 0.6, 1.5, 2.0, 3.0];

function floorForMode(mode: StationMode): number {
  switch (mode) {
    case StationMode.DISTANCE: return MIN_DISTANCE_METRES;
    case StationMode.TIMED:    return MIN_SECONDS;
    default:                   return MIN_REPS;
  }
}

/** Finisher blocks are labelled as such; the label is the only marker kept */
function isFinisherBlock(block: SessionBlock): boolean {
  return block.label.indexOf('Finisher') === 0;
}

/**
 * How many prescriptions are sitting on the floor.
 *
 * A session can keep its promise about minutes and still be empty: forty-four
 * minutes of twenty-metre carries and eight-rep sets is in band and is not a
 * workout. It happens when the time goes on rounds and rest rather than on
 * work, and a fitter asked only to land near a number of minutes answers by
 * shrinking every prescription to the smallest a coach would write.
 *
 * Counting the floored movements gives it something to prefer besides the
 * clock: among sessions that keep the promise, the one that trains the most.
 */
function flooredCount(blocks: SessionBlock[]): number {
  var count = 0;

  for (var b = 0; b < blocks.length; b++) {
    if (blocks[b].scheme === BlockScheme.WARMUP) continue;

    for (var i = 0; i < blocks[b].items.length; i++) {
      var item = blocks[b].items[i];
      if (item.prefabType === 'RECOVERY') continue;
      if (item.requirement <= floorForMode(item.mode)) count++;
    }
  }

  return count;
}

/**
 * The session with its last working block removed.
 *
 * The third and last knob, after per-round volume and round count. A medium
 * strength session of two blocks can sit four minutes over its band with
 * every carry already at twenty metres and every hold at thirty seconds -
 * there is nothing left to shrink, and the only honest way to make it shorter
 * is to do less of it.
 *
 * The warm-up and the finisher stay: the warm-up because it is not part of
 * the dose, the finisher because a session that stops without one has been
 * cut off rather than shortened.
 */
function dropLastWorkingBlock(blocks: SessionBlock[]): SessionBlock[] {
  var lastWorking = -1;
  var working = 0;

  for (var i = 0; i < blocks.length; i++) {
    if (blocks[i].scheme === BlockScheme.WARMUP) continue;
    if (isFinisherBlock(blocks[i])) continue;
    lastWorking = i;
    working++;
  }

  // One working block is the least a session can be built from
  if (working <= 1 || lastWorking < 0) return blocks;

  var out: SessionBlock[] = [];
  for (var j = 0; j < blocks.length; j++) {
    if (j !== lastWorking) out.push(blocks[j]);
  }
  return out;
}

/**
 * True when this session keeps its promise at every level, not just one.
 *
 * Only the two extremes are dosed and measured. The candidate is built at
 * REGULAR, so its own length is already known to the caller, and every other
 * level sits between a beginner's extra rest and an athlete's extra volume.
 * Checking all three would cost half again as much on a search the picker
 * runs on every toggle.
 */
function suitsEveryLevel(
  blocks: SessionBlock[],
  request: SessionRequest,
  seed: number,
  regularMinutes: number
): boolean {
  if (!withinBand(regularMinutes, request.duration)) return false;

  for (var i = 0; i < LEVEL_EXTREMES.length; i++) {
    var dosed = applyLevelVolume(blocks, {
      space: request.space,
      duration: request.duration,
      focus: request.focus,
      level: LEVEL_EXTREMES[i],
      seed: request.seed,
    }, seed);

    if (!withinBand(minutesOf(dosed), request.duration)) return false;
  }

  return true;
}

/** The longest session and the shortest one; everyone else is between them */
const LEVEL_EXTREMES: Level[] = ['BEGINNER', 'ATHLETE'];

function minutesOf(blocks: SessionBlock[]): number {
  return estimateMinutes(wrapPlanStations(flattenBlocks(blocks), 'SESSION COMPLETE'));
}

/**
 * Resize the session until it keeps the promise on the picker.
 *
 * Binary search on the volume, because the estimate rises with it: more work
 * takes longer, and earns proportionally more rest, so the total moves the
 * same way. Deterministic - the same request always converges to the same
 * session.
 *
 * If the band cannot be reached even at the limits, the closest attempt is
 * returned and the plan reports its real length. The picker shows what the
 * session actually is; it never shows the band and hands over something else.
 */
function fitToDuration(
  blocks: SessionBlock[],
  request: SessionRequest,
  seed: number
): SessionBlock[] {
  var band = bandFor(request.duration);
  var target = band.targetMinutes;

  var best = blocks;
  var bestError = Math.abs(minutesOf(blocks) - target);
  var bestInBand = withinBand(minutesOf(blocks), request.duration);
  var bestFloored = flooredCount(blocks);

  // Volume first, rounds only if volume alone cannot reach the band. Trimming
  // rounds changes the shape of the session; trimming the prescription does
  // not, so it is the knob to reach for first.
  //
  // And the round decision is taken at REGULAR, whatever level actually asked.
  // Rounds are the shape of the session: a beginner and an athlete choosing
  // the same workout should get the same workout at different doses, not one
  // with seven rounds and one with five. Left free, the fitter reached the
  // same minutes by different structures and the two stopped being comparable
  // at all.
  // Every round option is considered, not only the first that fits: fewer
  // rounds leaves more room in each of them, and five full rounds is better
  // training than seven empty ones. The whole search runs at REGULAR, so the
  // choice stays a property of the session rather than of who asked for it.
  var roundScales = ROUND_SCALES;


  // Three knobs, in the order a coach reaches for them: how much work per
  // round, then how many rounds, then how many blocks. Each changes the
  // session more than the last, so each is only tried when the one before it
  // could not honour the time that was promised.
  var shapes = [blocks, dropLastWorkingBlock(blocks)];

  for (var sh = 0; sh < shapes.length; sh++) {
  for (var r = 0; r < roundScales.length; r++) {
    for (var i = 0; i <= FIT_SAMPLES; i++) {
      var scale = MIN_FIT_SCALE +
                  (MAX_FIT_SCALE - MIN_FIT_SCALE) * (i / FIT_SAMPLES);

      var candidate = scaleBlocks(shapes[sh], scale, neutralRequest(request), seed, roundScales[r]);
      var minutes = minutesOf(candidate);
      var error = Math.abs(minutes - target);

      // Every level has to keep the promise, not just the one that asked.
      //
      // A beginner rests a quarter longer and an athlete carries a fifth more
      // volume, so the same fitted session lands at three different lengths.
      // Fitting for the asking level alone and repairing the others
      // afterwards is what broke the ordering: the repair moved each level's
      // dose independently, and a beginner came out of it having done more
      // work than a regular athlete. Choosing a session that suits all three
      // means the levels differ by dose alone, which is the only way their
      // volumes stay comparable.
      var inBand = suitsEveryLevel(candidate, request, seed, minutes);

      // Three things in order. Keeping the promise comes first - the band is
      // what the athlete was told. Then how much of the session is real work
      // rather than the smallest prescription that would fit: minutes alone
      // let the fitter answer with an empty session of the right length. Only
      // then how near the middle of the band it lands.
      var floored = flooredCount(candidate);

      var better = inBand !== bestInBand
        ? inBand
        : floored !== bestFloored
          ? floored < bestFloored
          : error < bestError;

      if (better) {
        best = candidate;
        bestError = error;
        bestInBand = inBand;
        bestFloored = floored;
      }

      // Nothing can beat this: inside the band with every prescription clear
      // of the floor. The generator runs on the picker, on every toggle, so
      // the search stops when it has won rather than finishing the sweep.
      if (bestInBand && bestFloored === 0 && bestError <= 1) {
        return settleAfterLevel(
          applyLevelVolume(best, request, seed), request, seed);
      }
    }
  }

  // Dropping a block is a real loss of training, so it is only considered
  // once keeping them all has failed to honour the promise.
  if (bestInBand) break;
  }

  return settleAfterLevel(applyLevelVolume(best, request, seed), request, seed);
}

/**
 * A last nudge, after the athlete's dose has been applied.
 *
 * The session was fitted at REGULAR and then dosed, so a session already
 * sitting near the edge of its band can be pushed a minute outside it by a
 * beginner's longer rest or an athlete's larger volume. Structure is not
 * touched - same rounds, same movements, same shape - only the prescription,
 * and only within a narrow range, so the level ordering survives.
 */
function settleAfterLevel(
  blocks: SessionBlock[],
  request: SessionRequest,
  seed: number
): SessionBlock[] {
  if (withinBand(minutesOf(blocks), request.duration)) return blocks;

  var band = bandFor(request.duration);
  var best = blocks;
  var bestError = Math.abs(minutesOf(blocks) - band.targetMinutes);
  var bestInBand = false;

  // The dose only, never the rounds.
  //
  // Rounds are the shape of the session and the shape does not belong to the
  // athlete's level: letting settle trim them meant a beginner's longer rest
  // bought them fewer, fuller rounds, and they came out of it having done
  // more work than a regular athlete. Every level now runs the same session
  // and differs by dose alone, which is what makes the levels comparable at
  // all.
  for (var r = 0; r < 1; r++) {
    for (var i = 0; i <= SETTLE_SAMPLES; i++) {
      var scale = MIN_SETTLE_SCALE +
                  (MAX_SETTLE_SCALE - MIN_SETTLE_SCALE) * (i / SETTLE_SAMPLES);

      var candidate = scaleBlocks(blocks, scale, request, seed);
      var minutes = minutesOf(candidate);
      var inBand = withinBand(minutes, request.duration);
      var error = Math.abs(minutes - band.targetMinutes);

      var better = inBand !== bestInBand ? inBand : error < bestError;

      if (better) {
        best = candidate;
        bestError = error;
        bestInBand = inBand;
      }
    }

    if (bestInBand) break;
  }

  return best;
}

/** How far the dose may be nudged to keep the promise. Narrow on purpose. */
const MIN_SETTLE_SCALE = 0.75;
const MAX_SETTLE_SCALE = 1.3;
const SETTLE_SAMPLES = 32;

/**
 * The athlete's own dose, applied to a session that is already the right
 * length.
 *
 * Last, and deliberately so. Fitting a levelled session meant the fitter
 * reached the same minutes by different structures for different athletes:
 * a beginner got seven rounds and an athlete five of the same workout, and
 * because rest is earned by the bout, an athlete's larger bout could earn
 * back more rest than a regular one - the level ordering inverted.
 *
 * Applied here, the four sessions are one session at four doses. They differ
 * in minutes by roughly the level spread, which the band absorbs.
 */
function applyLevelVolume(
  blocks: SessionBlock[],
  request: SessionRequest,
  seed: number
): SessionBlock[] {
  var level = requestLevel(request);
  var volume = levelScale(request);

  if (volume === 1.0 && level === 'REGULAR') return blocks;

  var out: SessionBlock[] = [];

  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b];

    // Everybody warms up for the same four and a half minutes. The level
    // decides which drills fill it - a beginner's mobility, an athlete's fast
    // feet - not how long being ready takes.
    if (block.scheme === BlockScheme.WARMUP) {
      out.push(block);
      continue;
    }

    var items: StationConfig[] = [];
    for (var i = 0; i < block.items.length; i++) {
      var item = block.items[i];
      var dosed: StationConfig = {} as StationConfig;

      for (var key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          (dosed as any)[key] = (item as any)[key];
        }
      }

      if (item.prefabType !== 'RECOVERY') {
        dosed.requirement = Math.max(
          floorForMode(item.mode),
          snapRequirement(item.mode, item.requirement * volume)
        );
      }

      items.push(dosed);
    }

    // The run is dose too. Left alone, an advanced athlete took twenty per
    // cent more work at every station and then ran the same two hundred
    // metres - and in a running session, where the run is the entire
    // workout, their level stopped meaning anything at all.
    // The level moves an archetype session by repetitions rather than by
    // distance: a beginner does three eight-hundreds at threshold and an
    // athlete five, which is the same session at two doses. Shortening the
    // repetition instead would have given the beginner a different session.
    var dosedRun = scaleRun(block.run, volume, request.space, !!block.archetype);
    var runMetres = runMetresOf(dosedRun);

    // An archetype takes its dose in repetitions, between two bounds.
    //
    // Never below the count that earns the session its name - a beginner
    // given two of anything has been given a warm-up with the wrong label.
    // And never past what the tier can hold, because the settle pass that
    // catches every other overshoot works by nudging requirements, and an
    // archetype's requirement is a canonical distance it may not move. Left
    // uncapped, an athlete's extra kilometre repeat put a twenty-four minute
    // session at thirty-eight with nothing able to pull it back.
    var dosedRounds = block.rounds;
    if (block.archetype && hasRun(block.run)) {
      var archetype = block.archetype as RunningArchetype;
      var metres = runMetresOf(block.run);
      var cycle = pacedCycleSeconds(archetype, metres, block.paceTarget);

      var ceiling = bandFor(request.duration).maxMinutes * 60 -
                    (block.selfWarming ? 0 : WARMUP_SECONDS);

      dosedRounds = Math.max(
        minimumRounds(archetype, metres),
        Math.min(
          Math.max(1, Math.floor(ceiling / Math.max(1, cycle))),
          Math.round(block.rounds * volume)
        )
      );
    }

    var levelled = reviseBlock(block, {
      label: '',
      rounds: dosedRounds,
      run: dosedRun,
      items: items,
      restSeconds: restFor(block.scheme, items, dosedRun, request, seed + b),
      roundScales: dosedRounds === block.rounds
        ? block.roundScales
        : straightScales(dosedRounds),
    });

    if (block.legMetres !== undefined) {
      levelled.legMetres = Math.min(block.legMetres, runMetres);
    }

    levelled.label = blockLabel(levelled, isFinisherBlock(block));
    out.push(levelled);
  }

  return out;
}


// ── Composition ─────────────────────────────────────────────────────────────

function buildBlocks(input: GeneratorInput, request: SessionRequest): SessionBlock[] {
  var allAccessories = input.accessories === undefined
    ? ACCESSORY_STATIONS as StationConfig[]
    : input.accessories;

  var seed = request.seed === undefined ? 0 : request.seed;
  var blockCount = WORKING_BLOCKS[request.duration] || 1;

  // A combination the picker will not offer is one the generator will not
  // build. The old running builder answered SMALL + RUNNING with on-the-spot
  // conditioning, so an illegal request produced a session and a contract
  // violation looked like a feature.
  if (!focusFitsSpace(request.focus, request.space)) return [];

  var races = rankPool(
    racePoolFor(request.focus, input.templates, request.space), input, request);
  var accessories = rankPool(accessoryPoolFor(request.focus, allAccessories), input, request);

  if (races.length === 0 && accessories.length === 0) return [];

  var blocks: SessionBlock[] = [];

  var working: SessionBlock[] = [];
  var wantsFinisher = true;

  switch (request.focus) {
    case 'RUNNING':
      working = buildRunningBlocks(request, seed, input.history, input.paceAnchors);
      // The running is the session. Nothing is appended to round it off.
      wantsFinisher = false;
      break;

    case 'ENGINE':
      working = buildEngineBlocks(races, accessories, request, seed, blockCount);
      break;

    case 'STRENGTH':
      working = buildStrengthBlocks(races, accessories, request, seed, blockCount);
      break;

    default:
      working = buildMixedBlocks(races, accessories, request, seed, blockCount);
      break;
  }

  // The warm-up goes in front of the work unless the work opens with
  // something that warms itself up. An easy run does: its first minutes are
  // the warm-up, which is what easy means, so four and a half minutes of
  // drills in front of it is warming up for a warm-up - and on a fifteen
  // minute session it is a third of the session spent preparing for the rest.
  //
  // Built after the work rather than before it, because until the work exists
  // there is no way to ask.
  if (!warmsItself(working)) {
    var warmup = buildWarmup(request, seed);
    if (warmup) blocks.push(warmup);
  }

  for (var i = 0; i < working.length; i++) blocks.push(working[i]);

  if (wantsFinisher) {
    var last = buildFinisher(races, accessories, request, seed);
    if (last) blocks.push(last);
  }

  return applyLegCaps(fitToDuration(blocks, request, seed), request);
}

/**
 * Tell the athlete where the wall is.
 *
 * Applied after fitting, because the cap depends on the final prescription
 * and the fitter is what decides that. Deciding it earlier meant a station
 * resized upwards ended up longer than the room with nothing saying so.
 *
 * Only the instruction and the leg change. The distance is untouched: it is
 * tracked as accumulated path length, so it is completed by turning round.
 */
function applyLegCaps(
  blocks: SessionBlock[],
  request: SessionRequest
): SessionBlock[] {
  if (request.space !== 'SMALL') return blocks;

  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b];

    if (runMetresOf(block.run) > SMALL_SPACE_LEG_METRES) {
      block.legMetres = SMALL_SPACE_LEG_METRES;
    }

    for (var i = 0; i < block.items.length; i++) {
      var item = block.items[i];
      if (item.mode !== StationMode.DISTANCE) continue;
      if (item.requirement <= SMALL_SPACE_LEG_METRES) continue;
      if (item.legMetres !== undefined) continue;

      item.legMetres = SMALL_SPACE_LEG_METRES;
      item.instruction = shuttleInstruction(
        item.instruction, item.requirement, SMALL_SPACE_LEG_METRES
      );
    }

    // The label carries the run distance, which the cap does not change
    block.label = blockLabel(block, isFinisherBlock(block));
  }

  return blocks;
}

// ── Presentation ────────────────────────────────────────────────────────────

const SPACE_LABEL: { [k: string]: string }    = { SMALL: 'Small space', NORMAL: 'Open space' };
const DURATION_LABEL: { [k: string]: string } = { SHORT: 'Short', MEDIUM: 'Medium', FULL: 'Full' };
const FOCUS_LABEL: { [k: string]: string }    = { RUNNING: 'Running', ENGINE: 'Engine', STRENGTH: 'Strength', MIXED: 'Mixed' };
const LEVEL_LABEL: { [k: string]: string }    = { BEGINNER: 'Beginner', REGULAR: 'Regular', ATHLETE: 'Athlete' };

function buildTitle(request: SessionRequest): string {
  return FOCUS_LABEL[request.focus] + ' · ' + DURATION_LABEL[request.duration];
}

function buildRationale(request: SessionRequest, blocks: SessionBlock[], minutes: number): string {
  // The effort cue goes here rather than into any number: the session is
  // exactly as long as it was, the athlete simply knows what to bring to it.
  //
  // From the archetype where there is one. The focus cue covers all of
  // running with one line, and running is five things now - "controlled hard,
  // seven out of ten" is right for an interval session and the opposite of
  // what an easy run or a set of speed repetitions is asking for.
  return minutes + ' min · ' + blocks.length + ' blocks · ' +
         SPACE_LABEL[request.space].toLowerCase() + ' · ' +
         'scaled for ' + LEVEL_LABEL[requestLevel(request)] + '\n' +
         sessionEffortLine(request, blocks);
}

function sessionEffortLine(request: SessionRequest, blocks: SessionBlock[]): string {
  for (var i = 0; i < blocks.length; i++) {
    var archetype = blocks[i].archetype;
    if (!archetype) continue;

    var topology = RUNNING_TOPOLOGY[archetype as RunningArchetype];
    if (topology && topology.effortCue) return topology.effortCue;
  }

  return effortLine(request.focus);
}

/** The session written out the way a coach would write it */
export function describeBlocks(plan: SessionPlan): string[] {
  if (!plan || !plan.blocks) return [];

  var lines: string[] = [];
  for (var i = 0; i < plan.blocks.length; i++) {
    var block = plan.blocks[i];
    lines.push(block.label +
      (block.restSeconds > 0 ? '  ·  ' + block.restSeconds + 's rest' : ''));
  }

  return lines;
}

function buildId(request: SessionRequest): string {
  var seed = request.seed === undefined ? 0 : request.seed;
  return ['gen', request.space, request.duration, request.focus,
          requestLevel(request), seed].join('-').toLowerCase();
}

// ── Entry point ─────────────────────────────────────────────────────────────

/**
 * Build a session for the given constraints. Returns null only when there are
 * no templates to work with — every other input produces a loadable plan.
 */
export function generateSession(
  input: GeneratorInput,
  request: SessionRequest
): SessionPlan {
  if (!input || !input.templates || input.templates.length === 0) return null;
  if (!request) return null;

  var blocks = buildBlocks(input, request);
  if (blocks.length === 0) return null;

  var wrapped = wrapPlanStations(flattenBlocks(blocks), 'SESSION COMPLETE');
  var minutes = estimateMinutes(wrapped);

  return {
    id: buildId(request),
    kind: SessionKind.TRAINING,
    title: buildTitle(request),
    rationale: buildRationale(request, blocks, minutes),
    estimatedMinutes: minutes,
    stations: wrapped,
    blocks: blocks,
    source: 'generated',
  };
}

/** Every request the picker can express, for previewing or testing */
/**
 * Whether a focus can be trained in a space.
 *
 * Running needs somewhere to run. A five square metre room has nowhere to run
 * to and twenty-metre shuttles are not running - they are turning, which is a
 * different demand and already exists under ENGINE and MIXED.
 *
 * Here rather than in the picker, because a rule that only the picker knows
 * is a rule the generator can be asked to break. It was: the picker hid the
 * button and the generator quietly built something anyway, and the something
 * was not a running session.
 */
export function focusFitsSpace(focus: Focus, space: Space): boolean {
  return !(space === 'SMALL' && focus === 'RUNNING');
}

export function allRequests(seed?: number): SessionRequest[] {
  var out: SessionRequest[] = [];

  for (var s = 0; s < ALL_SPACES.length; s++) {
    for (var d = 0; d < ALL_DURATIONS.length; d++) {
      for (var f = 0; f < ALL_FOCUSES.length; f++) {
        if (!focusFitsSpace(ALL_FOCUSES[f], ALL_SPACES[s])) continue;

        for (var l = 0; l < ALL_LEVELS.length; l++) {
          out.push({
            space: ALL_SPACES[s],
            duration: ALL_DURATIONS[d],
            focus: ALL_FOCUSES[f],
            level: ALL_LEVELS[l],
            seed: seed,
          });
        }
      }
    }
  }

  return out;
}
