// ============================================================================
// ProgressBarController.ts — Visual Progress Bar for Headlock UI
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// For 3D headlock UI (camera child). Two fill modes:
// 1. SCALE mode: fillBar scales on X axis (no shader needed) ← RECOMMENDED
// 2. MATERIAL mode: shader with currentPosition parameter
// ============================================================================

@component
export class ProgressBarController extends BaseScriptComponent {

  // ── Fill Mode ───────────────────────────────────────────────────────────

  @ui.separator
  @ui.label("Fill Mode (choose one)")

  /** Fill bar that scales on X axis. Pivot should be at LEFT edge. */
  @input @allowUndefined fillBar: SceneObject;

  /** OR: Material with 'currentPosition' float parameter */
  @input @allowUndefined barMaterial: Material;

  // ── Optional Elements ───────────────────────────────────────────────────

  @ui.separator
  @ui.label("Optional Elements")

  /** Pointer/indicator that slides along the bar */
  @input @allowUndefined pointer: SceneObject;

  /** Text showing percentage (e.g., "75%") */
  @input @allowUndefined percentText: Text;

  // ── Position Bounds (for pointer) ───────────────────────────────────────

  @ui.separator
  @ui.label("Pointer Bounds (if using pointer)")

  /** Empty object marking the left edge (0% position) */
  @input @allowUndefined startMarker: SceneObject;

  /** Empty object marking the right edge (100% position) */
  @input @allowUndefined endMarker: SceneObject;

  // ── Settings ─────────────────────────────────────────────────────────────

  @ui.separator
  @ui.label("Settings")

  @input initialProgress: number = 0;

  /** Smoothly animate progress changes */
  @input smoothTransition: boolean = true;

  /** Animation speed (higher = faster) */
  @input smoothSpeed: number = 8.0;

  /** Minimum scale to prevent disappearing (0.001 - 0.1) */
  @input minFillScale: number = 0.01;

  /** DEBUG: Auto-animate progress 0→100% for testing */
  @input debugAutoAnimate: boolean = false;

  // ── Private State ────────────────────────────────────────────────────────

  private pointerTransform: Transform;
  private fillTransform: Transform;
  private fillScreenTransform: ScreenTransform;
  private fillOriginalScale: vec3;
  private fillOriginalAnchors: Rect;
  private useScreenTransform: boolean = false;

  private startX: number = 0;
  private endX: number = 0;
  private pointerY: number = 0;
  private pointerZ: number = 0;

  private currentProgress: number = 0;
  private targetProgress: number = 0;
  private isInitialized: boolean = false;
  private _lastLoggedProgress: number = -1;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  onAwake(): void {
    // Validate: need at least one fill method
    if (!this.fillBar && !this.barMaterial) {
      print('[ProgressBar] WARNING: No fillBar or barMaterial assigned. Only text/pointer will update.');
    }

    // Setup fillBar - detect ScreenTransform (for Image) vs Transform (for Mesh)
    if (this.fillBar) {
      // Try to get ScreenTransform first (for Image components)
      this.fillScreenTransform = this.fillBar.getComponent('Component.ScreenTransform') as ScreenTransform;

      if (this.fillScreenTransform) {
        // Image mode - use ScreenTransform anchors
        this.useScreenTransform = true;
        this.fillOriginalAnchors = Rect.create(
          this.fillScreenTransform.anchors.left,
          this.fillScreenTransform.anchors.right,
          this.fillScreenTransform.anchors.top,
          this.fillScreenTransform.anchors.bottom
        );
        print('[ProgressBar] Using IMAGE mode (ScreenTransform)');
        print('[ProgressBar] Original anchors: left=' + this.fillOriginalAnchors.left.toFixed(3) +
          ' right=' + this.fillOriginalAnchors.right.toFixed(3));
      } else {
        // Mesh mode - use Transform scale
        this.useScreenTransform = false;
        this.fillTransform = this.fillBar.getTransform();
        this.fillOriginalScale = this.fillTransform.getLocalScale();
        print('[ProgressBar] Using MESH mode (Transform scale)');
        print('[ProgressBar] Original scale: (' +
          this.fillOriginalScale.x.toFixed(3) + ', ' +
          this.fillOriginalScale.y.toFixed(3) + ', ' +
          this.fillOriginalScale.z.toFixed(3) + ')');
      }
    }

    // Setup pointer
    if (this.pointer) {
      this.pointerTransform = this.pointer.getTransform();

      if (this.startMarker && this.endMarker) {
        const startPos = this.startMarker.getTransform().getLocalPosition();
        const endPos = this.endMarker.getTransform().getLocalPosition();
        this.startX = startPos.x;
        this.endX = endPos.x;
        this.pointerY = startPos.y;
        this.pointerZ = startPos.z;
        print('[ProgressBar] Pointer range X: ' + this.startX.toFixed(2) + ' → ' + this.endX.toFixed(2));
      } else {
        print('[ProgressBar] WARNING: Pointer assigned but no startMarker/endMarker');
      }
    }

    // Set initial progress
    this.currentProgress = this.initialProgress;
    this.targetProgress = this.initialProgress;
    this.applyProgress(this.initialProgress);

    this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));
    this.isInitialized = true;

    print('[ProgressBar] Initialized — initial: ' + (this.initialProgress * 100).toFixed(0) + '%');
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Set progress value (0 to 1)
   */
  setProgress(progress: number): void {
    this.targetProgress = Math.max(0, Math.min(1, progress));

    if (!this.smoothTransition) {
      this.currentProgress = this.targetProgress;
      this.applyProgress(this.currentProgress);
    }
  }

  /**
   * Get current displayed progress
   */
  getProgress(): number {
    return this.currentProgress;
  }

  /**
   * Reset to zero (instant, no animation)
   */
  reset(): void {
    this.currentProgress = 0;
    this.targetProgress = 0;
    this.applyProgress(0);
  }

  /**
   * Show/hide the entire progress bar
   */
  setVisible(visible: boolean): void {
    this.getSceneObject().enabled = visible;
  }

  // ── Update Loop ──────────────────────────────────────────────────────────

  private onUpdate(): void {
    if (!this.isInitialized) return;

    // DEBUG: Auto-animate for testing
    if (this.debugAutoAnimate) {
      const t = getTime() % 5;  // 5 second cycle
      this.targetProgress = t / 5;  // 0 → 1 over 5 seconds
    }

    if (!this.smoothTransition) return;
    if (Math.abs(this.currentProgress - this.targetProgress) < 0.001) {
      if (this.currentProgress !== this.targetProgress) {
        this.currentProgress = this.targetProgress;
        this.applyProgress(this.currentProgress);
      }
      return;
    }

    const dt = getDeltaTime();
    this.currentProgress = this.lerp(this.currentProgress, this.targetProgress, this.smoothSpeed * dt);
    this.applyProgress(this.currentProgress);
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private applyProgress(progress: number): void {
    // 1. Fill bar update
    if (this.useScreenTransform && this.fillScreenTransform) {
      // IMAGE mode: use scale.x (pivot must be at left edge: pivot.x = -0.5)
      const scaleX = Math.max(this.minFillScale, progress);
      this.fillScreenTransform.scale = new vec3(scaleX, 1, 1);

      // Debug log
      if (Math.abs(progress - this._lastLoggedProgress) > 0.1) {
        print('[ProgressBar] progress=' + (progress * 100).toFixed(0) + '% → scale.x=' + scaleX.toFixed(3));
        this._lastLoggedProgress = progress;
      }
    } else if (this.fillTransform && this.fillOriginalScale) {
      // MESH mode: scale X axis
      const scaleX = Math.max(this.minFillScale, progress);
      const newScale = new vec3(
        this.fillOriginalScale.x * scaleX,
        this.fillOriginalScale.y,
        this.fillOriginalScale.z
      );
      this.fillTransform.setLocalScale(newScale);

      // Debug log
      if (Math.abs(progress - this._lastLoggedProgress) > 0.1) {
        print('[ProgressBar] progress=' + (progress * 100).toFixed(0) + '% → scaleX=' + newScale.x.toFixed(3));
        this._lastLoggedProgress = progress;
      }
    }

    // 2. Material shader (if using Path Pioneer style shader)
    if (this.barMaterial && this.barMaterial.mainPass) {
      try {
        (this.barMaterial.mainPass as any).currentPosition = progress;
      } catch (e) {
        // Shader doesn't have currentPosition parameter
      }
    }

    // 3. Move pointer along X axis
    if (this.pointerTransform && this.startMarker && this.endMarker) {
      const newX = this.remap(progress, 0, 1, this.startX, this.endX);
      this.pointerTransform.setLocalPosition(new vec3(newX, this.pointerY, this.pointerZ));
    }

    // 4. Update percentage text
    if (this.percentText) {
      this.percentText.text = Math.floor(progress * 100) + '%';
    }
  }

  private remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.min(1, t);
  }
}
