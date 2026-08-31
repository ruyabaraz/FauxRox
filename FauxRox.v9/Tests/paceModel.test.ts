// ============================================================================
// paceModel.test.ts — training paces from something the athlete actually ran
// ============================================================================

import {
  vdotFromRace,
  paceAtFraction,
  equivalentRacePace,
  bandFor,
  profileFromFiveK,
  THRESHOLD_OFFSET_FAST_SEC_PER_KM,
  THRESHOLD_OFFSET_SLOW_SEC_PER_KM,
  SPEED_OFFSET_SEC_PER_KM,
  EASY_FRACTION_FAST,
  EASY_FRACTION_SLOW,
} from '../Assets/Scripts/PaceModel';

import {
  anchorFromFiveK,
  paceTargetFor,
  provenanceLine,
  formatPace,
  PaceAnchor,
} from '../Assets/Scripts/PaceTarget';

import { ALL_RUNNING_ARCHETYPES } from '../Assets/Scripts/RunningArchetype';

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

const FIVE_K = [20 * 60, 23 * 60, 26 * 60, 30 * 60];

describe('two routes to threshold, and they agree', () => {
  // The reason to trust either. Daniels' own heuristic - twenty-four to
  // thirty seconds per mile slower than 5K race pace - and the fitness index
  // at eighty-eight per cent are independent of one another, and they land
  // within a couple of seconds across the whole range this app serves.
  //
  // An earlier version of this had threshold at 5:36 for a 26:00 athlete,
  // arrived at by averaging a correct calculation with a half-remembered one.
  // Both of these say 5:27-5:31.
  for (const seconds of FIVE_K) {
    const vdot = vdotFromRace(5000, seconds);
    const fromIndex = paceAtFraction(vdot, 0.88);
    const fromHeuristic = seconds / 5 + THRESHOLD_OFFSET_FAST_SEC_PER_KM;

    check('a ' + (seconds / 60) + ':00 5K agrees within four seconds',
      Math.abs(fromIndex - fromHeuristic) <= 4,
      formatPace(fromIndex) + ' vs ' + formatPace(fromHeuristic));
  }
});

describe('the five intensities are five different paces', () => {
  const vdot = vdotFromRace(5000, 26 * 60);
  const fiveK = 26 * 60 / 5;

  const easy = bandFor('EASY_BASE', vdot, fiveK);
  const threshold = bandFor('THRESHOLD', vdot, fiveK);
  const vo2 = bandFor('VO2', vdot, fiveK);
  const speed = bandFor('SPEED_REPETITION', vdot, fiveK);

  check('easy is the slowest', easy.fastestSecPerKm > threshold.slowestSecPerKm,
    formatPace(easy.fastestSecPerKm) + ' vs ' + formatPace(threshold.slowestSecPerKm));
  check('then threshold', threshold.fastestSecPerKm > vo2.slowestSecPerKm);
  check('then maximal aerobic', vo2.fastestSecPerKm > speed.slowestSecPerKm);

  // The first version of speed work overlapped maximal aerobic work outright.
  // Two archetypes that prescribe the same pace are not two archetypes.
  check('and the gap between the two fastest is real',
    vo2.fastestSecPerKm - speed.fastestSecPerKm === SPEED_OFFSET_SEC_PER_KM,
    vo2.fastestSecPerKm - speed.fastestSecPerKm);

  check('every band is a band',
    [easy, threshold, vo2, speed].every((b) => b.slowestSecPerKm > b.fastestSecPerKm));

  // Easy is the least certain pace there is, so it gets the widest band -
  // and the effort cue stays the primary instruction on an easy day.
  const width = (b) => b.slowestSecPerKm - b.fastestSecPerKm;
  check('easy is the widest', width(easy) > width(threshold),
    width(easy).toFixed(0) + 's vs ' + width(threshold).toFixed(0) + 's');
  check('and it sits inside the intensity range Daniels gives',
    EASY_FRACTION_SLOW >= 0.59 && EASY_FRACTION_FAST <= 0.74);
});

describe('race pace is not predicted by road running', () => {
  const vdot = vdotFromRace(5000, 26 * 60);

  // Eight kilometres with eight stations between them is not predicted by a
  // 5K, and the honest answer until the athlete has raced is that we do not
  // know. Every other archetype has a derivation; this one waits.
  check('a 5K says nothing about race pace',
    bandFor('HYROX_PACE', vdot, 312) === null);

  const anchor = anchorFromFiveK(26 * 60);
  check('so no target is produced for it',
    paceTargetFor('HYROX_PACE', anchor) === null);

  for (const archetype of ALL_RUNNING_ARCHETYPES) {
    if (archetype === 'HYROX_PACE') continue;
    check('but ' + archetype + ' gets one',
      paceTargetFor(archetype, anchor) !== null);
  }
});

describe('a 5K is evidence, and says so', () => {
  const anchor = anchorFromFiveK(26 * 60);

  check('the source is a run the athlete did', anchor.source === '5K_ENTRY');
  check('the derivation is recorded', anchor.derivation === 'DANIELS_GILBERT');

  // One performance on one day, used to prescribe intensities it did not
  // measure. Calibration from their own sessions replaces it later.
  check('and it is marked provisional', anchor.provisional === true);

  const target = paceTargetFor('THRESHOLD', anchor);
  check('the target carries the provenance through',
    target.source === '5K_ENTRY' && target.provisional === true);

  // Said once, where the bands are made. An athlete mid-repetition wants the
  // band and their pace; where it came from is a question for setup.
  check('and there is a sentence for the athlete',
    provenanceLine(anchor) === 'Based on your recent 5K', provenanceLine(anchor));
  check('with nothing to say when there is no anchor',
    provenanceLine(null) === '');

  check('nonsense produces no anchor at all',
    anchorFromFiveK(0) === null && anchorFromFiveK(-1) === null);
});

describe('a faster athlete gets faster paces, everywhere', () => {
  // The whole point of anchoring on the athlete. Every intensity has to move
  // with them, and in the right direction - a fixed offset applied to one of
  // them would have broken this quietly.
  for (const archetype of ALL_RUNNING_ARCHETYPES) {
    if (archetype === 'HYROX_PACE') continue;

    let monotone = true;
    let previous = 0;

    for (const seconds of FIVE_K) {
      const band = profileFromFiveK(seconds).bandOf(archetype);
      if (band.fastestSecPerKm <= previous) monotone = false;
      previous = band.fastestSecPerKm;
    }

    check(archetype + ' slows as the 5K slows', monotone);
  }

  // And the whole profile moves by a sensible amount rather than collapsing.
  const quick = profileFromFiveK(20 * 60).bandOf('VO2');
  const steady = profileFromFiveK(30 * 60).bandOf('VO2');

  check('a ten minute spread in the 5K is a real spread in the paces',
    steady.fastestSecPerKm - quick.fastestSecPerKm > 60,
    formatPace(quick.fastestSecPerKm) + ' vs ' + formatPace(steady.fastestSecPerKm));
});

describe('the numbers, written down', () => {
  // Not an assertion about physiology - a record of what this produces, so a
  // change to any constant shows up as a change to a table somebody can read
  // rather than as a test that still passes.
  const rows: string[] = [];

  for (const seconds of FIVE_K) {
    const p = profileFromFiveK(seconds);
    const band = (a) => {
      const b = p.bandOf(a);
      return b ? formatPace(b.fastestSecPerKm) + '-' + formatPace(b.slowestSecPerKm) : 'none';
    };

    rows.push('  ' + formatPace(seconds / 5) + ' 5K pace  ' +
              'easy ' + band('EASY_BASE') + '  ' +
              'thr ' + band('THRESHOLD') + '  ' +
              'vo2 ' + band('VO2') + '  ' +
              'spd ' + band('SPEED_REPETITION') + '  ' +
              'race ' + band('HYROX_PACE'));
  }

  console.log(rows.join('\n'));

  const p = profileFromFiveK(26 * 60);
  check('a 26:00 5K threshold is 5:27-5:31',
    formatPace(p.bandOf('THRESHOLD').fastestSecPerKm) === '5:27' &&
    formatPace(p.bandOf('THRESHOLD').slowestSecPerKm) === '5:31');

  check('and its speed work is around 4:39-4:43',
    formatPace(p.bandOf('SPEED_REPETITION').fastestSecPerKm) === '4:39',
    formatPace(p.bandOf('SPEED_REPETITION').fastestSecPerKm));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
