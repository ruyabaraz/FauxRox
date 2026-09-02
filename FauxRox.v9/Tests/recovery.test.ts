// ============================================================================
// recovery.test.ts — rest is earned by the work it follows
// ============================================================================
// Rest was a flat sixty seconds whatever it followed. Measured over the whole
// parameter space, that produced:
//
//   STRENGTH SHORT    1.2-3.5 min work,   4.5-15.1 min rest   1:4.5
//
// A twenty-minute session with four minutes of work in it. And the shorter
// the athlete asked for the worse it got, because the duration tier scaled
// the work and left the rest alone.
// ============================================================================

import {
  RECOVERY_POLICY,
  LEVEL_RECOVERY,
  RecoveryProfile,
  recoverySeconds,
  ratioBindingRange,
  ALL_LEVELS,
  Level,
  makeRecoveryStation,
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

const PROFILES: RecoveryProfile[] = ['STRENGTH', 'ENGINE', 'MIXED'];
const BOUTS = [3, 10, 30, 60, 90, 150, 300];
const POSITIONS = [0, 0.25, 0.5, 0.75, 1];

// ── The rule ────────────────────────────────────────────────────────────────

describe('rest follows the work rather than the clock', () => {
  // The reported failure: a three-second interval earning sixty seconds of
  // walking, in a session that was then 93% rest.
  const tiny = recoverySeconds(3, 'ENGINE', 'REGULAR', 0.5);
  const real = recoverySeconds(150, 'ENGINE', 'REGULAR', 0.5);

  check('a three-second effort does not earn a minute off', tiny < 60, tiny);
  check('and a long one earns more than a short one', real > tiny, real + ' vs ' + tiny);

  // Monotonic in the bout, everywhere in between
  for (const profile of PROFILES) {
    let monotone = true;
    for (let i = 1; i < BOUTS.length; i++) {
      const a = recoverySeconds(BOUTS[i - 1], profile, 'REGULAR', 0.5);
      const b = recoverySeconds(BOUTS[i], profile, 'REGULAR', 0.5);
      if (b < a) monotone = false;
    }
    check(profile + ': more work never earns less rest', monotone);
  }
});

describe('shortening a session shortens the rest too', () => {
  // The structural fault: work scaled with the duration tier, rest did not,
  // so SHORT was always the highest rest fraction of the three.
  for (const profile of PROFILES) {
    const full = recoverySeconds(120, profile, 'REGULAR', 0.5);
    const short = recoverySeconds(48, profile, 'REGULAR', 0.5);  // 0.4 volume

    check(profile + ': a lighter round rests less, or at the floor',
      short <= full, short + ' vs ' + full);
  }
});

// ── The bands ───────────────────────────────────────────────────────────────

/** Bouts where the ratio, not one of the bounds, decides the rest */
function bindingBouts(profile: RecoveryProfile): number[] {
  const { minBout, maxBout } = ratioBindingRange(profile);
  const out: number[] = [];
  for (let i = 0; i <= 4; i++) out.push(minBout + (maxBout - minBout) * (i / 4));
  return out;
}

describe('inside its binding range, the ratio decides', () => {
  for (const profile of PROFILES) {
    const policy = RECOVERY_POLICY[profile];
    let inBand = true;
    let worst = '';

    for (const bout of bindingBouts(profile)) {
      for (const at of POSITIONS) {
        const ratio = recoverySeconds(bout, profile, 'REGULAR', at) / bout;
        if (ratio < policy.minRatio - 0.03 || ratio > policy.maxRatio + 0.03) {
          inBand = false;
          worst = bout.toFixed(0) + 's -> 1:' + ratio.toFixed(2);
        }
      }
    }
    check(profile + ': ratio stays within 1:' + policy.minRatio + '-1:' + policy.maxRatio,
      inBand, worst);

    check(profile + ': the binding range is a real range',
      ratioBindingRange(profile).maxBout > ratioBindingRange(profile).minBout);
  }
});

describe('outside it, the bounds take over on purpose', () => {
  for (const profile of PROFILES) {
    const policy = RECOVERY_POLICY[profile];
    const { minBout, maxBout } = ratioBindingRange(profile);

    // A 200m carry at the modelled loaded pace is four minutes of work. At
    // the band's ratio that would be minutes of standing about.
    const huge = recoverySeconds(maxBout * 4, profile, 'REGULAR', 1);
    check(profile + ': a very long bout is capped, not scaled',
      huge === policy.ceilingSeconds, huge);
    check(profile + ': and capping means resting less than the ratio, never more',
      huge / (maxBout * 4) < policy.maxRatio);

    // An interval tuned to a few metres indoors
    const tiny = recoverySeconds(minBout / 8, profile, 'REGULAR', 0);
    check(profile + ': a tiny bout still gets a usable break',
      tiny === policy.floorSeconds, tiny);
  }
});

describe('the bands say what the training is for', () => {
  // Compromised work rests least: arriving at a station already tired is the
  // demand being trained. Engine work is dense by definition. Strength stays
  // near parity - these are carries and lunges, not maximal lifting.
  const at = (p: RecoveryProfile) => recoverySeconds(120, p, 'REGULAR', 0.5);

  check('mixed rests least', at('MIXED') < at('ENGINE'), at('MIXED') + ' vs ' + at('ENGINE'));
  check('and strength rests most', at('STRENGTH') > at('ENGINE'));

  // Running is not here. It had one band for every kind of running, which was
  // right for one archetype of five and wrong by factors of four and six for
  // two others; each archetype declares its own now and there is nothing left
  // for a shared band to describe.

  // And strength does not drift into powerlifting territory
  check('strength stays near parity, not 2:1',
    RECOVERY_POLICY.STRENGTH.maxRatio <= 1.5, RECOVERY_POLICY.STRENGTH.maxRatio);
});

describe('the seed moves rest inside the band, never outside it', () => {
  for (const profile of PROFILES) {
    const bout = bindingBouts(profile)[2];   // mid binding range
    const low = recoverySeconds(bout, profile, 'REGULAR', 0);
    const high = recoverySeconds(bout, profile, 'REGULAR', 1);

    check(profile + ': the band has room in it', high > low, low + '-' + high);
    check(profile + ': the bottom is the minimum ratio',
      Math.abs(low - bout * RECOVERY_POLICY[profile].minRatio) < 1.5, low);
    check(profile + ': the top is the maximum ratio',
      Math.abs(high - bout * RECOVERY_POLICY[profile].maxRatio) < 1.5, high);

    // Out-of-range positions are clamped, not extrapolated
    check(profile + ': a position below the band clamps',
      recoverySeconds(bout, profile, 'REGULAR', -5) === low);
    check(profile + ': a position above it clamps',
      recoverySeconds(bout, profile, 'REGULAR', 9) === high);
  }
});

// ── Level ───────────────────────────────────────────────────────────────────

describe('a lower level never rests less', () => {
  // The invariant. Shifting only the bounds would satisfy nothing: most bouts
  // land mid-band, where a changed ceiling has no effect at all, and a
  // beginner would have received exactly the athlete's rest.
  const ORDER: Level[] = ['ATHLETE', 'REGULAR', 'BEGINNER'];

  for (const profile of PROFILES) {
    let ordered = true;
    let worst = '';

    for (const bout of BOUTS) {
      for (const at of POSITIONS) {
        const rests = ORDER.map((l) => recoverySeconds(bout, profile, l, at));
        for (let i = 1; i < rests.length; i++) {
          if (rests[i] < rests[i - 1]) {
            ordered = false;
            worst = bout + 's @' + at + ' -> ' + rests.join(' / ');
          }
        }
      }
    }
    check(profile + ': athlete <= regular <= beginner, always', ordered, worst);
  }
});

describe('the level multiplier bites mid-band, not only at the edges', () => {
  // A 90-second bout sits well inside every band, so nothing but a multiplier
  // could separate the levels here.
  for (const profile of PROFILES) {
    const beginner = recoverySeconds(90, profile, 'BEGINNER', 0.5);
    const athlete = recoverySeconds(90, profile, 'ATHLETE', 0.5);

    check(profile + ': a beginner rests longer on the same work',
      beginner > athlete, beginner + ' vs ' + athlete);
  }

  check('and the multipliers are ordered',
    LEVEL_RECOVERY.BEGINNER > LEVEL_RECOVERY.REGULAR &&
    LEVEL_RECOVERY.REGULAR > LEVEL_RECOVERY.ATHLETE);
});

// ── Safety bounds ───────────────────────────────────────────────────────────

describe('degenerate input is handled rather than propagated', () => {
  check('nothing is ever negative',
    recoverySeconds(-50, 'MIXED', 'REGULAR', 0.5) > 0);
  check('zero work still gets the floor',
    recoverySeconds(0, 'ENGINE', 'REGULAR', 0.5) >= RECOVERY_POLICY.ENGINE.floorSeconds * 0.87);
  check('an unknown profile falls back rather than crashing',
    recoverySeconds(60, 'NONSENSE' as RecoveryProfile, 'REGULAR', 0.5) > 0);
});

describe('the bounds respect the level too', () => {
  // Clamping first and scaling afterwards would let a beginner rest less than
  // an athlete at the ceiling, which is the one thing that must not happen.
  for (const profile of PROFILES) {
    const beginner = recoverySeconds(9999, profile, 'BEGINNER', 1);
    const athlete = recoverySeconds(9999, profile, 'ATHLETE', 1);
    check(profile + ': a beginner rests longer at the ceiling too',
      beginner > athlete, beginner + ' vs ' + athlete);

    const bLow = recoverySeconds(1, profile, 'BEGINNER', 0);
    const aLow = recoverySeconds(1, profile, 'ATHLETE', 0);
    check(profile + ': and at the floor', bLow > aLow, bLow + ' vs ' + aLow);
  }
});

// ── Determinism ─────────────────────────────────────────────────────────────

describe('the same inputs always give the same rest', () => {
  for (const profile of PROFILES) {
    for (const level of ALL_LEVELS) {
      check(profile + '/' + level + ' is stable',
        recoverySeconds(75, profile, level, 0.3) ===
        recoverySeconds(75, profile, level, 0.3));
    }
  }
});

describe('the recovery is named for who is doing it', () => {
  // The kind is WALK_OR_JOG because both are correct between repetitions run
  // at speed - what matters is coming back fully. Which of the two it is
  // depends on the athlete, and the panel has to say one of them: "walk or
  // jog" is a menu, and somebody mid-session reading a menu has stopped.
  const beginner = makeRecoveryStation(180, 'BEGINNER', 'WALK_OR_JOG');
  const regular = makeRecoveryStation(180, 'REGULAR', 'WALK_OR_JOG');
  const athlete = makeRecoveryStation(180, 'ATHLETE', 'WALK_OR_JOG');

  check('a beginner walks', beginner.name === 'WALK', beginner.name);
  check('and everybody else jogs',
    regular.name === 'JOG' && athlete.name === 'JOG',
    regular.name + '/' + athlete.name);

  check('and the instruction says the same thing the name does',
    beginner.instruction.indexOf('Walk') === 0 &&
    regular.instruction.indexOf('Jog') === 0,
    regular.instruction);

  // The archetype's contract is unchanged whoever is doing it - what was
  // prescribed is full recovery, and that is what the analysis reads.
  check('and all of them are still the same kind of recovery',
    beginner.recoveryKind === 'WALK_OR_JOG' &&
    regular.recoveryKind === 'WALK_OR_JOG' &&
    athlete.recoveryKind === 'WALK_OR_JOG');
  check('for the same length of time',
    beginner.requirement === regular.requirement);

  // The other two kinds say what they are whoever is running: a float is a
  // float because it is short, not because of who is doing it.
  check('a float is a float for everybody',
    makeRecoveryStation(45, 'BEGINNER', 'FLOAT_JOG').name === 'FLOAT' &&
    makeRecoveryStation(45, 'ATHLETE', 'FLOAT_JOG').name === 'FLOAT');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
