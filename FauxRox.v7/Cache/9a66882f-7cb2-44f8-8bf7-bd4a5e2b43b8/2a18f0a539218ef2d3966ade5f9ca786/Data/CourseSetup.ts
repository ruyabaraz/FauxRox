// ============================================================================
// CourseSetup.ts — HYROX MIRAGE Ground Calibration
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Handles ground detection and floor height calibration.
// Does NOT place a fixed course - dynamic spawning is handled by
// RaceStateMachine + CourseManager.
// ============================================================================

import { GroundCalibration } from "./GroundCalibration";

@component
export class CourseSetup extends BaseScriptComponent {

  // ── References ───────────────────────────────────────────────────────────

  @input groundCalibration: GroundCalibration;
  @input courseManagerScript: ScriptComponent;

  @input @allowUndefined calibrationVisual: SceneObject;
  @input @allowUndefined statusText: Text;
  @input @allowUndefined instructionText: Text;

  // ── State ────────────────────────────────────────────────────────────────

  private _isCalibrated: boolean = false;
  private _floorY: number = 0;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  onAwake(): void {
    print("[CourseSetup] Initialized (Dynamic Mode)");

    if (!this.groundCalibration) {
      print("[CourseSetup] ERROR: GroundCalibration not assigned!");
      return;
    }

    // Auto-start calibration after a short delay
    var delayEvent = this.createEvent("DelayedCallbackEvent");
    delayEvent.bind(() => {
      this.startCalibration();
    });
    (delayEvent as DelayedCallbackEvent).reset(0.5);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Start ground calibration process
   */
  startCalibration(): void {
    if (this._isCalibrated) {
      print("[CourseSetup] Already calibrated.");
      return;
    }

    this.showInstruction("Look at the floor and hold still");

    this.groundCalibration.startCalibration(
      (pos, rot, progress) => this.onCalibrating(pos, rot, progress),
      (pos, rot) => this.onCalibrated(pos, rot)
    );
  }

  /**
   * Re-calibrate ground
   */
  recalibrate(): void {
    this._isCalibrated = false;
    this._floorY = 0;
    print("[CourseSetup] Recalibrating...");
    this.startCalibration();
  }

  /**
   * Check if calibration is complete
   */
  get isCalibrated(): boolean {
    return this._isCalibrated;
  }

  /**
   * Get calibrated floor Y position
   */
  get floorY(): number {
    return this._floorY;
  }

  /**
   * Get player's current ground position (uses calibrated floor height)
   */
  getPlayerGroundPosition(): vec3 {
    return this.groundCalibration.getPlayerGroundPosition();
  }

  // ── Calibration Callbacks ────────────────────────────────────────────────

  private onCalibrating(pos: vec3, rot: quat, progress: number): void {
    // Update visual indicator position
    if (this.calibrationVisual) {
      this.calibrationVisual.enabled = true;
      this.calibrationVisual.getTransform().setWorldPosition(pos);
      this.calibrationVisual.getTransform().setWorldRotation(rot);
    }

    // Update status text
    var pct = Math.round(progress * 100);
    this.showStatus("Detecting floor: " + pct + "%");

    if (progress > 0.5) {
      this.showInstruction("Hold steady...");
    }
  }

  private onCalibrated(pos: vec3, _rot: quat): void {
    print("[CourseSetup] Ground calibrated at Y=" + pos.y.toFixed(1));

    // Hide calibration visual
    if (this.calibrationVisual) {
      this.calibrationVisual.enabled = false;
    }

    // Store floor height
    this._floorY = pos.y;
    this._isCalibrated = true;

    // Set floor height in CourseManager
    var cm = this.getCourseManager();
    if (cm && typeof cm.setFloorHeight === 'function') {
      cm.setFloorHeight(this._floorY);
    }

    this.showStatus("Ready");
    this.showInstruction("");

    print("[CourseSetup] Calibration complete");
    print("[CourseSetup] Floor Y: " + this._floorY.toFixed(1));
    print("[CourseSetup] Floor offset: " + this.groundCalibration.floorOffset.toFixed(1) + "cm");
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getCourseManager(): any {
    return this.courseManagerScript as any;
  }

  private showStatus(msg: string): void {
    if (this.statusText) {
      this.statusText.text = msg;
    }
  }

  private showInstruction(msg: string): void {
    if (this.instructionText) {
      this.instructionText.text = msg;
    }
  }
}
