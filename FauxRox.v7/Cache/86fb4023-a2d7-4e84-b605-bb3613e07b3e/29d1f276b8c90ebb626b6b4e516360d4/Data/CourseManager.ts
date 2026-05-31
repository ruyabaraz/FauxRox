// ============================================================================
// CourseManager.ts — FauxRox Dynamic Course System
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// DYNAMIC "follow-the-runner" system:
// - Stations spawn in front of the player when run distance completes
// - Fade in/out animations
// - No fixed course layout
// ============================================================================

// Station completion type
export enum StationMode {
  TIMED = 'TIMED',           // Complete after X seconds
  DISTANCE = 'DISTANCE',     // Complete after walking X meters
  REPS = 'REPS',             // Complete after X repetitions (manual pinch)
  RUN = 'RUN',               // Run segment (distance-based)
  ZONE_HIT = 'ZONE_HIT',     // Complete after X zone hits (hand tracking)
}

// Motion type for zone-based stations
export enum MotionType {
  OVERHEAD_REACH = 'OVERHEAD_REACH',   // Target Press: reach up to target
  AIR_SKIERG = 'AIR_SKIERG',           // Air SkiErg: pull down
  FORWARD_PUSH = 'FORWARD_PUSH',       // Power push forward
  BACKWARD_PULL = 'BACKWARD_PULL',     // Row pull backward
}

// Station configuration interface
export interface StationConfig {
  name: string;
  mode: StationMode;
  requirement: number;        // seconds, meters, reps, or zone hits depending on mode
  instruction: string;        // What to do at this station
  prefabType: string;
  runDistanceBefore: number;  // meters to run before this station (0 for first)
  motionType?: MotionType;    // For ZONE_HIT mode: which motion to detect
  isFinish?: boolean;         // True for finish marker (not a workout station)
}

@component
export class CourseManager extends BaseScriptComponent {

  // ── Prefabs ──────────────────────────────────────────────────────────────

  @input startLinePrefab: ObjectPrefab;
  @input finishPrefab: ObjectPrefab;

  // Station-specific prefabs (8 workout stations)
  @input @allowUndefined airSkiergPrefab: ObjectPrefab;
  @input @allowUndefined powerLanePrefab: ObjectPrefab;
  @input @allowUndefined crabWalkPrefab: ObjectPrefab;
  @input @allowUndefined burpeeBroadJumpPrefab: ObjectPrefab;
  @input @allowUndefined powerRowPrefab: ObjectPrefab;
  @input @allowUndefined heavyCarryPrefab: ObjectPrefab;
  @input @allowUndefined walkingLungesPrefab: ObjectPrefab;
  @input @allowUndefined targetPressPrefab: ObjectPrefab;

  // Fallback prefab if station-specific not assigned
  @input @allowUndefined defaultWorkoutPrefab: ObjectPrefab;

  // ── Run Settings ────────────────────────────────────────────────────────

  @ui.separator
  @ui.label("Run Settings")

  /** Run distance per segment in meters (default 100m, full HYROX = 1000m) */
  @input runDistance: number = 100;

  /** Distance to spawn station in front of player (cm) */
  @input spawnDistanceAhead: number = 150;

  /** Fade duration in seconds */
  @input fadeDuration: number = 0.5;

  // ── Station Requirements (for demo, reduce these values) ───────────────

  @ui.separator
  @ui.label("Zone Hit Stations (reps)")

  /** Air SkiErg: pull down reps (full HYROX ~50) */
  @input airSkiergReps: number = 50;

  /** Power Row Gates: pull back reps (full HYROX ~50) */
  @input powerRowReps: number = 50;

  /** Target Press: reach up reps (full HYROX ~75) */
  @input targetPressReps: number = 75;

  @ui.separator
  @ui.label("Distance Stations (meters)")

  /** Power Lane: push distance in meters (full HYROX ~50m) */
  @input powerLaneDistance: number = 50;

  /** Crab Walk: distance in meters (full HYROX ~50m) */
  @input crabWalkDistance: number = 50;

  /** Burpee Broad Jump: distance in meters (full HYROX ~80m) */
  @input burpeeDistance: number = 80;

  /** Heavy Carry Lane: distance in meters (full HYROX ~200m) */
  @input heavyCarryDistance: number = 200;

  /** Walking Lunges: distance in meters (full HYROX ~100m) */
  @input lungesDistance: number = 100;

  // ── Public State ─────────────────────────────────────────────────────────

  stationConfigs: StationConfig[] = [];
  stationCount: number = 0;
  isReady: boolean = false;

  // Current active station
  private _activeStation: SceneObject = null;
  private _activeStationIndex: number = -1;

  // Floor height (set by CourseSetup after calibration)
  private _floorY: number = 0;
  private _floorCalibrated: boolean = false;

  /**
   * Returns true when floor is calibrated and START line is spawned
   * (Used by StartTrigger to know when pinch should start race)
   */
  get isCoursePlaced(): boolean {
    return this._floorCalibrated && this._activeStationIndex >= 0;
  }

  // ── Real HYROX Course Config (Bodyweight Version) ────────────────────────

  private buildCourseConfig(): StationConfig[] {
    return [
      // START - just a visual marker, completes instantly
      {
        name: 'START',
        mode: StationMode.TIMED,
        requirement: 0,
        instruction: '',
        prefabType: 'START',
        runDistanceBefore: 0
      },

      // Station 1: Air Skierg
      {
        name: 'Air Skierg',
        mode: StationMode.ZONE_HIT,
        requirement: this.airSkiergReps,
        instruction: 'Reach UP and PULL DOWN',
        prefabType: 'AIR_SKIERG',
        runDistanceBefore: this.runDistance,
        motionType: MotionType.AIR_SKIERG
      },

      // Station 2: Dumbell Bear Crawl
      {
        name: 'Dumbell Bear Crawl',
        mode: StationMode.DISTANCE,
        requirement: this.powerLaneDistance,
        instruction: 'Push through the lane!',
        prefabType: 'POWER_LANE',
        runDistanceBefore: this.runDistance
      },

      // Station 3: Goblet Reverse Walk
      {
        name: 'Goblet Reverse Walk',
        mode: StationMode.DISTANCE,
        requirement: this.crabWalkDistance,
        instruction: 'Walk backward with goblet hold',
        prefabType: 'CRAB_WALK',
        runDistanceBefore: this.runDistance
      },

      // Station 4: Burpee Broad Jump
      {
        name: 'Burpee Broad Jump',
        mode: StationMode.DISTANCE,
        requirement: this.burpeeDistance,
        instruction: 'Burpee + Broad Jump',
        prefabType: 'BURPEE_BROAD_JUMP',
        runDistanceBefore: this.runDistance
      },

      // Station 5: Standing Row
      {
        name: 'Standing Row',
        mode: StationMode.ZONE_HIT,
        requirement: this.powerRowReps,
        instruction: 'Reach forward then PULL BACK',
        prefabType: 'POWER_ROW',
        runDistanceBefore: this.runDistance,
        motionType: MotionType.BACKWARD_PULL
      },

      // Station 6: Farmers Carry → Heavy Carry Lane
      {
        name: 'HEAVY CARRY',
        mode: StationMode.DISTANCE,
        requirement: this.heavyCarryDistance,
        instruction: 'Carry through the lane!',
        prefabType: 'HEAVY_CARRY',
        runDistanceBefore: this.runDistance
      },

      // Station 7: Lunges
      {
        name: 'WALKING LUNGES',
        mode: StationMode.DISTANCE,
        requirement: this.lungesDistance,
        instruction: 'Walking Lunges',
        prefabType: 'WALKING_LUNGES',
        runDistanceBefore: this.runDistance
      },

      // Station 8: Wall Balls → Target Press
      {
        name: 'SQUAT PRESS',
        mode: StationMode.ZONE_HIT,
        requirement: this.targetPressReps,
        instruction: 'Squat DOWN then reach UP to target!',
        prefabType: 'TARGET_PRESS',
        runDistanceBefore: this.runDistance,
        motionType: MotionType.OVERHEAD_REACH
      },

      // FINISH
      {
        name: 'FINISH',
        mode: StationMode.TIMED,
        requirement: 0,
        instruction: 'RACE COMPLETE!',
        prefabType: 'FINISH',
        runDistanceBefore: 0,
        isFinish: true
      }
    ];
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  onAwake(): void {
    this.stationConfigs = this.buildCourseConfig();
    this.stationCount = this.stationConfigs.length;
    this.isReady = true;

    print('[CourseManager] Dynamic course initialized');
    print('[CourseManager] Run distance: ' + this.runDistance + 'm per segment');
    print('[CourseManager] Zone hits: SkiErg=' + this.airSkiergReps + ', Row=' + this.powerRowReps + ', Press=' + this.targetPressReps);
    print('[CourseManager] Total stations: ' + this.stationCount);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Set floor height (called by CourseSetup after calibration)
   */
  setFloorHeight(floorY: number): void {
    this._floorY = floorY;
    this._floorCalibrated = true;
    print('[CourseManager] Floor height set: ' + floorY.toFixed(1));
  }

  /**
   * Get station config by index
   */
  getStationConfig(index: number): StationConfig {
    if (index < 0 || index >= this.stationConfigs.length) {
      return null;
    }
    return this.stationConfigs[index];
  }

  /**
   * Spawn a station in front of the player
   * @param stationIndex Which station to spawn
   * @param playerPos Player's current world position
   * @param playerForward Player's forward direction (normalized)
   * @returns The spawned SceneObject
   */
  spawnStationInFrontOfPlayer(stationIndex: number, playerPos: vec3, playerForward: vec3): SceneObject {
    if (stationIndex < 0 || stationIndex >= this.stationConfigs.length) {
      print('[CourseManager] Invalid station index: ' + stationIndex);
      return null;
    }

    // Destroy previous active station
    this.destroyActiveStation();

    var cfg = this.stationConfigs[stationIndex];
    var prefab = this.getPrefab(cfg.prefabType);

    if (!prefab) {
      print('[CourseManager] No prefab for ' + cfg.prefabType);
      return null;
    }

    // Calculate spawn position: in front of player at floor level
    var flatForward = new vec3(playerForward.x, 0, playerForward.z).normalize();
    var spawnPos = new vec3(
      playerPos.x + flatForward.x * this.spawnDistanceAhead,
      this._floorY,
      playerPos.z + flatForward.z * this.spawnDistanceAhead
    );

    print('[CourseManager] spawnStation: playerPos=(' + playerPos.x.toFixed(0) + ', ' + playerPos.z.toFixed(0) + ')');
    print('[CourseManager] spawnStation: flatForward=(' + flatForward.x.toFixed(2) + ', ' + flatForward.z.toFixed(2) + '), dist=' + this.spawnDistanceAhead);
    print('[CourseManager] spawnStation: offset=(' + (flatForward.x * this.spawnDistanceAhead).toFixed(0) + ', ' + (flatForward.z * this.spawnDistanceAhead).toFixed(0) + ')');

    // Create rotation facing the player
    var toPlayer = new vec3(
      playerPos.x - spawnPos.x,
      0,
      playerPos.z - spawnPos.z
    ).normalize();
    var rotation = quat.lookAt(toPlayer, vec3.up());

    // Spawn the station
    var obj = prefab.instantiate(null);
    obj.getTransform().setWorldPosition(spawnPos);
    obj.getTransform().setWorldRotation(rotation);

    this._activeStation = obj;
    this._activeStationIndex = stationIndex;

    print('[CourseManager] Spawned station ' + stationIndex + ': ' + cfg.name);
    print('[CourseManager] Position: (' + spawnPos.x.toFixed(0) + ', ' + spawnPos.y.toFixed(0) + ', ' + spawnPos.z.toFixed(0) + ')');

    // Start fade-in animation
    this.fadeIn(obj);

    return obj;
  }

  /**
   * Spawn START station at player's current position (beginning of race)
   */
  spawnStartAtPlayer(playerPos: vec3, playerForward: vec3): SceneObject {
    return this.spawnStationInFrontOfPlayer(0, playerPos, playerForward);
  }

  /**
   * Destroy the current active station with fade-out
   */
  destroyActiveStation(): void {
    if (this._activeStation) {
      // Quick destroy (could add fade-out animation here)
      this._activeStation.destroy();
      this._activeStation = null;
      print('[CourseManager] Destroyed active station');
    }
  }

  /**
   * Fade out and destroy active station
   */
  fadeOutAndDestroy(onComplete?: () => void): void {
    if (!this._activeStation) {
      if (onComplete) onComplete();
      return;
    }

    var station = this._activeStation;
    this._activeStation = null;

    this.fadeOut(station, () => {
      station.destroy();
      if (onComplete) onComplete();
    });
  }

  /**
   * Get current active station index
   */
  getActiveStationIndex(): number {
    return this._activeStationIndex;
  }

  /**
   * Get active station object
   */
  getActiveStation(): SceneObject {
    return this._activeStation;
  }

  /**
   * Reset course state (keeps floor calibration)
   */
  resetCourse(): void {
    this.destroyActiveStation();
    this._activeStationIndex = -1;
    // Note: Keep _floorCalibrated true - no need to recalibrate floor
    print('[CourseManager] Course reset');
  }

  /**
   * Full reset including floor calibration
   */
  fullReset(): void {
    this.destroyActiveStation();
    this._activeStationIndex = -1;
    this._floorCalibrated = false;
    this._floorY = 0;
    print('[CourseManager] Full reset (floor calibration cleared)');
  }

  // ── Fade Animations ──────────────────────────────────────────────────────

  private fadeIn(obj: SceneObject): void {
    // Start invisible
    this.setObjectAlpha(obj, 0);
    obj.enabled = true;

    // Animate to visible
    var startTime = getTime();
    var duration = this.fadeDuration;

    var fadeEvent = this.createEvent('UpdateEvent');
    fadeEvent.bind(() => {
      var elapsed = getTime() - startTime;
      var t = Math.min(1, elapsed / duration);

      this.setObjectAlpha(obj, t);

      if (t >= 1) {
        this.removeEvent(fadeEvent);
      }
    });
  }

  private fadeOut(obj: SceneObject, onComplete?: () => void): void {
    var startTime = getTime();
    var duration = this.fadeDuration;

    var fadeEvent = this.createEvent('UpdateEvent');
    fadeEvent.bind(() => {
      var elapsed = getTime() - startTime;
      var t = Math.min(1, elapsed / duration);

      this.setObjectAlpha(obj, 1 - t);

      if (t >= 1) {
        this.removeEvent(fadeEvent);
        if (onComplete) onComplete();
      }
    });
  }

  /**
   * Get maxAlpha from AlphaOverride component if present
   * Returns 1.0 if no component found (full opacity)
   */
  private getMaxAlphaOverride(obj: SceneObject): number {
    var scripts = obj.getComponents('Component.ScriptComponent');
    for (var i = 0; i < scripts.length; i++) {
      var script = scripts[i] as any;
      if (script.maxAlpha !== undefined && typeof script.maxAlpha === 'number') {
        return script.maxAlpha;
      }
    }
    return 1.0;
  }

  private setObjectAlpha(obj: SceneObject, fadeProgress: number): void {
    // Set alpha on all RenderMeshVisuals in hierarchy
    // Each mesh can have its own maxAlpha via AlphaOverride component
    this.forEachRenderMesh(obj, (rmv: RenderMeshVisual, meshObj: SceneObject) => {
      var meshMaxAlpha = this.getMaxAlphaOverride(meshObj);
      var alpha = fadeProgress * meshMaxAlpha;

      var mat = rmv.mainMaterial;
      if (mat) {
        try {
          var pass = mat.mainPass;
          if (pass.baseColor) {
            var color = pass.baseColor;
            pass.baseColor = new vec4(color.r, color.g, color.b, alpha);
          }
        } catch (e) {
          // Material doesn't support alpha, ignore
        }
      }
    });

    // Handle Text components
    this.forEachText(obj, (textComp: any, textObj: SceneObject) => {
      var textMaxAlpha = this.getMaxAlphaOverride(textObj);
      var alpha = fadeProgress * textMaxAlpha;

      try {
        if (textComp.textFill && textComp.textFill.color) {
          var c = textComp.textFill.color;
          textComp.textFill.color = new vec4(c.r, c.g, c.b, alpha);
        }
      } catch (e) {
        // Ignore
      }
    });
  }

  private forEachRenderMesh(obj: SceneObject, callback: (rmv: RenderMeshVisual, meshObj: SceneObject) => void): void {
    // Check this object
    var rmv = obj.getComponent('Component.RenderMeshVisual') as RenderMeshVisual;
    if (rmv) callback(rmv, obj);

    // Check children recursively
    var childCount = obj.getChildrenCount();
    for (var i = 0; i < childCount; i++) {
      this.forEachRenderMesh(obj.getChild(i), callback);
    }
  }

  private forEachText(obj: SceneObject, callback: (textComp: any, textObj: SceneObject) => void): void {
    // Check this object
    var textComp = obj.getComponent('Component.Text');
    if (textComp) callback(textComp, obj);

    // Check children recursively
    var childCount = obj.getChildrenCount();
    for (var i = 0; i < childCount; i++) {
      this.forEachText(obj.getChild(i), callback);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getPrefab(type: string): ObjectPrefab {
    switch (type) {
      case 'START':
        return this.startLinePrefab;

      case 'FINISH':
        return this.finishPrefab;

      case 'AIR_SKIERG':
        return this.airSkiergPrefab || this.defaultWorkoutPrefab;

      case 'POWER_LANE':
        return this.powerLanePrefab || this.defaultWorkoutPrefab;

      case 'CRAB_WALK':
        return this.crabWalkPrefab || this.defaultWorkoutPrefab;

      case 'BURPEE_BROAD_JUMP':
        return this.burpeeBroadJumpPrefab || this.defaultWorkoutPrefab;

      case 'POWER_ROW':
        return this.powerRowPrefab || this.defaultWorkoutPrefab;

      case 'HEAVY_CARRY':
        return this.heavyCarryPrefab || this.defaultWorkoutPrefab;

      case 'WALKING_LUNGES':
        return this.walkingLungesPrefab || this.defaultWorkoutPrefab;

      case 'TARGET_PRESS':
        return this.targetPressPrefab || this.defaultWorkoutPrefab;

      default:
        return this.defaultWorkoutPrefab;
    }
  }
}
