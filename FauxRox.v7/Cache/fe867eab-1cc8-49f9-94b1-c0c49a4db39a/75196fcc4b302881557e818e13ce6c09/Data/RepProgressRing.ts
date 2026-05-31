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

  /** Ring mesh with progress material (ProgressRingMat shader) */
  @input ringMesh: RenderMeshVisual;

  /** Text showing current rep count */
  @input currentText: Text;

  /** Text showing total (e.g., "/ 50") */
  @input totalText: Text;

  // ── Settings ──────────────────────────────────────────────────────────────

  /** Ring fill color (shader: ringColor) */
  @input ringColor: vec4 = new vec4(1.0, 1.0, 1.0, 1.0);

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

    // Initialize shader parameters
    if (this.ringMesh) {
      const pass = this.ringMesh.mainPass as any;
      pass.progress = 0;
      pass.ringColor = this.ringColor;
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
    if (!this.ringMesh) return;

    const pass = this.ringMesh.mainPass as any;
    pass.progress = progress;
    pass.ringColor = this.ringColor;
  }

  /** Update ring color at runtime */
  setColor(color: vec4): void {
    this.ringColor = color;
    if (this.ringMesh) {
      const pass = this.ringMesh.mainPass as any;
      pass.ringColor = color;
    }
  }
}
