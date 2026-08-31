// ============================================================================
// listeningSurface.test.ts — one microphone, one indicator
// ============================================================================
// Two surfaces can say the coach is listening. The coach's own belongs to the
// HUD, where it means "switched on, and it can hear you" for the length of a
// workout. The session panel's belongs beside the question being answered.
// They are never both right, and both lit is the app saying the same thing
// twice in two places while the athlete works out which one to believe.
//
// So one of them owns it. What is checked here is that ownership is a thing
// the coach has, rather than the panel reaching across the scene and
// switching the coach's objects off - which would work, until something else
// switched them back on and nobody could say which line had done it.
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

const COACH = source('AICoach.ts');
const PICKER = source('SessionPickerUI.ts');

function occurrences(text: string, needle: string): number {
  let count = 0;
  let at = text.indexOf(needle);
  while (at >= 0) { count++; at = text.indexOf(needle, at + needle.length); }
  return count;
}

/** The body of a method or getter, to the line that closes it */
function member(text: string, signature: string): string {
  const start = text.indexOf(signature);
  if (start < 0) return '';

  const end = text.indexOf('\n  }', start);
  return end < 0 ? text.substring(start) : text.substring(start, end);
}

describe('the coach knows which surface is drawing it', () => {
  check('there is a name for the two of them',
    COACH.indexOf("export type ListeningSurface = 'HUD' | 'PICKER'") >= 0);

  check('and the coach holds one', COACH.indexOf('_listeningSurface') > 0);
  check('and starts owning it', COACH.indexOf("_listeningSurface: ListeningSurface = 'HUD'") > 0);

  // Every one of its own visuals asks first.
  check('the indicator asks who owns it',
    member(COACH, 'private setRecordingIndicator').indexOf('ownsListeningUI') > 0);
  check('and the wave does',
    member(COACH, 'private setListeningAnimation').indexOf('ownsListeningUI') > 0);
  check('and the pulse does',
    member(COACH, 'private startMicPulse').indexOf('ownsListeningUI') > 0);
});

describe('nothing switches those objects on behind the owner\'s back', () => {
  // Three places may touch them directly: the initial state at start-up, the
  // one that clears them when ownership leaves, and the setter itself.
  // Anything else is a line that will one day light an indicator the owner
  // did not ask for.
  const raw = occurrences(COACH, 'recordingIndicator.enabled');
  check('the coach writes its indicator in three places and no more',
    raw <= 3, raw);

  const wave = occurrences(COACH, 'listeningWaveAnimation.enabled');
  check('and its wave in three', wave <= 3, wave);

  // The panel owns its own group and says so by never mentioning the
  // coach's.
  check('the panel never reaches across to the coach\'s objects',
    PICKER.indexOf('recordingIndicator') < 0 &&
    PICKER.indexOf('listeningWaveAnimation') < 0);
  check('it has one of its own instead', PICKER.indexOf('listeningGroup') > 0);
});

describe('a turn changes hands and hands back', () => {
  const begin = member(COACH, 'beginSessionTurn(surface?: ListeningSurface)');
  check('starting a turn sets the surface', begin.indexOf('setListeningSurface') > 0);

  const end = member(COACH, 'endSessionTurn(): void');
  check('and ending it puts the HUD back',
    end.indexOf("setListeningSurface('HUD')") > 0, end);

  // A coach the athlete had switched on is still switched on afterwards, and
  // shows its own indicator again. One that was off goes off with nothing of
  // the panel's left lit.
  check('and only a borrowed microphone is switched off',
    end.indexOf('if (borrowed) this.deactivateToggleMode()') > 0, end);
  check('with the surface restored before that happens',
    end.indexOf('setListeningSurface') < end.indexOf('deactivateToggleMode'), end);

  // Handing it over clears whatever the old owner had on screen, or the
  // duplicate this exists to prevent survives the handover itself.
  const handover = member(COACH, 'private setListeningSurface');
  check('changing hands clears what the old owner was showing',
    handover.indexOf('clearOwnListeningUI') > 0);
  check('and taking it back shows what is actually true',
    handover.indexOf('this._isToggleOn') > 0 &&
    handover.indexOf('this.isUserSpeaking') > 0, handover);

  check('and the panel asks for its own surface by name',
    PICKER.indexOf("beginSessionTurn('PICKER')") > 0);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
