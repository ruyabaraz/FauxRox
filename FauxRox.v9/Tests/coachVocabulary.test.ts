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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
