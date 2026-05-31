// ============================================================================
// OnboardingUI.ts — HYROX First-Launch Onboarding (Single Panel)
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Single panel UI for collecting user profile data.
// All options visible at once - fast and premium feel.
// ============================================================================

import { ProfileManager, FitnessLevel, GoalType } from './ProfileManager';

@component
export class OnboardingUI extends BaseScriptComponent {

  // ── References ──────────────────────────────────────────────────────────

  @input profileManager: ProfileManager;

  /** Frame - parent container for entire Onboarding UI */
  @input @allowUndefined frame: SceneObject;

  /** Main panel containing all UI elements */
  @input @allowUndefined mainPanel: SceneObject;

  // ── Welcome ─────────────────────────────────────────────────────────────

  @ui.separator
  @ui.label("Welcome")

  @input @allowUndefined welcomeText: Text;

  // ── Name Input ──────────────────────────────────────────────────────────

  @ui.separator
  @ui.label("Name Input")

  @input @allowUndefined nameText: Text;
  @input @allowUndefined nameEditButton: ScriptComponent;

  // ── Birth Year ──────────────────────────────────────────────────────────

  @ui.separator
  @ui.label("Birth Year")

  @input @allowUndefined birthYearText: Text;
  @input @allowUndefined yearMinusButton: ScriptComponent;
  @input @allowUndefined yearPlusButton: ScriptComponent;

  // ── Fitness Level ───────────────────────────────────────────────────────

  @ui.separator
  @ui.label("Fitness Level")

  @input @allowUndefined beginnerButton: ScriptComponent;
  @input @allowUndefined intermediateButton: ScriptComponent;
  @input @allowUndefined advancedButton: ScriptComponent;

  // ── Goal ────────────────────────────────────────────────────────────────

  @ui.separator
  @ui.label("Goal")

  @input @allowUndefined finishStrongButton: ScriptComponent;
  @input @allowUndefined beatPBButton: ScriptComponent;
  @input @allowUndefined maxEffortButton: ScriptComponent;
  @input @allowUndefined pacingButton: ScriptComponent;

  // ── Actions ─────────────────────────────────────────────────────────────

  @ui.separator
  @ui.label("Actions")

  @input @allowUndefined confirmButton: ScriptComponent;
  @input @allowUndefined guestButton: ScriptComponent;

  // ── Settings ────────────────────────────────────────────────────────────

  @ui.separator
  @ui.label("Settings")

  @input debugPrint: boolean = true;
  @input defaultBirthYear: number = 1990;

  // ── State ───────────────────────────────────────────────────────────────

  private _isVisible: boolean = false;
  private _displayName: string = 'Athlete';
  private _birthYear: number = 1990;
  private _fitnessLevel: FitnessLevel = 'regular';
  private _goal: GoalType = 'finish_strong';

  private onCompleteCallback: (profile: any) => void = null;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  onAwake(): void {
    this._birthYear = this.defaultBirthYear;

    // Hide immediately
    if (this.frame) this.frame.enabled = false;
    if (this.mainPanel) this.mainPanel.enabled = false;

    this.log('Initialized');

    // Setup buttons after SIK initializes
    this.createEvent('OnStartEvent').bind(() => {
      this.setupButtons();
    });
  }

  private setupButtons(): void {
    // Name edit (voice input)
    this.bindButton(this.nameEditButton, () => this.onEditName());

    // Year controls
    this.bindButton(this.yearMinusButton, () => this.onYearMinus());
    this.bindButton(this.yearPlusButton, () => this.onYearPlus());

    // Fitness level (mutually exclusive)
    this.bindButton(this.beginnerButton, () => this.selectFitness('beginner'));
    this.bindButton(this.intermediateButton, () => this.selectFitness('regular'));
    this.bindButton(this.advancedButton, () => this.selectFitness('athlete'));

    // Goal (mutually exclusive)
    this.bindButton(this.finishStrongButton, () => this.selectGoal('finish_strong'));
    this.bindButton(this.beatPBButton, () => this.selectGoal('beat_pb'));
    this.bindButton(this.maxEffortButton, () => this.selectGoal('max_effort'));
    this.bindButton(this.pacingButton, () => this.selectGoal('pacing'));

    // Actions
    this.bindButton(this.confirmButton, () => this.onConfirm());
    this.bindButton(this.guestButton, () => this.onGuest());

    this.log('Buttons bound');
  }

  private bindButton(btn: ScriptComponent, callback: () => void): void {
    if (!btn) return;
    var b = btn as any;
    if (b.onTriggerUp && b.onTriggerUp.add) {
      b.onTriggerUp.add(callback);
    } else if (b.onButtonPinched && b.onButtonPinched.add) {
      b.onButtonPinched.add(callback);
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  show(snapUserName: string, onComplete: (profile: any) => void): void {
    this.onCompleteCallback = onComplete;

    if (snapUserName && snapUserName.length > 0) {
      this._displayName = snapUserName;
    }

    // Reset to defaults
    this._birthYear = this.defaultBirthYear;
    this._fitnessLevel = 'regular';
    this._goal = 'finish_strong';

    // Show UI
    if (this.frame) this.frame.enabled = true;
    if (this.mainPanel) this.mainPanel.enabled = true;
    this._isVisible = true;

    this.updateUI();
    this.log('Showing onboarding for: ' + this._displayName);
  }

  hide(): void {
    if (this.frame) this.frame.enabled = false;
    if (this.mainPanel) this.mainPanel.enabled = false;
    this._isVisible = false;
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  // ── UI Updates ──────────────────────────────────────────────────────────

  private updateUI(): void {
    if (this.welcomeText) {
      this.welcomeText.text = 'Welcome';
    }
    if (this.nameText) {
      this.nameText.text = this._displayName;
    }
    if (this.birthYearText) {
      this.birthYearText.text = this._birthYear.toString();
    }
  }

  // ── Year Controls ───────────────────────────────────────────────────────

  private onYearMinus(): void {
    this._birthYear = Math.max(1920, this._birthYear - 1);
    this.updateUI();
  }

  private onYearPlus(): void {
    this._birthYear = Math.min(2015, this._birthYear + 1);
    this.updateUI();
  }

  // ── Selection ───────────────────────────────────────────────────────────

  private selectFitness(level: FitnessLevel): void {
    this._fitnessLevel = level;
    this.log('Fitness: ' + level);
    // TODO: Visual feedback - highlight selected button
  }

  private selectGoal(goal: GoalType): void {
    this._goal = goal;
    this.log('Goal: ' + goal);
    // TODO: Visual feedback - highlight selected button
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  private onConfirm(): void {
    this.log('Confirmed: ' + this._displayName + ', ' + this._birthYear + ', ' + this._fitnessLevel + ', ' + this._goal);

    if (this.profileManager) {
      var profile = this.profileManager.createProfile(
        this._displayName,
        this._birthYear,
        this._fitnessLevel,
        this._goal,
        false,
        null
      );

      this.hide();

      if (this.onCompleteCallback) {
        this.onCompleteCallback(profile);
      }
    }
  }

  private onGuest(): void {
    this.log('Continue as guest');

    if (this.profileManager) {
      var profile = this.profileManager.createGuestProfile();

      this.hide();

      if (this.onCompleteCallback) {
        this.onCompleteCallback(profile);
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
