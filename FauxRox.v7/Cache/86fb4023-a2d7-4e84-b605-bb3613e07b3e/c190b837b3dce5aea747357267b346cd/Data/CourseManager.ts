// ============================================================================
// CourseManager.ts — HYROX MIRAGE Course Placement
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Uses SurfacePlacementController (Horizontal mode) for ground detection.
// User looks around to scan, pinches to confirm placement point.
// Course stations are laid out from that point along camera forward.
//
// Attach to SceneObject "CourseRoot".
// ============================================================================

import { SurfacePlacementController } from './SurfacePlacement/SurfacePlacementController';
import { PlacementSettings, PlacementMode } from './SurfacePlacement/PlacementSettings';

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
  isPlacementActive: boolean = false;

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
   * Start the surface placement flow.
   * User scans by looking around, pinches to confirm ground point.
   * Call this from StartTrigger or on lens start.
   */
  startPlacement(): void {
    if (this.isCoursePlaced) {
      print('[CourseManager] Already placed. resetCourse() first.');
      return;
    }
    if (this.isPlacementActive) {
      print('[CourseManager] Placement already in progress.');
      return;
    }

    this.isPlacementActive = true;
    print('[CourseManager] Starting surface placement — look at the ground...');

    var settings = new PlacementSettings(PlacementMode.HORIZONTAL, false);

    SurfacePlacementController.getInstance().startSurfacePlacement(
      settings,
      (pos: vec3, rot: quat) => {
        this.onPlacementConfirmed(pos, rot);
      }
    );
  }

  /**
   * Stop placement without placing (cancel).
   */
  cancelPlacement(): void {
    if (this.isPlacementActive) {
      SurfacePlacementController.getInstance().stopSurfacePlacement();
      this.isPlacementActive = false;
      print('[CourseManager] Placement cancelled');
    }
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
    // Stop any active placement
    this.cancelPlacement();

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

  // ── Placement Callback ────────────────────────────────────────────────

  private onPlacementConfirmed(pos: vec3, rot: quat): void {
    this.isPlacementActive = false;

    print('[CourseManager] Ground confirmed at ('
      + pos.x.toFixed(0) + ', ' + pos.y.toFixed(0) + ', ' + pos.z.toFixed(0) + ')');

    // Extract forward direction from placement rotation (XZ only)
    var forwardDir = rot.multiplyVec3(vec3.forward()).uniformScale(-1);
    forwardDir = new vec3(forwardDir.x, 0, forwardDir.z).normalize();
    var lateralDir = new vec3(-forwardDir.z, 0, forwardDir.x);

    this.layoutStations(pos, forwardDir, lateralDir);
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
