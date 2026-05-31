// ============================================================================
// ProgressBarController.ts — Visual Progress Bar for Headlock UI
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Adapted from Path Pioneer for 3D headlock UI (camera child, not ortho/screen)
// Uses local X position for pointer movement and material shader for fill effect
// ============================================================================

@component
export class ProgressBarController extends BaseScriptComponent {

  // ── Bar Elements ─────────────────────────────────────────────────────────

  /** Pointer/indicator that slides along the bar */
  @input pointer: SceneObject;

  /** Text component showing percentage (e.g., "75%") */
  @input @allowUndefined percentText: Text;

  /** Material with 'currentPosition' float parameter for fill shader */
  @input @allowUndefined barMaterial: Material;

  // ── Position Bounds ──────────────────────────────────────────────────────

  /** Empty object marking the left edge (0% position) */
  @input startMarker: SceneObject;

  /** Empty object marking the right edge (100% position) */
  @input endMarker: SceneObject;

  // ── Settings ─────────────────────────────────────────────────────────────

  @input initialProgress: number = 0;

  /** Smoothly animate progress changes */
  @input smoothTransition: boolean = true;

  /** Animation speed (higher = faster) */
  @input smoothSpeed: number = 8.0;

  // ── Private State ────────────────────────────────────────────────────────

  private pointerTransform: Transform;
  private startX: number = 0;
  private endX: number = 0;
  private startY: number = 0;
  private startZ: number = 0;

  private currentProgress: number = 0;
  private targetProgress: number = 0;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  onAwake(): void {
    if (!this.pointer) {
      print('[ProgressBar] ERROR: pointer not assigned');
      return;
    }

    if (!this.startMarker || !this.endMarker) {
      print('[ProgressBar] ERROR: startMarker and endMarker required');
      return;
    }

    this.pointerTransform = this.pointer.getTransform();

    // Get local X positions from markers
    const startPos = this.startMarker.getTransform().getLocalPosition();
    const endPos = this.endMarker.getTransform().getLocalPosition();

    this.startX = startPos.x;
    this.endX = endPos.x;
    this.startY = startPos.y;
    this.startZ = startPos.z;

    // Set initial progress
    this.currentProgress = this.initialProgress;
    this.targetProgress = this.initialProgress;
    this.applyProgress(this.initialProgress);

    if (this.smoothTransition) {
      this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));
    }

    print('[ProgressBar] Init — range X: ' + this.startX.toFixed(2) + ' → ' + this.endX.toFixed(2));
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

  // ── Update Loop ──────────────────────────────────────────────────────────

  private onUpdate(): void {
    if (!this.smoothTransition) return;
    if (Math.abs(this.currentProgress - this.targetProgress) < 0.001) return;

    const dt = getDeltaTime();
    this.currentProgress = this.lerp(this.currentProgress, this.targetProgress, this.smoothSpeed * dt);
    this.applyProgress(this.currentProgress);
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private applyProgress(progress: number): void {
    // Move pointer along X axis
    if (this.pointerTransform) {
      const newX = this.remap(progress, 0, 1, this.startX, this.endX);
      this.pointerTransform.setLocalPosition(new vec3(newX, this.startY, this.startZ));
    }

    // Update material shader parameter
    if (this.barMaterial && this.barMaterial.mainPass) {
      this.barMaterial.mainPass.currentPosition = progress;
    }

    // Update percentage text
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
