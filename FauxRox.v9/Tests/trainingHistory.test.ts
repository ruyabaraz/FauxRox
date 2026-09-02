// ============================================================================
// trainingHistory.test.ts — seed lifecycle and movement diversity
// ============================================================================
// The generator was deterministic and the seed never moved, so every training
// session an athlete generated was byte-for-byte the last one. These lock the
// rules that fixed it:
//
//   determinism is kept  — the same request and the same history must still
//                          produce the same session, so a preview is stable
//   the seed advances    — but only when a session is actually completed
//   variety is earned    — recently trained movements drop, without ever
//                          overruling what the space, focus or limiter demand
// ============================================================================

import {
  emptyTrainingLog,
  recordCompletedSession,
  recordAbandonedSession,
  trainingSeed,
  extractMovements,
  parseTrainingLog,
  TrainingLog,
} from '../Assets/Scripts/TrainingHistory';

import {
  generateSession,
  GeneratorInput,
  SessionRequest,
} from '../Assets/Scripts/AdaptiveSessionGenerator';

import {
  StationConfig,
  StationMode,
  MotionType,
  SessionPlan,
  isAccessory,
  distanceRun,
  runMetresOf,
  hasRun,
  timedRun,
} from '../Assets/Scripts/SessionTypes';

let passed = 0;
let failed = 0;

function describe(name: string, body: () => void): void {
  console.log('\n=== ' + name + ' ===');
  body();
}

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail !== undefined ? '   -> ' + String(detail) : '')); }
}

const TEMPLATES: StationConfig[] = [
  { name: 'AIR SKIERG', mode: StationMode.ZONE_HIT, requirement: 50, instruction: 'x', prefabType: 'AIR_SKIERG', run: distanceRun(100), motionType: MotionType.AIR_SKIERG },
  { name: 'DUMBBELL BEAR CRAWL', mode: StationMode.DISTANCE, requirement: 50, instruction: 'x', prefabType: 'POWER_LANE', run: distanceRun(100) },
  { name: 'GOBLET REVERSE WALK', mode: StationMode.DISTANCE, requirement: 50, instruction: 'x', prefabType: 'CRAB_WALK', run: distanceRun(100) },
  { name: 'BURPEE BROAD JUMP', mode: StationMode.REPS, requirement: 25, instruction: 'x', prefabType: 'BURPEE_BROAD_JUMP', run: distanceRun(100) },
  { name: 'STANDING ROW', mode: StationMode.ZONE_HIT, requirement: 50, instruction: 'x', prefabType: 'POWER_ROW', run: distanceRun(100), motionType: MotionType.BACKWARD_PULL },
  { name: 'HEAVY CARRY', mode: StationMode.DISTANCE, requirement: 200, instruction: 'x', prefabType: 'HEAVY_CARRY', run: distanceRun(100) },
  { name: 'DB WALKING LUNGES', mode: StationMode.DISTANCE, requirement: 100, instruction: 'x', prefabType: 'WALKING_LUNGES', run: distanceRun(100) },
  { name: 'SQUAT TARGET REACH', mode: StationMode.ZONE_HIT, requirement: 75, instruction: 'x', prefabType: 'TARGET_PRESS', run: distanceRun(100), motionType: MotionType.OVERHEAD_REACH },
];

const INPUT: GeneratorInput = { templates: TEMPLATES, baseRunMetres: 400 };
const REQ: SessionRequest = { space: 'NORMAL', duration: 'MEDIUM', focus: 'STRENGTH', level: 'REGULAR', seed: 0 };
const movementsOf = (p: SessionPlan) => extractMovements(p.stations);

// ── What counts as a movement ───────────────────────────────────────────────

describe('only real movements are remembered', () => {
  const stations = [
    { prefabType: 'START' },
    { prefabType: 'WARMUP_A_SKIPS' },
    { prefabType: 'WALKING_LUNGES' },
    { prefabType: 'AIR_SQUAT' },
    { prefabType: 'REST' },
    { prefabType: 'WALKING_LUNGES' },
    { prefabType: 'AIR_SQUAT' },
    { prefabType: 'RECOVERY' },
    { prefabType: 'FINISH' },
  ];

  const found = extractMovements(stations);

  check('markers are dropped', found.indexOf('START') < 0 && found.indexOf('FINISH') < 0);
  check('rest is not a movement', found.indexOf('REST') < 0);
  check('the walk between intervals is not a movement', found.indexOf('RECOVERY') < 0);
  check('warm-up drills are left out of selection history', found.indexOf('WARMUP_A_SKIPS') < 0);
  check('a movement repeated across rounds is recorded once', found.length === 2, found.join(', '));
  check('and it is the two that were trained',
    found.indexOf('WALKING_LUNGES') >= 0 && found.indexOf('AIR_SQUAT') >= 0, found.join(', '));
});

// ── Seed lifecycle ──────────────────────────────────────────────────────────

const seedOf = (log: TrainingLog, preview = 0) => trainingSeed(log, preview);

describe('the seed moves when training happens, and only then', () => {
  const start = emptyTrainingLog();
  check('a new athlete starts at zero',
    start.completionOrdinal === 0 && start.offerOrdinal === 0 && start.recent.length === 0);

  // Generating, previewing, changing your mind - none of this is training
  let log = start;
  for (let i = 0; i < 10; i++) generateSession(INPUT, { ...REQ, seed: seedOf(log) });
  check('generating a session does not consume one', log.completionOrdinal === 0);

  const first = generateSession(INPUT, { ...REQ, seed: seedOf(log) })!;
  log = recordCompletedSession(log, movementsOf(first));
  check('completing one advances history', log.completionOrdinal === 1);
  check('and records what it used', log.recent.length > 0, log.recent.join(', '));

  const second = generateSession(INPUT, { ...REQ, seed: seedOf(log) })!;
  check('so the next session differs',
    JSON.stringify(first.stations) !== JSON.stringify(second.stations));

  log = recordCompletedSession(log, movementsOf(second));
  check('and keeps advancing', log.completionOrdinal === 2);
  check('remembering only the latest session',
    JSON.stringify(log.recent) === JSON.stringify(movementsOf(second)));

  check('completing never touches the offer count', log.offerOrdinal === 0);
});

// ── Abandoning ──────────────────────────────────────────────────────────────

describe('starting a session and walking out of it', () => {
  // The reported bug, verbatim: pick Training, press START, say "stop", press
  // the button again - and get the same workout back.
  let log = emptyTrainingLog();
  const offered = generateSession(INPUT, { ...REQ, seed: seedOf(log) })!;

  log = recordAbandonedSession(log);
  const next = generateSession(INPUT, { ...REQ, seed: seedOf(log) })!;

  check('does not burn a workout', log.completionOrdinal === 0);
  check('but does move the draw', log.offerOrdinal === 1);
  check('so a different session is offered',
    JSON.stringify(offered.stations) !== JSON.stringify(next.stations));

  // Nothing was trained, so nothing should be remembered as trained
  check('and nothing is remembered as trained', log.recent.length === 0);

  // Abandoning repeatedly keeps producing new draws rather than cycling back
  const seen: { [k: string]: boolean } = { [JSON.stringify(offered.stations)]: true };
  let distinct = 1;
  for (let i = 0; i < 5; i++) {
    log = recordAbandonedSession(log);
    const key = JSON.stringify(generateSession(INPUT, { ...REQ, seed: seedOf(log) })!.stations);
    if (!seen[key]) { seen[key] = true; distinct++; }
  }
  check('repeated abandons keep drawing', distinct >= 3, distinct + ' distinct of 6');

  // An abandon after real training leaves the history alone
  let trained = recordCompletedSession(emptyTrainingLog(), ['WALKING_LUNGES']);
  const before = trained.recent.join();
  trained = recordAbandonedSession(trained);
  check('history survives an abandon', trained.completionOrdinal === 1);
  check('and so does the recency list', trained.recent.join() === before);
});

// ── The two counters are not interchangeable ────────────────────────────────

describe('history and draw state cannot stand in for each other', () => {
  // This is the bug that shipped: one counter served both meanings, so
  // "trained three times" and "threw away three offers" were the same state.
  const trained = { completionOrdinal: 3, offerOrdinal: 0, recent: [], lastArchetype: '', lastCompletedAt: 0, launchOrdinal: 0 };
  const abandoned = { completionOrdinal: 0, offerOrdinal: 3, recent: [], lastArchetype: '', lastCompletedAt: 0, launchOrdinal: 0 };
  check('swapping the counters is a different seed',
    seedOf(trained) !== seedOf(abandoned),
    seedOf(trained) + ' vs ' + seedOf(abandoned));

  // Adding them was the original mistake; make sure we did not re-add them
  const split = { completionOrdinal: 1, offerOrdinal: 2, recent: [], lastArchetype: '', lastCompletedAt: 0, launchOrdinal: 0 };
  const other = { completionOrdinal: 2, offerOrdinal: 1, recent: [], lastArchetype: '', lastCompletedAt: 0, launchOrdinal: 0 };
  check('and so is every other split of the same total',
    seedOf(split) !== seedOf(other));

  // Progression is a claim about the athlete, so it reads history only
  check('an abandon does not look like training',
    recordAbandonedSession(emptyTrainingLog()).completionOrdinal === 0);
});

// ── Preview ─────────────────────────────────────────────────────────────────

describe('preview varies without ever being remembered', () => {
  const log = emptyTrainingLog();

  const a = generateSession(INPUT, { ...REQ, seed: seedOf(log, 0) })!;
  const b = generateSession(INPUT, { ...REQ, seed: seedOf(log, 1) })!;
  const c = generateSession(INPUT, { ...REQ, seed: seedOf(log, 2) })!;

  check('the preview offset changes the draw',
    JSON.stringify(a.stations) !== JSON.stringify(b.stations));
  check('and keeps changing it',
    JSON.stringify(b.stations) !== JSON.stringify(c.stations));

  // Fifteen minutes of testing must not arrive on device as fifteen workouts
  check('while the stored log stays empty',
    log.completionOrdinal === 0 && log.offerOrdinal === 0 && log.recent.length === 0);

  check('and the offset alone is stable',
    JSON.stringify(generateSession(INPUT, { ...REQ, seed: seedOf(log, 7) })) ===
    JSON.stringify(generateSession(INPUT, { ...REQ, seed: seedOf(log, 7) })));
});

describe('the same state always produces the same session', () => {
  const a = generateSession(INPUT, { ...REQ, seed: 3 })!;
  const b = generateSession(INPUT, { ...REQ, seed: 3 })!;
  check('a preview is stable', JSON.stringify(a) === JSON.stringify(b));

  const withHistory = { ...INPUT, recentMovements: ['WALKING_LUNGES', 'AIR_SQUAT'] };
  const c = generateSession(withHistory, { ...REQ, seed: 3 })!;
  const d = generateSession(withHistory, { ...REQ, seed: 3 })!;
  check('history does not make it unstable', JSON.stringify(c) === JSON.stringify(d));
  check('but it does change the outcome', JSON.stringify(a) !== JSON.stringify(c));
});

// ── Diversity ───────────────────────────────────────────────────────────────

describe('what was just trained gets pushed down', () => {
  for (const seed of [0, 1, 5, 7, 42]) {
    const first = generateSession(INPUT, { ...REQ, seed })!;
    const trained = movementsOf(first);

    const next = generateSession(
      { ...INPUT, recentMovements: trained },
      { ...REQ, seed: seed + 1 }
    )!;
    const nextMovements = movementsOf(next);

    const repeated = nextMovements.filter((m) => trained.indexOf(m) >= 0);

    check(
      'the next session is not the same movements (seed ' + seed + ')',
      repeated.length < nextMovements.length,
      'repeated ' + repeated.join(', ') + ' of ' + nextMovements.join(', ')
    );
  }
});

describe('recency never overrules a real constraint', () => {
  // A small room is a fact about the world. Having done a movement yesterday
  // is a preference, and must not be able to put the athlete in a wall.
  for (const seed of [0, 3, 9]) {
    const stationary = ['AIR_SKIERG', 'POWER_ROW', 'TARGET_PRESS', 'BURPEE_BROAD_JUMP'];
    const plan = generateSession(
      { ...INPUT, recentMovements: stationary },
      { space: 'SMALL', duration: 'FULL', focus: 'MIXED', level: 'REGULAR', seed }
    )!;

    const travelling = movementsOf(plan).filter((m) =>
      ['POWER_LANE', 'CRAB_WALK', 'HEAVY_CARRY', 'WALKING_LUNGES'].indexOf(m) >= 0
    );

    check(
      'a small room still wins over recency (seed ' + seed + ')',
      travelling.length <= 1,
      'travelling: ' + travelling.join(', ')
    );
  }

  // Focus is a training decision, not a tiebreak
  for (const seed of [0, 3, 9]) {
    const distanceStations = ['POWER_LANE', 'CRAB_WALK', 'HEAVY_CARRY', 'WALKING_LUNGES'];
    const plan = generateSession(
      { ...INPUT, recentMovements: distanceStations },
      { space: 'NORMAL', duration: 'FULL', focus: 'STRENGTH', level: 'REGULAR', seed }
    )!;

    const kept = movementsOf(plan).filter((m) => distanceStations.indexOf(m) >= 0);
    check(
      'a strength session still uses loaded work (seed ' + seed + ')',
      kept.length > 0,
      movementsOf(plan).join(', ')
    );
  }

  // A named limiter is the whole reason the session exists
  for (const seed of [0, 3, 9]) {
    const plan = generateSession(
      {
        ...INPUT,
        limiterPrefabType: 'BURPEE_BROAD_JUMP',
        recentMovements: ['PUSH_UP', 'BURPEE_LATERAL', 'BURPEE_BROAD_JUMP'],
      },
      { space: 'NORMAL', duration: 'MEDIUM', focus: 'MIXED', level: 'REGULAR', seed }
    )!;

    const helpers = movementsOf(plan).filter((m) =>
      ['PUSH_UP', 'BURPEE_LATERAL'].indexOf(m) >= 0
    );
    check(
      'the limiter still pulls in what develops it (seed ' + seed + ')',
      helpers.length > 0,
      movementsOf(plan).join(', ')
    );
  }
});

// ── Stored form ─────────────────────────────────────────────────────────────

describe('a stored log survives whatever it finds', () => {
  check('empty storage', parseTrainingLog('').completionOrdinal === 0);
  check('malformed json', parseTrainingLog('{oh no').completionOrdinal === 0);
  check('missing fields', parseTrainingLog('{}').completionOrdinal === 0);
  check('a negative count',
    parseTrainingLog('{"completionOrdinal":-4}').completionOrdinal === 0);
  check('a negative offer count',
    parseTrainingLog('{"offerOrdinal":-4}').offerOrdinal === 0);
  check('non-numeric counts',
    parseTrainingLog('{"completionOrdinal":"lots"}').completionOrdinal === 0);
  check('non-string entries are dropped',
    parseTrainingLog('{"completionOrdinal":2,"recent":["A",7,"B"]}').recent.length === 2);

  const round = recordAbandonedSession(recordCompletedSession(emptyTrainingLog(), ['A', 'B']));
  const back = parseTrainingLog(JSON.stringify(round));
  check('a real log round-trips',
    back.completionOrdinal === 1 && back.offerOrdinal === 1 && back.recent.join() === 'A,B');

  // Logs written before the counters were split carry a single `ordinal`,
  // which was only ever incremented on completion.
  const migrated = parseTrainingLog('{"ordinal":4,"recent":["A"]}');
  check('an old single-counter log migrates to history',
    migrated.completionOrdinal === 4, migrated.completionOrdinal);
  check('and starts with a clean draw count', migrated.offerOrdinal === 0);
  check('keeping its recency list', migrated.recent.join() === 'A');
});

describe('what the last session was, and when', () => {
  // The movement list cannot answer the first. Threshold repetitions and
  // maximal aerobic ones are the same movement - a run - and what separates
  // them is the distance, the recovery and the pace, none of which survives
  // being reduced to a prefab name.
  const done = recordCompletedSession(
    emptyTrainingLog(), ['RUN'], 'THRESHOLD', 1000);

  check('the archetype is remembered', done.lastArchetype === 'THRESHOLD');
  check('and when it finished', done.lastCompletedAt === 1000);

  // Nothing was trained, so the last session the athlete actually did is
  // still the last one they did - and still owes whatever recovery it owed.
  const quit = recordAbandonedSession(done);
  check('an abandoned session does not become the last one',
    quit.lastArchetype === 'THRESHOLD' && quit.lastCompletedAt === 1000);
  check('but it still moves the draw', quit.offerOrdinal === done.offerOrdinal + 1);

  const next = recordCompletedSession(quit, ['RUN'], 'EASY_BASE', 2000);
  check('and finishing one replaces it', next.lastArchetype === 'EASY_BASE');

  // A session that was not running has no archetype, and saying so is not
  // the same as saying it was easy.
  const strength = recordCompletedSession(emptyTrainingLog(), ['HEAVY_CARRY'], '', 3000);
  check('a session with no archetype claims none', strength.lastArchetype === '');
});

describe('a log written before scheduling existed', () => {
  // Absent in every log on every device today, and read as "not known" rather
  // than defaulted to something plausible: an invented archetype would be
  // scheduled against, and an invented timestamp would hold a real athlete
  // back from a session they had earned.
  const old = parseTrainingLog(JSON.stringify({
    completionOrdinal: 4, offerOrdinal: 1, recent: ['HEAVY_CARRY'],
  }));

  check('the counters survive', old.completionOrdinal === 4 && old.offerOrdinal === 1);
  check('the archetype is not invented', old.lastArchetype === '');
  check('nor the time', old.lastCompletedAt === 0);

  // And one written by this version round-trips.
  const fresh = recordCompletedSession(emptyTrainingLog(), ['RUN'], 'VO2', 12345);
  const back = parseTrainingLog(JSON.stringify(fresh));
  check('a current log survives the round trip',
    back.lastArchetype === 'VO2' && back.lastCompletedAt === 12345);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
