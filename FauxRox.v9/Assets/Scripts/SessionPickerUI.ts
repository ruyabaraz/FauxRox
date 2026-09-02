// ============================================================================
// SessionPickerUI.ts — "How are you training today?"
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Two verbs on one panel. Race Day is the full course, unscaled, and it is
// what counts for the leaderboard and the personal best. Training is a shorter
// session composed for the space the athlete has, the time they have and what
// they want to work on.
//
// Nothing is preselected. Opening with Race Day already chosen showed a goal
// row before the athlete had said they were racing, which reads as the panel
// having decided for them.
//
// Follows the OnboardingPanel pattern: labelled rows of mutually exclusive
// RectangleButtons, bound the same way OnboardingUI binds its groups. Every
// input is optional so a half-wired panel degrades instead of throwing.
//
// Rows appear only when they mean something. Race Day asks what the athlete is
// racing for; Training asks how the session should be built. Neither question
// makes sense on the other side — "beat your PB" is meaningless in a five
// minute engine session, and a focus preference is meaningless in a race that
// is always the same eight stations.
//
// The focus row is hidden entirely in a small space. With only a handful of
// stationary stations to draw from, all three focuses converge on the same
// workout - offering a choice that changes nothing reads as broken, and
// greying it out only raises "why can't I pick that?". The environment is a
// harder constraint than the preference, so the preference disappears.
// ============================================================================

import {
  generateSession,
  Space,
  Duration,
  Focus,
  Level,
  SessionRequest,
  focusFitsSpace,
} from './AdaptiveSessionGenerator';

import {
  PickerFlow,
  PickerState,
  readySummaryOf,
  PickerSelection,
  stepSummaryOf,
  understoodLines,
  voiceQuestionFor,
  voiceRefusalFor,
  VoiceIntent,
} from './PickerFlow';
import { SessionPlan } from './SessionTypes';
import { PaceTarget, formatPaceBand, provenanceOfTarget } from './PaceTarget';
import {
  parseFiveKEntry,
  formatFiveKTime,
  formatFiveKDigits,
  stepFiveK,
  FIVE_K_START_SECONDS,
  FIVE_K_COARSE_STEP_SECONDS,
  FIVE_K_FINE_STEP_SECONDS,
} from './PaceEvidence';
import { ProfileManager, GoalType } from './ProfileManager';

/**
 * Race Day is the course as raced; Training is a generated session.
 * UNSET is the opening state - nothing below the mode row means anything
 * until the athlete has said which of the two they are doing.
 */
export type PickerMode = 'UNSET' | 'RACE' | 'TRAINING';

/** Brand accent, #D5FF2F — headings and the current selection */
const ACCENT = new vec4(0.835, 1.0, 0.184, 1.0);
/** Everything unselected */
const PLAIN = new vec4(1.0, 1.0, 1.0, 1.0);

@component
export class SessionPickerUI extends BaseScriptComponent {

  // ── References ──────────────────────────────────────────────────────────

  @ui.separator
  @ui.label('Session Picker')

  /** CourseManager — supplies the station pool and loads the chosen plan */
  @input @allowUndefined courseManagerScript: ScriptComponent;

  /**
   * ProfileManager — the athlete's fitness level sizes the session. Optional:
   * with no profile the generator falls back to a regular-level workout.
   */
  @input @allowUndefined profileManager: ProfileManager;

  /** Frame — the whole picker, shown and hidden as one */
  @input @allowUndefined panelRoot: SceneObject;

  /** Panel heading — what this screen is asking */
  @input @allowUndefined headerText: Text;

  /** The heading itself. Short, because it sits at title weight. */
  @input headerLabel: string = "TODAY'S SESSION";

  // ── Mode ────────────────────────────────────────────────────────────────

  @ui.separator
  @ui.label('Mode')

  @input @allowUndefined modeGroup: SceneObject;
  @input @allowUndefined raceDayButton: ScriptComponent;
  @input @allowUndefined trainingButton: ScriptComponent;

  // ── Goal ────────────────────────────────────────────────────────────────

  @ui.separator
  @ui.label('Goal (race day only)')

  @input @allowUndefined goalGroup: SceneObject;
  @input @allowUndefined finishStrongButton: ScriptComponent;
  @input @allowUndefined beatPBButton: ScriptComponent;
  @input @allowUndefined maxEffortButton: ScriptComponent;
  @input @allowUndefined pacingButton: ScriptComponent;

  // ── Space ───────────────────────────────────────────────────────────────

  @ui.separator
  @ui.label('Space (training only)')

  @input @allowUndefined spaceGroup: SceneObject;
  @input @allowUndefined smallSpaceButton: ScriptComponent;
  @input @allowUndefined normalSpaceButton: ScriptComponent;

  // ── Time ────────────────────────────────────────────────────────────────

  @ui.separator
  @ui.label('Time (training only)')

  @input @allowUndefined timeGroup: SceneObject;
  @input @allowUndefined shortButton: ScriptComponent;
  @input @allowUndefined mediumButton: ScriptComponent;
  @input @allowUndefined fullButton: ScriptComponent;

  // ── Focus ───────────────────────────────────────────────────────────────

  @ui.separator
  @ui.label('Focus (training only; running needs space)')

  /** The whole focus row — shown for training, whatever the space */
  @input @allowUndefined focusGroup: SceneObject;
  @input @allowUndefined runningButton: ScriptComponent;
  @input @allowUndefined engineButton: ScriptComponent;
  @input @allowUndefined strengthButton: ScriptComponent;
  @input @allowUndefined mixedButton: ScriptComponent;

  // ── Output ──────────────────────────────────────────────────────────────

  @ui.separator
  @ui.label('Output')

  /**
   * Live preview of the selection, e.g.
   * "7 min · 5 stations · open space · scaled for Regular".
   *
   * This is the only place that says something the buttons do not: minutes,
   * station count and the level the profile supplies. A separate title was
   * tried and removed — it only ever repeated the selection sitting right
   * below it.
   */
  @input @allowUndefined summaryText: Text;

  // ── Progressive disclosure ──────────────────────────────────────────────
  //
  // What has been answered, collapsed to one line above the question being
  // asked. "Open space · Short", small, out of the way.

  @ui.separator
  @ui.label('Progressive disclosure')

  @input @allowUndefined stepSummaryText: Text;

  // ── Ready ───────────────────────────────────────────────────────────────
  //
  // A state of its own rather than more content under the selectors. The
  // configuration groups go away entirely; what is left is the session.

  @ui.separator
  @ui.label('Ready state')

  @input @allowUndefined readyGroup: SceneObject;
  @input @allowUndefined readyEyebrowText: Text;
  @input @allowUndefined readyHeadlineText: Text;
  @input @allowUndefined readyMetaPrimaryText: Text;
  @input @allowUndefined readyMetaSecondaryText: Text;
  @input @allowUndefined readyEffortText: Text;
  @input @allowUndefined editButton: ScriptComponent;

  // ── Talking to the coach ────────────────────────────────────────────────
  //
  // A second way in, beside the buttons rather than instead of them. The
  // athlete says what they are up for, the app holds whatever was in the
  // sentence, and anything still missing is asked - once out loud, and then
  // as the buttons that were there all along.
  //
  // Prominent on the first question and small after it: somebody two answers
  // deep has already chosen how they are doing this.

  @ui.separator
  @ui.label('Talk to coach')

  /** AICoach - optional, and with none of it wired the panel is the buttons */
  @input @allowUndefined aiCoachScript: ScriptComponent;

  /** The big one, on the first training question */
  @input @allowUndefined talkToCoachButton: ScriptComponent;
  /** The small one, once they are already answering */
  @input @allowUndefined voiceMicButton: ScriptComponent;

  @input @allowUndefined listeningGroup: SceneObject;
  /** What to say, and then whatever the coach asked back */
  @input @allowUndefined listeningPromptText: Text;
  /** What has been understood so far, one line each */
  @input @allowUndefined listeningUnderstoodText: Text;

  @input listeningPrompt: string = "Tell me what you're up for";

  /** How long a turn waits before handing the athlete back to the buttons */
  @input listeningTimeoutSeconds: number = 12;

  // ── Pace evidence ───────────────────────────────────────────────────────
  //
  // "Know your recent 5K time?", asked once, of somebody who has just chosen
  // a running session. Not at onboarding: a person setting the app up has not
  // decided they are a runner yet, and a 5K time means nothing to them until
  // they have. Skipping is a complete answer - most people do not have a
  // recent 5K, and a run with no pace target is still a run.

  @ui.separator
  @ui.label('Pace evidence (running only, asked once)')

  @input @allowUndefined paceOfferGroup: SceneObject;
  /** The question, and where a mistyped time gets answered */
  @input @allowUndefined paceOfferPromptText: Text;
  @input paceOfferPrompt: string = 'Know your recent 5K time?';

  /**
   * Forget any stored 5K when the Lens starts, and ask again.
   *
   * For testing the question, and for anybody whose profile has a time on it
   * they did not enter. Off by default: an athlete's evidence is theirs, and
   * a switch that silently wiped it every launch would be the same bug in the
   * other direction.
   */
  @input forgetPaceEvidenceOnStart: boolean = false;
  /**
   * The time itself, as a stepper.
   *
   * A keyboard does not exist in the editor preview and is a heavy thing to
   * raise on a pair of glasses for four digits. Four taps and no modal, and
   * the question can be answered where it is asked.
   */
  @input @allowUndefined fiveKValueText: Text;
  @input @allowUndefined fiveKMinuteDownButton: ScriptComponent;
  @input @allowUndefined fiveKMinuteUpButton: ScriptComponent;
  @input @allowUndefined fiveKSecondDownButton: ScriptComponent;
  @input @allowUndefined fiveKSecondUpButton: ScriptComponent;

  /**
   * Type it instead, on the glasses.
   *
   * Raises the AR keyboard as a numeric keypad - six keys and a done, rather
   * than a full keyboard hanging in the air - and reads four digits the way a
   * stopwatch shows them. The keypad has no colon and does not need one.
   *
   * The keyboard does not exist in the editor preview, which is why the
   * stepper above it does. Neither replaces the other: one is the way to
   * answer on a device, the other is the way to answer anywhere.
   */
  @input @allowUndefined fiveKKeyboardButton: ScriptComponent;

  /** A UIKit text field, where a scene has one wired instead */
  @input @allowUndefined fiveKInputField: ScriptComponent;
  @input @allowUndefined paceAddButton: ScriptComponent;
  @input @allowUndefined paceSkipButton: ScriptComponent;

  /**
   * Where the paces come from, on the ready panel only.
   *
   * Never on the running HUD. Mid-rep is not the moment to explain the
   * derivation, and an athlete deciding whether to trust a target is doing it
   * here, before they start.
   */
  @input @allowUndefined paceProvenanceText: Text;

  @input @allowUndefined startButton: ScriptComponent;
  @input @allowUndefined backButton: ScriptComponent;

  // ── Settings ────────────────────────────────────────────────────────────

  @ui.separator
  @ui.label('Settings')

  /**
   * How long a screen ignores presses after it appears.
   *
   * A pinch that chose the last answer is still in progress when the next
   * screen is drawn, and its release lands on whatever is now under the
   * finger. That is how the 5K question got declined the instant it was
   * asked: one pinch chose RUNNING and dismissed the question that choosing
   * RUNNING had just raised.
   *
   * Short enough that nobody deliberate is refused, long enough to outlast
   * the release of the press that got them here.
   */
  @input screenSettleSeconds: number = 0.5;

  @input debugPrint: boolean = true;

  // ── State ───────────────────────────────────────────────────────────────

  /**
   * Where the athlete is in the flow, and what they have answered.
   *
   * The panel used to hold five fields and recompute six visibility flags
   * from them on every change. Six groups have sixty-four combinations, six
   * of which are screens somebody designed. The flow owns the state now and
   * this file only renders it.
   */
  private _flow: PickerFlow = new PickerFlow();

  private _goal: GoalType = 'finish_strong';

  /** Varies the workout between sessions without breaking determinism */
  private _seed: number = 0;
  private _lastLoggedSeed: number = -1;

  private _preview: SessionPlan = null;

  /** Which screen is up, and since when */
  private _shownState: PickerState = 'MODE';
  private _shownAt: number = 0;

  /**
   * Whether this screen has been up long enough to have been answered.
   *
   * The release of the pinch that got them here is not an answer to what it
   * revealed.
   */
  private settled(): boolean {
    return getTime() - this._shownAt >= this.screenSettleSeconds;
  }

  private onStartCallback: (plan: SessionPlan) => void = null;
  private onBackCallback: () => void = null;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => this.onStart());
  }

  private onStart(): void {
    this.bindButton(this.raceDayButton, () => this.selectMode('RACE'));
    this.bindButton(this.trainingButton, () => this.selectMode('TRAINING'));

    this.bindButton(this.finishStrongButton, () => this.selectGoal('finish_strong'));
    this.bindButton(this.beatPBButton, () => this.selectGoal('beat_pb'));
    this.bindButton(this.maxEffortButton, () => this.selectGoal('max_effort'));
    this.bindButton(this.pacingButton, () => this.selectGoal('pacing'));

    this.bindButton(this.smallSpaceButton, () => this.selectSpace('SMALL'));
    this.bindButton(this.normalSpaceButton, () => this.selectSpace('NORMAL'));

    this.bindButton(this.shortButton, () => this.selectDuration('SHORT'));
    this.bindButton(this.mediumButton, () => this.selectDuration('MEDIUM'));
    this.bindButton(this.fullButton, () => this.selectDuration('FULL'));

    this.bindButton(this.runningButton, () => this.selectFocus('RUNNING'));
    this.bindButton(this.engineButton, () => this.selectFocus('ENGINE'));
    this.bindButton(this.strengthButton, () => this.selectFocus('STRENGTH'));
    this.bindButton(this.mixedButton, () => this.selectFocus('MIXED'));

    this.bindButton(this.paceAddButton, () => this.acceptFiveK());
    this.bindButton(this.paceSkipButton, () => this.declineFiveK());

    this.bindButton(this.fiveKMinuteDownButton,
      () => this.stepFiveKBy(-FIVE_K_COARSE_STEP_SECONDS));
    this.bindButton(this.fiveKMinuteUpButton,
      () => this.stepFiveKBy(FIVE_K_COARSE_STEP_SECONDS));
    this.bindButton(this.fiveKSecondDownButton,
      () => this.stepFiveKBy(-FIVE_K_FINE_STEP_SECONDS));
    this.bindButton(this.fiveKSecondUpButton,
      () => this.stepFiveKBy(FIVE_K_FINE_STEP_SECONDS));

    this.bindButton(this.fiveKKeyboardButton, () => this.openFiveKKeyboard());
    this.bindFiveKInput();

    // A state with no interface behind it is a dead end, so the flow is told
    // whether this panel can actually ask. A scene that predates these inputs
    // goes straight from focus to ready, exactly as it did.
    this._flow.setPaceOfferAvailable(this.canOfferPace());

    this.bindButton(this.talkToCoachButton, () => this.startListening());
    this.bindButton(this.voiceMicButton, () => this.startListening());
    this.bindCoachIntent();

    this.bindButton(this.startButton, () => this.confirm());
    this.bindButton(this.editButton, () => this.editSelection());
    this.bindButton(this.backButton, () => this.goBack());

    if (this.profileManager && this.profileManager.hasProfile()) {
      this._goal = this.profileManager.getGoal();
    }

    if (this.forgetPaceEvidenceOnStart && this.profileManager &&
        (this.profileManager as any).clearPaceEvidence) {
      this.log('forgetPaceEvidenceOnStart is on - clearing the stored 5K');
      (this.profileManager as any).clearPaceEvidence();
    }

    this.hide();
    this.clearBackTarget();
    this.refresh();

    this.log('Initialized');
  }

  // ── Public API ──────────────────────────────────────────────────────────

  show(): void {
    if (this.panelRoot) this.panelRoot.enabled = true;

    // Asked at most once, ever. Read at the top of the flow rather than at
    // the moment of asking so that answering it in one session is remembered
    // in the next.
    this._flow.setPaceOfferPending(
      !!this.profileManager && (this.profileManager as any).shouldOfferPace === true);

    this.refresh();
    this.log('Shown');
  }

  hide(): void {
    // A microphone left open behind a closed panel is the coach listening to
    // a room nobody is talking to it in.
    if (this._flow.isListening) this.stopListening();

    if (this.panelRoot) this.panelRoot.enabled = false;
  }

  get isVisible(): boolean {
    return this.panelRoot ? this.panelRoot.enabled : false;
  }

  /**
   * Vary the generated workout between sessions. Same seed, same workout —
   * pass something that changes as the athlete trains, such as how many races
   * they have finished.
   */
  setSeed(seed: number): void {
    this._seed = seed | 0;
    this.refresh();
  }

  /** The plan the current selection would produce, without committing to it */
  get previewPlan(): SessionPlan {
    return this._preview;
  }

  /**
   * Move the dials on the athlete's behalf.
   *
   * The coach never writes a workout — it chooses the same three parameters a
   * person would choose, and the generator builds from them. The panel then
   * opens showing exactly what was picked, so the athlete can see the
   * reasoning, change any of it, or just press START. Nothing is committed
   * until they do.
   */
  applyPrescription(space: Space, duration: Duration, focus: Focus, note?: string): void {
    this._flow.applyPrescription(space, duration, focus);
    this._prescriptionNote = note || '';

    this.log('Prescribed: ' + space + ' / ' + duration + ' / ' + this._flow.selection.focus);

    this.show();
  }

  /** Why the coach picked this, shown under the summary until changed */
  private _prescriptionNote: string = '';

  /**
   * The station the last verdict named as the limiter. Sessions built while
   * this is set prefer the accessories that develop it.
   */
  private _limiterPrefabType: string = '';

  /**
   * Movements from the athlete's last training session.
   *
   * Passed to the generator so equally suitable movements that were just done
   * are pushed down. Never strong enough to override the space, focus or
   * limiter constraints - it only breaks ties.
   */
  private _recentMovements: string[] = [];

  setRecentMovements(movements: string[]): void {
    this._recentMovements = movements || [];
  }

  /** Told by RaceStateMachine once a race has produced a verdict */
  setLimiter(prefabType: string): void {
    this._limiterPrefabType = prefabType || '';
    if (this._limiterPrefabType) {
      this.log('Limiter: ' + this._limiterPrefabType);
    }
  }

  onSessionStart(callback: (plan: SessionPlan) => void): void {
    this.onStartCallback = callback;
  }

  onBack(callback: () => void): void {
    this.onBackCallback = callback;
  }

  /**
   * Give BACK somewhere to return to, and show it. Cleared whenever the picker
   * is opened normally: in the pre-race flow the picker is the only thing on
   * screen, and a button that hides the panel and leaves the athlete staring
   * at nothing is worse than no button.
   */
  setBackTarget(callback: () => void): void {
    this.onBackCallback = callback;
    if (this.backButton) {
      var obj = this.backButton.getSceneObject();
      if (obj) obj.enabled = true;
    }
  }

  private clearBackTarget(): void {
    this.onBackCallback = null;
    if (this.backButton) {
      var obj = this.backButton.getSceneObject();
      if (obj) obj.enabled = false;
    }
  }

  // ── Selection ───────────────────────────────────────────────────────────

  private selectMode(mode: PickerMode): void {
    if (mode === 'UNSET') return;

    this._prescriptionNote = '';
    this._flow.chooseMode(mode === 'RACE' ? 'RACE' : 'TRAINING');
    this.log('Mode: ' + mode);
    this.refresh();
  }

  /** What the athlete is about to start */
  get mode(): PickerMode {
    if (this._flow.state === 'MODE') return 'UNSET';
    return this._flow.state === 'RACE' ? 'RACE' : 'TRAINING';
  }

  /** Where the athlete is in the flow, for anything that needs to know */
  get state(): PickerState {
    return this._flow.state;
  }

  /**
   * Race intent. Stored on the profile so the coach reads it in context, but
   * asked here rather than at onboarding: what someone is racing for changes
   * from one attempt to the next, unlike who they are.
   */
  private selectGoal(goal: GoalType): void {
    if (this._flow.state !== 'RACE') return;

    this._goal = goal;
    this._prescriptionNote = '';

    if (this.profileManager && this.profileManager.hasProfile()) {
      this.profileManager.updateProfile({ goal: goal });
    }

    this.log('Goal: ' + goal);
    this.refresh();
  }

  /** The race intent currently selected */
  get goal(): GoalType {
    return this._goal;
  }

  /**
   * Whether a focus can be trained in this much room.
   *
   * One rule, asked in every place the answer matters, so the button, the
   * click handler and the coach's prescription cannot disagree.
   */
  private setButtonVisible(button: ScriptComponent, visible: boolean): void {
    if (!button) return;

    var obj: SceneObject = null;
    try {
      obj = button.getSceneObject();
    } catch (e) {
      return;
    }
    if (isNull(obj)) return;

    obj.enabled = visible;
  }

  private selectSpace(space: Space): void {
    if (!this._flow.isTraining) return;
    this._prescriptionNote = '';

    // Only running needs ground. Where a room makes it impossible the flow
    // clears the focus rather than substituting one - the athlete chose
    // running, and quietly starting them on something else is worse than
    // asking again.
    this._flow.chooseSpace(space);

    this.log('Space: ' + space);
    this.refresh();
  }

  private selectDuration(duration: Duration): void {
    if (!this._flow.isTraining) return;
    this._prescriptionNote = '';
    this._flow.chooseDuration(duration);
    this.log('Time: ' + duration);
    this.refresh();
  }

  private selectFocus(focus: Focus): void {
    if (!this._flow.isTraining) return;
    this._prescriptionNote = '';
    this._flow.chooseFocus(focus);
    this.log('Focus: ' + focus);
    this.refresh();
  }

  /** Back to the last question, with every answer still standing */
  private editSelection(): void {
    this._flow.edit();
    this.log('Editing');
    this.refresh();
  }

  // ── Rendering ───────────────────────────────────────────────────────────

  /**
   * Show the state the flow is in, and nothing else.
   *
   * One group per state rather than a set of conditions per group. The old
   * version computed six visibility flags from five fields on every change,
   * which is a way of describing a screen that has no name and cannot be
   * checked - and the screens that came out of it were the ones nobody chose.
   */
  private refresh(): void {
    var state = this._flow.state;
    var selection = this._flow.selection;

    // A screen that has just appeared has not been pressed yet, whatever the
    // hand is doing.
    if (state !== this._shownState) {
      this._shownState = state;
      this._shownAt = getTime();
    }

    // A session is only generated once there is enough to generate one. The
    // old picker rebuilt it on every keypress, including while the athlete
    // was still deciding what room they were in.
    this._preview = state === 'TRAINING_READY' || state === 'RACE'
      ? this.buildPreview()
      : null;

    var racing = state === 'RACE';

    this.setSelected(this.raceDayButton, racing);
    this.setSelected(this.trainingButton, this._flow.isTraining);

    // Mode is only a question until it has been answered.
    this.setGroupVisible(this.modeGroup, state === 'MODE');
    this.setGroupVisible(this.goalGroup, racing);

    // One question at a time.
    this.setGroupVisible(this.spaceGroup, state === 'TRAINING_SPACE');
    this.setGroupVisible(this.timeGroup, state === 'TRAINING_TIME');
    this.setGroupVisible(this.focusGroup, state === 'TRAINING_FOCUS');
    this.setGroupVisible(this.paceOfferGroup, state === 'TRAINING_PACE_OFFER');
    this.setGroupVisible(this.listeningGroup, state === 'TRAINING_LISTENING');

    // Prominent where the athlete has not started answering, small once they
    // have. The same turn either way; the second one is an offer rather than
    // an invitation.
    //
    // Where there is no small one, the big one stays. Somebody who answered
    // the first question by hand and wanted to say the rest out loud found
    // the microphone gone, which is not "less prominent", it is absent.
    var answering = state === 'TRAINING_TIME' || state === 'TRAINING_FOCUS';

    this.setButtonVisible(this.talkToCoachButton,
      this.canListen() &&
      (state === 'TRAINING_SPACE' || (answering && !this.voiceMicButton)));

    this.setButtonVisible(this.voiceMicButton, answering && this.canListen());

    this.renderListening();

    // The prompt doubles as where a mistyped time is answered, so it goes
    // back to being a question whenever the athlete is not in front of it.
    if (state !== 'TRAINING_PACE_OFFER') {
      this.setText(this.paceOfferPromptText, this.paceOfferPrompt);
    }

    this.renderFiveK();
    this.setGroupVisible(this.readyGroup, state === 'TRAINING_READY');

    if (racing) {
      this.setSelected(this.finishStrongButton, this._goal === 'finish_strong');
      this.setSelected(this.beatPBButton, this._goal === 'beat_pb');
      this.setSelected(this.maxEffortButton, this._goal === 'max_effort');
      this.setSelected(this.pacingButton, this._goal === 'pacing');
    }

    this.setSelected(this.smallSpaceButton, selection.space === 'SMALL');
    this.setSelected(this.normalSpaceButton, selection.space === 'NORMAL');

    this.setSelected(this.shortButton, selection.duration === 'SHORT');
    this.setSelected(this.mediumButton, selection.duration === 'MEDIUM');
    this.setSelected(this.fullButton, selection.duration === 'FULL');

    // Running is the one focus a room cannot hold, so it is the one button
    // that goes away - rather than the whole row, which used to leave a small
    // space with no say in what it trained at all.
    this.setButtonVisible(this.runningButton,
      !selection.space || focusFitsSpace('RUNNING', selection.space));

    this.setSelected(this.runningButton, selection.focus === 'RUNNING');
    this.setSelected(this.engineButton, selection.focus === 'ENGINE');
    this.setSelected(this.strengthButton, selection.focus === 'STRENGTH');
    this.setSelected(this.mixedButton, selection.focus === 'MIXED');

    this.setButtonVisible(this.startButton, state === 'TRAINING_READY' || racing);
    this.setButtonVisible(this.editButton, state === 'TRAINING_READY');

    this.renderHeader(state);
    this.renderReady(selection);
    this.renderSummary(state);
  }

  /** The question being asked, and the answers already given */
  private renderHeader(state: PickerState): void {
    if (this.headerText) {
      this.headerText.text = this._flow.isTraining ? 'TRAINING' : this.headerLabel;
    }

    if (this.stepSummaryText) {
      // Only while there are still questions. On the ready panel the answers
      // are the content rather than a note above it.
      var line = this._flow.isConfiguring
        ? stepSummaryOf(this._flow.selection)
        : '';

      this.stepSummaryText.text = line;
      this.setTextVisible(this.stepSummaryText, line !== '');
    }
  }

  /**
   * The ready panel, as fields.
   *
   * Filled even when hidden: a group toggled on mid-frame showing the
   * previous session's numbers is a worse bug than an empty one, because it
   * looks right.
   */
  private renderReady(selection: PickerSelection): void {
    var summary = readySummaryOf(this._preview, selection);

    this.setText(this.readyEyebrowText, summary.eyebrow);
    this.setText(this.readyHeadlineText, summary.headline);
    this.setText(this.readyMetaPrimaryText, summary.metaPrimary);
    this.setText(this.readyMetaSecondaryText, summary.metaSecondary);
    this.setText(this.readyEffortText, summary.effort);
    this.renderProvenance(selection);
  }

  /**
   * The pace they are being asked for, and where it came from.
   *
   * Here rather than on the running HUD. Mid-repetition is not the moment to
   * explain a derivation, and an athlete deciding whether to trust a target
   * is doing it now, before they start.
   *
   * Only for running, and only when there is a target at all - "based on your
   * recent 5K" under a strength session is a sentence about nothing, and a
   * session with no target says nothing rather than showing a model's guess.
   */
  private renderProvenance(selection: PickerSelection): void {
    if (!this.paceProvenanceText) return;

    var target = selection.focus === 'RUNNING' ? this.previewPaceTarget() : null;
    var line = target
      ? formatPaceBand(target) + ' · ' + provenanceOfTarget(target)
      : '';

    this.paceProvenanceText.text = line;
    this.setTextVisible(this.paceProvenanceText, line !== '');
  }

  /** The target the session in front of the athlete is actually prescribed at */
  private previewPaceTarget(): PaceTarget {
    var plan = this._preview;
    if (!plan || !plan.blocks) return null;

    for (var i = 0; i < plan.blocks.length; i++) {
      if (plan.blocks[i].paceTarget) return plan.blocks[i].paceTarget;
    }

    return null;
  }

  /**
   * The one line that is not part of a state.
   *
   * It used to carry the generated rationale, which ends in a coaching
   * sentence three lines long. That belongs in the athlete's ear when the
   * work starts, not on a panel they glance at while deciding - and it is
   * already there, said by the coach as the working set begins.
   */
  private renderSummary(state: PickerState): void {
    if (!this.summaryText) return;

    var line = '';

    if (state === 'MODE') {
      line = 'Race Day, or a training session?';
    } else if (state === 'TRAINING_LISTENING' && !this.listeningPromptText) {
      // No card wired, so the turn happens on the one line every scene has.
      // One writer per readout: the listening text goes through here rather
      // than being written by two functions that disagree on odd frames.
      var understood = understoodLines(this._flow.selection);
      line = understood.length > 0
        ? this.listeningLine() + '\n' + understood.join(' · ')
        : this.listeningLine();
    } else if (state === 'RACE') {
      line = this._preview ? this._preview.title : 'No session available';
    } else if (state === 'TRAINING_READY' && !this._preview) {
      line = 'No session available';
    }

    if (this._prescriptionNote && state === 'TRAINING_READY') {
      line = line ? this._prescriptionNote + '\n' + line : this._prescriptionNote;
    }

    this.summaryText.text = line;
    this.setTextVisible(this.summaryText, line !== '');
  }

  private setGroupVisible(group: SceneObject, visible: boolean): void {
    if (!group || isNull(group)) return;
    group.enabled = visible;
  }

  private setText(text: Text, value: string): void {
    if (text) text.text = value;
  }

  private setTextVisible(text: Text, visible: boolean): void {
    if (!text) return;

    var obj: SceneObject = null;
    try {
      obj = text.getSceneObject();
    } catch (e) {
      return;
    }
    if (isNull(obj)) return;

    obj.enabled = visible;
  }

  private buildPreview(): SessionPlan {
    if (this._flow.state === 'MODE') return null;
    if (this._flow.isTraining && !this._flow.isComplete) return null;

    var course = this.courseManagerScript as any;
    if (!course) {
      this.log('CourseManager not available — cannot preview');
      return null;
    }

    // Race Day is never generated and never scaled — it is the course as
    // raced, which is what keeps leaderboard times comparable.
    if (this._flow.state === 'RACE') {
      return course.buildRacePlan ? course.buildRacePlan() : null;
    }

    if (!course.getGeneratorInput) {
      this.log('CourseManager cannot supply a station pool');
      return null;
    }

    var request: SessionRequest = {
      space: this._flow.selection.space as Space,
      duration: this._flow.selection.duration as Duration,
      focus: this._flow.selection.focus as Focus,
      level: this.athleteLevel(),
      seed: this._seed,
    };

    try {
      var genInput = course.getGeneratorInput(this._limiterPrefabType);
      genInput.recentMovements = this._recentMovements;

      // What the athlete did last, and how long ago. Two sessions in a row
      // are not two independent draws: the same one twice is a smaller
      // training week than two different ones, and a hard session the day
      // after a hard session is how a block becomes an injury.
      if (this.profileManager && (this.profileManager as any).schedulingContext) {
        genInput.history = (this.profileManager as any).schedulingContext;
      }

      // Their own paces where they have given us something to derive them
      // from, and none at all where they have not. The generator prescribes
      // distances either way; only the targets alongside them depend on this.
      var anchors = this.paceAnchors();
      if (anchors.length > 0) genInput.paceAnchors = anchors;

      // What was decided and why, on the glasses, where it cannot otherwise
      // be seen. A running session that comes out easy every time is either
      // the draw or the history, and those are two different bugs.
      genInput.log = (line: string) => this.log(line);

      // Whether the draw moved at all since last time. A seed that never
      // changes hands out the same session forever, and from the outside
      // that looks like the generator having one idea.
      if (this._seed !== this._lastLoggedSeed) {
        this._lastLoggedSeed = this._seed;
        this.log('Draw seed is now ' + this._seed);
      }

      return generateSession(genInput, request);
    } catch (e) {
      this.log('Preview failed: ' + e);
      return null;
    }
  }

  /**
   * The athlete's level, from the profile they set during onboarding. This is
   * the one place the profile reaches into workout generation — everything
   * else it holds is either identity or heart rate maths.
   */
  private athleteLevel(): Level {
    if (!this.profileManager || !this.profileManager.hasProfile()) return 'REGULAR';

    switch (this.profileManager.getFitnessLevel()) {
      case 'beginner': return 'BEGINNER';
      case 'athlete':  return 'ATHLETE';
      default:         return 'REGULAR';
    }
  }

  // ── Talking to the coach ────────────────────────────────────────────────

  /**
   * True when there is a coach to talk to and a way to start.
   *
   * A button and a coach, and nothing else required. The turn has somewhere
   * to be shown either way: its own fields where a scene has them, and the
   * summary line - which every scene has - where it does not. Demanding the
   * whole card before the microphone would work at all meant a panel with a
   * button on it and no way to press it into anything.
   */
  private canListen(): boolean {
    return !!(this.aiCoachScript && (this.talkToCoachButton || this.voiceMicButton));
  }

  /**
   * Hand the microphone to the athlete for one turn.
   *
   * The flow changes state first and the coach second: a microphone that
   * fails to open must still leave the panel somewhere sensible, and the
   * panel is what the athlete is looking at.
   */
  private startListening(): void {
    if (!this.canListen()) return;

    this._refusalLine = '';
    this._voiceQuestionsAsked = 0;
    this._flow.listen();
    this.refresh();

    var coach = this.aiCoachScript as any;
    // The panel draws this turn: its indicator sits beside the question being
    // answered, and the coach's own belongs to the workout HUD.
    var listening = coach && coach.beginSessionTurn
      ? coach.beginSessionTurn('PICKER') === true
      : false;

    if (!listening) {
      this.log('Coach cannot listen - back to the buttons');
      this._flow.endListening();
      this.refresh();
      return;
    }

    this.armListeningTimeout();
  }

  /**
   * Wherever a turn goes quiet, it ends.
   *
   * A microphone that stays open because nothing was said is the athlete
   * standing in front of a panel that is waiting for them, with no way to
   * tell that it is. The buttons come back instead.
   */
  private armListeningTimeout(): void {
    this._listeningTurn++;
    var turn = this._listeningTurn;

    var wait = this.createEvent('DelayedCallbackEvent');
    wait.bind(() => {
      if (turn !== this._listeningTurn) return;
      if (!this._flow.isListening) return;

      this.log('Nothing said - back to the buttons');
      this.stopListening();
    });
    wait.reset(Math.max(4, this.listeningTimeoutSeconds));
  }

  /** Which turn is current, so an old timer cannot end a new turn */
  private _listeningTurn: number = 0;

  /** How many things have been asked out loud in this turn. At most one. */
  private _voiceQuestionsAsked: number = 0;

  private stopListening(): void {
    this._listeningTurn++;

    var coach = this.aiCoachScript as any;
    if (coach && coach.endSessionTurn) coach.endSessionTurn();

    this._flow.endListening();
    this.refresh();
  }

  /**
   * What the athlete said, as much of it as was about the session.
   *
   * Returns what is still missing, which is what the coach is told to ask
   * about next - one question, and only where there is one. Nothing about a
   * session is decided here or there: the flow holds the answers and the
   * generator builds from them.
   */
  private bindCoachIntent(): void {
    var coach = this.aiCoachScript as any;
    if (!coach || !coach.onSessionIntent) return;

    coach.onSessionIntent((space: string, duration: string, focus: string) => {
      var intent: VoiceIntent = {};
      if (space) intent.space = space as Space;
      if (duration) intent.duration = duration as Duration;
      if (focus) intent.focus = focus as Focus;

      // Said outside the panel, or after it closed. Held rather than acted
      // on: the athlete is not looking at this.
      if (!this._flow.isTraining) {
        return 'The athlete is not setting up a session right now.';
      }

      var asked = this._flow.selection;
      var wantedRunning = intent.focus === 'RUNNING';

      this._flow.applyVoiceIntent(intent);
      this._listeningTurn++;

      var missing = this._flow.unanswered;

      // A room is a fact. Where it took the run away, that is the thing to
      // say - not silently the next question, which would leave them
      // wondering what happened to the run they asked for.
      var refused = wantedRunning && this._flow.selection.focus === null;

      // Said on the panel too. A refusal that exists only in the coach's
      // voice is no refusal at all to somebody with the sound off: they asked
      // to run, the run is not there, and nothing on screen says why.
      this._refusalLine = refused
        ? voiceRefusalFor('RUNNING', this._flow.selection.space as Space)
        : '';

      if (missing.length === 0) {
        this.stopListening();
        return 'Set up and shown to them: ' + this.spokenSelection() +
               '. Say what it is in one short line and that they can start it.';
      }

      var reply = refused
        ? 'Running needs more room than they have. Tell them that in one short ' +
          'line and ask what they want instead. '
        : '';

      // One question out loud, and then the buttons.
      //
      // An athlete who said "twenty minutes" and gets asked about space and
      // then about focus has been walked through the button flow with their
      // voice, which is slower than the buttons and less certain of what it
      // heard. So the highest-priority gap is asked once, and whatever is
      // still missing after that is a screen with their answers already on
      // it and two taps left.
      if (this._voiceQuestionsAsked > 0) {
        this.stopListening();
        return reply + 'Say nothing more. They have ' + missing.join(' and ') +
               ' left and are choosing it on the panel now.';
      }

      this._voiceQuestionsAsked++;

      // Still listening, so the one question can be answered out loud.
      this.armListeningTimeout();
      this.refresh();

      return reply + 'Still missing: ' + missing.join(', ') + '. ' +
             'Ask one short question about ' + missing[0].toLowerCase() +
             ' and nothing else.';
    });
  }

  /** The selection in words, for the coach to read back */
  private spokenSelection(): string {
    var s = this._flow.selection;
    return [s.space, s.duration, s.focus].join(' / ');
  }

  /** Why the last thing they asked for is not on offer, or '' */
  private _refusalLine: string = '';

  private renderListening(): void {
    if (!this._flow.isListening) return;

    // What it has understood, never what it heard. A line of transcript,
    // misheard in the middle, is a thing to argue with rather than to check.
    this.setText(this.listeningUnderstoodText,
      understoodLines(this._flow.selection).join('\n'));

    this.setText(this.listeningPromptText, this.listeningLine());
  }

  /** What to say to somebody who is being listened to */
  private listeningLine(): string {
    var missing = this._flow.unanswered;

    var line = missing.length === 3 && !this._refusalLine
      ? this.listeningPrompt
      : voiceQuestionFor(missing);

    return this._refusalLine ? this._refusalLine + ' ' + line : line;
  }

  // ── Pace evidence ───────────────────────────────────────────────────────

  /** Whatever is in the field right now, read only when ADD is pressed */
  private _fiveKTyped: string = '';

  /** Where the stepper is standing, in seconds */
  private _fiveKStepped: number = FIVE_K_START_SECONDS;

  /**
   * Every part of the question has to be on the panel for it to be asked.
   *
   * Half of it - a way to answer with no way to confirm, or a confirmation
   * with nothing to confirm - is a screen the athlete cannot get out of
   * except by going back.
   *
   * Either way of answering will do. The stepper is the one that works
   * everywhere; the field is for typing it on a device where a keyboard is
   * something the athlete already has open.
   */
  private canOfferPace(): boolean {
    var canAnswer = !!(this.fiveKValueText || this.fiveKInputField);
    return !!(this.paceOfferGroup && canAnswer &&
              this.paceAddButton && this.paceSkipButton);
  }

  private stepFiveKBy(deltaSeconds: number): void {
    this._fiveKStepped = stepFiveK(this._fiveKStepped, deltaSeconds);

    // A tap on the stepper is the answer now, whatever was half-typed before.
    this._fiveKTyped = '';

    this.renderFiveK();
  }

  private renderFiveK(): void {
    this.setText(this.fiveKValueText, formatFiveKTime(this._fiveKStepped));
  }

  private bindFiveKInput(): void {
    if (!this.fiveKInputField) return;

    var field = this.fiveKInputField as any;

    // The same defensive pair the other fields use: UIKit exposes one or the
    // other depending on the version installed.
    var onEdited = (text: string) => { this._fiveKTyped = text || ''; };

    if (field.onTextChanged && field.onTextChanged.add) {
      field.onTextChanged.add(onEdited);
    } else if (field.onValueChanged && field.onValueChanged.add) {
      field.onValueChanged.add(onEdited);
    }
  }

  /**
   * Raise the AR keyboard as a keypad.
   *
   * Numeric, because a 5K time is four digits and a full keyboard hanging in
   * the air for four digits is the reason this question also has a stepper.
   * It opens on whatever the stepper is showing, so somebody who has already
   * got close can correct a digit rather than start again.
   *
   * Nothing here throws where there is no keyboard - the editor preview has
   * none - and the stepper is still standing behind it either way.
   */
  private openFiveKKeyboard(): void {
    var system = this.textInput();
    if (!system || !system.requestKeyboard) {
      this.log('No keyboard available - the stepper is the way in here');
      return;
    }

    try {
      var options = new TextInputSystem.KeyboardOptions();
      options.keyboardType = TextInputSystem.KeyboardType.Num;
      options.returnKeyType = TextInputSystem.ReturnKeyType.Done;
      options.enablePreview = true;
      options.initialText = formatFiveKDigits(this._fiveKStepped);

      options.onTextChanged = (text: string) => {
        this._fiveKTyped = text || '';

        // Show it as a time while they type it as digits, so the thing being
        // entered and the thing being answered are visibly the same thing.
        var reading = parseFiveKEntry(this._fiveKTyped);
        if (reading !== null) {
          this._fiveKStepped = reading;
          this.renderFiveK();
        }
      };

      options.onReturnKeyPressed = () => {
        system.dismissKeyboard();
        this.acceptFiveK();
      };

      options.onError = (code: number, description: string) => {
        this.log('Keyboard error ' + code + ': ' + description);
      };

      system.requestKeyboard(options);
    } catch (e) {
      this.log('Keyboard unavailable: ' + e);
    }
  }

  /**
   * The keyboard system, where this device has one.
   *
   * Asked for on the press rather than held from start-up: the module does
   * not exist in every runtime this panel opens in, and a missing keyboard
   * must cost the picker nothing until somebody actually reaches for it.
   */
  private textInput(): any {
    try {
      require('LensStudio:TextInputModule');
    } catch (e) {
      // Older runtimes expose the system without the module import
    }

    return (global as any).textInputSystem;
  }

  /**
   * Read the field once, on the press.
   *
   * Somebody typing 24:30 passes through "2", "24" and "24:3", none of which
   * is a time. Validating each keystroke is how a field becomes unusable.
   */
  private acceptFiveK(): void {
    if (!this.settled()) {
      this.log('Ignoring a press that arrived with the question');
      return;
    }

    // What they typed in this turn, if anything; otherwise where they left
    // the stepper, which is a real answer and is sitting in front of them.
    //
    // Never whatever the field happens to contain. A text field holds its
    // last value, its placeholder, or something left over from another
    // screen, and none of those is somebody telling us their 5K time - a
    // stored personal best arrived from one of them and nobody had typed
    // anything.
    var typed = this._fiveKTyped;
    var source = typed ? 'typed' : 'stepper';

    var seconds = typed ? parseFiveKEntry(typed) : this._fiveKStepped;

    if (seconds === null) {
      // Say what is wrong and stay. Bouncing them to the next screen with the
      // time silently dropped is worse than asking again.
      this.setText(this.paceOfferPromptText,
        'Minutes and seconds, like 24:30 or 2430.');
      this.log('5K not understood: ' + this._fiveKTyped);
      return;
    }

    if (this.profileManager && (this.profileManager as any).recordFiveKTime) {
      (this.profileManager as any).recordFiveKTime(seconds);
    }

    this._fiveKTyped = '';
    this._flow.resolvePaceOffer();
    this.log('5K entered: ' + formatFiveKTime(seconds) + ' (' + seconds + 's, ' +
             source + ')');
    this.refresh();
  }

  /** No is an answer, and it is remembered so the question stops being asked */
  private declineFiveK(): void {
    if (!this.settled()) {
      this.log('Ignoring a press that arrived with the question');
      return;
    }

    if (this.profileManager && (this.profileManager as any).declinePaceEvidence) {
      (this.profileManager as any).declinePaceEvidence();
    }

    this._fiveKTyped = '';
    this._flow.resolvePaceOffer();
    this.log('5K declined');
    this.refresh();
  }

  /** Everything the profile's evidence produces, most specific first */
  private paceAnchors(): any[] {
    if (!this.profileManager) return [];
    return (this.profileManager as any).paceAnchors || [];
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  private confirm(): void {
    if (this._flow.state === 'MODE') {
      this.log('No mode chosen yet');
      if (this.summaryText) {
        this.summaryText.text = 'Choose Race Day or Training first.';
      }
      return;
    }

    // START is only shown on the ready panel, but a stray tap while the
    // athlete is still answering must not begin a session they have not
    // finished describing.
    if (this._flow.isConfiguring) {
      this.log('Still configuring - nothing to start');
      return;
    }

    // And the release of the pinch that finished the last question is not
    // somebody starting a session. START appears where FOCUS was.
    if (!this.settled()) {
      this.log('Ignoring a press that arrived with the panel');
      return;
    }

    if (!this._preview) {
      this.log('Nothing to start');
      return;
    }

    var course = this.courseManagerScript as any;
    if (course && course.loadPlan) {
      course.loadPlan(this._preview);
    }

    this.log('Starting: ' + this._preview.title + ' (' + this._preview.id + ')');
    this.hide();

    if (this.onStartCallback) this.onStartCallback(this._preview);
  }

  /**
   * One step back, and out of the panel from the first one.
   *
   * It used to close the panel from wherever the athlete was, which was the
   * only behaviour available when there was nowhere to step back to. Now
   * there is, and an athlete who wants to change the room should not have to
   * leave and come in again to do it.
   */
  private goBack(): void {
    // Out of the turn first. Backing out of listening is backing out of the
    // microphone, not out of the session.
    if (this._flow.isListening) {
      this.stopListening();
      return;
    }

    if (this._flow.back()) {
      this._prescriptionNote = '';
      this.refresh();
      return;
    }

    if (!this.onBackCallback) return;

    this.hide();
    this.onBackCallback();
  }

  // ── UIKit plumbing ──────────────────────────────────────────────────────
  //
  // Same shape as OnboardingUI: UIKit exposes a couple of different event and
  // selection APIs depending on the widget, so try each rather than assume.

  private bindButton(btn: ScriptComponent, callback: () => void): void {
    if (!btn) return;

    var b = btn as any;
    if (b.onTriggerUp && b.onTriggerUp.add) {
      b.onTriggerUp.add(callback);
    } else if (b.onButtonPinched && b.onButtonPinched.add) {
      b.onButtonPinched.add(callback);
    }
  }

  private setSelected(btn: ScriptComponent, selected: boolean): void {
    if (!btn) return;

    var b = btn as any;

    if (b.isSelected !== undefined) {
      b.isSelected = selected;
    } else if (b.selected !== undefined) {
      b.selected = selected;
    } else if (b.setSelected) {
      b.setSelected(selected);
    }

    // Fallback for widgets with no selection state of their own. Uses the
    // brand accent rather than an arbitrary green.
    if (b.renderMeshVisual && b.renderMeshVisual.mainMaterial) {
      b.renderMeshVisual.mainMaterial.mainPass.baseColor = selected ? ACCENT : PLAIN;
    }
  }

  private log(msg: string): void {
    if (this.debugPrint) print('[SessionPickerUI] ' + msg);
  }
}
