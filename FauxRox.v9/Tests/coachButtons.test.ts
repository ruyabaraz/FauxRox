// ============================================================================
// coachButtons.test.ts — one coach, one state, two ways to reach it
// ============================================================================
// There is a microphone on the panel and a microphone on the wrist. They are
// the same switch, and the failure they had was the ordinary one: each drew
// itself from what it remembered doing, so using either left the other
// showing the opposite of the truth.
//
// The wrist one was worse than stale. It called push-to-talk, which the coach
// ignores outright while the toggle is on - so after switching the coach on
// from the panel, the wrist button did nothing at all, and only worked in the
// case where the other button had never been used.
//
// Both are runtime shells, so this reads them.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

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

function source(name: string): string {
  return fs.readFileSync(path.join(ROOT, 'Assets', 'Scripts', name), 'utf8');
}

const PANEL = source('CoachToggleButton.ts');
const WRIST = source('WristMenu.ts');
const COACH = source('AICoach.ts');

function member(text: string, signature: string): string {
  const start = text.indexOf(signature);
  if (start < 0) return '';

  const end = text.indexOf('\n  }', start);
  return end < 0 ? text.substring(start) : text.substring(start, end);
}

describe('both buttons do the same thing', () => {
  check('the panel toggles the coach',
    member(PANEL, 'private onButtonPressed').indexOf('toggleCoach()') > 0);
  check('and so does the wrist',
    member(WRIST, 'private onAskCoachPressed').indexOf('toggleCoach()') > 0);

  // Push-to-talk is ignored while the toggle is on, so a wrist button using
  // it worked only when the panel button had not been used.
  check('and the wrist no longer asks for the one that gets ignored',
    member(WRIST, 'private onAskCoachPressed').indexOf('startListening') < 0);
  check('though the coach still has it for anything else that wants it',
    COACH.indexOf('startListening(): void') > 0);
});

describe('and both read the state back from the coach', () => {
  // Not from each other, and not from what they remember doing.
  check('the panel follows the coach every frame',
    PANEL.indexOf('followCoach()') > 0 &&
    member(PANEL, 'private followCoach').indexOf('isToggleOn') > 0);
  check('and the wrist does too',
    WRIST.indexOf('this.followCoach()') > 0 &&
    member(WRIST, 'private followCoach').indexOf('isToggleOn') > 0);

  // Redrawn on a change rather than every frame: a texture assignment per
  // frame per button is work nobody asked for.
  check('the panel only redraws when it changes',
    member(PANEL, 'private followCoach').indexOf('if (isOn === this.shownOn) return;') > 0);
  check('and so does the wrist',
    member(WRIST, 'private followCoach').indexOf('if (isOn === this._coachShownOn) return;') > 0);

  // The press no longer draws anything: it asks, and the follower shows what
  // actually happened rather than what the button assumed would happen.
  check('and pressing draws nothing itself',
    member(PANEL, 'private onButtonPressed').indexOf('setIconTexture') < 0,
    member(PANEL, 'private onButtonPressed'));
});

describe('the coach is the one that knows', () => {
  check('it says whether it is on', COACH.indexOf('get isToggleOn()') > 0);
  check('and that is what both of them ask',
    PANEL.indexOf('isToggleOn') > 0 && WRIST.indexOf('isToggleOn') > 0);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
