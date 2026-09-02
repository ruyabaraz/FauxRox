// ============================================================================
// paceCoaching.test.ts — say it once, and then let them run
// ============================================================================
// Pace measured over a rolling window wobbles by a few seconds a kilometre
// the whole time. A coach that remarks on every wobble is one the athlete
// stops hearing by the second repetition, so almost everything here is about
// when to say nothing.
// ============================================================================

import {
  PaceCoach,
  paceCueContext,
  paceCueLine,
  PACE_DRIFT_WORTH_SAYING,
  PACE_CUE_COOLDOWN_SECONDS,
} from '../Assets/Scripts/PaceCoaching';

import { PaceBand } from '../Assets/Scripts/PaceTarget';

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

/** 4:50 to 5:00 per kilometre */
const BAND: PaceBand = { fastestSecPerKm: 290, slowestSecPerKm: 300 };

const SLOW = 300 + PACE_DRIFT_WORTH_SAYING + 2;
const FAST = 290 - PACE_DRIFT_WORTH_SAYING - 2;

describe('nothing to say, and it says nothing', () => {
  const coach = new PaceCoach();

  check('inside the band is not news', coach.update(295, BAND, 0) === 'NOTHING');
  check('and neither is the edge of it', coach.update(300, BAND, 1) === 'NOTHING');

  // A pace nobody was given cannot be missed.
  check('no band, no opinion', coach.update(400, null, 2) === 'NOTHING');
  check('and nothing measured yet is not a slow pace',
    coach.update(null, BAND, 3) === 'NOTHING');

  // The band is already a range. This is drift beyond a range drawn wide on
  // purpose - noise, not a decision.
  check('and a wobble just outside it is still nothing',
    coach.update(300 + PACE_DRIFT_WORTH_SAYING - 1, BAND, 4) === 'NOTHING');
});

describe('drifting, and being told once', () => {
  const coach = new PaceCoach();

  check('running slow gets picked up',
    coach.update(SLOW, BAND, 0) === 'PICK_IT_UP');

  // They heard it. What they need now is time to act on it, not the sentence
  // again - and the window it is measured over has not caught up yet either.
  check('and not told again immediately',
    coach.update(SLOW, BAND, 1) === 'NOTHING');
  check('nor a moment later',
    coach.update(SLOW, BAND, PACE_CUE_COOLDOWN_SECONDS - 1) === 'NOTHING');
  check('but again once it has had time to work',
    coach.update(SLOW, BAND, PACE_CUE_COOLDOWN_SECONDS + 1) === 'PICK_IT_UP');
});

describe('the other way is new information', () => {
  const coach = new PaceCoach();

  check('too fast is its own call', coach.update(FAST, BAND, 0) === 'EASE_OFF');

  // Somebody told to ease off who is now well under is doing something the
  // first call did not cover, and waiting out the cooldown to say so would be
  // watching them make it worse.
  check('and going the other way is said at once, cooldown or not',
    coach.update(SLOW, BAND, 2) === 'PICK_IT_UP');
});

describe('coming back is worth one word', () => {
  const coach = new PaceCoach();

  coach.update(SLOW, BAND, 0);
  check('a correction is standing', coach.correcting);

  check('coming back into the band is acknowledged',
    coach.update(295, BAND, 5) === 'ON_PACE');
  check('and the correction is over', !coach.correcting);

  // Once. Said every time they are on pace it is chatter.
  check('and not said again', coach.update(295, BAND, 6) === 'NOTHING');
  check('nor on the next lap', coach.update(296, BAND, 60) === 'NOTHING');

  // Nobody was corrected, so there is nothing to come back from.
  const quiet = new PaceCoach();
  check('somebody who never drifted is not congratulated',
    quiet.update(295, BAND, 0) === 'NOTHING');
});

describe('a new repetition starts again', () => {
  const coach = new PaceCoach();

  coach.update(SLOW, BAND, 0);
  coach.reset();

  check('the cooldown does not carry across',
    coach.update(SLOW, BAND, 1) === 'PICK_IT_UP');
  check('and neither does a standing correction', (() => {
    const fresh = new PaceCoach();
    fresh.update(SLOW, BAND, 0);
    fresh.reset();
    return fresh.update(295, BAND, 1) === 'NOTHING';
  })());
});

describe('what the coach is told to say', () => {
  const slow = paceCueContext('PICK_IT_UP', SLOW, BAND);
  check('the drift is a measurement', slow.indexOf('10 seconds per kilometre') > 0,
    slow);
  check('and it is stated as slower than prescribed',
    slow.indexOf('slower') > 0);

  // A measurement rather than a judgement: they are running ten seconds a
  // kilometre slow, not badly.
  check('and nobody is told they are bad at this',
    slow.indexOf('bad') < 0 && slow.indexOf('poor') < 0);

  const fast = paceCueContext('EASE_OFF', FAST, BAND);
  check('too fast says what it costs', fast.indexOf('rest of the session') > 0);

  check('and the instruction is short', slow.indexOf('four words or fewer') > 0 &&
    fast.indexOf('four words or fewer') > 0);

  check('coming back is briefer still',
    paceCueContext('ON_PACE', 295, BAND).indexOf('two or three words') > 0);

  check('and nothing is nothing',
    paceCueContext('NOTHING', 295, BAND) === '' &&
    paceCueContext('PICK_IT_UP', SLOW, null) === '');
});

describe('and the same thing for a silent pair of glasses', () => {
  check('slow', paceCueLine('PICK_IT_UP') === 'PICK IT UP');
  check('fast', paceCueLine('EASE_OFF') === 'EASE OFF');
  check('back', paceCueLine('ON_PACE') === 'ON PACE');
  check('and nothing', paceCueLine('NOTHING') === '');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
