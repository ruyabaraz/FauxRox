// ============================================================================
// ProximityDetector.ts — HYROX MIRAGE Station Proximity Detection
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Attach this script to the same "RaceController" SceneObject.
// It checks every frame whether the user (camera) is within range
// of any station gate placed by CourseManager.
// ============================================================================

import { CourseManager, StationData } from './CourseManager';

// ── Event Data ──────────────────────────────────────────────────────────────

export interface StationProximityEvent {
  stationIndex: number;
  stationName: string;
  distance: number;        // current distance in world units (cm)
  stationPosition: vec3;   // world position of the station
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

@component
export class ProximityDetector extends BaseScriptComponent {

  // ── Inspector Inputs ────────────────────────────────────────────────────

  /** The camera SceneObject (user's head position) */
  @input
  cameraObject: SceneObject;

  /** Reference to CourseManager to get live station positions */
  @input
  courseManager: CourseManager;

  /** Distance threshold (cm) to trigger "entered station" */
  @input
  enterRadius: number = 120;

  /** Distance threshold (cm) to trigger "exited station".
   *  Slightly larger than enterRadius to prevent flickering. */
  @input
  exitRadius: number = 180;

  /** If true, only check the "active" next station (cheaper).
   *  If false, check ALL stations every frame (for free-roam). */
  @input
  checkOnlyActiveStation: boolean = true;

  // ── Callbacks (set by RaceStateMachine) ─────────────────────────────────

  onStationEnter: (event: StationProximityEvent) => void = null;
  onStationExit: (event: StationProximityEvent) => void = null;

  // ── Internal State ──────────────────────────────────────────────────────

  /** Per-station "is user currently inside" tracker */
  private _insideFlags: boolean[] = [];
  private _cameraTransform: Transform;
  private _stations: StationData[] = [];
  private _activeStationIndex: number = 0;

  // ── Lifecycle ─────────────────────────────────────────────────────────

  onAwake(): void {
    if (!this.cameraObject) {
      print('[ProximityDetector] ERROR: cameraObject not assigned!');
      return;
    }
    this._cameraTransform = this.cameraObject.getTransform();

    this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));
    print('[ProximityDetector] Initialized — enterRadius='
      + this.enterRadius + ' exitRadius=' + this.exitRadius);
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Called by RaceStateMachine when the race starts or station advances.
   * Refreshes internal station list and resets flags.
   */
  refreshStations(): void {
    if (this.courseManager) {
      this._stations = this.courseManager.getStations();
    }
    this._insideFlags = new Array(this._stations.length).fill(false);
    this._activeStationIndex = 0;
    print('[ProximityDetector] Refreshed — ' + this._stations.length + ' stations');
  }

  /**
   * Set which station index is "active" (used when checkOnlyActiveStation=true)
   */
  setActiveStation(index: number): void {
    this._activeStationIndex = index;
  }

  /**
   * Get current distance to a specific station (for UI display)
   */
  getDistanceToStation(index: number): number {
    if (index < 0 || index >= this._stations.length) return Infinity;
    const userPos = this._cameraTransform.getWorldPosition();
    const stationPos = this._stations[index].worldPosition;
    return this.horizontalDistance(userPos, stationPos);
  }

  // ── Per-Frame ─────────────────────────────────────────────────────────

  private onUpdate(): void {
    if (!this._cameraTransform || this._stations.length === 0) return;

    const userPos = this._cameraTransform.getWorldPosition();

    if (this.checkOnlyActiveStation) {
      // Only check one station — cheaper per frame
      if (this._activeStationIndex < this._stations.length) {
        this.checkStation(this._activeStationIndex, userPos);
      }
    } else {
      // Check all stations
      for (let i = 0; i < this._stations.length; i++) {
        this.checkStation(i, userPos);
      }
    }
  }

  // ── Core Logic ────────────────────────────────────────────────────────

  private checkStation(index: number, userPos: vec3): void {
    const station = this._stations[index];
    if (!station) return;

    // Horizontal distance only (ignore Y) — user might be standing,
    // station gate might be at ground level
    const dist = this.horizontalDistance(userPos, station.worldPosition);
    const wasInside = this._insideFlags[index];

    if (!wasInside && dist <= this.enterRadius) {
      // ── ENTER ──
      this._insideFlags[index] = true;

      const event: StationProximityEvent = {
        stationIndex: index,
        stationName: station.name,
        distance: dist,
        stationPosition: station.worldPosition,
      };

      print('[ProximityDetector] ENTER station ' + index
        + ' (' + station.name + ') dist=' + dist.toFixed(0) + 'cm');

      if (this.onStationEnter) {
        this.onStationEnter(event);
      }

    } else if (wasInside && dist > this.exitRadius) {
      // ── EXIT ──
      this._insideFlags[index] = false;

      const event: StationProximityEvent = {
        stationIndex: index,
        stationName: station.name,
        distance: dist,
        stationPosition: station.worldPosition,
      };

      print('[ProximityDetector] EXIT station ' + index
        + ' (' + station.name + ') dist=' + dist.toFixed(0) + 'cm');

      if (this.onStationExit) {
        this.onStationExit(event);
      }
    }
  }

  /**
   * Horizontal (XZ plane) distance — ignores vertical (Y) difference.
   * This is critical for AR fitness: user stands upright, stations
   * are on the ground plane. Full 3D distance would be wrong.
   */
  private horizontalDistance(a: vec3, b: vec3): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
