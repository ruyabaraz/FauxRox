// ============================================================================
// ProximityDetector.ts — HYROX MIRAGE Station Proximity Detection
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================

@component
export class ProximityDetector extends BaseScriptComponent {

  @input cameraObject: SceneObject;

  /** Drag CourseRoot SceneObject here — Inspector resolves the ScriptComponent */
  @input courseManagerScript: ScriptComponent;

  @input enterRadius: number = 120;
  @input exitRadius: number = 180;
  @input checkOnlyActiveStation: boolean = true;

  // Callbacks — set by RaceStateMachine at runtime
  onStationEnter: (stationIndex: number, stationName: string, distance: number) => void = null;
  onStationExit: (stationIndex: number, stationName: string, distance: number) => void = null;

  private _insideFlags: boolean[] = [];
  private _cameraTransform: Transform;
  private _activeStationIndex: number = 0;
  private _stationCount: number = 0;

  onAwake(): void {
    if (!this.cameraObject) {
      print('[ProximityDetector] ERROR: cameraObject not assigned!');
      return;
    }
    this._cameraTransform = this.cameraObject.getTransform();
    this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));
    print('[ProximityDetector] Init — enter=' + this.enterRadius + ' exit=' + this.exitRadius);
  }

  // Runtime accessor — bypasses compile-time type checking
  private getCM(): any {
    return this.courseManagerScript as any;
  }

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
    var cm = this.getCM();
    var stationPos = cm.stationPositions[index];
    return this.horizontalDistance(userPos, stationPos);
  }

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

  private checkStation(index: number, userPos: vec3): void {
    var cm = this.getCM();
    var stationPos = cm.stationPositions[index];
    if (!stationPos) return;

    var dist = this.horizontalDistance(userPos, stationPos);
    var wasInside = this._insideFlags[index] || false;

    if (!wasInside && dist <= this.enterRadius) {
      this._insideFlags[index] = true;
      var enterName = cm.stationNames[index];
      print('[ProximityDetector] ENTER ' + index + ' (' + enterName + ') d=' + dist.toFixed(0));
      if (this.onStationEnter) {
        this.onStationEnter(index, enterName, dist);
      }
    } else if (wasInside && dist > this.exitRadius) {
      this._insideFlags[index] = false;
      var exitName = cm.stationNames[index];
      print('[ProximityDetector] EXIT ' + index + ' (' + exitName + ') d=' + dist.toFixed(0));
      if (this.onStationExit) {
        this.onStationExit(index, exitName, dist);
      }
    }
  }

  private horizontalDistance(a: vec3, b: vec3): number {
    var dx = a.x - b.x;
    var dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
