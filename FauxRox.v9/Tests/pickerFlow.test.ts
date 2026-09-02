// ============================================================================
// pickerFlow.test.ts — one question at a time
// ============================================================================
// The flow is kept apart from the panel so these can run without a headset.
// Every rule here is a rule about the flow rather than about UIKit.
// ============================================================================

import {
  PickerFlow,
  PickerState,
  readySummaryOf,
  stepSummaryOf,
  emptySelection,
  understoodLines,
  voiceQuestionFor,
  voiceRefusalFor,
} from '../Assets/Scripts/PickerFlow';

import { SessionPlan, BlockScheme, SessionKind } from '../Assets/Scripts/SessionTypes';

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

/** A flow that has walked to READY through the normal path */
function ready(space: 'SMALL' | 'NORMAL' = 'NORMAL'): PickerFlow {
  const flow = new PickerFlow();
  flow.chooseMode('TRAINING');
  flow.chooseSpace(space);
  flow.chooseDuration('MEDIUM');
  flow.chooseFocus(space === 'SMALL' ? 'MIXED' : 'RUNNING');
  return flow;
}

describe('one question at a time, in order', () => {
  const flow = new PickerFlow();

  check('it opens on the choice between race and training', flow.state === 'MODE');

  flow.chooseMode('TRAINING');
  check('training enters at space', flow.state === 'TRAINING_SPACE', flow.state);

  flow.chooseSpace('NORMAL');
  check('space leads to time', flow.state === 'TRAINING_TIME', flow.state);

  flow.chooseDuration('SHORT');
  check('time leads to focus', flow.state === 'TRAINING_FOCUS', flow.state);

  flow.chooseFocus('RUNNING');
  check('focus leads to ready', flow.state === 'TRAINING_READY', flow.state);

  // Configuration is over, and the panel knows it - which is what stops the
  // ready screen from being the same screen with more content under it.
  check('and ready is not a configuring state', !flow.isConfiguring);
  check('while every step before it is',
    ['TRAINING_SPACE', 'TRAINING_TIME', 'TRAINING_FOCUS'].every((s) => {
      const f = new PickerFlow();
      f.chooseMode('TRAINING');
      if (s !== 'TRAINING_SPACE') f.chooseSpace('NORMAL');
      if (s === 'TRAINING_FOCUS') f.chooseDuration('SHORT');
      return f.isConfiguring;
    }));

  check('race day does not walk the training steps', (() => {
    const race = new PickerFlow();
    race.chooseMode('RACE');
    return race.state === 'RACE' && !race.isConfiguring;
  })());
});

describe('a room without running in it', () => {
  const flow = new PickerFlow();
  flow.chooseMode('TRAINING');
  flow.chooseSpace('SMALL');
  flow.chooseDuration('MEDIUM');

  flow.chooseFocus('RUNNING');
  check('running is refused in a small room', flow.selection.focus === null,
    flow.selection.focus);
  check('and the athlete is still being asked', flow.state === 'TRAINING_FOCUS');

  flow.chooseFocus('ENGINE');
  check('another focus is accepted', flow.selection.focus === 'ENGINE');
  check('and it moves on', flow.state === 'TRAINING_READY');
});

describe('going back one step at a time, keeping the answers', () => {
  const flow = ready();

  check('back from ready is focus', flow.back() && flow.state === 'TRAINING_FOCUS');
  check('back from focus is time', flow.back() && flow.state === 'TRAINING_TIME');
  check('back from time is space', flow.back() && flow.state === 'TRAINING_SPACE');
  check('back from space is the mode choice', flow.back() && flow.state === 'MODE');

  // The panel closes rather than the flow having nowhere to put the athlete.
  check('and back from there closes the panel', flow.back() === false);

  // Walking back does not un-choose anything: the athlete came to change one
  // thing, not to start again.
  check('every answer survived the walk back',
    flow.selection.space === 'NORMAL' &&
    flow.selection.duration === 'MEDIUM' &&
    flow.selection.focus === 'RUNNING',
    JSON.stringify(flow.selection));
});

describe('edit returns to the last question with everything still chosen', () => {
  const flow = ready();
  flow.edit();

  check('it lands on focus', flow.state === 'TRAINING_FOCUS');
  check('with the selections intact',
    flow.selection.space === 'NORMAL' &&
    flow.selection.duration === 'MEDIUM' &&
    flow.selection.focus === 'RUNNING');

  // Re-picking the same focus goes straight back to ready.
  flow.chooseFocus('RUNNING');
  check('and choosing again returns to ready', flow.state === 'TRAINING_READY');
});

describe('changing the room can un-choose the focus', () => {
  // The edge case worth writing down. The old picker substituted mixed for
  // running when the room shrank, so the athlete pressed START on a session
  // they had not chosen. Clearing it costs them one tap and tells the truth.
  const flow = ready();

  flow.back(); flow.back(); flow.back();
  check('back at the room question', flow.state === 'TRAINING_SPACE');

  flow.chooseSpace('SMALL');
  check('running is cleared rather than swapped', flow.selection.focus === null);
  check('and nothing was silently put in its place',
    flow.selection.focus !== 'MIXED' as any);

  check('the room and the time are untouched',
    flow.selection.space === 'SMALL' && flow.selection.duration === 'MEDIUM');

  // They walk forward again and must answer focus for themselves.
  flow.chooseDuration('MEDIUM');
  check('and they arrive at focus with nothing selected',
    flow.state === 'TRAINING_FOCUS' && flow.selection.focus === null);

  check('so the session cannot be started yet', !flow.isComplete);

  flow.chooseFocus('STRENGTH');
  check('until they choose', flow.isComplete && flow.state === 'TRAINING_READY');

  // A focus that stays valid is not disturbed.
  const kept = ready('NORMAL');
  kept.back(); kept.back(); kept.back();
  kept.chooseSpace('NORMAL');
  check('a still-valid focus survives a space change',
    kept.selection.focus === 'RUNNING');
});

describe('a prescribed session opens on the answer', () => {
  const flow = new PickerFlow();
  flow.applyPrescription('NORMAL', 'FULL', 'THRESHOLD' as any);

  check('it lands in ready', flow.state === 'TRAINING_READY', flow.state);

  const legal = new PickerFlow();
  legal.applyPrescription('NORMAL', 'FULL', 'RUNNING');
  check('with what the coach chose', legal.selection.focus === 'RUNNING' &&
    legal.selection.duration === 'FULL');

  // Walking the athlete through three questions they did not ask would be
  // pretending the coach had not spoken. Editing is still one tap away.
  legal.edit();
  check('and it is still editable', legal.state === 'TRAINING_FOCUS');

  // A prescription a room cannot hold stops at the question rather than being
  // quietly rewritten.
  const impossible = new PickerFlow();
  impossible.applyPrescription('SMALL', 'MEDIUM', 'RUNNING');
  check('an impossible prescription asks instead of substituting',
    impossible.state === 'TRAINING_FOCUS' && impossible.selection.focus === null);
});

describe('the ready panel is fields, not a paragraph', () => {
  const plan: SessionPlan = {
    id: 'gen-x', kind: SessionKind.TRAINING, title: 'Running · Short',
    rationale: '15 min · 1 blocks · open space · scaled for Regular\n' +
               'RPE 3-4. You could hold a conversation the whole way. ' +
               "If you couldn't, it wasn't this session.",
    estimatedMinutes: 15,
    stations: [],
    source: 'generated',
    blocks: [{
      label: '15:00 run', scheme: BlockScheme.STRAIGHT, rounds: 1,
      items: [], restSeconds: 0, roundScales: [1],
      archetype: 'EASY_BASE',
    }],
  };

  const flow = ready();
  const summary = readySummaryOf(plan, flow.selection);

  check('it says what the screen is', summary.eyebrow === 'READY');
  check('and what the session is', summary.headline === 'RUNNING', summary.headline);
  check('what it costs', summary.metaPrimary === '15 MIN · 1 BLOCK',
    summary.metaPrimary);
  check('where and how long', summary.metaSecondary === 'Open space · Medium',
    summary.metaSecondary);

  // The archetype's own line, not the focus's - running is five things now.
  check('and how hard, from the archetype',
    summary.effort === 'RPE 3-4 · conversational', summary.effort);

  // The coaching sentence is worth saying and this is not where. The athlete
  // hears it when the work starts.
  const everything = [summary.eyebrow, summary.headline, summary.metaPrimary,
                      summary.metaSecondary, summary.effort].join(' ');

  check('the paragraph is nowhere on the panel',
    everything.indexOf('conversation the whole way') < 0, everything);
  check('nor is the rationale printed whole',
    everything.indexOf(plan.rationale) < 0);

  // Every field is one glance long.
  check('and nothing on it is a sentence to read',
    [summary.headline, summary.metaPrimary, summary.metaSecondary, summary.effort]
      .every((line) => line.length <= 34),
    everything);
});

describe('the answers so far, collapsed', () => {
  check('nothing chosen says nothing', stepSummaryOf(emptySelection()) === '');

  check('one answer is one part',
    stepSummaryOf({ space: 'NORMAL', duration: null, focus: null }) === 'Open space');

  check('two are joined',
    stepSummaryOf({ space: 'SMALL', duration: 'SHORT', focus: null }) ===
    'Small space · Short');

  // The focus is not in it: at the moment this line is shown the focus is the
  // question being asked, and answering it in the summary above would be odd.
  check('the question being asked is not in the summary of answers',
    stepSummaryOf({ space: 'NORMAL', duration: 'FULL', focus: 'ENGINE' })
      .indexOf('Engine') < 0);
});

describe('the 5K question arrives where it is worth asking', () => {
  // Not in onboarding. Somebody setting the app up has not decided they are a
  // runner yet; the question only means something once they have chosen a run.
  const flow = new PickerFlow();
  flow.setPaceOfferAvailable(true);
  flow.setPaceOfferPending(true);

  flow.chooseMode('TRAINING');
  flow.chooseSpace('NORMAL');
  flow.chooseDuration('MEDIUM');
  flow.chooseFocus('STRENGTH');
  check('a strength session is never asked for a 5K time',
    flow.state === 'TRAINING_READY', flow.state);

  flow.edit();
  flow.chooseFocus('RUNNING');
  check('choosing running asks', flow.state === 'TRAINING_PACE_OFFER', flow.state);
  check('and the panel still counts as configuring', flow.isConfiguring);
  // Every question has an answer by now, which is exactly the condition the
  // START button used to key off. It must still be held back: the athlete is
  // being asked something, and a stray tap should not begin the session.
  check('every answer is in', flow.isComplete);
  check('and START is still held back', flow.isConfiguring);

  flow.resolvePaceOffer();
  check('answering lands on ready', flow.state === 'TRAINING_READY', flow.state);
  check('and the focus that got them there survived',
    flow.selection.focus === 'RUNNING');

  flow.edit();
  flow.chooseFocus('RUNNING');
  check('and it is not asked a second time',
    flow.state === 'TRAINING_READY', flow.state);
});

describe('a panel that cannot ask does not stop to ask', () => {
  // A state with no interface behind it is a dead end. A scene that has not
  // been given the offer inputs behaves exactly as it did before they existed.
  const flow = new PickerFlow();
  flow.setPaceOfferPending(true);

  flow.chooseMode('TRAINING');
  flow.chooseSpace('NORMAL');
  flow.chooseDuration('MEDIUM');
  flow.chooseFocus('RUNNING');

  check('an unwired panel goes straight to ready',
    flow.state === 'TRAINING_READY', flow.state);
});

describe('somebody who already answered is left alone', () => {
  const flow = new PickerFlow();
  flow.setPaceOfferAvailable(true);
  flow.setPaceOfferPending(false);

  flow.chooseMode('TRAINING');
  flow.chooseSpace('NORMAL');
  flow.chooseDuration('MEDIUM');
  flow.chooseFocus('RUNNING');

  check('no question, no extra step', flow.state === 'TRAINING_READY', flow.state);
});

describe('back out of the question the way you came in', () => {
  const flow = new PickerFlow();
  flow.setPaceOfferAvailable(true);
  flow.setPaceOfferPending(true);

  flow.chooseMode('TRAINING');
  flow.chooseSpace('NORMAL');
  flow.chooseDuration('MEDIUM');
  flow.chooseFocus('RUNNING');

  check('back from the question returns to focus',
    flow.back() && flow.state === 'TRAINING_FOCUS', flow.state);

  // Backing out is not an answer. It is somebody changing their mind about
  // the session, and the question is still open.
  flow.chooseFocus('RUNNING');
  check('and the question is still there', flow.state === 'TRAINING_PACE_OFFER',
    flow.state);
});

describe('what was said, and nothing that was not', () => {
  // "I've got twenty minutes" says one thing. The old prescription path
  // answered all three questions at once and could afford to; this one holds
  // the one thing that was said and asks the next question.
  const flow = new PickerFlow();
  flow.chooseMode('TRAINING');

  check('one field heard leaves the other two to ask',
    flow.applyVoiceIntent({ duration: 'MEDIUM' }) === 'TRAINING_SPACE');
  check('and it is kept', flow.selection.duration === 'MEDIUM');
  check('and nothing was invented',
    flow.selection.space === null && flow.selection.focus === null);
  check('and it knows what it is still missing',
    flow.unanswered.join(',') === 'SPACE,FOCUS', flow.unanswered.join(','));

  // Space first, because it is a physical constraint rather than a
  // preference, and it decides whether running is a session at all.
  check('space is what it asks for first',
    new PickerFlow().applyVoiceIntent({ focus: 'ENGINE' }) === 'TRAINING_SPACE');
  check('then time',
    new PickerFlow().applyVoiceIntent({ space: 'NORMAL', focus: 'ENGINE' }) ===
      'TRAINING_TIME');
  check('then focus',
    new PickerFlow().applyVoiceIntent({ space: 'NORMAL', duration: 'SHORT' }) ===
      'TRAINING_FOCUS');
});

describe('all three said is a session', () => {
  const flow = new PickerFlow();
  flow.chooseMode('TRAINING');

  const landed = flow.applyVoiceIntent(
    { space: 'NORMAL', duration: 'FULL', focus: 'RUNNING' });

  check('it lands where the buttons would have', landed === 'TRAINING_READY');
  check('with everything it heard', flow.isComplete &&
    flow.selection.focus === 'RUNNING' && flow.selection.duration === 'FULL');
  check('and nothing left to ask', flow.unanswered.length === 0);

  // Never behind their back: the panel opens on the answer and they still
  // press the button.
  check('and it is still only an answer, not a start', !flow.isTraining ||
    flow.state === 'TRAINING_READY');
});

describe('two turns of speaking, not one', () => {
  // "I've got 20 minutes" ... "How much space?" ... "Small."
  const flow = new PickerFlow();
  flow.chooseMode('TRAINING');

  flow.applyVoiceIntent({ duration: 'MEDIUM' });
  const after = flow.applyVoiceIntent({ space: 'SMALL' });

  check('the second answer joins the first', after === 'TRAINING_FOCUS', after);
  check('and both are held', flow.selection.duration === 'MEDIUM' &&
    flow.selection.space === 'SMALL');

  // Saying nothing changes nothing, and does not lose what was already said.
  check('an empty turn keeps everything',
    flow.applyVoiceIntent({}) === 'TRAINING_FOCUS' &&
    flow.selection.space === 'SMALL');
  check('and so does a turn that heard nothing at all',
    flow.applyVoiceIntent(null) === 'TRAINING_FOCUS');
});

describe('a room is a fact, said out loud or pressed', () => {
  // Asked for a run in a small room, the flow keeps the room and drops the
  // run - the same rule the buttons obey. Quietly handing them engine work
  // under the word they used is the app deciding for them.
  const flow = new PickerFlow();
  flow.chooseMode('TRAINING');

  const landed = flow.applyVoiceIntent(
    { space: 'SMALL', duration: 'SHORT', focus: 'RUNNING' });

  check('it does not become a session', landed === 'TRAINING_FOCUS', landed);
  check('the room is kept', flow.selection.space === 'SMALL');
  check('the time is kept', flow.selection.duration === 'SHORT');
  check('and nothing was put in running\'s place',
    flow.selection.focus === null);

  // And it is only the room that makes it impossible - said the other way
  // round, the same words are a session.
  const roomy = new PickerFlow();
  roomy.chooseMode('TRAINING');
  check('in an open space the same request is a session',
    roomy.applyVoiceIntent({ space: 'NORMAL', duration: 'SHORT', focus: 'RUNNING' }) ===
      'TRAINING_READY');

  // A focus heard before any room is not yet impossible - there is no room
  // to be impossible in.
  const noRoom = new PickerFlow();
  noRoom.chooseMode('TRAINING');
  noRoom.applyVoiceIntent({ focus: 'RUNNING' });
  check('running heard before the room is held, not refused',
    noRoom.selection.focus === 'RUNNING');
  // The second sentence takes the first one back. Where the athlete lands is
  // still the first thing they have not answered - they never said how long
  // they had - and focus is waiting for them after it.
  check('and then the room takes it away if it has to',
    noRoom.applyVoiceIntent({ space: 'SMALL' }) === 'TRAINING_TIME' &&
    noRoom.selection.focus === null);
  check('and it is still on the list of what is missing',
    noRoom.unanswered.join(',') === 'DURATION,FOCUS', noRoom.unanswered.join(','));
});

describe('the complete path is left alone', () => {
  // Two callers, two contracts. The prescription answers all three questions
  // and says so; the voice intent answers what it heard. Folding them into
  // one function would make the complete path start defending itself against
  // absences it never has.
  const flow = new PickerFlow();
  flow.chooseMode('TRAINING');
  flow.applyPrescription('NORMAL', 'MEDIUM', 'ENGINE');

  check('a full prescription still lands on the session',
    flow.state === 'TRAINING_READY');
  check('and still refuses an impossible one the way it did', (() => {
    const small = new PickerFlow();
    small.applyPrescription('SMALL', 'MEDIUM', 'RUNNING');
    return small.state === 'TRAINING_FOCUS' && small.selection.focus === null;
  })());
});

describe('listening is a turn, not a mode', () => {
  const flow = new PickerFlow();
  flow.chooseMode('TRAINING');

  check('the buttons are where the athlete starts', flow.state === 'TRAINING_SPACE');

  flow.listen();
  check('and the microphone is a step sideways', flow.isListening);
  check('which still counts as setting the session up', flow.isConfiguring);
  check('and is not a session', !flow.isComplete);

  // A turn that heard nothing is the same situation as not having spoken.
  flow.endListening();
  check('a turn with nothing in it puts them back where they were',
    flow.state === 'TRAINING_SPACE');

  // From further in, it returns further in - a turn that costs the athlete
  // their place is one they only try once.
  flow.chooseSpace('NORMAL');
  flow.chooseDuration('SHORT');
  flow.listen();
  check('from the focus question it listens', flow.isListening);
  flow.endListening();
  check('and comes back to the focus question', flow.state === 'TRAINING_FOCUS');

  flow.listen();
  check('and backing out does the same thing',
    flow.back() && flow.state === 'TRAINING_FOCUS');
});

describe('what speaking can reach', () => {
  // Everything it reaches is something they could have pressed.
  const flow = new PickerFlow();
  flow.chooseMode('TRAINING');
  flow.listen();

  check('a complete answer ends the turn on the session',
    flow.applyVoiceIntent({ space: 'NORMAL', duration: 'FULL', focus: 'ENGINE' }) ===
      'TRAINING_READY');
  check('and there is nothing listening any more', !flow.isListening);

  // The pace question owns its own screen; a microphone in the middle of it
  // would be a second question on top of the one being asked.
  const asking = new PickerFlow();
  asking.setPaceOfferAvailable(true);
  asking.setPaceOfferPending(true);
  asking.chooseMode('TRAINING');
  asking.chooseSpace('NORMAL');
  asking.chooseDuration('MEDIUM');
  asking.chooseFocus('RUNNING');
  check('the 5K question is not interrupted by it',
    asking.state === 'TRAINING_PACE_OFFER');
  asking.listen();
  check('and listening does not take it over',
    asking.state === 'TRAINING_PACE_OFFER');

  // Race Day is not built from anything, so there is nothing to say to it.
  const racing = new PickerFlow();
  racing.chooseMode('RACE');
  racing.listen();
  check('and a race has nothing to be told', racing.state === 'RACE');
});

describe('what it says it has understood', () => {
  const flow = new PickerFlow();
  flow.chooseMode('TRAINING');
  flow.applyVoiceIntent({ duration: 'MEDIUM' });

  // Only what it is sure of. An empty row with a question mark on it is a
  // placeholder pretending to be information.
  check('one answer is one line',
    understoodLines(flow.selection).join(' | ') === 'Medium ✓',
    understoodLines(flow.selection).join(' | '));

  flow.applyVoiceIntent({ space: 'SMALL', focus: 'STRENGTH' });
  check('and three are three',
    understoodLines(flow.selection).join(' | ') ===
      'Small space ✓ | Medium ✓ | Strength ✓',
    understoodLines(flow.selection).join(' | '));

  check('and nothing understood says nothing',
    understoodLines(new PickerFlow().selection).length === 0);
  check('and nothing at all does not throw', understoodLines(null).length === 0);
});

describe('one question out loud, and then the buttons', () => {
  // An athlete who said "twenty minutes" and gets asked about space and then
  // focus has been put through the button flow with their voice, which is
  // slower than the buttons and less certain.
  check('the missing room is what gets asked',
    voiceQuestionFor(['SPACE', 'FOCUS']) === 'How much space have you got?');
  check('and time, when the room is known',
    voiceQuestionFor(['DURATION', 'FOCUS']) === 'How long have you got?');
  check('and what they want to work on, last',
    voiceQuestionFor(['FOCUS']) === 'What do you want to work on?');
  check('and nothing missing is nothing to ask',
    voiceQuestionFor([]) === '' && voiceQuestionFor(null) === '');
});

describe('the refusal is on the screen, not only in the voice', () => {
  // Somebody with the sound off asked to run, the run is not there, and
  // without this nothing tells them why.
  check('a run in a small room says what the problem is',
    voiceRefusalFor('RUNNING', 'SMALL') === 'Running needs more room than this.');

  check('and nothing that fits is refused',
    voiceRefusalFor('ENGINE', 'SMALL') === '' &&
    voiceRefusalFor('RUNNING', 'NORMAL') === '' &&
    voiceRefusalFor('MIXED', 'NORMAL') === '');

  check('and half a question refuses nothing',
    voiceRefusalFor(null, 'SMALL') === '' && voiceRefusalFor('RUNNING', null) === '');

  // It is about the room, not about them.
  check('it is the room that is named',
    voiceRefusalFor('RUNNING', 'SMALL').indexOf('room') > 0);
});

// ── The panel's own guard against a press it did not receive ────────────────
//
// The flow cannot see this one: it is about when a press arrives rather than
// what it means. One pinch chose RUNNING, the 5K question appeared where the
// focus buttons had been, and the release of that same pinch landed on SKIP -
// so the question was declined in the frame it was asked, and the athlete
// never saw it. The log said "5K declined" and nobody had declined anything.

import * as fs from 'fs';
import * as path from 'path';

describe('a screen that just appeared has not been pressed yet', () => {
  const ROOT = path.join(__dirname, '..', '..', '..');
  const PANEL = fs.readFileSync(
    path.join(ROOT, 'Assets', 'Scripts', 'SessionPickerUI.ts'), 'utf8');

  check('the panel knows when the screen it is showing arrived',
    PANEL.indexOf('_shownAt') > 0 && PANEL.indexOf('_shownState') > 0);
  check('and only resets that when the screen actually changes',
    PANEL.indexOf('if (state !== this._shownState)') > 0);

  // Short enough that nobody deliberate is refused, long enough to outlast
  // the release of the press that got them here.
  check('and how long it waits can be tuned',
    PANEL.indexOf('@input screenSettleSeconds') > 0);

  function guarded(signature: string): boolean {
    const start = PANEL.indexOf(signature);
    if (start < 0) return false;

    const body = PANEL.substring(start, PANEL.indexOf('\n  }', start));
    return body.indexOf('this.settled()') > 0;
  }

  check('declining the 5K question is guarded',
    guarded('private declineFiveK'));
  check('and accepting it', guarded('private acceptFiveK'));

  // START appears exactly where the focus buttons were, so the same pinch
  // could have started the session.
  check('and starting the session', guarded('private confirm'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
