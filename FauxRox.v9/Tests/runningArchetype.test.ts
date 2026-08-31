// ============================================================================
// runningArchetype.test.ts — the pace model, and the direction it points
// ============================================================================

import {
  RunningArchetype,
  ALL_RUNNING_ARCHETYPES,
  MODEL_THRESHOLD_PACE_SEC_PER_KM,
  MODEL_PACE_FACTOR,
  modelPaceSecPerKm,
  modelSpeedMs,
  modelRunSeconds,
  ARCHETYPE_FIT_HEADROOM,
  fitAllowanceSeconds,
  minimumRounds,
  minimumDoseSeconds,
  cycleSeconds,
  tierHoldsArchetype,
  affordableMetresFor,
} from '../Assets/Scripts/RunningArchetype';

import { RUN_SPEED_MS } from '../Assets/Scripts/SessionTypes';

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

describe('the factors multiply pace, and pace runs backwards', () => {
  // The whole reason the constant is called MODEL_PACE_FACTOR. A bare 0.93
  // next to a speed reads as slower to whoever meets it next, and would be,
  // and nothing would throw - the session would just be built wrong.
  check('a factor above one is slower',
    modelSpeedMs('EASY_BASE') < modelSpeedMs('THRESHOLD'),
    modelSpeedMs('EASY_BASE') + ' vs ' + modelSpeedMs('THRESHOLD'));

  check('a factor below one is faster',
    modelSpeedMs('VO2') > modelSpeedMs('THRESHOLD'));

  check('threshold is the anchor and sits at exactly one',
    modelPaceSecPerKm('THRESHOLD') === MODEL_THRESHOLD_PACE_SEC_PER_KM);

  // Intensity is the ordering the archetypes are written in, so the model has
  // to agree with it or the two would drift apart the first time one changed.
  const paces = ALL_RUNNING_ARCHETYPES.map(modelPaceSecPerKm);
  let descends = true;
  for (let i = 1; i < paces.length; i++) {
    if (paces[i] > paces[i - 1]) descends = false;
  }
  check('and the list is ordered slowest to fastest', descends, paces.join(' → '));
});

describe('nothing regresses for easy running', () => {
  // The anchor was chosen for this. Every duration estimate the app has ever
  // made for a run used one speed for every metre; that speed was an easy
  // one, and easy running has to land back on it or the fit moves under
  // every session at once.
  const easy = modelSpeedMs('EASY_BASE');

  check('easy pace is still the speed the duration model always used',
    Math.abs(easy - RUN_SPEED_MS) / RUN_SPEED_MS < 0.01,
    easy + ' vs ' + RUN_SPEED_MS);

  check('and it reads as 6:40 /km',
    Math.round(modelPaceSecPerKm('EASY_BASE')) === 400,
    modelPaceSecPerKm('EASY_BASE'));
});

describe('the paces are ones a coach would recognise', () => {
  // Not a physiological assertion - a sanity range. If a factor is ever
  // edited into something that puts a recreational athlete at world-record
  // pace or at walking pace, the session built from it would still fit its
  // duration band and nothing else would notice.
  for (const archetype of ALL_RUNNING_ARCHETYPES) {
    const pace = modelPaceSecPerKm(archetype);
    check(archetype + ' sits between 4:00 and 7:00 /km',
      pace >= 240 && pace <= 420, Math.round(pace) + ' s/km');
  }

  // Race pace is between easy and threshold, which is what makes it race
  // pace: hard enough to be the day's target, sustainable enough for eight
  // kilometres with eight stations in between.
  check('race pace sits between easy and threshold',
    modelPaceSecPerKm('HYROX_PACE') < modelPaceSecPerKm('EASY_BASE') &&
    modelPaceSecPerKm('HYROX_PACE') > modelPaceSecPerKm('THRESHOLD'));
});

describe('what the model says a distance costs', () => {
  // A four hundred at threshold and a four hundred easy are the same
  // geometry, and the session they belong to is not the same length. This is
  // the whole reason a single RUN_SPEED_MS could not survive the archetypes.
  const easy = modelRunSeconds('EASY_BASE', 400);
  const fast = modelRunSeconds('SPEED_REPETITION', 400);

  check('four hundred easy takes 2:40', Math.round(easy) === 160, easy);
  check('and the same four hundred as a repetition takes 1:47',
    Math.round(fast) === 107, fast);
  check('so the model no longer books them as the same session',
    easy - fast > 45, easy - fast);

  check('no distance costs nothing', modelRunSeconds('VO2', 0) === 0);
});

describe('the fitter margin is a dial with a name', () => {
  // A tier is legal for an archetype when the archetype's minimum dose fits
  // the target plus this. SHORT's working budget is ten and a half minutes.
  const SHORT_TARGET = 630;
  const allowance = fitAllowanceSeconds(SHORT_TARGET);

  check('fifteen per cent of headroom', Math.round(allowance) === 725, allowance);

  check('the margin is a fraction, not a duration',
    ARCHETYPE_FIT_HEADROOM > 0 && ARCHETYPE_FIT_HEADROOM < 1);

  // The contract's conclusion: a short session holds easy running and
  // nothing else. Derived here rather than restated, so the table and the
  // builder cannot come to different answers about the same session.
  check('a short session holds easy running',
    tierHoldsArchetype('EASY_BASE', 'SHORT', SHORT_TARGET));

  for (const archetype of ['THRESHOLD', 'VO2', 'SPEED_REPETITION', 'HYROX_PACE'] as const) {
    check('and not ' + archetype,
      !tierHoldsArchetype(archetype, 'SHORT', SHORT_TARGET),
      affordableMetresFor(archetype, 'SHORT', SHORT_TARGET).join(', '));
  }
});

describe('a minimum dose is counted in the unit that decides it', () => {
  // Three currencies, and they are not interchangeable. Six two-hundreds and
  // three four-hundreds are not the same speed session however similar the
  // arithmetic looks - the exposures are the dose.
  check('speed work is counted in repetitions, whatever the distance',
    minimumRounds('SPEED_REPETITION', 150) === 6 &&
    minimumRounds('SPEED_REPETITION', 300) === 6);

  // Stated as seconds this produced four repetitions where the contract says
  // six: the seconds that mean six reps at 100 m mean three at 200 m.
  check('and stating it in seconds would not have',
    Math.ceil(804 / cycleSeconds('SPEED_REPETITION', 150)) !==
    Math.ceil(804 / cycleSeconds('SPEED_REPETITION', 300)));

  check('threshold is counted in metres at pace',
    minimumRounds('THRESHOLD', 800) === 3 && minimumRounds('THRESHOLD', 1200) === 2);

  check('and maximal aerobic work in time at intensity',
    minimumRounds('VO2', 600) === 3 && minimumRounds('VO2', 1000) === 2);

  check('a race-pace session is three kilometre repeats',
    minimumRounds('HYROX_PACE', 1000) === 3);

  // The dose in seconds is derived from the dose in its own unit, so the
  // legality question and the building question stay the same question.
  check('and the seconds follow from the unit',
    minimumDoseSeconds('THRESHOLD', 800) ===
    minimumRounds('THRESHOLD', 800) * cycleSeconds('THRESHOLD', 800));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
