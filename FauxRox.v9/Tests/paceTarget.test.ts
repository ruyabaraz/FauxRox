// ============================================================================
// paceTarget.test.ts — the model prior must not reach the athlete
// ============================================================================

import {
  PaceSource,
  PaceTarget,
  PaceAnchor,
  ALL_PACE_SOURCES,
  sourceSuitsArchetype,
  paceTargetFor,
  formatPaceBand,
  formatPace,
  withinBand,
  driftFromBand,
} from '../Assets/Scripts/PaceTarget';

import {
  ALL_RUNNING_ARCHETYPES,
  modelPaceSecPerKm,
} from '../Assets/Scripts/RunningArchetype';

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

const band = (fastest: number, slowest: number) => ({
  fastestSecPerKm: fastest, slowestSecPerKm: slowest,
});

describe('every source is the athlete own evidence', () => {
  // The whole point of the type. A pace target cannot be constructed without
  // naming where it came from, and there is nowhere for the duration model to
  // come from - so passing it here means editing this list on purpose rather
  // than passing the wrong number by accident.
  for (const source of ALL_PACE_SOURCES) {
    check(source + ' is evidence from the athlete',
      source === '5K_ENTRY' || source === 'CALIBRATION' || source === 'HYROX_HISTORY');
  }

  check('there are three of them', ALL_PACE_SOURCES.length === 3);

  check('and none of them is the duration model',
    (ALL_PACE_SOURCES as string[]).indexOf('MODEL') < 0,
    ALL_PACE_SOURCES.join(', '));

  // The model still exists and still answers - to the generator, for fitting
  // sessions into a duration. It is the same number for everybody who opens
  // the app, which is what makes it useless as a prescription.
  check('the model is still there for the fitter',
    modelPaceSecPerKm('THRESHOLD') > 0);
});

describe('race splits prescribe race pace and nothing else', () => {
  // Run under fatigue, between stations, on a course we do not control. They
  // measure one specific thing: what that athlete holds on race day - which
  // is what a race-pace session asks for and precisely not a threshold.
  for (const archetype of ALL_RUNNING_ARCHETYPES) {
    const suits = sourceSuitsArchetype('HYROX_HISTORY', archetype);
    check('HYROX history ' + (archetype === 'HYROX_PACE' ? 'feeds' : 'does not feed') +
          ' ' + archetype,
      suits === (archetype === 'HYROX_PACE'));
  }

  // A 5K or a pace measured from their own running is general.
  for (const archetype of ALL_RUNNING_ARCHETYPES) {
    check('a 5K entry can anchor ' + archetype,
      sourceSuitsArchetype('5K_ENTRY', archetype));
    check('and so can calibration for ' + archetype,
      sourceSuitsArchetype('CALIBRATION', archetype));
  }
});

describe('with no anchor there is no target', () => {
  // Which is every session today, and will be most sessions forever: a
  // first-time athlete has no anchor and will not have one until they have
  // run something. Everything downstream is written for this state rather
  // than treating it as an edge case.
  for (const archetype of ALL_RUNNING_ARCHETYPES) {
    check(archetype + ' has no target yet', paceTargetFor(archetype) === null);
  }

  check('and nothing to print', formatPaceBand(null) === '');

  const anchor: PaceAnchor = {
    kind: 'INDEX',
    source: 'CALIBRATION', derivation: 'MEASURED', provisional: false,
    vdot: 40, fiveKPaceSecPerKm: 300,
  };
  check('an anchor switches it on', paceTargetFor('THRESHOLD', anchor) !== null);

  // The compatibility rule is applied here rather than trusted at the call
  // site, so a race-derived anchor cannot leak into a threshold session by
  // somebody forgetting to ask.
  const fromRace: PaceAnchor = {
    kind: 'MEASURED',
    source: 'HYROX_HISTORY', derivation: 'RACE_SPLITS', provisional: false,
    band: band(290, 300),
  };
  check('and stays out of everything a race cannot speak for',
    paceTargetFor('THRESHOLD', fromRace) === null &&
    paceTargetFor('VO2', fromRace) === null);
});

describe('a band, because a number would be false precision', () => {
  const target: PaceTarget = { source: '5K_ENTRY', band: band(280, 290) };

  check('it reads as a range', formatPaceBand(target) === '4:40-4:50 /km',
    formatPaceBand(target));
  check('and a pace reads as m:ss', formatPace(286) === '4:46', formatPace(286));

  // Named for direction. Pace runs backwards, so the field that sounds like
  // the slow end is the fast one, and that is the trap the pace factors were
  // renamed to avoid.
  check('the fastest boundary is the smaller number',
    target.band.fastestSecPerKm < target.band.slowestSecPerKm);

  check('inside the band is inside', withinBand(285, target.band));
  check('and both edges count', withinBand(280, target.band) && withinBand(290, target.band));
  check('too fast is outside', !withinBand(275, target.band));
  check('too slow is outside', !withinBand(295, target.band));
});

describe('drift says which way, and says nothing when there is nothing to say', () => {
  const b = band(280, 290);

  // Zero inside the band is not "no error" - it is nothing to report, which
  // is the reason for prescribing a band rather than a number. An athlete a
  // second off a point target should not be told they missed.
  check('anywhere in the band drifts by nothing', driftFromBand(285, b) === 0);
  check('including the edges', driftFromBand(280, b) === 0 && driftFromBand(290, b) === 0);

  check('slower than prescribed is positive', driftFromBand(296, b) === 6);
  check('faster than prescribed is negative', driftFromBand(274, b) === -6);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
