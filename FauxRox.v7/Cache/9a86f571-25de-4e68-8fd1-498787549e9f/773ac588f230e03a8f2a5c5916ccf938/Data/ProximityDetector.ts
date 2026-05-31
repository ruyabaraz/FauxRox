// ============================================================================
// ProximityDetector.ts — HYROX MIRAGE Station Proximity Detection
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Attach to "RaceController" SceneObject.
// courseManager is typed as ScriptComponent to avoid cross-file TS2304.
// At runtime we access .stationPositions, .stationNames etc. directly.
// ============================================================================

@component
export class ProximityDetector extends BaseScriptComponent {

  // ── Inspector Inputs ────────────────────────────────────────────────────

  @input cameraObject: SceneObject;

  /** Drag the CourseRoot SceneObject here.
   *  Typed as ScriptComponent to avoid compile-order dependency. */
  @input courseManagerScript: Component.ScriptComponent;

  @input enterRadius: number = 120;
  @input exitRadius: number = 180;
  @input checkOnlyActiveStation: boolean = true;

  // ── Callbacks (set by RaceStateMachine at runtime) ──────────────────────

  onStationEnter: (stationIndex: number, stationName: string, distance: number) => void = null;
  onStationExit: (stationIndex: number, stationName: string, distance: number) => void = null;

  // ── Internal ────────────────────────────────────────────────────────────

  private _insideFlags: boolean[] = [];
  private _cameraTransform: Transform;
  private _activeStationIndex: number = 0;
  private _stationCount: number = 0;

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

  // ── CourseManager Data Access (runtime, via ScriptComponent) ────────────

  private getCM(): any {
    return this.courseManagerScript as any;
  }

  private getStationPosition(index: number): vec3 {
    var cm = this.getCM();
    if (cm && cm.stationPositions && index < cm.stationPositions.length) {
      return cm.stationPositions[index];
    }
    return vec3.zero();
  }

  private getStationName(index: number): string {
    var cm = this.getCM();
    if (cm && cm.stationNames && index < cm.stationNames.length) {
      return cm.stationNames[index];
    }
    return '';
  }

  // ── Public API ────────────────────────────────────────────────────────

  refreshStations(): void {
    var cm = this.getCM();
    if (!cm) return;
    this._stationCount = cm.stationCount || 0;
    this._insideFlags = [];
    for (var i = 0; i < this._stationCount; i++) {
      this._insideFlags.push(false);
    }
    this._activeStationIndex = 0;
    print('[ProximityDetector] Refreshed — ' + this._stationCount + ' stations');
  }

  setActiveStation(index: number): void {
    this._activeStationIndex = index;
  }

  getDistanceToStation(index: number): number {
    if (index < 0 || index >= this._stationCount) return Infinity;
    var userPos = this._cameraTransform.getWorldPosition();
    return this.horizontalDistance(userPos, this.getStationPosition(index));
  }

  // ── Per-Frame ─────────────────────────────────────────────────────────

  private onUpdate(): void {
    if (!this._cameraTransform || this._stationCount === 0) return;

    var userPos = this._cameraTransform.getWorldPosition();

    if (this.checkOnlyActiveStation) {
      if (this._activeStationIndex < this._stationCount) {
        this.checkStation(this._activeStationIndex, userPos);
      }
    } else {
      for (var i = 0; i < this._stationCount; i++) {
        this.checkStation(i, userPos);
      }
    }
  }

  // ── Core Detection ────────────────────────────────────────────────────

  private checkStation(index: number, userPos: vec3): void {
    var stationPos = this.getStationPosition(index);
    var dist = this.horizontalDistance(userPos, stationPos);
    var wasInside = this._insideFlags[index] || false;

    if (!wasInside && dist <= this.enterRadius) {
      this._insideFlags[index] = true;
      var enterName = this.getStationName(index);
      print('[ProximityDetector] ENTER ' + index + ' (' + enterName + ') d=' + dist.toFixed(0));
      if (this.onStationEnter) {
        this.onStationEnter(index, enterName, dist);
      }
    } else if (wasInside && dist > this.exitRadius) {
      this._insideFlags[index] = false;
      var exitName = this.getStationName(index);
      print('[ProximityDetector] EXIT ' + index + ' (' + exitName + ') d=' + dist.toFixed(0));
      if (this.onStationExit) {
        this.onStationExit(index, exitName, dist);
      }
    }
  }

  /** XZ-plane distance. Y ignored (user upright, stations on ground). */
  private horizontalDistance(a: vec3, b: vec3): number {
    var dx = a.x - b.x;
    var dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
