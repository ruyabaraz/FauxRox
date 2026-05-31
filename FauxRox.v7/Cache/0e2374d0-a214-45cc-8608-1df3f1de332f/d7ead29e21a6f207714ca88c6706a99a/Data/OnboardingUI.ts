// ============================================================================
// OnboardingUI.ts — HYROX First-Launch Onboarding Flow
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// State machine UI controller for collecting user profile data.
// Pattern based on BLEConnectionUI.ts state machine.
// Steps: WELCOME → BIRTH_YEAR → FITNESS_LEVEL → GOAL → CONFIRM → COMPLETE
// ============================================================================

import { ProfileManager, FitnessLevel, GoalType } from './ProfileManager';

export enum OnboardingState {
  HIDDEN        = 'HIDDEN',
  WELCOME       = 'WELCOME',
  BIRTH_YEAR    = 'BIRTH_YEAR',
  FITNESS_LEVEL = 'FITNESS_LEVEL',
  GOAL          = 'GOAL',
  CONFIRM       = 'CONFIRM',
  COMPLETE      = 'COMPLETE',
}

@component
export class OnboardingUI extends BaseScriptComponent {

  // ── References ──────────────────────────────────────────────────────────

  @input profileManager: ProfileManager;

  /** Frame - parent container for entire Onboarding UI (has Frame.ts) */
  @input @allowUndefined frame: SceneObject;

  // ── Welcome Step ────────────────────────────────────────────────────────

  @ui.separator
  @ui.label("Welcome Step")

  @input @allowUndefined welcomePanel: SceneObject;
  @input @allowUndefined welcomeNameText: Text;
  @input @allowUndefined confirmNameButton: ScriptComponent;
  @input @allowUndefined guestButton: ScriptComponent;

  // ── Birth Year Step ─────────────────────────────────────────────────────

  @ui.separator
  @ui.label("Birth Year Step")

  @input @allowUndefined birthYearPanel: SceneObject;
  @input @allowUndefined birthYearText: Text;
  @input @allowUndefined yearMinusButton: ScriptComponent;
  @input @allowUndefined yearPlusButton: ScriptComponent;
  @input @allowUndefined decade70sButton: ScriptComponent;
  @input @allowUndefined decade80sButton: ScriptComponent;
  @input @allowUndefined decade90sButton: ScriptComponent;
  @input @allowUndefined decade00sButton: ScriptComponent;
  @input @allowUndefined birthYearNextButton: ScriptComponent;
  @input @allowUndefined birthYearSkipButton: ScriptComponent;

  // ── Fitness Level Step ──────────────────────────────────────────────────

  @ui.separator
  @ui.label("Fitness Level Step")

  @input @allowUndefined fitnessPanel: SceneObject;
  @input @allowUndefined beginnerButton: ScriptComponent;
  @input @allowUndefined regularButton: ScriptComponent;
  @input @allowUndefined athleteButton: ScriptComponent;

  // ── Goal Step ───────────────────────────────────────────────────────────

  @ui.separator
  @ui.label("Goal Step")

  @input @allowUndefined goalPanel: SceneObject;
  @input @allowUndefined finishStrongButton: ScriptComponent;
  @input @allowUndefined beatPBButton: ScriptComponent;
  @input @allowUndefined maxEffortButton: ScriptComponent;
  @input @allowUndefined pacingButton: ScriptComponent;

  // ── Confirm Step ────────────────────────────────────────────────────────

  @ui.separator
  @ui.label("Confirm Step")

  @input @allowUndefined confirmPanel: SceneObject;
  @input @allowUndefined confirmSummaryText: Text;
  @input @allowUndefined letsGoButton: ScriptComponent;

  // ── Settings ────────────────────────────────────────────────────────────

  @ui.separator
  @ui.label("Settings")

  @input debugPrint: boolean = true;
  @input defaultBirthYear: number = 1990;

  // ── State ───────────────────────────────────────────────────────────────

  private _state: OnboardingState = OnboardingState.HIDDEN;

  // Collected data
  private _displayName: string = 'Athlete';
  private _birthYear: number = 1990;
  private _birthYearSkipped: boolean = false;
  private _fitnessLevel: FitnessLevel = 'regular';
  private _goal: GoalType = 'finish_strong';
  private _isGuest: boolean = false;

  // ── Callback ────────────────────────────────────────────────────────────

  private onCompleteCallback: (profile: any) => void = null;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  onAwake(): void {
    this._birthYear = this.defaultBirthYear;

    // CRITICAL: Disable panels IMMEDIATELY before any UI kit initialization
    if (this.frame) this.frame.enabled = false;
    if (this.welcomePanel) this.welcomePanel.enabled = false;
    if (this.birthYearPanel) this.birthYearPanel.enabled = false;
    if (this.fitnessPanel) this.fitnessPanel.enabled = false;
    if (this.goalPanel) this.goalPanel.enabled = false;
    if (this.confirmPanel) this.confirmPanel.enabled = false;

    this.log('OnboardingUI initialized');
    this.hideAll();

    // Delay button setup to OnStartEvent - SIK components need time to initialize
    this.createEvent('OnStartEvent').bind(() => {
      this.setupButtonCallbacks();
    });
  }

  private setupButtonCallbacks(): void {
    this.log('Setting up button callbacks...');

    // Welcome step
    this.bindButton(this.confirmNameButton, () => this.onConfirmName());
    this.bindButton(this.guestButton, () => this.onContinueAsGuest());

    // Birth year step
    this.bindButton(this.yearMinusButton, () => this.onYearMinus());
    this.bindButton(this.yearPlusButton, () => this.onYearPlus());
    this.bindButton(this.decade70sButton, () => this.onDecade(1970));
    this.bindButton(this.decade80sButton, () => this.onDecade(1980));
    this.bindButton(this.decade90sButton, () => this.onDecade(1990));
    this.bindButton(this.decade00sButton, () => this.onDecade(2000));
    this.bindButton(this.birthYearNextButton, () => this.onBirthYearNext());
    this.bindButton(this.birthYearSkipButton, () => this.onBirthYearSkip());

    // Fitness level step
    this.bindButton(this.beginnerButton, () => this.onSelectFitness('beginner'));
    this.bindButton(this.regularButton, () => this.onSelectFitness('regular'));
    this.bindButton(this.athleteButton, () => this.onSelectFitness('athlete'));

    // Goal step
    this.bindButton(this.finishStrongButton, () => this.onSelectGoal('finish_strong'));
    this.bindButton(this.beatPBButton, () => this.onSelectGoal('beat_pb'));
    this.bindButton(this.maxEffortButton, () => this.onSelectGoal('max_effort'));
    this.bindButton(this.pacingButton, () => this.onSelectGoal('pacing'));

    // Confirm step
    this.bindButton(this.letsGoButton, () => this.onLetsGo());

    this.log('All buttons bound');
  }

  private bindButton(buttonComp: ScriptComponent, callback: () => void): void {
    if (!buttonComp) return;

    var btn = buttonComp as any;

    if (btn.onTriggerUp && btn.onTriggerUp.add) {
      btn.onTriggerUp.add(callback);
      this.log('Button bound: ' + buttonComp.getSceneObject().name);
    } else if (btn.onButtonPinched && btn.onButtonPinched.add) {
      btn.onButtonPinched.add(callback);
      this.log('Button bound (onButtonPinched): ' + buttonComp.getSceneObject().name);
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Show onboarding flow (start from welcome)
   */
  show(snapUserName: string, onComplete: (profile: any) => void): void {
    if (this._state !== OnboardingState.HIDDEN) {
      this.log('Already showing onboarding');
      return;
    }

    this.onCompleteCallback = onComplete;

    // Set display name from Snap user if provided
    if (snapUserName && snapUserName.length > 0) {
      this._displayName = snapUserName;
    }

    this.log('Starting onboarding for: ' + this._displayName);
    this.setState(OnboardingState.WELCOME);
  }

  /**
   * Hide onboarding (cancel or complete)
   */
  hide(): void {
    this.setState(OnboardingState.HIDDEN);
  }

  /**
   * Get current state
   */
  get state(): OnboardingState {
    return this._state;
  }

  /**
   * Check if onboarding is visible
   */
  get isVisible(): boolean {
    return this._state !== OnboardingState.HIDDEN && this._state !== OnboardingState.COMPLETE;
  }

  // ── State Management ────────────────────────────────────────────────────

  private setState(state: OnboardingState): void {
    this._state = state;
    this.log('State: ' + state);
    this.hideAll();

    switch (state) {
      case OnboardingState.WELCOME:
        if (this.frame) this.frame.enabled = true;
        if (this.welcomePanel) this.welcomePanel.enabled = true;
        this.updateWelcomeUI();
        break;

      case OnboardingState.BIRTH_YEAR:
        if (this.birthYearPanel) this.birthYearPanel.enabled = true;
        this.updateBirthYearUI();
        break;

      case OnboardingState.FITNESS_LEVEL:
        if (this.fitnessPanel) this.fitnessPanel.enabled = true;
        break;

      case OnboardingState.GOAL:
        if (this.goalPanel) this.goalPanel.enabled = true;
        break;

      case OnboardingState.CONFIRM:
        if (this.confirmPanel) this.confirmPanel.enabled = true;
        this.updateConfirmUI();
        break;

      case OnboardingState.COMPLETE:
        this.completeOnboarding();
        if (this.frame) this.frame.enabled = false;
        break;

      case OnboardingState.HIDDEN:
        if (this.frame) this.frame.enabled = false;
        break;
    }
  }

  private hideAll(): void {
    if (this.welcomePanel) this.welcomePanel.enabled = false;
    if (this.birthYearPanel) this.birthYearPanel.enabled = false;
    if (this.fitnessPanel) this.fitnessPanel.enabled = false;
    if (this.goalPanel) this.goalPanel.enabled = false;
    if (this.confirmPanel) this.confirmPanel.enabled = false;
  }

  // ── Welcome Step ────────────────────────────────────────────────────────

  private updateWelcomeUI(): void {
    if (this.welcomeNameText) {
      this.welcomeNameText.text = "I'm " + this._displayName;
    }
  }

  private onConfirmName(): void {
    this._isGuest = false;
    this.log('Name confirmed: ' + this._displayName);
    this.setState(OnboardingState.BIRTH_YEAR);
  }

  private onContinueAsGuest(): void {
    this._isGuest = true;
    this._displayName = 'Guest';
    this.log('Continuing as guest');

    // Skip all personalization for guest
    this._birthYearSkipped = true;
    this._fitnessLevel = 'regular';
    this._goal = 'finish_strong';

    this.setState(OnboardingState.COMPLETE);
  }

  // ── Birth Year Step ─────────────────────────────────────────────────────

  private updateBirthYearUI(): void {
    if (this.birthYearText) {
      this.birthYearText.text = this._birthYear.toString();
    }
  }

  private onYearMinus(): void {
    this._birthYear = Math.max(1920, this._birthYear - 1);
    this.updateBirthYearUI();
  }

  private onYearPlus(): void {
    this._birthYear = Math.min(2015, this._birthYear + 1);
    this.updateBirthYearUI();
  }

  private onDecade(decade: number): void {
    // Set to middle of decade
    this._birthYear = decade + 5;
    this.updateBirthYearUI();
  }

  private onBirthYearNext(): void {
    this._birthYearSkipped = false;
    this.log('Birth year: ' + this._birthYear);
    this.setState(OnboardingState.FITNESS_LEVEL);
  }

  private onBirthYearSkip(): void {
    this._birthYearSkipped = true;
    this.log('Birth year skipped');
    this.setState(OnboardingState.FITNESS_LEVEL);
  }

  // ── Fitness Level Step ──────────────────────────────────────────────────

  private onSelectFitness(level: FitnessLevel): void {
    this._fitnessLevel = level;
    this.log('Fitness level: ' + level);
    this.setState(OnboardingState.GOAL);
  }

  // ── Goal Step ───────────────────────────────────────────────────────────

  private onSelectGoal(goal: GoalType): void {
    this._goal = goal;
    this.log('Goal: ' + goal);
    this.setState(OnboardingState.CONFIRM);
  }

  // ── Confirm Step ────────────────────────────────────────────────────────

  private updateConfirmUI(): void {
    if (!this.confirmSummaryText) return;

    var fitnessLabels: Record<FitnessLevel, string> = {
      'beginner': 'Beginner',
      'regular': 'Regular',
      'athlete': 'Athlete',
    };

    var goalLabels: Record<GoalType, string> = {
      'finish_strong': 'Finish Strong',
      'beat_pb': 'Beat My PB',
      'max_effort': 'Max Effort',
      'pacing': 'Pacing Practice',
    };

    var summary = this._displayName + '\n';

    if (!this._birthYearSkipped) {
      var age = new Date().getFullYear() - this._birthYear;
      summary += 'Age: ' + age + '\n';
    }

    summary += 'Level: ' + fitnessLabels[this._fitnessLevel] + '\n';
    summary += 'Goal: ' + goalLabels[this._goal];

    this.confirmSummaryText.text = summary;
  }

  private onLetsGo(): void {
    this.log('Onboarding confirmed');
    this.setState(OnboardingState.COMPLETE);
  }

  // ── Completion ──────────────────────────────────────────────────────────

  private completeOnboarding(): void {
    // Save profile via ProfileManager
    if (this.profileManager) {
      var birthYear = this._birthYearSkipped ? null : this._birthYear;

      var profile = this.profileManager.createProfile(
        this._displayName,
        birthYear,
        this._fitnessLevel,
        this._goal,
        this._isGuest,
        null // odizUserId - will be set by CloudManager auth
      );

      this.log('Profile saved');

      // Notify callback
      if (this.onCompleteCallback) {
        this.onCompleteCallback(profile);
      }
    } else {
      this.log('WARNING: ProfileManager not assigned');

      // Still call callback
      if (this.onCompleteCallback) {
        this.onCompleteCallback(null);
      }
    }
  }

  // ── Debug ───────────────────────────────────────────────────────────────

  private log(msg: string): void {
    if (this.debugPrint) {
      print('[OnboardingUI] ' + msg);
    }
  }
}
