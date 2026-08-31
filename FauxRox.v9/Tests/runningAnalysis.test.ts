// ============================================================================
// runningAnalysis.test.ts — what the running did, afterwards
// ============================================================================

import {
  RunSample,
  analyseRunning,
  comparableSet,
  comparabilityKey,
  runningAiContext,
  MIN_REPS_FOR_FADE,
  MIN_REPS_FOR_SPREAD,
  FADE_WORTH_MENTIONING,
} from '../Assets/Scripts/RunningAnalysis';

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

const band = { fastestSecPerKm: 280, slowestSecPerKm: 290 };

const rep = (
  paceSecPerKm: number,
  over: Partial<RunSample> = {}
): RunSample => ({
  archetype: 'THRESHOLD',
  prescribed: 1000,
  prescribedKind: 'DISTANCE',
  paceSecPerKm,
  ...over,
});

describe('only repetitions that were attempts at the same thing', () => {
  // Four hundred at threshold and six hundred at maximal aerobic effort are
  // not two attempts at one thing, and a fade computed across them would be
  // measuring the prescription rather than the athlete.
  const mixed: RunSample[] = [
    rep(285), rep(288), rep(291),
    rep(250, { archetype: 'VO2', prescribed: 600 }),
    rep(252, { archetype: 'VO2', prescribed: 600 }),
  ];

  const set = comparableSet(mixed);
  check('the largest comparable set is taken', set.length === 3, set.length);
  check('and it is all one archetype',
    set.every((s) => s.archetype === 'THRESHOLD'));

  check('the same distance at a different archetype is not comparable',
    comparabilityKey(rep(285)) !== comparabilityKey(rep(285, { archetype: 'VO2' })));

  check('nor the same archetype at a different distance',
    comparabilityKey(rep(285)) !== comparabilityKey(rep(285, { prescribed: 800 })));

  // A run written to the clock and a run written to the ground are not the
  // same prescription even at the same number.
  check('nor the same number in a different unit',
    comparabilityKey(rep(285, { prescribedKind: 'TIME' })) !==
    comparabilityKey(rep(285, { prescribedKind: 'DISTANCE' })));

  check('nor the same session at a different target',
    comparabilityKey(rep(285, { target: band })) !== comparabilityKey(rep(285)));
});

describe('alignment keeps the direction', () => {
  // Too fast and too slow are opposite mistakes with opposite corrections,
  // and a coach that cannot tell them apart is worse than one that says
  // nothing. An absolute drift would have hidden this.
  const tooFast = analyseRunning([
    rep(270, { target: band }), rep(272, { target: band }),
    rep(268, { target: band }), rep(274, { target: band }),
  ]);

  check('four fast repetitions are counted as fast', tooFast.alignment.fast === 4);
  check('none in the band', tooFast.alignment.inBand === 0);
  check('and the drift is negative', tooFast.alignment.meanDriftSecPerKm < 0,
    tooFast.alignment.meanDriftSecPerKm);

  const tooSlow = analyseRunning([
    rep(300, { target: band }), rep(305, { target: band }),
    rep(298, { target: band }), rep(302, { target: band }),
  ]);

  check('four slow repetitions are counted as slow', tooSlow.alignment.slow === 4);
  check('and the drift is positive', tooSlow.alignment.meanDriftSecPerKm > 0);

  // Anywhere in the band is nothing to report, which is the point of a band.
  const onTarget = analyseRunning([
    rep(281, { target: band }), rep(289, { target: band }),
    rep(285, { target: band }), rep(280, { target: band }),
  ]);

  check('everything inside the band is inside it', onTarget.alignment.inBand === 4);
  check('and drifts by nothing at all', onTarget.alignment.meanDriftSecPerKm === 0);
});

describe('fade and consistency need no target at all', () => {
  // Which is the whole reason they are separate findings. An athlete with no
  // pace anchor - every athlete today - can still be told their last two
  // repetitions drifted, and that is a fact about their running rather than
  // about our estimate of it.
  const faded = analyseRunning([rep(280), rep(283), rep(295), rep(302)]);

  check('no target means no alignment', faded.alignment === null);
  check('but the fade is still measured', faded.fade !== null);
  check('and it says they slowed', faded.fade.driftSecPerKm > 0,
    faded.fade.driftSecPerKm);
  check('the spread too', faded.spreadSecPerKm === 22, faded.spreadSecPerKm);

  // A half of one repetition is not a half.
  const two = analyseRunning([rep(280), rep(300)]);
  check('two repetitions cannot fade', two.fade === null);
  check('nor can they have a spread', two.spreadSecPerKm === null);
  check('the thresholds are stated',
    MIN_REPS_FOR_FADE === 4 && MIN_REPS_FOR_SPREAD === 3);

  const negative = analyseRunning([rep(300), rep(298), rep(285), rep(282)]);
  check('finishing faster is a negative fade', negative.fade.driftSecPerKm < 0);
});

describe('the coach is given descriptions, never a score', () => {
  const lines = runningAiContext(analyseRunning([
    rep(285, { target: band }), rep(288, { target: band }),
    rep(296, { target: band }), rep(304, { target: band }),
  ]));

  const all = lines.join(' ');

  check('it says how many were in the band', all.indexOf('2 of 4') > 0, all);
  check('and which way the rest went', all.indexOf('ran slow') > 0, all);

  // A percentage is a grade, and a grade invites the athlete to chase it -
  // which in a session whose point is running at a chosen effort is exactly
  // the wrong thing to be doing.
  check('and never as a percentage', all.indexOf('%') < 0, all);
  check('nor as a score', all.toLowerCase().indexOf('score') < 0);

  // Silence where there is nothing to say. A coach who reports the absence of
  // a problem every session has taught the athlete to skim.
  const clean = runningAiContext(analyseRunning([
    rep(284, { target: band }), rep(285, { target: band }),
    rep(286, { target: band }), rep(285, { target: band }),
  ]));

  check('a session run to the band says so in one line', clean.length === 1, clean.join(' | '));
  check('with no fade to report', clean.join(' ').indexOf('FADE') < 0);

  check('and an empty session says nothing at all',
    runningAiContext(analyseRunning([])).length === 0);

  // Below the threshold there is nothing worth an athlete's attention, and
  // reporting it would be reporting the measurement.
  const tiny = runningAiContext(analyseRunning([
    rep(285), rep(286), rep(288), rep(289),
  ]));
  check('a fade of four seconds is not mentioned',
    tiny.join(' ').indexOf('FADE') < 0, tiny.join(' | '));
  check('the threshold is stated', FADE_WORTH_MENTIONING === 8);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
