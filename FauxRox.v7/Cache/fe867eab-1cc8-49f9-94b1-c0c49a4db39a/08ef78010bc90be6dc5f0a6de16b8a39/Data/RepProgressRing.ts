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
  private _material: Material = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onAwake(): void {
    print('[RepProgressRing] onAwake - ringMesh: ' + (!isNull(this.ringMesh) ? 'exists' : 'NULL'));

    // Clone material for unique instance
    if (!isNull(this.ringMesh)) {
      const mat = this.ringMesh.mainMaterial;
      print('[RepProgressRing] mainMaterial: ' + (!isNull(mat) ? 'exists' : 'NULL'));
      if (!isNull(mat)) {
        this._material = mat.clone();
        this.ringMesh.mainMaterial = this._material;
        print('[RepProgressRing] Material cloned successfully');
      }
    }

    // Start hidden - disable all children
    this.setAllChildrenEnabled(false);

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

    // Enable all children first
    this.setAllChildrenEnabled(true);

    // Lazy init: clone material on first show
    if (!this._material && !isNull(this.ringMesh)) {
      const mat = this.ringMesh.mainMaterial;
      print('[RepProgressRing] show() - mainMaterial: ' + (!isNull(mat) ? 'exists' : 'NULL'));
      if (!isNull(mat)) {
        this._material = mat.clone();
        this.ringMesh.mainMaterial = this._material;
        print('[RepProgressRing] Material cloned in show()');
      }
    }

    // Debug: check visibility
    if (!isNull(this.ringMesh)) {
      print('[RepProgressRing] ringMesh enabled: ' + this.ringMesh.getSceneObject().enabled);
      print('[RepProgressRing] ringMesh visible: ' + this.ringMesh.enabled);
    }

    this.updateTexts();
    this.setRingProgress(0);

    print('[RepProgressRing] Shown - target: ' + totalReps + ' reps');
  }

  /**
   * Hide the progress ring
   */
  hide(): void {
    // Disable all children
    this.setAllChildrenEnabled(false);
    this._isAnimating = false;
    print('[RepProgressRing] Hidden');
  }

  /**
   * Enable/disable all children of this group
   */
  private setAllChildrenEnabled(enabled: boolean): void {
    // Parent group
    this.sceneObject.enabled = enabled;

    // Ring mesh
    if (this.ringMesh) {
      this.ringMesh.getSceneObject().enabled = enabled;
    }

    // Text objects
    if (this.currentText) {
      this.currentText.getSceneObject().enabled = enabled;
    }
    if (this.totalText) {
      this.totalText.getSceneObject().enabled = enabled;
    }
  }

  /**
   * Update the current rep count
   */
  setReps(current: number): void {
    this._currentReps = current;
    this._targetProgress = Math.min(1, current / this._totalReps);

    print('[RepProgressRing] setReps: ' + current + '/' + this._totalReps + ' = ' + this._targetProgress.toFixed(2));

    this.updateTexts();

    // Always update immediately (animation unreliable when sceneObject was disabled)
    this._displayedProgress = this._targetProgress;
    this.setRingProgress(this._displayedProgress);
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
    if (!this._material) {
      print('[RepProgressRing] ERROR: material is null!');
      return;
    }

    const pass = this._material.mainPass as any;
    pass.progress = progress;
    pass.ringColor = this.ringColor;
    print('[RepProgressRing] Progress: ' + progress.toFixed(2));
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
