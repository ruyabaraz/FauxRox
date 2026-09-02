// ============================================================================
// coachVocabulary.test.ts — the coach may only offer what the picker offers
// ============================================================================
// The coach prescribes by choosing the same three parameters a person would
// choose from the panel. That only holds while the two lists are the same
// list - and they stopped being the same the day running became a focus:
// RUNNING was added to the picker, the whole running programme was built
// behind it, and the coach's own vocabulary still had three focuses in it. An
// athlete could ask it for a run and be given engine work instead, forever,
// silently.
//
// Nothing in a type system catches that, because the coach's vocabulary is a
// tool schema handed to a model - strings in a literal. So it is read here
// and compared with the closed sets the generator actually accepts.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

import {
  ALL_SPACES,
  ALL_DURATIONS,
  ALL_FOCUSES,
  focusFitsSpace,
} from '../Assets/Scripts/AdaptiveSessionGenerator';

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

const ROOT = path.join(__dirname, '..', '..', '..');
const COACH = fs.readFileSync(
  path.join(ROOT, 'Assets', 'Scripts', 'AICoach.ts'), 'utf8');

/** The prescribeSession tool, from its name to the start of the next tool */
function prescribeTool(): string {
  const start = COACH.indexOf("name: 'prescribeSession'");
  if (start < 0) return '';

  const next = COACH.indexOf("name: '", start + 20);
  return next < 0 ? COACH.substring(start) : COACH.substring(start, next);
}

/** What a parameter of that tool is given as its list of values */
function enumSourceFor(parameter: string): string {
  const tool = prescribeTool();
  const at = tool.indexOf(parameter + ': {');
  if (at < 0) return '';

  const open = tool.indexOf('enum: ', at);
  if (open < 0) return '';

  const close = tool.indexOf('\n', open);
  return tool.substring(open + 'enum: '.length, close < 0 ? undefined : close).trim();
}

describe('the coach is offered exactly what the picker offers', () => {
  check('the tool is still there', prescribeTool() !== '');

  // Not "the two lists match" but "there is one list". A test that compared
  // two copies would pass the day somebody added a focus to both and got one
  // of them wrong; there is nothing to get wrong here.
  check('the focuses it may ask for are the generator\'s own',
    enumSourceFor('focus').indexOf('ALL_FOCUSES') === 0, enumSourceFor('focus'));
  check('and the durations', enumSourceFor('duration').indexOf('ALL_DURATIONS') === 0,
    enumSourceFor('duration'));
  check('and the spaces', enumSourceFor('space').indexOf('ALL_SPACES') === 0,
    enumSourceFor('space'));

  // The one that was missing, named, so the failure reads as itself.
  check('which means running is among them',
    (ALL_FOCUSES as string[]).indexOf('RUNNING') >= 0);
  check('and there are four of them', ALL_FOCUSES.length === 4);
  check('and three durations and two spaces',
    ALL_DURATIONS.length === 3 && ALL_SPACES.length === 2);
});

describe('what comes back is checked against the same lists', () => {
  // A literal list beside the schema is how the two drifted apart the first
  // time: two places to add a focus, and only one of them gets remembered.
  check('nothing is validated against a list typed out by hand',
    COACH.indexOf("['ENGINE', 'STRENGTH', 'MIXED']") < 0 &&
    COACH.indexOf("['SHORT', 'MEDIUM', 'FULL']") < 0 &&
    COACH.indexOf("['SMALL', 'NORMAL']") < 0);

  check('the generator\'s own lists are what it reads',
    COACH.indexOf('ALL_FOCUSES') > 0 && COACH.indexOf('ALL_DURATIONS') > 0 &&
    COACH.indexOf('ALL_SPACES') > 0);
});

describe('a room is a fact, not a preference', () => {
  // The rule itself, which the coach now asks rather than restates.
  check('running does not fit a small room',
    !focusFitsSpace('RUNNING', 'SMALL'));
  check('and everything else does',
    focusFitsSpace('ENGINE', 'SMALL') && focusFitsSpace('STRENGTH', 'SMALL') &&
    focusFitsSpace('MIXED', 'SMALL'));
  check('and all of it fits an open one',
    focusFitsSpace('RUNNING', 'NORMAL') && focusFitsSpace('MIXED', 'NORMAL'));

  check('the coach asks that rule rather than keeping its own copy',
    COACH.indexOf('focusFitsSpace') > 0);

  // Quietly handing somebody engine work when they asked to run is the app
  // deciding for them, and they would find out by doing it.
  const handler = COACH.substring(COACH.indexOf('private handlePrescribeSession'));
  const guard = handler.indexOf('focusFitsSpace');
  const applies = handler.indexOf('this.onPrescribeCallback(');
  check('and refuses before it prescribes, rather than substituting',
    guard > 0 && applies > guard, guard + ' / ' + applies);

  check('and the instructions say so too',
    COACH.indexOf('RUNNING needs a NORMAL space') > 0);
});

describe('moving on is the athlete\'s call, and the engine\'s decision', () => {
  // They know when a set has given them what it was going to. What the coach
  // must not do is decide whether it is allowed - that depends on what is
  // running, which the state machine knows and the coach does not.
  check('the coach can be asked to move on', COACH.indexOf("name: 'skipBlock'") > 0);

  const handler = COACH.substring(COACH.indexOf('private handleSkipBlock'));
  const body = handler.substring(0, handler.indexOf('\n  }'));

  check('and it asks the engine rather than deciding',
    body.indexOf('skipToNextBlock') > 0, body);
  check('and passes on the refusal it is given',
    body.indexOf('Not skipped') > 0 && body.indexOf('refused') > 0, body);

  // A race is eight stations in an order. One with a station missing is not a
  // faster race.
  check('and is told never to offer it in a race',
    COACH.indexOf('Never during a race') > 0);

  // The words somebody actually says, and the one it must not be confused
  // with: skipping ends a block and carries on, stopping ends the session.
  for (const said of ['next block', 'skip this block', 'move on',
                      'can we go to the next block']) {
    check('"' + said + '" is one of them', COACH.indexOf('"' + said + '"') > 0);
  }

  check('and stopping is told it is not this',
    COACH.indexOf('that is skipBlock') > 0);
  check('and skipping is told it is not stopping',
    COACH.indexOf('never use stopSession for these') > 0);

  const ROOT2 = path.join(__dirname, '..', '..', '..');
  const MACHINE = fs.readFileSync(
    path.join(ROOT2, 'Assets', 'Scripts', 'RaceStateMachine.ts'), 'utf8');

  const skip = MACHINE.substring(MACHINE.indexOf('skipToNextBlock(): string'));
  const skipBody = skip.substring(0, skip.indexOf('\n  }'));

  check('the engine refuses it in a race',
    skipBody.indexOf('isTrainingSession') > 0 &&
    skipBody.indexOf('the whole course') > 0, skipBody);
  check('and when nothing is running',
    skipBody.indexOf('isSessionUnderway') > 0);
  check('and when there is no next block to move to',
    skipBody.indexOf('last block') > 0);

  // Skipping is not a way of finishing early with the same result.
  check('and nothing is written down for what was not done',
    skipBody.indexOf('recordEffort') < 0 && skipBody.indexOf('_splitNames') < 0);
});

describe('the button and the voice ask the same question', () => {
  const ROOT3 = path.join(__dirname, '..', '..', '..');
  const WRIST = fs.readFileSync(
    path.join(ROOT3, 'Assets', 'Scripts', 'WristMenu.ts'), 'utf8');
  const MACHINE2 = fs.readFileSync(
    path.join(ROOT3, 'Assets', 'Scripts', 'RaceStateMachine.ts'), 'utf8');

  check('the wrist menu has a next-block button',
    WRIST.indexOf('nextBlockButton') > 0);
  check('and it calls the same method the coach does',
    WRIST.indexOf('skipToNextBlock') > 0);

  // A button that is there and does nothing reads as broken, and one that
  // decides for itself whether to appear will one day disagree with the
  // engine about whether there is a block to go to.
  check('and it is shown only when pressing it would do something',
    WRIST.indexOf('race.canSkipBlock === true') > 0);
  check('which is the engine\'s answer, not the menu\'s',
    MACHINE2.indexOf('get canSkipBlock(): boolean') > 0);

  const can = MACHINE2.substring(MACHINE2.indexOf('get canSkipBlock(): boolean'));
  const canBody = can.substring(0, can.indexOf('\n  }'));
  check('and it asks exactly what the skip asks',
    canBody.indexOf('isTrainingSession') > 0 &&
    canBody.indexOf('isSessionUnderway') > 0 &&
    canBody.indexOf('firstStationOfNextBlock') > 0, canBody);
});

describe('asking to begin again decides nothing', () => {
  // "Start a new session" says one thing: another one. Answering it with
  // prescribeSession would mean inventing a duration and a focus the athlete
  // never mentioned, which is the one thing these tools exist not to do -
  // and prescribeSession requires both, so the model would have had to.
  check('there is a way to ask for the panel',
    COACH.indexOf("name: 'startNewSession'") > 0);

  const tool = COACH.substring(COACH.indexOf("name: 'startNewSession'"));
  const description = tool.substring(0, tool.indexOf('\n          }'));

  check('and it takes no parameters at all',
    description.indexOf('parameters') < 0, description);

  for (const said of ['start a new session', 'let us do another', 'new session']) {
    check('"' + said + '" reaches it', description.indexOf(said) > 0);
  }

  check('and it is told what the other two are for instead',
    description.indexOf('prescribeSession or setSessionIntent') > 0);
  check('and never to do it mid-session',
    description.indexOf('Never while a session is running') > 0);

  const handler = COACH.substring(COACH.indexOf('private handleStartNewSession'));
  const body = handler.substring(0, handler.indexOf('\n  }'));

  check('the coach asks the engine rather than deciding',
    body.indexOf('startNewSession()') > 0, body);
  check('and is told not to suggest one once it is open',
    body.indexOf('Do not suggest a session for them') > 0);

  const ROOT4 = path.join(__dirname, '..', '..', '..');
  const MACHINE3 = fs.readFileSync(
    path.join(ROOT4, 'Assets', 'Scripts', 'RaceStateMachine.ts'), 'utf8');

  const open = MACHINE3.substring(MACHINE3.indexOf('startNewSession(): string'));
  const openBody = open.substring(0, open.indexOf('\n  }'));

  // Quietly throwing away a session in progress is not a recoverable mistake.
  check('the engine refuses it while something is running',
    openBody.indexOf('isUnderway') > 0 && openBody.indexOf('stopped first') > 0,
    openBody);
  check('and opens the panel the way the finish button does',
    openBody.indexOf('resetRace()') > 0);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
