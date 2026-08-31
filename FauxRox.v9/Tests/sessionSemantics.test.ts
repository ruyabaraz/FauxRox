// ============================================================================
// sessionSemantics.test.ts — a training session is never called a race
// ============================================================================
// The data layer always knew: it printed "Training session - skipping verdict"
// and, seconds later, the coach said "Race completed in 2:39" out loud. The
// kind was known and simply never reached the words.
//
// These lock the boundary. Every string a training athlete can see or hear is
// checked against the vocabulary that leaked, so the next person to add a
// panel cannot quietly reintroduce it.
// ============================================================================

import {
  SessionSemantics,
  semanticsFor,
  finishTitle,
  summaryPreamble,
  isSessionUnderway,
  isSessionPausable,
  isSessionPaused,
} from '../Assets/Scripts/SessionSemantics';

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

const RACE = semanticsFor('RACE');
const TRAINING = semanticsFor('TRAINING');

/**
 * The fields an athlete reads or hears.
 *
 * aiContext is deliberately excluded: it is addressed to the model, not the
 * athlete, and it has to name the forbidden word in order to forbid it.
 */
function spokenFields(s: SessionSemantics): { field: string, value: string }[] {
  return [
    { field: 'noun', value: s.noun },
    { field: 'nounTitle', value: s.nounTitle },
    { field: 'completionTitle', value: s.completionTitle },
    { field: 'stoppedTitle', value: s.stoppedTitle },
    { field: 'retryLabel', value: s.retryLabel },
    { field: 'summaryOpening', value: s.summaryOpening },
    { field: 'summaryKind', value: s.summaryKind },
  ];
}

// ── The leak itself ─────────────────────────────────────────────────────────

describe('nothing a training athlete sees says "race"', () => {
  for (const { field, value } of spokenFields(TRAINING)) {
    check(
      'training ' + field + ' is race-free',
      value.toLowerCase().indexOf('race') < 0,
      value
    );
  }

  // The exact string from the log that started this
  check(
    'the summary does not open with "Race completed in"',
    TRAINING.summaryOpening.indexOf('Race completed in') < 0,
    TRAINING.summaryOpening
  );

  check(
    'the coach is not asked for a post-race summary',
    summaryPreamble(TRAINING).toLowerCase().indexOf('race') < 0,
    summaryPreamble(TRAINING)
  );

  check(
    'the button does not offer another race',
    TRAINING.retryLabel.toLowerCase().indexOf('race') < 0,
    TRAINING.retryLabel
  );
});

describe('a race is still called a race', () => {
  check('noun', RACE.noun === 'race');
  check('the summary opens with the race wording',
    RACE.summaryOpening.indexOf('Race completed in') === 0, RACE.summaryOpening);
  check('the coach is asked for a post-race summary',
    summaryPreamble(RACE).indexOf('post-race') > 0, summaryPreamble(RACE));
  check('the button offers another race',
    RACE.retryLabel === 'RACE AGAIN');
});

// ── The model is told, per turn ─────────────────────────────────────────────

describe('the model cannot guess the kind, so it is handed it', () => {
  // The system instruction is sent once at connect time, before the athlete
  // has picked anything. aiContext is the only channel left.
  check('training context names the kind',
    TRAINING.aiContext.indexOf('SESSION KIND: TRAINING') === 0, TRAINING.aiContext);
  check('race context names the kind',
    RACE.aiContext.indexOf('SESSION KIND: RACE') === 0, RACE.aiContext);

  check('training context forbids the word outright',
    TRAINING.aiContext.indexOf('Never use the word "race"') > 0);

  // The athlete's own noun must not decide anything - they say "stop the
  // race" mid-workout and the app already knows better.
  check('training context anticipates the athlete saying "race"',
    TRAINING.aiContext.toLowerCase().indexOf('they mean this session') > 0,
    TRAINING.aiContext);

  check('training context denies a personal best',
    TRAINING.aiContext.indexOf('no personal best') > 0);
});

// ── Headlines ───────────────────────────────────────────────────────────────

describe('the finish headline reflects both kind and outcome', () => {
  check('race finished',   finishTitle(RACE, true) === 'FINISHED!');
  check('race stopped',    finishTitle(RACE, false) === 'STOPPED');
  check('training done',   finishTitle(TRAINING, true) === 'SESSION COMPLETE');
  check('training ended',  finishTitle(TRAINING, false) === 'ENDED EARLY');

  check('completing and stopping never read the same (race)',
    finishTitle(RACE, true) !== finishTitle(RACE, false));
  check('completing and stopping never read the same (training)',
    finishTitle(TRAINING, true) !== finishTitle(TRAINING, false));

  // Stopping a workout early is a normal thing to do; stopping a race is a
  // failure to finish. The words should not treat them alike.
  check('training does not borrow the race word for stopping',
    finishTitle(TRAINING, false) !== finishTitle(RACE, false));
});

// ── Ranking ─────────────────────────────────────────────────────────────────

describe('only a race counts for anything', () => {
  check('race counts', RACE.countsForRanking === true);
  check('training does not', TRAINING.countsForRanking === false);
});

// ── No accidental sharing ───────────────────────────────────────────────────

describe('the two kinds share no displayed wording', () => {
  const raceFields = spokenFields(RACE);
  const trainingFields = spokenFields(TRAINING);

  for (let i = 0; i < raceFields.length; i++) {
    check(
      raceFields[i].field + ' differs between the kinds',
      raceFields[i].value !== trainingFields[i].value,
      raceFields[i].value
    );
  }
});

// ── Unknown kinds ───────────────────────────────────────────────────────────

describe('an unrecognised kind falls back to the race', () => {
  // The conservative direction: a race mislabelled as training silently costs
  // the athlete their personal best, while training mislabelled as a race is
  // only wrong out loud.
  for (const bad of ['', 'race', 'training', 'RELAY', 'undefined', null as any]) {
    check('"' + String(bad) + '" is treated as a race',
      semanticsFor(bad).kind === 'RACE');
  }

  check('the exact enum value is what matches',
    semanticsFor('TRAINING').kind === 'TRAINING');
});

// ── Stability ───────────────────────────────────────────────────────────────

describe('resolving the kind is pure', () => {
  check('same kind, same words',
    semanticsFor('TRAINING').retryLabel === semanticsFor('TRAINING').retryLabel);
  check('the kinds do not bleed into each other',
    semanticsFor('RACE').retryLabel !== semanticsFor('TRAINING').retryLabel);
});

// ── "Can you stop the race?" ────────────────────────────────────────────────

describe('a running session can always be stopped', () => {
  // Every state the machine has. Walking up to a station is one of them, and
  // leaving it out is what made the coach refuse: the athlete was at
  // APPROACHING_STATION, asked to stop, and was told it could not be done.
  const LIVE = [
    'COUNTDOWN',
    'RUNNING',
    'APPROACHING_STATION',
    'APPROACHING_FINISH',
    'STATION',
    'PAUSED',
  ];

  for (const state of LIVE) {
    check('stoppable during ' + state, isSessionUnderway(state) === true);
  }

  check('nothing to stop when idle', isSessionUnderway('IDLE') === false);
  check('nothing to stop once finished', isSessionUnderway('FINISHED') === false);
  check('nothing to stop with no state at all', isSessionUnderway('') === false);

  // Written as "not idle, not over" rather than as a list, so a state added
  // tomorrow is live by default. Refusing to stop is worse than stopping from
  // somewhere unusual.
  check('an unknown state counts as running',
    isSessionUnderway('APPROACHING_SOMETHING_NEW') === true);
});

describe('pause and resume know which is which', () => {
  check('a station can be paused', isSessionPausable('STATION') === true);
  check('an approach can be paused', isSessionPausable('APPROACHING_STATION') === true);
  check('a countdown can be paused', isSessionPausable('COUNTDOWN') === true);

  check('what is paused cannot be paused again', isSessionPausable('PAUSED') === false);
  check('idle cannot be paused', isSessionPausable('IDLE') === false);
  check('finished cannot be paused', isSessionPausable('FINISHED') === false);

  check('only a paused session resumes', isSessionPaused('PAUSED') === true);
  check('a running one does not', isSessionPaused('RUNNING') === false);
  check('nor an idle one', isSessionPaused('IDLE') === false);

  // The two are exclusive: nothing is both pausable and already paused
  for (const state of ['IDLE', 'COUNTDOWN', 'RUNNING', 'APPROACHING_STATION',
                       'APPROACHING_FINISH', 'STATION', 'PAUSED', 'FINISHED']) {
    check(state + ' is not both pausable and paused',
      !(isSessionPausable(state) && isSessionPaused(state)));
  }
});

// ── Idempotent commands ─────────────────────────────────────────────────────

describe('a spoken command means an intent, not a toggle', () => {
  // pauseSession, resumeSession and stopSession each guard on exactly one of
  // these predicates and do nothing when it is false. A duplicate tool call
  // - and one arrived twice in a single log - must therefore land on the
  // same state, not undo the first.
  //
  // A toggle underneath would give: pause + pause = running, which for a
  // conversational system is the wrong contract entirely.

  // pause + pause = paused
  check('the first pause has something to pause',
    isSessionPausable('STATION') === true);
  check('the second finds nothing to pause',
    isSessionPausable('PAUSED') === false);
  check('and does not resume it instead',
    isSessionPaused('PAUSED') === true);

  // resume + resume = running
  check('the first resume has something to resume',
    isSessionPaused('PAUSED') === true);
  check('the second finds nothing to resume',
    isSessionPaused('STATION') === false);
  check('and does not pause it instead',
    isSessionPausable('STATION') === true);

  // stop + stop = stopped
  check('the first stop has something to stop',
    isSessionUnderway('APPROACHING_STATION') === true);
  check('the second finds nothing to stop',
    isSessionUnderway('FINISHED') === false);
});

describe('the wrist button and the coach see the same rules', () => {
  // The wrist menu has separate PAUSE and RESUME buttons and both used to
  // call the toggle, so pressing PAUSE twice resumed the session. Both now
  // read the same two predicates the voice commands read.
  const STATES = ['IDLE', 'COUNTDOWN', 'RUNNING', 'APPROACHING_STATION',
                  'APPROACHING_FINISH', 'STATION', 'PAUSED', 'FINISHED'];

  for (const state of STATES) {
    // Whatever the state, at most one of the two can act
    const acts = (isSessionPausable(state) ? 1 : 0) + (isSessionPaused(state) ? 1 : 0);
    check(state + ': pause and resume are never both available', acts <= 1, acts);

    // And a session that is running always offers exactly one of them
    if (isSessionUnderway(state)) {
      check(state + ': a live session offers one of them', acts === 1);
    } else {
      check(state + ': a dead session offers neither', acts === 0);
    }
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
