// ============================================================================
// calibration.test.ts — an observation is not an anchor
// ============================================================================
// One threshold repetition run at 5:14 is a fact about that repetition. It
// becomes a fact about the athlete only when there is enough of it, from more
// than one session, and the sessions agree.
//
// The promotion policy is the whole subject here, and most of these tests are
// about when it refuses.
// ============================================================================

import {
  RunObservation,
  PaceEvidenceStore,
  emptyPaceEvidence,
  recordObservations,
  recordFiveK,
  recordHyroxRuns,
  calibratableObservations,
  calibrationAnchorFrom,
  calibrationSpread,
  sessionMedians,
  isBelievableObservation,
  parsePaceEvidence,
  anchorFrom,
  hyroxAnchorFrom,
  MIN_CALIBRATION_SAMPLES,
  MIN_CALIBRATION_SESSIONS,
  CALIBRATION_SPREAD_LIMIT_SEC_PER_KM,
  OBSERVATION_CAPACITY,
  OBSERVATION_MAX_AGE_MS,
  MIN_HYROX_SAMPLE_METRES,
} from '../Assets/Scripts/PaceEvidence';

import {
  resolveTarget,
  anchorFromThresholdPace,
  anchorFromFiveK,
  provenanceLine,
  PaceAnchor,
} from '../Assets/Scripts/PaceTarget';

import {
  THRESHOLD_OFFSET_MID_SEC_PER_KM,
  bandFor,
} from '../Assets/Scripts/PaceModel';

import { runObservations, EffortRecord } from '../Assets/Scripts/TrainingAnalysis';

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

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function rep(
  paceSecPerKm: number,
  sessionAtEpochMs: number,
  archetype = 'THRESHOLD',
  metres = 1000
): RunObservation {
  return {
    archetype: archetype,
    paceSecPerKm: paceSecPerKm,
    metres: metres,
    sessionAtEpochMs: sessionAtEpochMs,
  };
}

/** n repetitions at this pace, all belonging to one session */
function session(pace: number, at: number, count: number, archetype = 'THRESHOLD'): RunObservation[] {
  const out: RunObservation[] = [];
  for (let i = 0; i < count; i++) out.push(rep(pace, at, archetype));
  return out;
}

function storeOf(...groups: RunObservation[][]): PaceEvidenceStore {
  let store = emptyPaceEvidence();
  for (const group of groups) store = recordObservations(store, group);
  return store;
}

describe('one session is one afternoon', () => {
  // Everybody has a day when they were tired, or fresh, or racing a friend.
  const oneSession = storeOf(session(310, NOW - DAY, MIN_CALIBRATION_SAMPLES + 2));

  check('enough repetitions is still not enough sessions',
    calibrationAnchorFrom(oneSession, NOW) === null);
  check('and the repetitions were all kept anyway',
    calibratableObservations(oneSession, NOW).length === MIN_CALIBRATION_SAMPLES + 2);

  const twoSessions = recordObservations(oneSession, session(312, NOW - 3 * DAY, 3));
  check('two sessions that agree are an athlete',
    calibrationAnchorFrom(twoSessions, NOW) !== null);
});

describe('a handful of repetitions is not a fitness', () => {
  const thin = storeOf(session(310, NOW - DAY, 1), session(310, NOW - 3 * DAY, 1));

  check('two sessions of one repetition each say nothing',
    calibrationAnchorFrom(thin, NOW) === null);
  check('and there were the right number of sessions',
    sessionMedians(calibratableObservations(thin, NOW)).length === MIN_CALIBRATION_SESSIONS);

  const enough = recordObservations(thin, session(310, NOW - 5 * DAY,
    MIN_CALIBRATION_SAMPLES - 2));
  check('enough of them and it answers', calibrationAnchorFrom(enough, NOW) !== null);
});

describe('sessions that disagree are not one athlete', () => {
  const wild = storeOf(
    session(300, NOW - DAY, 3),
    session(300 + CALIBRATION_SPREAD_LIMIT_SEC_PER_KM + 5, NOW - 4 * DAY, 3));

  check('two efforts that far apart are refused',
    calibrationAnchorFrom(wild, NOW) === null);

  const close = storeOf(
    session(300, NOW - DAY, 3),
    session(300 + CALIBRATION_SPREAD_LIMIT_SEC_PER_KM, NOW - 4 * DAY, 3));
  check('and the limit itself is allowed', calibrationAnchorFrom(close, NOW) !== null);

  // Fading through a session is what a threshold session does to people. It
  // is not a disagreement about their fitness, so it is not measured that way.
  const fades = storeOf(
    [rep(295, NOW - DAY), rep(300, NOW - DAY), rep(305, NOW - DAY),
     rep(315, NOW - DAY), rep(325, NOW - DAY)],
    session(305, NOW - 4 * DAY, 3));
  check('fading inside a session is not a disagreement between sessions',
    calibrationAnchorFrom(fades, NOW) !== null);

  check('the spread of one session is nothing', calibrationSpread([300]) === 0);
  check('and of none, nothing', calibrationSpread([]) === 0);
});

describe('threshold, and nothing else', () => {
  // Maximal aerobic repetitions are three minutes long and vary with how much
  // somebody had left; easy runs are limited by patience; speed repetitions
  // are not aerobic at all.
  for (const archetype of ['VO2', 'EASY_BASE', 'SPEED_REPETITION', 'HYROX_PACE']) {
    const store = storeOf(
      session(310, NOW - DAY, 4, archetype),
      session(310, NOW - 4 * DAY, 4, archetype));

    check('a month of ' + archetype + ' still calibrates nothing',
      calibrationAnchorFrom(store, NOW) === null);
    check('though it was all recorded',
      (store.observations || []).length === 8);
  }
});

describe('evidence about somebody who no longer exists', () => {
  const longAgo = NOW - OBSERVATION_MAX_AGE_MS - 1;
  const stale = storeOf(session(310, longAgo, 4), session(310, longAgo - DAY, 4));

  check('last year\'s threshold sessions say nothing about today',
    calibrationAnchorFrom(stale, NOW) === null);
  check('and they were fine at the time',
    calibrationAnchorFrom(stale, longAgo + 1) !== null);
});

describe('the index comes out where the model would have put it', () => {
  // Read backwards through the same derivation A2 uses forwards: two routes
  // to the index that disagreed would be two models, and the second one would
  // be nobody's.
  const fiveK = anchorFromFiveK(1500);
  const thresholdBand = fiveK && fiveK.kind === 'INDEX'
    ? bandFor('THRESHOLD', fiveK.vdot, fiveK.fiveKPaceSecPerKm)
    : null;

  check('a 25:00 5K implies a threshold band', thresholdBand !== null);

  const centre = thresholdBand
    ? (thresholdBand.fastestSecPerKm + thresholdBand.slowestSecPerKm) / 2
    : 0;
  const calibrated = anchorFromThresholdPace(centre);

  check('and running that band back through gives the same 5K pace',
    calibrated !== null && calibrated.kind === 'INDEX' && fiveK !== null &&
    fiveK.kind === 'INDEX' &&
    Math.abs(calibrated.fiveKPaceSecPerKm - fiveK.fiveKPaceSecPerKm) < 0.001,
    calibrated !== null && calibrated.kind === 'INDEX' ? calibrated.fiveKPaceSecPerKm : 'none');

  check('and the same fitness index',
    calibrated !== null && calibrated.kind === 'INDEX' && fiveK !== null &&
    fiveK.kind === 'INDEX' && Math.abs(calibrated.vdot - fiveK.vdot) < 0.001);

  check('the offset it reads back through is the middle of the band',
    Math.abs(centre - THRESHOLD_OFFSET_MID_SEC_PER_KM -
      (fiveK && fiveK.kind === 'INDEX' ? fiveK.fiveKPaceSecPerKm : 0)) < 0.001);

  check('it is measured rather than remembered',
    calibrated !== null && calibrated.source === 'CALIBRATION' &&
    calibrated.provisional === false);
  check('and it says so', provenanceLine(calibrated) === 'Measured from your own sessions');

  check('a pace nothing could have produced is not an index',
    anchorFromThresholdPace(0) === null && anchorFromThresholdPace(-5) === null);
});

describe('what the athlete ran outranks what they typed', () => {
  let store = recordFiveK(emptyPaceEvidence(), 1800, NOW);
  store = recordObservations(store, session(300, NOW - DAY, 4));
  store = recordObservations(store, session(302, NOW - 4 * DAY, 4));

  const anchors: PaceAnchor[] = [];
  const calibrated = calibrationAnchorFrom(store, NOW);
  if (calibrated) anchors.push(calibrated);
  const entered = anchorFrom(store);
  if (entered) anchors.push(entered);

  check('both are on file', anchors.length === 2);

  const threshold = resolveTarget('THRESHOLD', anchors);
  check('the sessions answer', threshold !== null && threshold.source === 'CALIBRATION');

  // And the 5K is still there underneath, doing nothing, which is what it is
  // for: the moment the sessions go stale it answers again.
  const stale = resolveTarget('THRESHOLD', [entered as PaceAnchor]);
  check('the typed-in time still works on its own',
    stale !== null && stale.source === '5K_ENTRY');

  // Nothing derived from their own running is allowed to invent a race pace.
  check('and neither of them speaks for race pace',
    resolveTarget('HYROX_PACE', anchors) === null);
});

describe('the three stores keep out of each other\'s way', () => {
  let store = emptyPaceEvidence();
  store = recordObservations(store, session(305, NOW - DAY, 3));
  store = recordHyroxRuns(store, [
    { paceSecPerKm: 330, metres: 1000, atEpochMs: NOW },
    { paceSecPerKm: 332, metres: 1000, atEpochMs: NOW },
    { paceSecPerKm: 334, metres: 1000, atEpochMs: NOW },
  ]);
  store = recordFiveK(store, 1500, NOW);
  store = recordObservations(store, session(307, NOW - 4 * DAY, 3));

  check('the observations survived the other two writers',
    (store.observations || []).length === 6);
  check('and the races did', (store.hyroxRuns || []).length === 3);
  check('and the 5K did', store.fiveK !== undefined);

  const round = parsePaceEvidence(JSON.stringify(store));
  check('all three survive being written down and read back',
    (round.observations || []).length === 6 &&
    (round.hyroxRuns || []).length === 3 && round.fiveK !== undefined);

  check('and all three still answer',
    calibrationAnchorFrom(round, NOW) !== null &&
    hyroxAnchorFrom(round, NOW) !== null &&
    anchorFrom(round) !== null);

  check('a stored observation with no archetype is not one',
    (parsePaceEvidence('{"observations":[{"paceSecPerKm":300,"metres":1000,"sessionAtEpochMs":1}]}')
      .observations || []).length === 0);
});

describe('the store does not grow without bound', () => {
  let store = emptyPaceEvidence();
  for (let i = 0; i < OBSERVATION_CAPACITY + 10; i++) {
    store = recordObservations(store, [rep(300 + i, NOW - i * DAY)]);
  }

  check('it keeps a fixed number', (store.observations || []).length === OBSERVATION_CAPACITY);
});

describe('what a repetition has to be before it is an observation', () => {
  check('a kilometre at threshold is one', isBelievableObservation(rep(310, NOW)));
  check('a shuttle across a room is not',
    !isBelievableObservation(rep(310, NOW, 'THRESHOLD', MIN_HYROX_SAMPLE_METRES - 1)));
  check('and a broken measurement is not',
    !isBelievableObservation(rep(20, NOW)) && !isBelievableObservation(rep(5000, NOW)));

  const efforts: EffortRecord[] = [
    { name: 'RUN 1', prefabType: 'RUN', mode: 'RUN', prescribed: 1000, durationMs: 310000,
      blockScheme: 'STRAIGHT', blockIndex: 0, roundIndex: 1, avgHR: 165,
      archetype: 'THRESHOLD', paceSecPerKm: 310, measuredMetres: 1000 },
    // A run the plan never named: nothing to calibrate from, since what
    // separates threshold from anything else is not in the measurement.
    { name: 'RUN 2', prefabType: 'RUN', mode: 'RUN', prescribed: 1000, durationMs: 310000,
      blockScheme: '', blockIndex: 1, roundIndex: 1, avgHR: 165,
      paceSecPerKm: 310, measuredMetres: 1000 },
    { name: 'RECOVERY', prefabType: 'RECOVERY', mode: 'TIMED', prescribed: 45,
      durationMs: 45000, blockScheme: 'STRAIGHT', blockIndex: 0, roundIndex: 1, avgHR: 140 },
  ];

  const seen = runObservations(efforts, NOW);
  check('one of the three is an observation', seen.length === 1, seen.length);
  check('and it carries the archetype it was run as',
    seen[0].archetype === 'THRESHOLD' && seen[0].paceSecPerKm === 310);
  check('and the session it belongs to', seen[0].sessionAtEpochMs === NOW);

  // Six repetitions of one session must not pass for six sessions.
  const wholeSession = runObservations([efforts[0], efforts[0], efforts[0]], NOW);
  check('every repetition of a session shares its time',
    sessionMedians(wholeSession).length === 1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
