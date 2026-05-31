// ============================================================================
// CourseManager.ts — HYROX MIRAGE Course Placement via World Query
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Attach to SceneObject "CourseRoot".
// Other scripts reference this via @input as Component.ScriptComponent,
// then access public properties/methods at runtime.
// ============================================================================

const WorldQueryModule = require('LensStudio:WorldQueryModule');

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

  // ── Public Data (accessed by other scripts at runtime) ──────────────────

  stationNames: string[] = [];
  stationPositions: vec3[] = [];
  stationDistanceLabels: string[] = [];
  stationObjects: SceneObject[] = [];
  stationCompleted: boolean[] = [];
  isCoursePlaced: boolean = false;
  stationCount: number = 0;

  // ── Course Config ─────────────────────────────────────────────────────

  private _courseConfig: { name: string; type: string; fwd: number; lat: number }[] = [
    { name: 'START',          type: 'START_LINE',      fwd: 0,   lat: 0   },
    { name: 'Gate Run 1',     type: 'GATE_RUN',        fwd: 400, lat: 0   },
    { name: 'Burpee Jumps',   type: 'BURPEE_JUMP',     fwd: 350, lat: 50  },
    { name: 'Gate Run 2',     type: 'GATE_RUN',        fwd: 400, lat: 0   },
    { name: 'Lunge Corridor', type: 'LUNGE_CORRIDOR',  fwd: 300, lat: -50 },
    { name: 'Wall Ball',      type: 'WALL_BALL',       fwd: 350, lat: 0   },
    { name: 'FINISH',         type: 'FINISH_TUNNEL',   fwd: 400, lat: 0   },
  ];

  // ── Internal ────────────────────────────────────────────────────────────

  private _hitTestSession: any = null;
  private _cameraTransform: Transform;

  // ── Lifecycle ─────────────────────────────────────────────────────────

  onAwake(): void {
    if (this.cameraObject) {
      this._cameraTransform = this.cameraObject.getTransform();
    }
    // Use native HitTestSessionOptions — plain JS object causes "not a native object" error
    var options = HitTestSessionOptions.create();
    options.filter = this.useWorldQueryFilter;
    this._hitTestSession = WorldQueryModule.createHitTestSessionWithOptions(options);
    print('[CourseManager] Init — World Query active, ' + this._courseConfig.length + ' stations, scale=' + this.courseScale);
  }

  // ── Public Methods ────────────────────────────────────────────────────

  placeCourse(): void {
    if (this.isCoursePlaced) {
      print('[CourseManager] Already placed. resetCourse() first.');
      return;
    }
    if (!this._cameraTransform) {
      print('[CourseManager] ERROR: cameraObject not set!');
      return;
    }

    var camPos = this._cameraTransform.getWorldPosition();
    var camFwd = this._cameraTransform.forward;
    var rayDir = new vec3(camFwd.x, -0.5, camFwd.z).normalize();

    this._hitTestSession.hitTest(camPos, rayDir, (hitResult: any) => {
      if (hitResult === null) {
        print('[CourseManager] No surface hit — fallback placement.');
        var fallbackY = camPos.y - 150;
        this.layoutStations(new vec3(camPos.x, fallbackY, camPos.z), camFwd);
      } else {
        print('[CourseManager] Surface hit at Y=' + hitResult.position.y.toFixed(0));
        this.layoutStations(hitResult.position, camFwd);
      }
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
    this.isCoursePlaced = false;
    this.stationCount = 0;
    print('[CourseManager] Course reset');
  }

  // ── Layout ────────────────────────────────────────────────────────────

  private layoutStations(origin: vec3, camForward: vec3): void {
    var forwardDir = new vec3(camForward.x, 0, camForward.z).normalize();
    var lateralDir = new vec3(-forwardDir.z, 0, forwardDir.x);
    var currentPos = new vec3(origin.x, origin.y, origin.z);

    for (var i = 0; i < this._courseConfig.length; i++) {
      var cfg = this._courseConfig[i];
      var fwd = cfg.fwd * this.courseScale;
      var lat = cfg.lat * this.courseScale;

      currentPos = new vec3(
        currentPos.x + forwardDir.x * fwd + lateralDir.x * lat,
        currentPos.y,
        currentPos.z + forwardDir.z * fwd + lateralDir.z * lat
      );

      var prefab = this.getPrefab(cfg.type);
      if (!prefab) {
        print('[CourseManager] No prefab for ' + cfg.type);
        continue;
      }

      var obj = prefab.instantiate(this.sceneObject);
      obj.getTransform().setWorldPosition(currentPos);
      obj.getTransform().setWorldRotation(quat.lookAt(forwardDir, vec3.up()));

      var distLabel = '';
      if (i < this._courseConfig.length - 1) {
        distLabel = (this._courseConfig[i + 1].fwd * this.courseScale / 100).toFixed(0) + 'm';
      } else {
        distLabel = 'FINAL';
      }

      this.stationNames.push(cfg.name);
      this.stationPositions.push(new vec3(currentPos.x, currentPos.y, currentPos.z));
      this.stationDistanceLabels.push(distLabel);
      this.stationObjects.push(obj);
      this.stationCompleted.push(false);

      print('[CourseManager] ' + i + ': ' + cfg.name + ' placed');
    }

    this.stationCount = this.stationNames.length;
    this.isCoursePlaced = true;

    if (this.highlightMaterial && this.stationObjects.length > 0) {
      this.applyMaterial(this.stationObjects[0], this.highlightMaterial);
    }
    print('[CourseManager] Done — ' + this.stationCount + ' stations');
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private getPrefab(type: string): ObjectPrefab {
    switch (type) {
      case 'START_LINE':     return this.startLinePrefab;
      case 'GATE_RUN':       return this.gatePrefab;
      case 'BURPEE_JUMP':    return this.burpeePrefab;
      case 'LUNGE_CORRIDOR': return this.lungePrefab;
      case 'WALL_BALL':      return this.wallBallPrefab;
      case 'FINISH_TUNNEL':  return this.finishPrefab;
      default:               return this.gatePrefab;
    }
  }

  private applyMaterial(obj: SceneObject, mat: Material): void {
    var count = obj.getChildrenCount();
    for (var i = 0; i < count; i++) {
      var rmv = obj.getChild(i).getComponent('Component.RenderMeshVisual');
      if (rmv) { rmv.mainMaterial = mat; }
    }
    var rootRmv = obj.getComponent('Component.RenderMeshVisual');
    if (rootRmv) { rootRmv.mainMaterial = mat; }
  }
}
