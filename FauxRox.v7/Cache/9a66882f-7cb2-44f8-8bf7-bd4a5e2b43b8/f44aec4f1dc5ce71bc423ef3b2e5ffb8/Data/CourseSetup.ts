// ============================================================================
// CourseSetup.ts — HYROX MIRAGE Course Setup Controller
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Replaces Example.ts / SurfacePlacement.lspkg with custom GroundCalibration.
// Handles the full flow: calibration → course placement → race start.
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

  private _isCoursePlaced: boolean = false;
  private _coursePosition: vec3 = vec3.zero();
  private _courseRotation: quat = quat.quatIdentity();

  // ── Lifecycle ────────────────────────────────────────────────────────────

  onAwake(): void {
    print("[CourseSetup] Initialized");

    if (!this.groundCalibration) {
      print("[CourseSetup] ERROR: GroundCalibration not assigned!");
      return;
    }

    if (!this.courseManagerScript) {
      print("[CourseSetup] ERROR: CourseManager not assigned!");
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
    if (this._isCoursePlaced) {
      print("[CourseSetup] Course already placed. Call resetCourse() first.");
      return;
    }

    this.showInstruction("Look at the floor and hold still");

    this.groundCalibration.startCalibration(
      (pos, rot, progress) => this.onCalibrating(pos, rot, progress),
      (pos, rot) => this.onCalibrated(pos, rot)
    );
  }

  /**
   * Reset course and restart calibration
   */
  resetCourse(): void {
    var cm = this.getCourseManager();
    if (cm && cm.isCoursePlaced) {
      cm.resetCourse();
    }

    this._isCoursePlaced = false;
    this._coursePosition = vec3.zero();
    this._courseRotation = quat.quatIdentity();

    print("[CourseSetup] Course reset, restarting calibration...");
    this.startCalibration();
  }

  /**
   * Check if course is placed
   */
  get isCoursePlaced(): boolean {
    return this._isCoursePlaced;
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

  private onCalibrated(pos: vec3, rot: quat): void {
    print("[CourseSetup] Ground calibrated at Y=" + pos.y.toFixed(1));

    // Hide calibration visual
    if (this.calibrationVisual) {
      this.calibrationVisual.enabled = false;
    }

    // Store course placement
    this._coursePosition = pos;
    this._courseRotation = rot;

    // Place the course
    this.placeCourse(pos, rot);
  }

  // ── Course Placement ─────────────────────────────────────────────────────

  private placeCourse(pos: vec3, rot: quat): void {
    var cm = this.getCourseManager();
    if (!cm) {
      print("[CourseSetup] ERROR: CourseManager not available!");
      return;
    }

    // Place course at calibrated position
    cm.placeCourseAt(pos, rot);
    this._isCoursePlaced = true;

    this.showStatus("");  // Clear status
    this.showInstruction("");  // Clear instruction - StartTrigger's hintText takes over

    print("[CourseSetup] Course placed successfully");
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
