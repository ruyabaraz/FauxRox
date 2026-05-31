// ============================================================================
// CourseManager.ts — HYROX MIRAGE Course Placement via World Query
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Attach to SceneObject "CourseRoot".
// No import/export — Lens Studio resolves @component classes globally.
// Other scripts reference this via @input CourseManager in Inspector.
// ============================================================================

const WorldQueryModule = require('LensStudio:WorldQueryModule');

// ── Course Layout Config ────────────────────────────────────────────────────

enum StationType {
  START_LINE    = 'START_LINE',
  GATE_RUN      = 'GATE_RUN',
  BURPEE_JUMP   = 'BURPEE_JUMP',
  LUNGE_CORR    = 'LUNGE_CORRIDOR',
  WALL_BALL     = 'WALL_BALL',
  FINISH_TUNNEL = 'FINISH_TUNNEL',
}

interface StationConfig {
  name: string;
  type: StationType;
  forwardOffset: number;   // cm from previous station
  lateralOffset: number;   // cm perpendicular
}

const DEFAULT_COURSE: StationConfig[] = [
  { name: 'START',           type: StationType.START_LINE,    forwardOffset: 0,   lateralOffset: 0  },
  { name: 'Gate Run 1',      type: StationType.GATE_RUN,      forwardOffset: 400, lateralOffset: 0  },
  { name: 'Burpee Jumps',    type: StationType.BURPEE_JUMP,   forwardOffset: 350, lateralOffset: 50 },
  { name: 'Gate Run 2',      type: StationType.GATE_RUN,      forwardOffset: 400, lateralOffset: 0  },
  { name: 'Lunge Corridor',  type: StationType.LUNGE_CORR,    forwardOffset: 300, lateralOffset: -50},
  { name: 'Wall Ball',       type: StationType.WALL_BALL,     forwardOffset: 350, lateralOffset: 0  },
  { name: 'FINISH',          type: StationType.FINISH_TUNNEL, forwardOffset: 400, lateralOffset: 0  },
];

// ============================================================================

@component
export class CourseManager extends BaseScriptComponent {

  // ── Inspector Inputs ────────────────────────────────────────────────────

  @input cameraObject: SceneObject;
  @input startLinePrefab: ObjectPrefab;
  @input gatePrefab: ObjectPrefab;
  @input burpeePrefab: ObjectPrefab;
  @input lungePrefab: ObjectPrefab;
  @input wallBallPrefab: ObjectPrefab;
  @input finishPrefab: ObjectPrefab;

  @input @allowUndefined highlightMaterial: Material;
  @input @allowUndefined completedMaterial: Material;
  @input useWorldQueryFilter: boolean = true;
  @input courseScale: number = 1.0;

  // ── Public Station Data ─────────────────────────────────────────────────
  // Accessed directly by RaceStateMachine and ProximityDetector
  // via their @input courseManager reference.

  stationNames: string[] = [];
  stationPositions: vec3[] = [];
  stationDistanceLabels: string[] = [];
  stationObjects: SceneObject[] = [];
  stationCompleted: boolean[] = [];

  // ── Internal ────────────────────────────────────────────────────────────

  private _hitTestSession: any = null;
  private _coursePlaced: boolean = false;
  private _cameraTransform: Transform;

  get isCoursePlaced(): boolean { return this._coursePlaced; }
  get stationCount(): number { return this.stationNames.length; }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  onAwake(): void {
    if (this.cameraObject) {
      this._cameraTransform = this.cameraObject.getTransform();
    }
    this._hitTestSession = WorldQueryModule.createHitTestSessionWithOptions({
      filter: this.useWorldQueryFilter,
    });
    print('[CourseManager] Init — ' + DEFAULT_COURSE.length + ' stations, scale=' + this.courseScale);
  }

  // ── Public API ────────────────────────────────────────────────────────

  placeCourse(): void {
    if (this._coursePlaced) {
      print('[CourseManager] Already placed. resetCourse() first.');
      return;
    }
    if (!this._cameraTransform) {
      print('[CourseManager] ERROR: cameraObject not set!');
      return;
    }

    var camPos = this._cameraTransform.getWorldPosition();
    var camForward = this._cameraTransform.forward;
    var rayDir = new vec3(camForward.x, -0.5, camForward.z).normalize();

    this._hitTestSession.hitTest(camPos, rayDir, (hitResult: any) => {
      if (hitResult === null) {
        print('[CourseManager] No surface — fallback placement.');
        this.placeCourseAtFallback(camPos, camForward);
        return;
      }
      this.placeCourseAtHit(hitResult.position, camForward);
    });
  }

  highlightStation(index: number): void {
    for (var i = 0; i < this.stationObjects.length; i++) {
      if (i < index && this.completedMaterial) {
        this.applyMaterial(this.stationObjects[i], this.completedMaterial);
        this.stationCompleted[i] = true;
      } else if (i === index && this.highlightMaterial) {
        this.applyMaterial(this.stationObjects[i], this.highlightMaterial);
      }
    }
  }

  resetCourse(): void {
    for (var i = 0; i < this.stationObjects.length; i++) {
      if (this.stationObjects[i]) {
        this.stationObjects[i].destroy();
      }
    }
    this.stationNames = [];
    this.stationPositions = [];
    this.stationDistanceLabels = [];
    this.stationObjects = [];
    this.stationCompleted = [];
    this._coursePlaced = false;
    print('[CourseManager] Course reset');
  }

  // ── Placement ─────────────────────────────────────────────────────────

  private placeCourseAtHit(hitPos: vec3, camForward: vec3): void {
    print('[CourseManager] Surface at (' + hitPos.x.toFixed(0) + ','
      + hitPos.y.toFixed(0) + ',' + hitPos.z.toFixed(0) + ')');
    var courseDir = new vec3(camForward.x, 0, camForward.z).normalize();
    var courseLateral = new vec3(-courseDir.z, 0, courseDir.x);
    this.layoutStations(hitPos, courseDir, courseLateral);
  }

  private placeCourseAtFallback(camPos: vec3, camForward: vec3): void {
    var groundY = camPos.y - 150;
    var groundPos = new vec3(camPos.x, groundY, camPos.z);
    var courseDir = new vec3(camForward.x, 0, camForward.z).normalize();
    var courseLateral = new vec3(-courseDir.z, 0, courseDir.x);
    print('[CourseManager] Fallback ground Y=' + groundY.toFixed(0));
    this.layoutStations(groundPos, courseDir, courseLateral);
  }

  private layoutStations(origin: vec3, forwardDir: vec3, lateralDir: vec3): void {
    var currentPos = new vec3(origin.x, origin.y, origin.z);

    for (var i = 0; i < DEFAULT_COURSE.length; i++) {
      var config = DEFAULT_COURSE[i];
      var fwd = config.forwardOffset * this.courseScale;
      var lat = config.lateralOffset * this.courseScale;

      currentPos = new vec3(
        currentPos.x + forwardDir.x * fwd + lateralDir.x * lat,
        currentPos.y,
        currentPos.z + forwardDir.z * fwd + lateralDir.z * lat
      );

      var prefab = this.getPrefabForType(config.type);
      if (!prefab) {
        print('[CourseManager] WARNING: No prefab for ' + config.type);
        continue;
      }

      var stationObj = prefab.instantiate(this.sceneObject);
      stationObj.getTransform().setWorldPosition(currentPos);

      var lookRot = quat.lookAt(forwardDir, vec3.up());
      stationObj.getTransform().setWorldRotation(lookRot);

      var distLabel = '';
      if (i < DEFAULT_COURSE.length - 1) {
        var nextFwd = DEFAULT_COURSE[i + 1].forwardOffset * this.courseScale;
        distLabel = (nextFwd / 100).toFixed(0) + 'm ahead';
      } else {
        distLabel = 'FINAL';
      }

      this.stationNames.push(config.name);
      this.stationPositions.push(new vec3(currentPos.x, currentPos.y, currentPos.z));
      this.stationDistanceLabels.push(distLabel);
      this.stationObjects.push(stationObj);
      this.stationCompleted.push(false);

      print('[CourseManager] Placed ' + i + ': ' + config.name);
    }

    this._coursePlaced = true;

    if (this.highlightMaterial && this.stationObjects.length > 0) {
      this.applyMaterial(this.stationObjects[0], this.highlightMaterial);
    }

    print('[CourseManager] Course placed! ' + this.stationNames.length + ' stations');
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private getPrefabForType(type: StationType): ObjectPrefab | null {
    switch (type) {
      case StationType.START_LINE:    return this.startLinePrefab;
      case StationType.GATE_RUN:      return this.gatePrefab;
      case StationType.BURPEE_JUMP:   return this.burpeePrefab;
      case StationType.LUNGE_CORR:    return this.lungePrefab;
      case StationType.WALL_BALL:     return this.wallBallPrefab;
      case StationType.FINISH_TUNNEL: return this.finishPrefab;
      default:                        return this.gatePrefab;
    }
  }

  private applyMaterial(obj: SceneObject, mat: Material): void {
    var childCount = obj.getChildrenCount();
    for (var i = 0; i < childCount; i++) {
      var rmv = obj.getChild(i).getComponent('Component.RenderMeshVisual');
      if (rmv) { rmv.mainMaterial = mat; }
    }
    var rootRmv = obj.getComponent('Component.RenderMeshVisual');
    if (rootRmv) { rootRmv.mainMaterial = mat; }
  }
}
