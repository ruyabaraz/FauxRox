// ============================================================================
// ProximityDetector.ts — HYROX MIRAGE Station Proximity Detection
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Attach to "RaceController" SceneObject.
// References CourseManager via @input (Inspector wiring).
// ============================================================================

@component
export class ProximityDetector extends BaseScriptComponent {

  // ── Inspector Inputs ────────────────────────────────────────────────────

  /** Camera SceneObject (user's head) */
  @input cameraObject: SceneObject;

  /** CourseManager component — drag CourseRoot here in Inspector */
  @input courseManager: CourseManager;

  /** Distance (cm) to trigger station enter */
  @input enterRadius: number = 120;

  /** Distance (cm) to trigger station exit (larger = hysteresis) */
  @input exitRadius: number = 180;

  /** Only check next active station (cheaper) vs all stations */
  @input checkOnlyActiveStation: boolean = true;

  // ── Callbacks ───────────────────────────────────────────────────────────
  // Set by RaceStateMachine at runtime.

  onStationEnter: (stationIndex: number, stationName: string, distance: number) => void = null;
  onStationExit: (stationIndex: number, stationName: string, distance: number) => void = null;

  // ── Internal ────────────────────────────────────────────────────────────

  private _insideFlags: boolean[] = [];
  private _cameraTransform: Transform;
  private _activeStationIndex: number = 0;

  // ── Lifecycle ─────────────────────────────────────────────────────────

  onAwake(): void {
    if (!this.cameraObject) {
      print('[ProximityDetector] ERROR: cameraObject not assigned!');
      return;
    }
    this._cameraTransform = this.cameraObject.getTransform();
    this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));
    print('[ProximityDetector] Init — enter=' + this.enterRadius + ' exit=' + this.exitRadius);
  }

  // ── Public API ────────────────────────────────────────────────────────

  /** Call when race starts or stations change */
  refreshStations(): void {
    if (!this.courseManager) return;
    var count = this.courseManager.stationCount;
    this._insideFlags = [];
    for (var i = 0; i < count; i++) {
      this._insideFlags.push(false);
    }
    this._activeStationIndex = 0;
    print('[ProximityDetector] Refreshed — ' + count + ' stations');
  }

  setActiveStation(index: number): void {
    this._activeStationIndex = index;
  }

  getDistanceToStation(index: number): number {
    if (!this.courseManager || index < 0 || index >= this.courseManager.stationCount) {
      return Infinity;
    }
    var userPos = this._cameraTransform.getWorldPosition();
    var stationPos = this.courseManager.stationPositions[index];
    return this.horizontalDistance(userPos, stationPos);
  }

  // ── Per-Frame ─────────────────────────────────────────────────────────

  private onUpdate(): void {
    if (!this._cameraTransform || !this.courseManager) return;
    if (this.courseManager.stationCount === 0) return;

    var userPos = this._cameraTransform.getWorldPosition();

    if (this.checkOnlyActiveStation) {
      if (this._activeStationIndex < this.courseManager.stationCount) {
        this.checkStation(this._activeStationIndex, userPos);
      }
    } else {
      for (var i = 0; i < this.courseManager.stationCount; i++) {
        this.checkStation(i, userPos);
      }
    }
  }

  // ── Core Detection ────────────────────────────────────────────────────

  private checkStation(index: number, userPos: vec3): void {
    var stationPos = this.courseManager.stationPositions[index];
    if (!stationPos) return;

    var dist = this.horizontalDistance(userPos, stationPos);
    var wasInside = this._insideFlags[index] || false;

    if (!wasInside && dist <= this.enterRadius) {
      // ── ENTER ──
      this._insideFlags[index] = true;
      var name = this.courseManager.stationNames[index];
      print('[ProximityDetector] ENTER ' + index + ' (' + name + ') dist=' + dist.toFixed(0));

      if (this.onStationEnter) {
        this.onStationEnter(index, name, dist);
      }

    } else if (wasInside && dist > this.exitRadius) {
      // ── EXIT ──
      this._insideFlags[index] = false;
      var exitName = this.courseManager.stationNames[index];
      print('[ProximityDetector] EXIT ' + index + ' (' + exitName + ') dist=' + dist.toFixed(0));

      if (this.onStationExit) {
        this.onStationExit(index, exitName, dist);
      }
    }
  }

  /**
   * XZ-plane distance only. Y ignored because user stands upright,
   * stations are on the ground.
   */
  private horizontalDistance(a: vec3, b: vec3): number {
    var dx = a.x - b.x;
    var dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
