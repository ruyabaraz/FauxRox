// ============================================================================
// raceStart.test.ts — a race in preview is still a race
// ============================================================================
// There are two questions about a session and they are not the same one:
//
//   what is it?          a race, or a training session
//   what does it count?  a leaderboard entry, a personal best, nothing
//
// Everything the athlete sees and hears belongs to the first. The countdown,
// the beeps and the gun are what a race IS, not a reward for it being
// eligible - and a race run in the editor preview, which is every race
// anybody tests, counts for nothing and still starts the way one starts.
//
// Asking the second question in the first one's place took the countdown and
// the start gun away from every race in preview. It was found by somebody
// running one, which is what this file is for.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

import {
  eligibilityOf,
  mayRank,
} from '../Assets/Scripts/SessionEligibility';

import { semanticsFor } from '../Assets/Scripts/SessionSemantics';

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

describe('the two questions have different answers', () => {
  const previewRace = { kind: 'RACE', previewSimplified: true, completed: true };

  check('a race in preview is a race', semanticsFor('RACE').kind === 'RACE');
  check('and counts for nothing', !mayRank(previewRace));
  check('and says why', eligibilityOf(previewRace).reason !== '');

  // Which is the whole point: one of these is about presentation and the
  // other is about records, and a predicate that answers both is a bug
  // waiting for somebody to test a race.
  const realRace = { kind: 'RACE', previewSimplified: false, completed: true };
  check('a race on a device is both', mayRank(realRace) &&
    semanticsFor('RACE').countsForRanking);

  const training = { kind: 'TRAINING', previewSimplified: false, completed: true };
  check('and a training session is neither',
    !mayRank(training) && semanticsFor('TRAINING').kind !== 'RACE');
});

// The state machine is a runtime shell and cannot be unit tested, so what can
// be checked is the shape of what it asks. Not a substitute for running one -
// it is the thing that would have caught this without anybody having to.
const ROOT = path.join(__dirname, '..', '..', '..');
const MACHINE = fs.readFileSync(
  path.join(ROOT, 'Assets', 'Scripts', 'RaceStateMachine.ts'), 'utf8');

/** The body of a method, from its signature to the line that closes it */
function methodBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) return '';

  const indent = '  ';
  const end = source.indexOf('\n' + indent + '}', start);
  return end < 0 ? source.substring(start) : source.substring(start, end);
}

describe('the start of a race asks what the session is', () => {
  const countdown = methodBody(MACHINE, 'private beginCountdown') ||
                    methodBody(MACHINE, 'this.playCountdownBeep();');

  check('the countdown is somewhere to be found', countdown !== '');

  const updates = methodBody(MACHINE, 'private updateCountdown');
  check('and so is the gun',
    updates.indexOf('playCountdownGo') >= 0, 'the gun moved');

  // isRaceSession() is the eligibility question. It belongs to the personal
  // best, the cloud save and the leaderboard button, and to nothing the
  // athlete sees at the start line.
  check('the gun is not gated on whether the race will count',
    updates.indexOf('isRaceSession') < 0, updates.indexOf('isRaceSession'));

  const beeps = MACHINE.indexOf('this.playCountdownBeep();');
  const guard = MACHINE.lastIndexOf('this.isRace', beeps);
  const wrongGuard = MACHINE.lastIndexOf('this.isRaceSession()', beeps);
  check('and neither is the countdown itself', guard > wrongGuard,
    'countdown guarded by the eligibility question');
});

describe('what the eligibility question is still for', () => {
  // Read together, these say where each question belongs. The three below are
  // records rather than presentation, and they are right to refuse a race
  // that will not count.
  for (const owner of ['skipping PB check', 'skipping cloud save', 'countsForRanking:']) {
    check('"' + owner + '" still asks it', MACHINE.indexOf(owner) >= 0);
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
