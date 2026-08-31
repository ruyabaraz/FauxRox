// ============================================================================
// hyroxPace.test.ts — the one band that is measured rather than modelled
// ============================================================================
// Race pace has no derivation. What somebody holds over eight kilometres with
// eight stations between them is not predicted by their road running, so the
// only honest source is having watched them do it - and the only honest thing
// to say before that is nothing.
//
// Which makes this module's job mostly refusal: refuse to speak for anything
// but race pace, refuse a pace read off forty metres, refuse a centre built
// from one run, and refuse evidence old enough to be about somebody else.
// ============================================================================

import {
  HyroxRunSample,
  PaceEvidenceStore,
  emptyPaceEvidence,
  recordFiveK,
  recordDeclined,
  recordHyroxRuns,
  freshHyroxRuns,
  robustCentreSecPerKm,
  hyroxAnchorFrom,
  isBelievableRunSample,
  parsePaceEvidence,
  anchorFrom,
  MIN_HYROX_SAMPLE_METRES,
  MIN_HYROX_SAMPLES,
  HYROX_SAMPLE_CAPACITY,
  HYROX_EVIDENCE_MAX_AGE_MS,
  HYROX_BAND_HALF_WIDTH_SEC_PER_KM,
} from '../Assets/Scripts/PaceEvidence';

import {
  paceTargetFor,
  resolveTarget,
  anchorFromFiveK,
  provenanceLine,
  PaceAnchor,
} from '../Assets/Scripts/PaceTarget';

import { ALL_RUNNING_ARCHETYPES } from '../Assets/Scripts/RunningArchetype';
import { raceRunSamples } from '../Assets/Scripts/TrainingAnalysis';
import { generateSession } from '../Assets/Scripts/AdaptiveSessionGenerator';
import { StationMode, distanceRun } from '../Assets/Scripts/SessionTypes';
import { EffortRecord } from '../Assets/Scripts/TrainingAnalysis';

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

function run(paceSecPerKm: number, metres = 1000, atEpochMs = NOW): HyroxRunSample {
  return { paceSecPerKm: paceSecPerKm, metres: metres, atEpochMs: atEpochMs };
}

function storeWith(...samples: HyroxRunSample[]): PaceEvidenceStore {
  return recordHyroxRuns(emptyPaceEvidence(), samples);
}

describe('a pace read off forty metres is a measurement of turning around', () => {
  check('a kilometre at five minutes is a run', isBelievableRunSample(run(300, 1000)));
  check('and the shortest allowed distance still is',
    isBelievableRunSample(run(300, MIN_HYROX_SAMPLE_METRES)));
  check('a living-room shuttle is not', !isBelievableRunSample(run(300, 40)));
  check('nor anything under the floor',
    !isBelievableRunSample(run(300, MIN_HYROX_SAMPLE_METRES - 1)));

  // A broken tracker is not an athlete.
  check('a pace nobody has ever run is a broken measurement',
    !isBelievableRunSample(run(90, 1000)));
  check('and neither is standing still', !isBelievableRunSample(run(4000, 1000)));

  check('the short ones never enter the store at all',
    (storeWith(run(300, 1000), run(300, 40)).hyroxRuns || []).length === 1);
});

describe('one split is a split; several are a pace', () => {
  check('nothing on file, nothing to say',
    hyroxAnchorFrom(emptyPaceEvidence(), NOW) === null);

  let store = emptyPaceEvidence();
  for (let i = 1; i < MIN_HYROX_SAMPLES; i++) {
    store = recordHyroxRuns(store, [run(300)]);
    check('still nothing after ' + i, hyroxAnchorFrom(store, NOW) === null);
  }

  store = recordHyroxRuns(store, [run(300)]);
  const anchor = hyroxAnchorFrom(store, NOW);
  check('and a pace once there are enough of them', anchor !== null);
  check('it is a band that was measured, not an index',
    anchor !== null && anchor.kind === 'MEASURED');
  check('centred on what they ran',
    anchor !== null && anchor.kind === 'MEASURED' &&
    anchor.band.fastestSecPerKm === 300 - HYROX_BAND_HALF_WIDTH_SEC_PER_KM &&
    anchor.band.slowestSecPerKm === 300 + HYROX_BAND_HALF_WIDTH_SEC_PER_KM);

  // Nothing about it is standing in for something better.
  check('and it is not provisional',
    anchor !== null && anchor.provisional === false);
  check('and it says where it came from',
    provenanceLine(anchor) === 'From your race splits');
});

describe('the centre steps over the run where something happened', () => {
  // Every race has one: a dropped dumbbell, a queue at the sled. It always
  // lands on the slow side, and a mean would carry it into the band.
  const withAMishap = storeWith(run(295), run(300), run(305), run(302), run(600));
  const centre = robustCentreSecPerKm(freshHyroxRuns(withAMishap, NOW));

  check('the median ignores it', centre === 302, centre);
  check('a mean would not have', centre < (295 + 300 + 305 + 302 + 600) / 5);

  check('an even count averages the middle two',
    robustCentreSecPerKm([run(300), run(310)]) === 305);
  check('and nothing has no centre', robustCentreSecPerKm([]) === 0);
});

describe('evidence about somebody who no longer exists', () => {
  const lastWinter = NOW - HYROX_EVIDENCE_MAX_AGE_MS - 1;
  const stale = storeWith(run(300, 1000, lastWinter), run(300, 1000, lastWinter),
                          run(300, 1000, lastWinter));

  check('three races from last year say nothing about today',
    hyroxAnchorFrom(stale, NOW) === null);
  check('and they were fine at the time', hyroxAnchorFrom(stale, lastWinter + 1) !== null);

  // Fresh evidence beside stale evidence is enough on its own.
  const mixed = recordHyroxRuns(stale, [run(320), run(320), run(320)]);
  const anchor = hyroxAnchorFrom(mixed, NOW);
  check('and only the recent ones set the pace',
    anchor !== null && anchor.kind === 'MEASURED' && anchor.band.fastestSecPerKm === 315,
    anchor !== null && anchor.kind === 'MEASURED' ? anchor.band.fastestSecPerKm : 'none');
});

describe('the store keeps the recent ones', () => {
  let store = emptyPaceEvidence();
  for (let i = 0; i < HYROX_SAMPLE_CAPACITY + 6; i++) {
    store = recordHyroxRuns(store, [run(300 + i)]);
  }

  const kept = store.hyroxRuns || [];
  check('it does not grow without bound', kept.length === HYROX_SAMPLE_CAPACITY);
  check('and it is the oldest that fall off the front',
    kept[kept.length - 1].paceSecPerKm === 300 + HYROX_SAMPLE_CAPACITY + 5);
});

describe('a race says one thing, and only that thing', () => {
  const raced = hyroxAnchorFrom(storeWith(run(300), run(302), run(298)), NOW);

  for (const archetype of ALL_RUNNING_ARCHETYPES) {
    const target = paceTargetFor(archetype, raced || undefined);
    if (archetype === 'HYROX_PACE') {
      check('it answers for race pace', target !== null);
    } else {
      check('and stays out of ' + archetype, target === null);
    }
  }
});

describe('two kinds of knowledge, held at once', () => {
  // An athlete who has typed a 5K and raced knows two different things, and
  // each answers where the other cannot.
  const store = recordFiveK(storeWith(run(300), run(302), run(298)), 1500, NOW);
  const anchors: PaceAnchor[] = [];

  const raced = hyroxAnchorFrom(store, NOW);
  if (raced) anchors.push(raced);
  const entered = anchorFrom(store);
  if (entered) anchors.push(entered);

  check('both are on file', anchors.length === 2);

  const race = resolveTarget('HYROX_PACE', anchors);
  check('race pace comes from the races', race !== null &&
    race.source === 'HYROX_HISTORY');

  const threshold = resolveTarget('THRESHOLD', anchors);
  check('and threshold from the 5K', threshold !== null &&
    threshold.source === '5K_ENTRY');

  // The order is the caller's, and the rule survives it being wrong: a race
  // anchor cannot answer a threshold question however early it is asked.
  const reversed = resolveTarget('THRESHOLD', [anchors[1], anchors[0]]);
  check('and the rule does not depend on the order',
    reversed !== null && reversed.source === '5K_ENTRY');

  check('with only a 5K there is still no race pace',
    resolveTarget('HYROX_PACE', [anchorFromFiveK(1500)]) === null);
  check('and with nothing at all, nothing',
    resolveTarget('HYROX_PACE', []) === null &&
    resolveTarget('THRESHOLD', undefined) === null);
});

describe('the two stores do not overwrite each other', () => {
  const both = recordFiveK(storeWith(run(300), run(302), run(298)), 1500, NOW);
  check('entering a 5K keeps the races', (both.hyroxRuns || []).length === 3);
  check('and the 5K is there too', both.fiveK !== undefined);

  const declined = recordDeclined(both, NOW);
  check('declining the 5K keeps the races', (declined.hyroxRuns || []).length === 3);

  const raced = recordHyroxRuns(both, [run(299)]);
  check('and racing again keeps the 5K', raced.fiveK !== undefined &&
    raced.fiveK.seconds === 1500);

  const round = parsePaceEvidence(JSON.stringify(raced));
  check('all of it survives being written down and read back',
    (round.hyroxRuns || []).length === 4 && round.fiveK !== undefined);
  check('and a stored sample too short to mean anything is dropped on the way in',
    (parsePaceEvidence('{"hyroxRuns":[{"paceSecPerKm":300,"metres":40,"atEpochMs":1}]}')
      .hyroxRuns || []).length === 0);
});

describe('only what the running measured', () => {
  const efforts: EffortRecord[] = [
    { name: 'RUN 1', prefabType: 'RUN', mode: 'RUN', prescribed: 1000, durationMs: 300000,
      blockScheme: '', blockIndex: 0, roundIndex: 1, avgHR: 150,
      paceSecPerKm: 300, measuredMetres: 1000 },
    // No measurement behind it: a split we happened to time.
    { name: 'RUN 2', prefabType: 'RUN', mode: 'RUN', prescribed: 1000, durationMs: 300000,
      blockScheme: '', blockIndex: 1, roundIndex: 1, avgHR: 150 },
    // A run in a room, which is a measurement of turning around.
    { name: 'RUN 3', prefabType: 'RUN', mode: 'RUN', prescribed: 40, durationMs: 20000,
      blockScheme: '', blockIndex: 2, roundIndex: 1, avgHR: 150,
      paceSecPerKm: 300, measuredMetres: 40 },
    // Not a run at all.
    { name: 'SKIERG', prefabType: 'AIR_SKIERG', mode: 'ZONE_HIT', prescribed: 50,
      durationMs: 120000, blockScheme: '', blockIndex: 3, roundIndex: 1, avgHR: 160 },
  ];

  const samples = raceRunSamples(efforts, NOW);
  check('one of the four is evidence', samples.length === 1, samples.length);
  check('and it is the one that was measured',
    samples[0].paceSecPerKm === 300 && samples[0].metres === 1000);
  check('nothing at all is no evidence', raceRunSamples([], NOW).length === 0);
});

describe('a measured race pace reaches the session', () => {
  const templates = [
    { name: 'AIR SKIERG', mode: StationMode.ZONE_HIT, requirement: 50, instruction: 'x',
      prefabType: 'AIR_SKIERG', run: distanceRun(100) },
    { name: 'HEAVY CARRY', mode: StationMode.DISTANCE, requirement: 200, instruction: 'x',
      prefabType: 'HEAVY_CARRY', run: distanceRun(100) },
  ];

  const raced = hyroxAnchorFrom(storeWith(run(330), run(334), run(332)), NOW);
  const anchors: PaceAnchor[] = raced ? [raced, anchorFromFiveK(1500)] : [];

  let sawRacePace = false;
  let sawOther = false;
  let wrongSource = '';

  for (const duration of ['MEDIUM', 'FULL']) {
    for (let seed = 0; seed < 25; seed++) {
      const plan = generateSession(
        { templates: templates as any, baseRunMetres: 400, paceAnchors: anchors },
        { space: 'NORMAL', duration: duration as any, focus: 'RUNNING',
          level: 'REGULAR', seed: seed });
      if (!plan || !plan.blocks) continue;

      for (const block of plan.blocks) {
        if (!block.archetype || !block.paceTarget) continue;

        if (block.archetype === 'HYROX_PACE') {
          sawRacePace = true;
          if (block.paceTarget.source !== 'HYROX_HISTORY' && !wrongSource) {
            wrongSource = 'race pace prescribed from ' + block.paceTarget.source;
          }
          // The band is the one that was measured, not a model's version of it.
          if (block.paceTarget.band.fastestSecPerKm !== 332 - HYROX_BAND_HALF_WIDTH_SEC_PER_KM &&
              !wrongSource) {
            wrongSource = 'race band centred on ' +
              (block.paceTarget.band.fastestSecPerKm + HYROX_BAND_HALF_WIDTH_SEC_PER_KM);
          }
        } else {
          sawOther = true;
          if (block.paceTarget.source !== '5K_ENTRY' && !wrongSource) {
            wrongSource = block.archetype + ' prescribed from ' + block.paceTarget.source;
          }
        }
      }
    }
  }

  check('race-pace sessions are prescribed from the races', sawRacePace && !wrongSource,
    wrongSource);
  check('and everything else from the 5K', sawOther && !wrongSource, wrongSource);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
