// ============================================================================
// statusLine.test.ts — one line at a time in the middle of the view
// ============================================================================
// "Cross station line" and the block's movement list were landing in the same
// place at the same moment, and the athlete got both on top of each other at
// exactly the point where they needed to read one of them.
//
// They are already in the right order: what the set holds, and then where to
// stand for it. So the status line waits while the card is up and says itself
// the moment it is gone.
//
// The state machine is a runtime shell, so what is checked here is the shape
// of it: that the line has one owner, that clearing is never deferred, and
// that the block banner - which borrows the same line where no block label is
// wired - cannot be wiped by the waiting.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

import {
  BLOCK_INTRO_SECONDS,
  BLOCK_INTRO_FADE_SECONDS,
  introOpacity,
} from '../Assets/Scripts/BlockIntro';

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
const MACHINE = fs.readFileSync(
  path.join(ROOT, 'Assets', 'Scripts', 'RaceStateMachine.ts'), 'utf8');

function member(signature: string): string {
  const start = MACHINE.indexOf(signature);
  if (start < 0) return '';

  const end = MACHINE.indexOf('\n  }', start);
  return end < 0 ? MACHINE.substring(start) : MACHINE.substring(start, end);
}

function occurrences(needle: string): number {
  let count = 0;
  let at = MACHINE.indexOf(needle);
  while (at >= 0) { count++; at = MACHINE.indexOf(needle, at + needle.length); }
  return count;
}

describe('the crossing prompt goes through the one that waits', () => {
  check('walking up to a station asks for the line',
    member('private updateApproachingUI').indexOf("setStatusLine('Cross station line')") > 0);

  check('and nothing writes that sentence any other way',
    MACHINE.indexOf("statusText.text = 'Cross station line'") < 0);
  check('nor the finish one',
    MACHINE.indexOf("statusText.text = 'Cross the finish line!'") < 0);

  // PAUSED is the one thing that outranks a card: an athlete who stopped the
  // session needs to see that it is stopped, whatever else was mid-fade.
  check('paused still says so immediately',
    MACHINE.indexOf("this.statusText.text = 'PAUSED'") > 0);
});

describe('waiting is only ever for something to say', () => {
  const setter = member('private setStatusLine');

  // Held back, a clear would come back on its own the next time a card went
  // away - saying "cross station line" to somebody already at the station.
  check('clearing happens at once', setter.indexOf('if (!this._statusLine)') > 0);
  check('and does not go through the wait',
    setter.indexOf('return;') > 0 &&
    setter.indexOf('return;') < setter.indexOf('renderStatusLine'), setter);

  const render = member('private renderStatusLine');
  check('and nothing is ever written that was not given',
    render.indexOf('if (!this._statusLine) return;') > 0, render);

  // The block banner borrows this same line where no block label is wired.
  // Re-asserting an empty string would wipe it mid-sentence.
  check('so the borrowed block banner survives it',
    MACHINE.indexOf('showing block names on the status line instead') > 0);
});

describe('the card and the line hand over cleanly', () => {
  check('putting the card up clears the line under it',
    member('private showBlockIntro').indexOf("this.statusText.text = ''") > 0);
  check('and taking it down says whatever was waiting',
    member('private hideBlockIntro').indexOf('renderStatusLine') > 0);

  // The handover is at the end of the fade rather than the start of it: a
  // sentence appearing under a half-faded card is the overlap again, smaller.
  check('and nothing is drawn while the card is still visible',
    introOpacity(BLOCK_INTRO_SECONDS - BLOCK_INTRO_FADE_SECONDS / 2) > 0 &&
    introOpacity(BLOCK_INTRO_SECONDS) === 0);
});

// ── The voice turn's own shape ──────────────────────────────────────────────
//
// Also a runtime shell, and also worth pinning: the rule that there is at
// most one question out loud lives in the panel, where a counter and an early
// return are the whole of it, and it would be silently lost by anybody
// tidying that function.

const PICKER = fs.readFileSync(
  path.join(ROOT, 'Assets', 'Scripts', 'SessionPickerUI.ts'), 'utf8');

function pickerMember(signature: string): string {
  const start = PICKER.indexOf(signature);
  if (start < 0) return '';

  const end = PICKER.indexOf('\n  }', start);
  return end < 0 ? PICKER.substring(start) : PICKER.substring(start, end);
}

describe('one question out loud, then the buttons', () => {
  const bind = pickerMember('private bindCoachIntent');

  check('the turn counts what it has asked',
    bind.indexOf('_voiceQuestionsAsked') > 0, 'no counter');
  // The completed case ends the turn too, so the check is what follows the
  // second-question guard rather than whether ending appears at all.
  const guard = bind.indexOf('if (this._voiceQuestionsAsked > 0)');
  check('and asks a second one by ending the turn instead',
    guard > 0 && bind.indexOf('this.stopListening()', guard) > guard,
    guard);

  // An athlete who said "twenty minutes" and gets asked about space and then
  // about focus has been walked through the button flow with their voice.
  check('and the count starts again with each turn',
    pickerMember('private startListening').indexOf('_voiceQuestionsAsked = 0') > 0);

  check('the microphone is still there while they are answering',
    PICKER.indexOf("state === 'TRAINING_SPACE' || (answering && !this.voiceMicButton)") > 0,
    'the big button vanishes after the first answer');
});

describe('the station panel waits behind the card', () => {
  // Two answers to "what am I doing" at the moment somebody is asking it for
  // the first time.
  check('the card hides the panel it is standing in for',
    member('private showBlockIntro').indexOf('setActiveHudVisible(false)') > 0);
  check('and gives it back', member('private hideBlockIntro')
    .indexOf('setActiveHudVisible(true)') > 0);

  const hud = member('private setActiveHudVisible');
  check('what it hides is the movement, its readouts and what is next',
    hud.indexOf('stationNameText') > 0 && hud.indexOf('stationInfoText') > 0 &&
    hud.indexOf('progressText') > 0 && hud.indexOf('nextStationText') > 0 &&
    hud.indexOf('progressBar') > 0, hud);

  // A card competing with a smaller copy of its own heading is not
  // introducing anything.
  check('and the smaller copy of its own heading',
    hud.indexOf('blockLabelText') > 0 && hud.indexOf('blockProgressText') > 0, hud);

  // The session clock is how long they have been training, which is true
  // while they read.
  check('and not the session clock', hud.indexOf('timerText') < 0, hud);

  // Every per-frame writer would put it straight back otherwise.
  check('and nothing draws it again while the card is up',
    member('private updateStationUI').indexOf('if (this._blockIntroShowing) return;') > 0 &&
    member('private updateRunningUI').indexOf('if (this._blockIntroShowing) return;') > 0);
});

describe('the surface fades with the words on it', () => {
  const fade = member('private setBlockIntroAlpha');
  check('the backdrop goes with the text',
    fade.indexOf('setBackdropAlpha') > 0, fade);

  const backdrop = member('private setBackdropAlpha');

  // Taken from the live value each time, three seconds of fading would leave
  // the panel a little more transparent on every block until it was gone.
  check('and its own opacity is read once and kept',
    backdrop.indexOf('if (!this._backdropColor)') > 0, backdrop);
  check('so the fade is always from the same starting point',
    backdrop.indexOf('base.a * alpha') > 0, backdrop);
  check('and a border fades with it',
    backdrop.indexOf('borderColor') > 0);

  // A backdrop that cannot fade still appears and disappears on time.
  check('and one that cannot fade does not throw',
    backdrop.indexOf('catch (e)') > 0);
});

describe('the work starts when the reading stops', () => {
  // A movement whose clock was running while the athlete read the card is a
  // movement they were given less of.
  check('nothing is counted while the card is up',
    member('private updateStationProgress')
      .indexOf('if (this._blockIntroShowing) return;') > 0);

  const hide = member('private hideBlockIntro');
  check('and the station clock starts when it goes',
    hide.indexOf('_stationStartTime = getTime() * 1000') > 0, hide);
  check('from zero', hide.indexOf('_stationProgress = 0') > 0);
  check('but only where a station is what is waiting',
    hide.indexOf('this._state === RaceState.STATION') > 0);

  // The hand detector counts from where it is rather than being restarted
  // underneath itself, so what it had counted by then is subtracted.
  check('and reps done while reading are not the movement\'s reps',
    MACHINE.indexOf('_repsBeforeStation = repCount') > 0 &&
    MACHINE.indexOf('repCount - this._repsBeforeStation') > 0);
  check('and that subtraction is forgotten at the next station',
    member('private enterStationMode').indexOf('_repsBeforeStation = 0') > 0);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
