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

  /** TextInputField from SpectaclesUIKit */
  @input @allowUndefined nameInputField: ScriptComponent;

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
    // Bind name input text change
    this.bindNameInput();

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

  private bindNameInput(): void {
    if (!this.nameInputField) return;

    var field = this.nameInputField as any;

    // Try different TextInputField event APIs
    if (field.onTextChanged && field.onTextChanged.add) {
      field.onTextChanged.add((newText: string) => {
        this.updateWelcomeText(newText);
      });
      this.log('Name input bound via onTextChanged');
    } else if (field.onValueChanged && field.onValueChanged.add) {
      field.onValueChanged.add((newText: string) => {
        this.updateWelcomeText(newText);
      });
      this.log('Name input bound via onValueChanged');
    }
  }

  private updateWelcomeText(name: string): void {
    if (!this.welcomeText) return;

    var displayName = (name && name.length > 0) ? name : 'Athlete';
    this.welcomeText.text = 'Welcome, ' + displayName;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  show(snapUserName: string, onComplete: (profile: any) => void): void {
    this.onCompleteCallback = onComplete;

    // Load existing profile values if available, otherwise use defaults
    if (this.profileManager && this.profileManager.hasProfile()) {
      var existing = this.profileManager.getProfile();
      this._displayName = existing.displayName || snapUserName || 'Athlete';
      this._birthYear = existing.birthYear || this.defaultBirthYear;
      this._fitnessLevel = existing.fitnessLevel || 'regular';
      this._goal = existing.goal || 'finish_strong';
      this.log('Loaded existing profile values');
    } else {
      // First time - use defaults
      if (snapUserName && snapUserName.length > 0) {
        this._displayName = snapUserName;
      }
      this._birthYear = this.defaultBirthYear;
      this._fitnessLevel = 'regular';
      this._goal = 'finish_strong';
    }

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
    if (this.birthYearText) {
      this.birthYearText.text = this._birthYear.toString();
    }
    // Name is handled by TextInputField directly
    if (this.nameInputField && this._displayName) {
      var field = this.nameInputField as any;
      if (field.text !== undefined) {
        field.text = this._displayName;
      }
    }
    // Update welcome text with current name
    this.updateWelcomeText(this._displayName);

    // Update button selection visuals
    this.updateFitnessButtonVisuals();
    this.updateGoalButtonVisuals();
  }

  /**
   * Get name from TextInputField
   */
  private getNameFromInput(): string {
    if (this.nameInputField) {
      var field = this.nameInputField as any;
      if (field.text && field.text.length > 0) {
        return field.text;
      }
    }
    return this._displayName || 'Athlete';
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
    this.updateFitnessButtonVisuals();
  }

  private selectGoal(goal: GoalType): void {
    this._goal = goal;
    this.log('Goal: ' + goal);
    this.updateGoalButtonVisuals();
  }

  // ── Button Visual Feedback ─────────────────────────────────────────────

  private updateFitnessButtonVisuals(): void {
    this.setButtonSelected(this.beginnerButton, this._fitnessLevel === 'beginner');
    this.setButtonSelected(this.intermediateButton, this._fitnessLevel === 'regular');
    this.setButtonSelected(this.advancedButton, this._fitnessLevel === 'athlete');
  }

  private updateGoalButtonVisuals(): void {
    this.setButtonSelected(this.finishStrongButton, this._goal === 'finish_strong');
    this.setButtonSelected(this.beatPBButton, this._goal === 'beat_pb');
    this.setButtonSelected(this.maxEffortButton, this._goal === 'max_effort');
    this.setButtonSelected(this.pacingButton, this._goal === 'pacing');
  }

  private setButtonSelected(btn: ScriptComponent, selected: boolean): void {
    if (!btn) return;
    var b = btn as any;
    // Try different SpectaclesUIKit APIs for selection state
    if (b.isSelected !== undefined) {
      b.isSelected = selected;
    } else if (b.selected !== undefined) {
      b.selected = selected;
    } else if (b.setSelected) {
      b.setSelected(selected);
    }
    // Fallback: try to change button icon/color via renderMeshVisual
    if (b.renderMeshVisual && b.renderMeshVisual.mainMaterial) {
      var mat = b.renderMeshVisual.mainMaterial;
      if (selected) {
        mat.mainPass.baseColor = new vec4(0.3, 0.8, 0.3, 1.0); // Green highlight
      } else {
        mat.mainPass.baseColor = new vec4(1.0, 1.0, 1.0, 1.0); // White default
      }
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  private onConfirm(): void {
    var name = this.getNameFromInput();
    this.log('Confirmed: ' + name + ', ' + this._birthYear + ', ' + this._fitnessLevel + ', ' + this._goal);

    if (this.profileManager) {
      var profile = this.profileManager.createProfile(
        name,
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
