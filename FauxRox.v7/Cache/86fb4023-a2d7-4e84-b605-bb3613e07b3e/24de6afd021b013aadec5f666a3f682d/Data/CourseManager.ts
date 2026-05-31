// ============================================================================
// CourseManager.ts — HYROX MIRAGE Course Placement
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// NO SurfacePlacement imports needed.
// Example.ts (from SurfacePlacement package) handles the scanning UX.
// When user confirms placement, Example.ts calls our placeCourseAt().
//
// Attach to SceneObject "CourseRoot".
// ============================================================================

@component
export class CourseManager extends BaseScriptComponent {

  // ── Inspector Inputs ────────────────────────────────────────────────────

  @input startLinePrefab: ObjectPrefab;
  @input gatePrefab: ObjectPrefab;
  @input burpeePrefab: ObjectPrefab;
  @input lungePrefab: ObjectPrefab;
  @input wallBallPrefab: ObjectPrefab;
  @input finishPrefab: ObjectPrefab;

  @input @allowUndefined highlightMaterial: Material;
  @input @allowUndefined completedMaterial: Material;

  /** Overall course scale (1.0 = default distances in cm) */
  @input courseScale: number = 1.0;

  // ── Public Data (accessed by other scripts via ScriptComponent cast) ───

  stationNames: string[] = [];
  stationPositions: vec3[] = [];
  stationDistanceLabels: string[] = [];
  stationObjects: SceneObject[] = [];
  stationCompleted: boolean[] = [];
  isCoursePlaced: boolean = false;
  stationCount: number = 0;

  // ── Course Config ─────────────────────────────────────────────────────

  private _courseConfig = [
    { name: 'START',          type: 'START_LINE',     fwd: 0,   lat: 0   },
    { name: 'Gate Run 1',     type: 'GATE_RUN',       fwd: 400, lat: 0   },
    { name: 'Burpee Jumps',   type: 'BURPEE_JUMP',    fwd: 350, lat: 50  },
    { name: 'Gate Run 2',     type: 'GATE_RUN',       fwd: 400, lat: 0   },
    { name: 'Lunge Corridor', type: 'LUNGE_CORRIDOR', fwd: 300, lat: -50 },
    { name: 'Wall Ball',      type: 'WALL_BALL',      fwd: 350, lat: 0   },
    { name: 'FINISH',         type: 'FINISH_TUNNEL',  fwd: 400, lat: 0   },
  ];

  // ── Lifecycle ─────────────────────────────────────────────────────────

  onAwake(): void {
    print('[CourseManager] Init — ' + this._courseConfig.length + ' stations, scale=' + this.courseScale);
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Place the course at a confirmed surface position and rotation.
   * Called by Example.ts onSurfaceDetected callback.
   *
   * pos = ground point (world space, cm)
   * rot = surface orientation (forward direction for course layout)
   */
  placeCourseAt(pos: vec3, rot: quat): void {
    if (this.isCoursePlaced) {
      print('[CourseManager] Already placed. resetCourse() first.');
      return;
    }

    print('[CourseManager] Placing course at ('
      + pos.x.toFixed(0) + ', ' + pos.y.toFixed(0) + ', ' + pos.z.toFixed(0) + ')');

    // Extract forward direction from placement rotation (XZ only)
    var forwardDir = rot.multiplyVec3(vec3.forward()).uniformScale(-1);
    forwardDir = new vec3(forwardDir.x, 0, forwardDir.z).normalize();
    var lateralDir = new vec3(-forwardDir.z, 0, forwardDir.x);

    this.layoutStations(pos, forwardDir, lateralDir);
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

  private layoutStations(origin: vec3, forwardDir: vec3, lateralDir: vec3): void {
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
    print('[CourseManager] Course placed — ' + this.stationCount + ' stations');
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
      if (rmv) rmv.mainMaterial = mat;
    }
    var rootRmv = obj.getComponent('Component.RenderMeshVisual');
    if (rootRmv) rootRmv.mainMaterial = mat;
  }
}
