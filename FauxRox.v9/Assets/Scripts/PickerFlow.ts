// ============================================================================
// PickerFlow.ts — one question at a time, and then a session
// ============================================================================
// The picker used to show mode, space, time, focus, a generated paragraph and
// a start button at once. On a phone that is a form. On a pair of glasses it
// is six things competing for attention while the world goes on behind them,
// and the athlete is standing in a gym holding a dumbbell.
//
// So it asks one thing at a time, and what has been answered collapses to a
// line. The state is explicit rather than a set of visibility flags, because
// "which of these six groups is on" has six answers that are legal and
// fifty-eight that are not, and the ones that are not are the ones that
// happen.
//
// Kept apart from the panel so it can be tested. Every rule here - what
// follows what, what going back preserves, when a focus stops being valid -
// is a rule about the flow rather than about UIKit, and none of it should
// need a headset to check.
//
// Pure: no Lens Studio imports.
// ============================================================================

import {
  Space,
  Duration,
  Focus,
  focusFitsSpace,
} from './AdaptiveSessionGenerator';

import { SessionPlan } from './SessionTypes';
import { RunningArchetype, RUNNING_TOPOLOGY } from './RunningArchetype';
import { effortCueFor } from './EffortCue';

export type PickerState =
  /** Race Day, or a training session? */
  | 'MODE'
  /** Race Day: pick the intent and go */
  | 'RACE'
  | 'TRAINING_SPACE'
  | 'TRAINING_TIME'
  | 'TRAINING_FOCUS'
  /**
   * Asked once, and only of somebody who has just chosen running and has no
   * pace evidence on file.
   *
   * Not in onboarding. Somebody setting up the app has not decided they are a
   * runner yet, and asking them for a 5K time before they have chosen a
   * running session is asking a question they have no reason to care about.
   * Here it arrives at the moment it becomes relevant, and skipping is a
   * perfectly good answer.
   */
  | 'TRAINING_PACE_OFFER'
  /**
   * The athlete is telling the coach what they are up for.
   *
   * One bounded turn rather than a conversation with no edges: they speak,
   * the flow takes what was in it, and it ends - either on the session or on
   * the next question, which is where the buttons are. A mode with no way out
   * except talking more is a mode people get stuck in while standing in a gym.
   *
   * The buttons never go away for it. This is a second way in, not a
   * replacement, and everything it can reach is something they could have
   * pressed.
   */
  | 'TRAINING_LISTENING'
  /** Configuration is done and out of the way; what is left is the session */
  | 'TRAINING_READY';

/**
 * Some of the three, from somebody talking rather than pressing.
 *
 * Every field optional and every absence meaningful: an athlete who said
 * "twenty minutes" said one thing, and the shape has to be able to carry
 * exactly that. A type that required all three would make the model invent
 * the rest before the flow ever saw it, which is the same silent default
 * moved one layer further away from anywhere it could be checked.
 */
export interface VoiceIntent {
  space?: Space;
  duration?: Duration;
  focus?: Focus;
}

/** The three questions, named, so what is missing can be talked about */
export type PickerField = 'SPACE' | 'DURATION' | 'FOCUS';

/**
 * What has been answered so far.
 *
 * Nullable, and that is the point. The old picker defaulted every field, so
 * "not yet chosen" and "chose the default" were the same state and the panel
 * could not tell the athlete which of the two they were in. It also meant a
 * focus could never be un-chosen, which is exactly what has to happen when a
 * small room makes running impossible.
 */
export interface PickerSelection {
  space: Space | null;
  duration: Duration | null;
  focus: Focus | null;
}

export function emptySelection(): PickerSelection {
  return { space: null, duration: null, focus: null };
}

export class PickerFlow {
  private _state: PickerState = 'MODE';
  private _selection: PickerSelection = emptySelection();

  get state(): PickerState { return this._state; }
  get selection(): PickerSelection { return this._selection; }

  /** True while the athlete is answering questions rather than reading answers */
  get isConfiguring(): boolean {
    return this._state === 'TRAINING_SPACE' ||
           this._state === 'TRAINING_TIME' ||
           this._state === 'TRAINING_FOCUS' ||
           this._state === 'TRAINING_PACE_OFFER' ||
           this._state === 'TRAINING_LISTENING';
  }

  /** True while the athlete is being listened to */
  get isListening(): boolean {
    return this._state === 'TRAINING_LISTENING';
  }

  get isTraining(): boolean {
    return this._state !== 'MODE' && this._state !== 'RACE';
  }

  reset(): void {
    this._state = 'MODE';
    this._selection = emptySelection();
  }

  chooseMode(mode: 'RACE' | 'TRAINING'): void {
    this._state = mode === 'RACE' ? 'RACE' : 'TRAINING_SPACE';
  }

  /**
   * A space can invalidate a focus, and when it does the focus is cleared
   * rather than replaced.
   *
   * Substituting quietly - which is what the old picker did, swapping running
   * for mixed - means the athlete presses START on a session they did not
   * choose. Clearing it costs them one tap and tells the truth.
   */
  chooseSpace(space: Space): void {
    this._selection.space = space;

    if (this._selection.focus && !focusFitsSpace(this._selection.focus, space)) {
      this._selection.focus = null;
    }

    if (this._state === 'TRAINING_SPACE') this._state = 'TRAINING_TIME';
  }

  chooseDuration(duration: Duration): void {
    this._selection.duration = duration;
    if (this._state === 'TRAINING_TIME') this._state = 'TRAINING_FOCUS';
  }

  /**
   * Whether the panel is able to ask for a 5K time.
   *
   * Set by whoever owns the scene. A state with no interface behind it is a
   * dead end, so the flow does not enter one it has been told cannot be
   * shown - which is also what keeps a scene that has not been updated
   * behaving exactly as it did.
   */
  private _canOfferPace: boolean = false;

  setPaceOfferAvailable(available: boolean): void {
    this._canOfferPace = available;
  }

  /** Ignored where the room cannot hold it, the same rule the button obeys */
  chooseFocus(focus: Focus): void {
    if (this._selection.space && !focusFitsSpace(focus, this._selection.space)) {
      return;
    }

    this._selection.focus = focus;
    if (this._state !== 'TRAINING_FOCUS') return;

    this._state = this.shouldAskForPace(focus)
      ? 'TRAINING_PACE_OFFER'
      : 'TRAINING_READY';
  }

  /**
   * Only for running, only once, and only when there is somewhere to ask.
   *
   * A pace target says nothing about a strength session, so the question is
   * not put to somebody who chose one.
   */
  private shouldAskForPace(focus: Focus): boolean {
    return focus === 'RUNNING' && this._canOfferPace && this._paceOfferPending;
  }

  /** Set by the panel from stored evidence: is there anything left to ask */
  private _paceOfferPending: boolean = false;

  setPaceOfferPending(pending: boolean): void {
    this._paceOfferPending = pending;
  }

  /** The athlete answered the pace question, one way or the other */
  resolvePaceOffer(): void {
    this._paceOfferPending = false;
    if (this._state === 'TRAINING_PACE_OFFER') this._state = 'TRAINING_READY';
  }

  /** Back to the last question, with every answer still standing */
  edit(): void {
    if (this._state === 'TRAINING_READY') this._state = 'TRAINING_FOCUS';
  }

  /**
   * One step back.
   *
   * @returns false when there is nowhere left to go and the panel should close
   */
  back(): boolean {
    switch (this._state) {
      case 'TRAINING_READY': this._state = 'TRAINING_FOCUS'; return true;
      case 'TRAINING_PACE_OFFER': this._state = 'TRAINING_FOCUS'; return true;
      // Out of the turn, back to the question. Backing out of listening is
      // not backing out of the session.
      case 'TRAINING_LISTENING': this._state = this._returnFromListening; return true;
      case 'TRAINING_FOCUS': this._state = 'TRAINING_TIME';  return true;
      case 'TRAINING_TIME':  this._state = 'TRAINING_SPACE'; return true;
      case 'TRAINING_SPACE': this._state = 'MODE';           return true;
      case 'RACE':           this._state = 'MODE';           return true;
      default:                                                return false;
    }
  }

  /**
   * The coach has answered all three, so the athlete opens on the answer.
   *
   * They can still edit it - that is the whole reason the panel opens at all
   * rather than the session simply starting - but walking them through three
   * questions they did not ask would be pretending the coach had not spoken.
   */
  applyPrescription(space: Space, duration: Duration, focus: Focus): void {
    this._selection.space = space;
    this._selection.duration = duration;
    this._selection.focus = focusFitsSpace(focus, space) ? focus : null;
    this._state = this._selection.focus ? 'TRAINING_READY' : 'TRAINING_FOCUS';
  }

  /**
   * Start a turn of listening, from wherever the athlete was.
   *
   * Remembers where they came from so that saying nothing puts them back
   * there rather than somewhere the flow chose. A turn that costs the athlete
   * their place is one they only try once.
   */
  listen(): void {
    if (!this.isTraining || this._state === 'TRAINING_LISTENING') return;
    if (this._state === 'TRAINING_PACE_OFFER') return;

    this._returnFromListening = this._state;
    this._state = 'TRAINING_LISTENING';
  }

  /** Where the athlete was standing when they pressed the microphone */
  private _returnFromListening: PickerState = 'TRAINING_SPACE';

  /**
   * The turn ended and nothing usable was in it.
   *
   * Back where they were, with every answer intact. Not an error state: a
   * turn that heard nothing is the same situation as not having spoken.
   */
  endListening(): void {
    if (this._state !== 'TRAINING_LISTENING') return;
    this._state = this._returnFromListening;
  }

  /**
   * Some of it, from somebody talking.
   *
   * Kept apart from applyPrescription rather than folded into it. That one is
   * a complete answer to all three questions and lands on the session; this
   * one is whatever was said, and what was not said stays unanswered. Making
   * one function do both would mean the complete path had to start defending
   * itself against absences it never has.
   *
   * Nothing is invented. "I've got twenty minutes" says one thing, and the
   * flow's answer is to hold that one thing and ask the next question - not
   * to decide on their behalf what they came to train.
   *
   * @returns the state it landed in, so the panel can say what it did
   */
  applyVoiceIntent(intent: VoiceIntent): PickerState {
    var heard = intent || {};

    if (heard.space) this._selection.space = heard.space;
    if (heard.duration) this._selection.duration = heard.duration;
    if (heard.focus) this._selection.focus = heard.focus;

    // A room is a fact, and it is checked after everything has been heard
    // rather than as each field arrives. Somebody can say "I want to run" and
    // then say what room they are in, and the second sentence has to be able
    // to take the first one back - checking only the focus as it arrived left
    // a run standing in a room it could not happen in.
    //
    // The room is kept and the focus is dropped, exactly as the buttons do.
    // The athlete is taken back to the question rather than quietly handed
    // something else under the word they used.
    if (this._selection.focus && this._selection.space &&
        !focusFitsSpace(this._selection.focus, this._selection.space)) {
      this._selection.focus = null;
    }

    this._state = this.firstUnanswered();
    return this._state;
  }

  /**
   * The question the athlete has not answered yet, in the order they are
   * asked - which is also the order they matter in. Space first: it is a
   * physical constraint rather than a preference, and it decides whether
   * running is a session at all.
   */
  private firstUnanswered(): PickerState {
    if (!this._selection.space) return 'TRAINING_SPACE';
    if (!this._selection.duration) return 'TRAINING_TIME';
    if (!this._selection.focus) return 'TRAINING_FOCUS';
    return 'TRAINING_READY';
  }

  /** What is still missing, in the order it will be asked for */
  get unanswered(): PickerField[] {
    var out: PickerField[] = [];
    if (!this._selection.space) out.push('SPACE');
    if (!this._selection.duration) out.push('DURATION');
    if (!this._selection.focus) out.push('FOCUS');
    return out;
  }

  /** True when there is enough to generate a session from */
  get isComplete(): boolean {
    return !!(this._selection.space && this._selection.duration && this._selection.focus);
  }
}

// ── What the ready panel says ───────────────────────────────────────────────

/**
 * The ready panel, as fields rather than as a paragraph.
 *
 * The picker used to print the session's rationale, which ends in a coaching
 * sentence - "RPE 3-4. You could hold a conversation the whole way. If you
 * couldn't, it wasn't this session." That is worth saying and this is not
 * where to say it: it is three lines of reading on a panel the athlete is
 * meant to glance at, and they hear it anyway when the work starts.
 *
 * Built from the plan's own fields rather than by cutting the string down.
 * A truncated sentence is a sentence somebody has to guess the end of.
 */
export interface ReadySummary {
  /** Small, above everything: what this screen is */
  eyebrow: string;
  /** The session, in one word */
  headline: string;
  /** What it costs: "15 MIN · 4 BLOCKS" */
  metaPrimary: string;
  /** Where and how long: "Open space · Short" */
  metaSecondary: string;
  /** How hard, in the shortest honest form */
  effort: string;
}

const SPACE_WORD: { [k: string]: string } = {
  SMALL: 'Small space', NORMAL: 'Open space',
};

const DURATION_WORD: { [k: string]: string } = {
  SHORT: 'Short', MEDIUM: 'Medium', FULL: 'Full',
};

const FOCUS_WORD: { [k: string]: string } = {
  RUNNING: 'RUNNING', ENGINE: 'ENGINE', STRENGTH: 'STRENGTH', MIXED: 'MIXED',
};

export function readySummaryOf(
  plan: SessionPlan | null,
  selection: PickerSelection
): ReadySummary {
  var blocks = plan && plan.blocks ? plan.blocks.length : 0;
  var minutes = plan ? plan.estimatedMinutes : 0;

  return {
    eyebrow: 'READY',
    headline: selection.focus ? (FOCUS_WORD[selection.focus] || '') : '',
    metaPrimary: minutes > 0
      ? minutes + ' MIN' + (blocks > 0 ? ' · ' + blocks + (blocks === 1 ? ' BLOCK' : ' BLOCKS') : '')
      : '',
    metaSecondary: [
      selection.space ? SPACE_WORD[selection.space] : '',
      selection.duration ? DURATION_WORD[selection.duration] : '',
    ].filter(function (part) { return part !== ''; }).join(' · '),
    effort: effortLineFor(plan, selection),
  };
}

/**
 * How hard, at panel length.
 *
 * From the archetype where the session has one, because running is five
 * different things now and one line for all of them would be back where this
 * started. From the focus otherwise, which is the shape the other three
 * grammars still have.
 */
function effortLineFor(
  plan: SessionPlan | null,
  selection: PickerSelection
): string {
  if (plan && plan.blocks) {
    for (var i = 0; i < plan.blocks.length; i++) {
      var archetype = plan.blocks[i].archetype;
      if (!archetype) continue;

      var topology = RUNNING_TOPOLOGY[archetype as RunningArchetype];
      if (topology && topology.effortShort) return topology.effortShort;
    }
  }

  return selection.focus ? effortCueFor(selection.focus).short : '';
}

/**
 * The answers so far, collapsed to one line.
 *
 * What the athlete has already decided, small and out of the way, so the
 * question they are being asked now is the only thing competing for their
 * attention.
 */
/**
 * What the app has understood, while it is being told.
 *
 * Structured, and only what it is sure of. The raw transcript is not the
 * interface: a line of what somebody just said, misheard in the middle, is a
 * thing to argue with rather than to check. Three short confirmations are
 * something an athlete can glance at and know whether to keep talking.
 *
 * A field is shown when it has an answer and left out when it does not,
 * because an empty row with a question mark on it is a placeholder pretending
 * to be information.
 */
export function understoodLines(selection: PickerSelection): string[] {
  var out: string[] = [];
  if (!selection) return out;

  if (selection.space) out.push(SPACE_WORD[selection.space] + ' ✓');
  if (selection.duration) out.push(DURATION_WORD[selection.duration] + ' ✓');
  if (selection.focus) out.push(titleCase(FOCUS_WORD[selection.focus]) + ' ✓');

  return out;
}

function titleCase(word: string): string {
  if (!word) return '';
  return word.charAt(0) + word.substring(1).toLowerCase();
}

/**
 * Why what they asked for is not on offer here.
 *
 * Said on the panel as well as out loud. A refusal that exists only in the
 * coach's voice is no refusal at all to somebody who has the sound off, or
 * who is in a gym - they asked to run, the run is not there, and nothing on
 * the screen says why.
 *
 * Short, and about the room rather than about them.
 */
export function voiceRefusalFor(focus: Focus, space: Space): string {
  if (!focus || !space || focusFitsSpace(focus, space)) return '';

  return focus === 'RUNNING'
    ? 'Running needs more room than this.'
    : 'That needs more room than this.';
}

/**
 * The one question worth asking out loud, or ''.
 *
 * One, never two. An athlete who said "twenty minutes" and gets asked about
 * space and then focus has been put through the button flow with their voice,
 * which is slower than the buttons and less certain. So the highest-priority
 * gap is asked, and whatever is still missing after that is a screen with the
 * answers already on it.
 */
export function voiceQuestionFor(missing: PickerField[]): string {
  if (!missing || missing.length === 0) return '';

  switch (missing[0]) {
    case 'SPACE':    return 'How much space have you got?';
    case 'DURATION': return 'How long have you got?';
    case 'FOCUS':    return 'What do you want to work on?';
    default:         return '';
  }
}

export function stepSummaryOf(selection: PickerSelection): string {
  var parts: string[] = [];

  if (selection.space) parts.push(SPACE_WORD[selection.space]);
  if (selection.duration) parts.push(DURATION_WORD[selection.duration]);

  return parts.length > 0 ? parts.join(' · ') : '';
}
