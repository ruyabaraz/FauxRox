// ============================================================================
// GroundCalibration.ts — FauxRox Ground Detection
// Based on Path Pioneer's SurfaceDetection approach
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Uses WorldQueryModule directly for ground detection with:
// - 30-frame stability window
// - Floor offset tracking (player height compensation)
// - Dual callback system (calibrating + calibrated)
// ============================================================================

@component
export class GroundCalibration extends BaseScriptComponent {

  @input camera: SceneObject;
  @input @allowUndefined visualIndicator: SceneObject;
  @input @allowUndefined progressText: Text;

  // Detection parameters
  @input maxHitDistance: number = 500;
  @input minHitDistance: number = 30;
  @input calibrationFrames: number = 30;
  @input moveThreshold: number = 8;

  // Floor offset (player height tracking)
  private _floorOffsetFromCamera: number = -100;
  private _floorIsSet: boolean = false;

  // WorldQuery
  private worldQueryModule = require("LensStudio:WorldQueryModule") as WorldQueryModule;
  private hitTestSession: HitTestSession = null;
  private camTransform: Transform = null;

  // Calibration state
  private isCalibrating: boolean = false;
  private history: vec3[] = [];
  private stableFrames: number = 0;
  private desiredPosition: vec3 = vec3.zero();
  private desiredRotation: quat = quat.quatIdentity();
  private updateEvent: SceneEvent = null;

  // Callbacks
  private onCalibratingCallback: (pos: vec3, rot: quat, progress: number) => void = null;
  private onCalibratedCallback: (pos: vec3, rot: quat) => void = null;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  onAwake(): void {
    if (!this.camera) {
      print("[GroundCalibration] ERROR: Camera not assigned!");
      return;
    }
    this.camTransform = this.camera.getTransform();

    // Initialize WorldQuery hit test session
    try {
      var options = HitTestSessionOptions.create();
      options.filter = true;
      this.hitTestSession = this.worldQueryModule.createHitTestSessionWithOptions(options);
      print("[GroundCalibration] WorldQuery session created");
    } catch (e) {
      print("[GroundCalibration] ERROR creating hit test session: " + e);
    }

    if (this.visualIndicator) {
      this.visualIndicator.enabled = false;
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Start ground calibration process
   * @param onCalibrating Called each frame during calibration with progress (0-1)
   * @param onCalibrated Called once when calibration completes
   */
  startCalibration(
    onCalibrating: (pos: vec3, rot: quat, progress: number) => void,
    onCalibrated: (pos: vec3, rot: quat) => void
  ): void {
    if (this.isCalibrating) {
      print("[GroundCalibration] Already calibrating, ignoring start request");
      return;
    }

    print("[GroundCalibration] Starting ground calibration...");
    this.isCalibrating = true;
    this.history = [];
    this.stableFrames = 0;
    this.onCalibratingCallback = onCalibrating;
    this.onCalibratedCallback = onCalibrated;

    // Show visual indicator
    if (this.visualIndicator) {
      this.visualIndicator.enabled = true;
    }

    // Start hit test session
    if (this.hitTestSession) {
      this.hitTestSession.start();
    }

    // Create update loop
    this.updateEvent = this.createEvent("UpdateEvent");
    this.updateEvent.bind(() => this.onUpdate());
  }

  /**
   * Stop calibration (cancel)
   */
  stopCalibration(): void {
    this.cleanup();
    print("[GroundCalibration] Calibration stopped");
  }

  /**
   * Get player's ground position based on current camera position and stored floor offset
   */
  getPlayerGroundPosition(): vec3 {
    if (!this._floorIsSet) {
      print("[GroundCalibration] WARNING: Floor not calibrated yet, using default offset");
    }
    var camPos = this.camTransform.getWorldPosition();
    return new vec3(camPos.x, camPos.y + this._floorOffsetFromCamera, camPos.z);
  }

  /**
   * Check if floor has been calibrated
   */
  get isFloorCalibrated(): boolean {
    return this._floorIsSet;
  }

  /**
   * Get the floor offset from camera (negative value = floor is below camera)
   */
  get floorOffset(): number {
    return this._floorOffsetFromCamera;
  }

  // ── Update Loop ──────────────────────────────────────────────────────────

  private onUpdate(): void {
    if (!this.isCalibrating || !this.hitTestSession) return;

    var camPos = this.camTransform.getWorldPosition();
    var camForward = this.camTransform.forward;

    // Bias ray slightly downward to find floor
    var rayDirection = new vec3(camForward.x, camForward.y + 0.15, camForward.z).normalize();

    // Ray from camera forward
    var rayStart = camPos.add(rayDirection.uniformScale(-this.minHitDistance));
    var rayEnd = camPos.add(rayDirection.uniformScale(-this.maxHitDistance));

    this.hitTestSession.hitTest(rayStart, rayEnd, (result) => {
      this.onHitTestResult(result);
    });
  }

  private onHitTestResult(result: any): void {
    var camPos = this.camTransform.getWorldPosition();

    if (result === null) {
      // No surface found - show default position
      this.updateVisualDefault();
      this.stableFrames = 0;
      this.history = [];
      this.updateProgress(0);
      return;
    }

    var hitPos = result.position;
    var hitNormal = result.normal;

    // Check if this is a horizontal surface (floor)
    var isHorizontal = hitNormal.y > 0.9;

    if (!isHorizontal) {
      // Not a floor surface
      this.updateVisualDefault();
      this.stableFrames = 0;
      this.history = [];
      this.updateProgress(0);
      return;
    }

    // Valid horizontal surface found
    this.desiredPosition = hitPos;

    // Calculate rotation facing camera
    var worldCameraForward = this.camTransform.right.cross(vec3.up()).normalize();
    this.desiredRotation = quat.lookAt(worldCameraForward, vec3.up());

    // Update visual indicator
    this.updateVisual(this.desiredPosition, this.desiredRotation);

    // Track stability
    this.history.push(hitPos);
    if (this.history.length > this.calibrationFrames) {
      this.history.shift();
    }

    // Check if position is stable (hasn't moved more than threshold)
    if (this.history.length >= 2) {
      var firstPos = this.history[0];
      var lastPos = this.history[this.history.length - 1];
      var movement = firstPos.distance(lastPos);

      if (movement < this.moveThreshold) {
        this.stableFrames++;
      } else {
        this.stableFrames = Math.max(0, this.stableFrames - 2);
      }
    }

    // Calculate progress
    var progress = Math.min(1, this.stableFrames / this.calibrationFrames);
    this.updateProgress(progress);

    // Call calibrating callback
    if (this.onCalibratingCallback) {
      this.onCalibratingCallback(this.desiredPosition, this.desiredRotation, progress);
    }

    // Check if calibration complete
    if (this.stableFrames >= this.calibrationFrames) {
      this.onCalibrationComplete();
    }
  }

  // ── Calibration Complete ─────────────────────────────────────────────────

  private onCalibrationComplete(): void {
    print("[GroundCalibration] Calibration complete!");

    // Store floor offset from camera
    var camPos = this.camTransform.getWorldPosition();
    var floorY = this.desiredPosition.y;
    this._floorOffsetFromCamera = floorY - camPos.y;
    this._floorIsSet = true;

    print("[GroundCalibration] Floor offset: " + this._floorOffsetFromCamera.toFixed(1) + "cm");
    print("[GroundCalibration] Floor Y: " + floorY.toFixed(1) + ", Camera Y: " + camPos.y.toFixed(1));

    // Call completion callback
    if (this.onCalibratedCallback) {
      this.onCalibratedCallback(this.desiredPosition, this.desiredRotation);
    }

    this.cleanup();
  }

  // ── Visual Updates ───────────────────────────────────────────────────────

  private updateVisual(pos: vec3, rot: quat): void {
    if (!this.visualIndicator) return;
    this.visualIndicator.enabled = true;
    this.visualIndicator.getTransform().setWorldPosition(pos);
    this.visualIndicator.getTransform().setWorldRotation(rot);
  }

  private updateVisualDefault(): void {
    if (!this.visualIndicator) return;
    var camPos = this.camTransform.getWorldPosition();
    var forward = this.camTransform.forward;
    var defaultPos = camPos.add(forward.uniformScale(-200));
    defaultPos.y = camPos.y - 100; // Below camera
    this.visualIndicator.getTransform().setWorldPosition(defaultPos);
  }

  private updateProgress(progress: number): void {
    if (!this.progressText) return;
    var pct = Math.round(progress * 100);
    this.progressText.text = "Calibrating: " + pct + "%";
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  private cleanup(): void {
    this.isCalibrating = false;

    if (this.updateEvent) {
      this.removeEvent(this.updateEvent);
      this.updateEvent = null;
    }

    if (this.hitTestSession) {
      this.hitTestSession.stop();
    }

    if (this.visualIndicator) {
      this.visualIndicator.enabled = false;
    }

    if (this.progressText) {
      this.progressText.text = "";
    }

    this.onCalibratingCallback = null;
    this.onCalibratedCallback = null;
  }
}
