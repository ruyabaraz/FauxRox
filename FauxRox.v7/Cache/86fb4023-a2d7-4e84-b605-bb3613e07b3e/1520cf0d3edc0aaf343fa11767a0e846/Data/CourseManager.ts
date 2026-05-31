// ============================================================================
// CourseManager.ts — HYROX MIRAGE Course Placement
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Based on World Query Hit Example pattern from Snap Asset Library.
//
// FLOW:
//   1. Every frame: hand interactor ray → World Query hit test
//   2. A "ghost marker" follows the hit point on the ground
//   3. User pinches → course origin locked at that point
//   4. Stations laid out from origin along hand ray direction
//   5. Ghost marker disabled, course hologram visible
//
// Attach to SceneObject "CourseRoot".
// ============================================================================

const WorldQueryModule = require('LensStudio:WorldQueryModule');
import { SIK } from 'SpectaclesInteractionKit.lspkg/SIK';
import {
  InteractorTriggerType,
  InteractorInputType,
} from 'SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor';

const EPSILON = 0.01;

@component
export class CourseManager extends BaseScriptComponent {

  // ── Inspector Inputs ────────────────────────────────────────────────────

  /** Ghost marker object — shows where course will be placed.
   *  A simple ring/disc/arrow prefab, child of CourseRoot. */
  @input ghostMarker: SceneObject;

  @input startLinePrefab: ObjectPrefab;
  @input gatePrefab: ObjectPrefab;
  @input burpeePrefab: ObjectPrefab;
  @input lungePrefab: ObjectPrefab;
  @input wallBallPrefab: ObjectPrefab;
  @input finishPrefab: ObjectPrefab;

  @input @allowUndefined highlightMaterial: Material;
  @input @allowUndefined completedMaterial: Material;

  /** Enable World Query surface filtering */
  @input filterEnabled: boolean = true;

  /** Overall course scale (1.0 = default HYROX distances in cm) */
  @input courseScale: number = 1.0;

  // ── Public Data ─────────────────────────────────────────────────────────

  stationNames: string[] = [];
  stationPositions: vec3[] = [];
  stationDistanceLabels: string[] = [];
  stationObjects: SceneObject[] = [];
  stationCompleted: boolean[] = [];
  isCoursePlaced: boolean = false;
  stationCount: number = 0;

  // ── Private ─────────────────────────────────────────────────────────────

  private _hitTestSession: HitTestSession;
  private _primaryInteractor: any = null;
  private _lastHitPosition: vec3 = vec3.zero();
  private _lastHitNormal: vec3 = vec3.up();
  private _hasValidHit: boolean = false;
  private _ghostTransform: Transform;

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
    // Create hit test session (native options object)
    var options = HitTestSessionOptions.create();
    options.filter = this.filterEnabled;
    this._hitTestSession = WorldQueryModule.createHitTestSessionWithOptions(options);

    // Ghost marker setup
    if (this.ghostMarker) {
      this._ghostTransform = this.ghostMarker.getTransform();
      this.ghostMarker.enabled = false;
    }

    // Per-frame update for continuous hand ray hit testing
    this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));

    print('[CourseManager] Init — hand-ray placement mode, '
      + this._courseConfig.length + ' stations, scale=' + this.courseScale);
  }

  // ── Per-Frame: Hand Ray → Hit Test ────────────────────────────────────

  private onUpdate(): void {
    // Don't do hit testing after course is placed
    if (this.isCoursePlaced) return;

    // Get the active hand interactor (the one pointing/targeting)
    this._primaryInteractor = SIK.InteractionManager.getTargetingInteractors().shift();

    if (this._primaryInteractor
      && this._primaryInteractor.isActive()
      && this._primaryInteractor.isTargeting()) {

      // Ray from hand — offset start slightly forward to avoid self-intersection
      var startPoint = this._primaryInteractor.startPoint;
      var endPoint = this._primaryInteractor.endPoint;
      var rayStart = new vec3(startPoint.x, startPoint.y, startPoint.z + 30);

      this._hitTestSession.hitTest(
        rayStart,
        endPoint,
        this.onHitTestResult.bind(this)
      );

      // Check for pinch release (trigger end) → place course
      if (this._primaryInteractor.previousTrigger !== InteractorTriggerType.None
        && this._primaryInteractor.currentTrigger === InteractorTriggerType.None) {
        this.onPinchRelease();
      }

    } else {
      // No active hand targeting — hide ghost
      if (this.ghostMarker) {
        this.ghostMarker.enabled = false;
      }
      this._hasValidHit = false;
    }
  }

  // ── Hit Test Result ───────────────────────────────────────────────────

  private onHitTestResult(result: any): void {
    if (result === null) {
      if (this.ghostMarker) this.ghostMarker.enabled = false;
      this._hasValidHit = false;
      return;
    }

    this._hasValidHit = true;
    this._lastHitPosition = result.position;
    this._lastHitNormal = result.normal;

    // Move ghost marker to hit point, oriented to surface
    if (this.ghostMarker && this._ghostTransform) {
      this.ghostMarker.enabled = true;
      this._ghostTransform.setWorldPosition(result.position);

      var lookDir: vec3;
      if (1 - Math.abs(result.normal.normalize().dot(vec3.up())) < EPSILON) {
        lookDir = vec3.forward();
      } else {
        lookDir = result.normal.cross(vec3.up());
      }
      this._ghostTransform.setWorldRotation(quat.lookAt(lookDir, result.normal));
    }
  }

  // ── Pinch Release → Place Course ──────────────────────────────────────

  private onPinchRelease(): void {
    if (!this._hasValidHit) {
      print('[CourseManager] No valid surface hit — cannot place course');
      return;
    }
    if (this.isCoursePlaced) return;

    print('[CourseManager] Pinch released — placing course at hit point');

    // Course direction: from user toward the hit point (XZ only)
    var interactorStart = this._primaryInteractor.startPoint;
    var dirToHit = new vec3(
      this._lastHitPosition.x - interactorStart.x,
      0,
      this._lastHitPosition.z - interactorStart.z
    );

    // If direction too short, use interactor forward
    if (dirToHit.length < 1) {
      var endPt = this._primaryInteractor.endPoint;
      dirToHit = new vec3(
        endPt.x - interactorStart.x,
        0,
        endPt.z - interactorStart.z
      );
    }

    var forwardDir = dirToHit.normalize();
    var lateralDir = new vec3(-forwardDir.z, 0, forwardDir.x);

    // Hide ghost
    if (this.ghostMarker) this.ghostMarker.enabled = false;

    // Layout stations from hit point
    this.layoutStations(this._lastHitPosition, forwardDir, lateralDir);
  }

  // ── Public API ────────────────────────────────────────────────────────

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

    // Re-enable ghost for new placement
    if (this.ghostMarker) this.ghostMarker.enabled = false;

    print('[CourseManager] Course reset — ready for new placement');
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

      print('[CourseManager] Placed ' + i + ': ' + cfg.name);
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
