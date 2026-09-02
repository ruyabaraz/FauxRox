// ============================================================================
// paceEvidence.test.ts — store what happened, derive what it means
// ============================================================================
// The point of this module is a promise: nothing derived from the model is
// ever written to disk. These tests are what keeps that promise honest, so
// most of them are about what the store does NOT contain.
// ============================================================================

import {
  FiveKEvidence,
  PaceEvidenceStore,
  emptyPaceEvidence,
  parseFiveKTime,
  isBelievableFiveK,
  formatFiveKTime,
  recordFiveK,
  recordDeclined,
  shouldOfferPaceEvidence,
  anchorFrom,
  parsePaceEvidence,
  FASTEST_BELIEVABLE_5K_SECONDS,
  SLOWEST_BELIEVABLE_5K_SECONDS,
  stepFiveK,
  FIVE_K_START_SECONDS,
  FIVE_K_COARSE_STEP_SECONDS,
  FIVE_K_FINE_STEP_SECONDS,
  parseFiveKDigits,
  parseFiveKEntry,
  formatFiveKDigits,
} from '../Assets/Scripts/PaceEvidence';

import { paceTargetFor, formatPace } from '../Assets/Scripts/PaceTarget';

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

describe('a 5K time is minutes and seconds, and nothing else', () => {
  check('22:30 is twenty-two and a half minutes', parseFiveKTime('22:30') === 1350);
  check('a leading and trailing space is still a time',
    parseFiveKTime('  25:00  ') === 1500);
  check('and an hour-long 5K is somebody real',
    parseFiveKTime('60:00') === SLOWEST_BELIEVABLE_5K_SECONDS);

  // "26" is the answer most people would give out loud, and it is the one
  // reading it cannot be sure about. Twenty-six minutes and twenty-six
  // seconds are both numbers a field could hold.
  check('a bare number is refused rather than guessed', parseFiveKTime('26') === null);
  check('so is a decimal', parseFiveKTime('26.5') === null);
  check('and a colon with nothing before it', parseFiveKTime(':30') === null);
  check('and one with a single second digit', parseFiveKTime('26:3') === null);
  check('and one with three', parseFiveKTime('26:300') === null);
  check('and sixty seconds, which is a minute', parseFiveKTime('25:60') === null);
  check('and words', parseFiveKTime('twenty six') === null);
  check('and nothing at all', parseFiveKTime('') === null);
});

describe('a time nobody ran is not evidence', () => {
  check('inside the world record is a typo, not a runner',
    parseFiveKTime('11:00') === null);
  check('the fast bound itself is allowed',
    parseFiveKTime(formatFiveKTime(FASTEST_BELIEVABLE_5K_SECONDS)) ===
      FASTEST_BELIEVABLE_5K_SECONDS);
  check('and past the slow bound is somebody who mistyped the minutes',
    parseFiveKTime('75:00') === null);

  check('the bound check agrees with the parser',
    isBelievableFiveK(1500) && !isBelievableFiveK(600) && !isBelievableFiveK(5000));
  check('and refuses things that are not numbers',
    !isBelievableFiveK(NaN) && !isBelievableFiveK(Infinity));
});

describe('what is written down is what they told us', () => {
  const store = recordFiveK(emptyPaceEvidence(), 1500, 1000);

  check('the time is there', store.fiveK !== undefined && store.fiveK.seconds === 1500);
  check('and when they said it', store.fiveK !== undefined &&
    store.fiveK.enteredAtEpochMs === 1000);

  // The whole reason this module exists. A2 moved the threshold estimate by
  // nine seconds a kilometre between two drafts; anybody whose stored profile
  // had held a number would have carried the first draft forever.
  const written = JSON.stringify(store);
  check('and no pace appears anywhere in what gets stored',
    written.indexOf('SecPerKm') < 0 && written.indexOf('band') < 0 &&
    written.indexOf('vdot') < 0, written);

  check('an unbelievable time is not recorded at all',
    recordFiveK(emptyPaceEvidence(), 600, 1000).fiveK === undefined);
});

describe('the question gets asked once', () => {
  check('a new athlete has not been asked',
    shouldOfferPaceEvidence(emptyPaceEvidence()));

  check('somebody who answered is not asked again',
    !shouldOfferPaceEvidence(recordFiveK(emptyPaceEvidence(), 1500, 1)));

  // Saying no is an answer. Most athletes do not have a recent 5K, and being
  // asked for one before every running session would be the app nagging.
  check('and neither is somebody who said no',
    !shouldOfferPaceEvidence(recordDeclined(emptyPaceEvidence(), 1)));

  // But saying no once is not saying no forever - it just means we stop
  // asking. Entering a time later still works.
  const declinedThenEntered = recordFiveK(recordDeclined(emptyPaceEvidence(), 1), 1500, 2);
  check('somebody who declined can still enter one later',
    declinedThenEntered.fiveK !== undefined &&
    declinedThenEntered.fiveK.seconds === 1500);
  check('and the refusal is still on the record',
    declinedThenEntered.declinedAtEpochMs === 1);
});

describe('the anchor is derived, not remembered', () => {
  const store = recordFiveK(emptyPaceEvidence(), 1500, 1);
  const anchor = anchorFrom(store);

  check('a stored 5K produces an anchor', anchor !== null);
  check('and it says where it came from',
    anchor !== null && anchor.source === '5K_ENTRY');
  check('and it is an index the bands are derived from, not a band',
    anchor !== null && anchor.kind === 'INDEX');
  check('and its 5K pace is the time they entered, per kilometre',
    anchor !== null && anchor.kind === 'INDEX' &&
    Math.abs(anchor.fiveKPaceSecPerKm - 300) < 0.5,
    anchor !== null && anchor.kind === 'INDEX' ? anchor.fiveKPaceSecPerKm : 'none');

  check('no evidence, no anchor', anchorFrom(emptyPaceEvidence()) === null);
  check('and a refusal is not an anchor',
    anchorFrom(recordDeclined(emptyPaceEvidence(), 1)) === null);

  // Two reads of the same store must not drift apart, and must not be the
  // same object either - a caller holding one should not be able to edit
  // what the next caller sees.
  const first = anchorFrom(store);
  const second = anchorFrom(store);
  check('two reads agree', first !== null && second !== null &&
    first.kind === 'INDEX' && second.kind === 'INDEX' &&
    first.vdot === second.vdot);
  check('and are not the same object', first !== second);

  const threshold = paceTargetFor('THRESHOLD', anchor || undefined);
  check('and the derivation reaches a real band', threshold !== null,
    threshold ? formatPace(threshold.band.fastestSecPerKm) : 'none');
});

describe('a stored blob is read back with the same suspicion', () => {
  const round = parsePaceEvidence(JSON.stringify(recordFiveK(emptyPaceEvidence(), 1500, 7)));
  check('a real store survives the trip',
    round.fiveK !== undefined && round.fiveK.seconds === 1500 &&
    round.fiveK.enteredAtEpochMs === 7);

  check('nothing stored is nothing read', parsePaceEvidence('').fiveK === undefined);
  check('and rubbish does not throw',
    parsePaceEvidence('{not json').fiveK === undefined);

  // A time that was believable under an older bound, or written by hand, is
  // checked again on the way in rather than trusted because it is ours.
  check('an impossible stored time is dropped',
    parsePaceEvidence('{"fiveK":{"seconds":420,"enteredAtEpochMs":1}}').fiveK === undefined);
  check('and dropping it puts the question back',
    shouldOfferPaceEvidence(
      parsePaceEvidence('{"fiveK":{"seconds":420,"enteredAtEpochMs":1}}')));

  check('a stored refusal is honoured',
    !shouldOfferPaceEvidence(parsePaceEvidence('{"declinedAtEpochMs":99}')));
  check('but a refusal with no time behind it is not invented',
    parsePaceEvidence('{"declinedAtEpochMs":0}').declinedAtEpochMs === undefined);
});

describe('showing a time back reads the way it was typed', () => {
  check('1500 seconds is 25:00', formatFiveKTime(1500) === '25:00');
  check('and seconds under ten keep their zero', formatFiveKTime(1505) === '25:05');
  check('and what is shown parses back to what it was',
    parseFiveKTime(formatFiveKTime(1387)) === 1387);
});

describe('a time you can enter without a keyboard', () => {
  // The system keyboard does not exist in the editor preview and is a heavy
  // thing to raise on a pair of glasses for four digits.
  check('it opens somewhere most people are a few taps from',
    isBelievableFiveK(FIVE_K_START_SECONDS));

  check('a minute up is a minute up',
    stepFiveK(FIVE_K_START_SECONDS, FIVE_K_COARSE_STEP_SECONDS) === 1560);
  check('and fifteen seconds down is fifteen seconds down',
    stepFiveK(FIVE_K_START_SECONDS, -FIVE_K_FINE_STEP_SECONDS) === 1485);

  // Coarse and fine taps mixed together must not leave a time on a number no
  // button could reach.
  let time = FIVE_K_START_SECONDS;
  for (const delta of [-FIVE_K_COARSE_STEP_SECONDS, -FIVE_K_FINE_STEP_SECONDS,
                       FIVE_K_COARSE_STEP_SECONDS, -FIVE_K_FINE_STEP_SECONDS]) {
    time = stepFiveK(time, delta);
  }
  check('every reachable time is on the grid', time % FIVE_K_FINE_STEP_SECONDS === 0, time);
  check('and this one is where the taps left it', time === 1470, time);

  // Somebody holding the fast end wants the fast end. A stepper that stops
  // moving says so; one that silently declines the tap does not.
  check('it stops at the fast end',
    stepFiveK(FASTEST_BELIEVABLE_5K_SECONDS, -FIVE_K_COARSE_STEP_SECONDS) ===
      FASTEST_BELIEVABLE_5K_SECONDS);
  check('and at the slow end',
    stepFiveK(SLOWEST_BELIEVABLE_5K_SECONDS, FIVE_K_COARSE_STEP_SECONDS) ===
      SLOWEST_BELIEVABLE_5K_SECONDS);

  check('and a stored time that is nonsense starts again from the middle',
    stepFiveK(0, 0) === FIVE_K_START_SECONDS &&
    stepFiveK(NaN, FIVE_K_FINE_STEP_SECONDS) ===
      FIVE_K_START_SECONDS + FIVE_K_FINE_STEP_SECONDS);

  // Whatever the stepper is showing has to be a time the store will take.
  let walked = FIVE_K_START_SECONDS;
  let refused = 0;
  for (let i = 0; i < 260; i++) {
    walked = stepFiveK(walked, i % 3 === 0 ? -FIVE_K_COARSE_STEP_SECONDS
                                           : FIVE_K_FINE_STEP_SECONDS);
    if (!isBelievableFiveK(walked)) refused++;
    if (parseFiveKTime(formatFiveKTime(walked)) !== walked) refused++;
  }
  check('every step of it is enterable and readable back', refused === 0, refused);
});

describe('a keypad with no colon on it', () => {
  // The AR keyboard worth raising on a pair of glasses is the numeric one -
  // six keys and a done rather than a full keyboard hanging in the air - and
  // it has no colon. Four digits are read the way a stopwatch shows them.
  check('2430 is twenty-four thirty', parseFiveKDigits('2430') === 1470);
  check('and three digits are read the same way, the leading zero left off',
    parseFiveKDigits('1345') === 825);
  check('though nine thirty is nobody\'s 5K', parseFiveKDigits('930') === null);

  // Two digits are the answer everybody gives out loud and the one nobody
  // can be sure about.
  check('two digits are still refused', parseFiveKDigits('26') === null);
  check('and five are not a time', parseFiveKDigits('24300') === null);
  check('and sixty seconds are not a minute', parseFiveKDigits('2460') === null);
  check('and a time nobody ran is still not one', parseFiveKDigits('1100') === null);

  // One reader for both keyboards, so the answer does not depend on which one
  // the glasses happened to raise.
  check('the colon form still reads', parseFiveKEntry('24:30') === 1470);
  check('and the keypad form reads the same', parseFiveKEntry('2430') === 1470);
  check('and they agree', parseFiveKEntry('24:30') === parseFiveKEntry('2430'));
  check('and nonsense is nonsense either way',
    parseFiveKEntry('later') === null && parseFiveKEntry('') === null);

  // What is handed to the keypad has to come back as what was handed to it.
  check('a time goes to the keypad and back unchanged',
    parseFiveKDigits(formatFiveKDigits(1470)) === 1470);

  let broken = 0;
  for (let seconds = FASTEST_BELIEVABLE_5K_SECONDS;
       seconds <= SLOWEST_BELIEVABLE_5K_SECONDS;
       seconds += FIVE_K_FINE_STEP_SECONDS) {
    if (parseFiveKEntry(formatFiveKDigits(seconds)) !== seconds) broken++;
    if (parseFiveKEntry(formatFiveKTime(seconds)) !== seconds) broken++;
  }
  check('and so does every time the stepper can show', broken === 0, broken);
});

describe('a time on a profile that nobody entered', () => {
  // Reported from the glasses: a stored 5K of 1488 seconds on a profile whose
  // owner had never been shown the question. There is exactly one function
  // that writes one, so a time that exists came through here - and these are
  // the ways it could have been given something it should have refused.
  check('an empty answer writes nothing',
    recordFiveK(emptyPaceEvidence(), 0, 1).fiveK === undefined);
  check('and neither does a stray number',
    recordFiveK(emptyPaceEvidence(), NaN, 1).fiveK === undefined);

  // The store keeps when it was written, which is how a time nobody
  // remembers entering can be placed.
  const written = recordFiveK(emptyPaceEvidence(), 1488, 1700000000000);
  check('and a real one is stamped with when',
    written.fiveK !== undefined &&
    written.fiveK.enteredAtEpochMs === 1700000000000);

  // Being able to take it back matters as much as being asked: a wrong time
  // was permanent, because the question is only asked when there is nothing
  // on file.
  check('an answered profile is not asked again',
    !shouldOfferPaceEvidence(written));
  check('and forgetting it brings the question back',
    shouldOfferPaceEvidence(emptyPaceEvidence()));

  // Four digits from a keypad are a time; a leftover field value is not
  // supposed to reach this at all, but if it does it has to look like one.
  check('and 2448 is what 1488 seconds looks like typed',
    parseFiveKEntry('2448') === 1488);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
