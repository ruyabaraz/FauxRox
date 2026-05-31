// ============================================================================
// RepProgressRing.ts — Circular Progress Ring for Rep Counting
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Displays a circular progress ring with rep count in the center.
// Used for ZONE_HIT stations (SkiErg, Wallball, Power Row).
// ============================================================================

@component
export class RepProgressRing extends BaseScriptComponent {

  // ── References ────────────────────────────────────────────────────────────

  /** Ring image with progress material (ProgressRingMat shader) */
  @input ringImage: Image;

  /** Text showing current rep count */
  @input currentText: Text;

  /** Text showing total (e.g., "/ 50") */
  @input totalText: Text;

  // ── Settings ──────────────────────────────────────────────────────────────

  /** Ring fill color */
  @input ringColor: vec4 = new vec4(0.8, 1.0, 0.8, 1.0);

  /** Background ring color (darker) */
  @input bgColor: vec4 = new vec4(0.3, 0.3, 0.3, 0.5);

  /** Ring thickness (0.05 - 0.2) */
  @input ringWidth: number = 0.08;

  /** Animate progress changes */
  @input animateProgress: boolean = true;

  /** Animation duration in seconds */
  @input animationDuration: number = 0.15;

  // ── State ─────────────────────────────────────────────────────────────────

  private _currentReps: number = 0;
  private _totalReps: number = 1;
  private _displayedProgress: number = 0;
  private _targetProgress: number = 0;
  private _isAnimating: boolean = false;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onAwake(): void {
    // Start hidden
    this.sceneObject.enabled = false;

    // Set colors
    if (this.ringImage) {
      this.setRingProgress(0);
      this.ringImage.mainPass.baseColor = this.ringColor;
    }

    if (this.bgRingImage) {
      this.bgRingImage.mainPass.baseColor = this.bgColor;
    }

    this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));

    print('[RepProgressRing] Initialized');
  }

  private onUpdate(): void {
    if (!this._isAnimating) return;

    // Animate towards target
    var diff = this._targetProgress - this._displayedProgress;
    var step = getDeltaTime() / this.animationDuration;

    if (Math.abs(diff) < step) {
      this._displayedProgress = this._targetProgress;
      this._isAnimating = false;
    } else {
      this._displayedProgress += Math.sign(diff) * step;
    }

    this.setRingProgress(this._displayedProgress);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Show the progress ring and initialize with total reps
   */
  show(totalReps: number): void {
    this._currentReps = 0;
    this._totalReps = Math.max(1, totalReps);
    this._displayedProgress = 0;
    this._targetProgress = 0;
    this._isAnimating = false;

    this.updateTexts();
    this.setRingProgress(0);
    this.sceneObject.enabled = true;

    print('[RepProgressRing] Shown - target: ' + totalReps + ' reps');
  }

  /**
   * Hide the progress ring
   */
  hide(): void {
    this.sceneObject.enabled = false;
    this._isAnimating = false;
    print('[RepProgressRing] Hidden');
  }

  /**
   * Update the current rep count
   */
  setReps(current: number): void {
    this._currentReps = current;
    this._targetProgress = Math.min(1, current / this._totalReps);

    this.updateTexts();

    if (this.animateProgress) {
      this._isAnimating = true;
    } else {
      this._displayedProgress = this._targetProgress;
      this.setRingProgress(this._displayedProgress);
    }
  }

  /**
   * Get current progress (0-1)
   */
  get progress(): number {
    return this._targetProgress;
  }

  /**
   * Check if ring is visible
   */
  get isVisible(): boolean {
    return this.sceneObject.enabled;
  }

  // ── Private Methods ───────────────────────────────────────────────────────

  private updateTexts(): void {
    if (this.currentText) {
      this.currentText.text = this._currentReps.toString();
    }

    if (this.totalText) {
      this.totalText.text = '/ ' + this._totalReps.toString();
    }
  }

  private setRingProgress(progress: number): void {
    if (!this.ringImage) return;

    // The material should have a 'progress' parameter (0-1)
    // This controls the arc fill from 0% to 100%
    var pass = this.ringImage.mainPass;
    if (pass.progress !== undefined) {
      pass.progress = progress;
    }

    // Fallback: if no progress parameter, use arc shader properties
    if (pass.arcEnd !== undefined) {
      // Arc from -90deg (top) clockwise
      pass.arcEnd = progress * 360;
    }
  }
}
