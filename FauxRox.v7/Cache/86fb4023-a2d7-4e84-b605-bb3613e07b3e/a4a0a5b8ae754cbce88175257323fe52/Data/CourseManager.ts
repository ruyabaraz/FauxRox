// ============================================================================
// CourseManager.ts — HYROX MIRAGE Course Placement
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Real HYROX format: 8 × 1km runs + 8 workout stations
// Bodyweight alternatives for equipment-free training
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
  OVERHEAD_PULL = 'OVERHEAD_PULL',     // Overhead Pull Gates: pull down
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
}

@component
export class CourseManager extends BaseScriptComponent {

  // ── Prefabs ──────────────────────────────────────────────────────────────

  @input startLinePrefab: ObjectPrefab;
  @input finishPrefab: ObjectPrefab;

  // Station-specific prefabs (8 workout stations)
  @input @allowUndefined overheadPullPrefab: ObjectPrefab;       // Station 1: Overhead Pull Gates
  @input @allowUndefined powerLanePrefab: ObjectPrefab;          // Station 2: Power Lane
  @input @allowUndefined crabWalkPrefab: ObjectPrefab;           // Station 3: Crab Walk
  @input @allowUndefined burpeeBroadJumpPrefab: ObjectPrefab;    // Station 4: Burpee Broad Jump
  @input @allowUndefined powerRowPrefab: ObjectPrefab;           // Station 5: Power Row Gates
  @input @allowUndefined heavyCarryPrefab: ObjectPrefab;         // Station 6: Heavy Carry Lane
  @input @allowUndefined walkingLungesPrefab: ObjectPrefab;      // Station 7: Walking Lunges
  @input @allowUndefined targetPressPrefab: ObjectPrefab;        // Station 8: Target Press

  // Fallback prefab if station-specific not assigned
  @input @allowUndefined defaultWorkoutPrefab: ObjectPrefab;

  @input @allowUndefined highlightMaterial: Material;
  @input @allowUndefined completedMaterial: Material;
  @input @allowUndefined activeMaterial: Material;

  // ── Settings ─────────────────────────────────────────────────────────────

  /** Run distance scale: 1.0 = full 1km, 0.1 = 100m per segment */
  @input runDistanceScale: number = 0.1;

  /** Workout intensity scale: 1.0 = full reps/time, 0.5 = half */
  @input workoutScale: number = 1.0;

  /** Physical spacing between station markers (cm) */
  @input stationSpacing: number = 500;

  // ── Public Data ──────────────────────────────────────────────────────────

  stationConfigs: StationConfig[] = [];
  stationNames: string[] = [];
  stationPositions: vec3[] = [];
  stationObjects: SceneObject[] = [];
  stationCompleted: boolean[] = [];
  isCoursePlaced: boolean = false;
  stationCount: number = 0;

  // Current run tracking
  currentRunTarget: number = 0;        // meters to run
  currentRunDistance: number = 0;      // meters run so far

  // ── Real HYROX Course Config (Bodyweight Version) ────────────────────────

  private readonly FULL_RUN_DISTANCE = 1000;  // 1km in meters

  private buildCourseConfig(): StationConfig[] {
    var runDist = this.FULL_RUN_DISTANCE * this.runDistanceScale;
    var ws = this.workoutScale;

    return [
      // START
      {
        name: 'START',
        mode: StationMode.TIMED,
        requirement: 3,
        instruction: 'Get Ready!',
        prefabType: 'START',
        runDistanceBefore: 0
      },

      // Station 1: SkiErg → Overhead Pull Gates
      // Pull hands down from overhead position
      {
        name: 'Overhead Pull Gates',
        mode: StationMode.ZONE_HIT,
        requirement: Math.round(50 * ws),
        instruction: 'Reach UP then PULL DOWN',
        prefabType: 'OVERHEAD_PULL',
        runDistanceBefore: runDist,
        motionType: MotionType.OVERHEAD_PULL
      },

      // Station 2: Sled Push → Power Lane
      // Move forward through AR lane
      {
        name: 'Power Lane',
        mode: StationMode.DISTANCE,
        requirement: Math.round(50 * ws),
        instruction: 'Push through the lane!',
        prefabType: 'POWER_LANE',
        runDistanceBefore: runDist
      },

      // Station 3: Sled Pull → Crab Walk
      {
        name: 'Crab Walk',
        mode: StationMode.DISTANCE,
        requirement: Math.round(50 * ws),
        instruction: 'Crab Walk Backward',
        prefabType: 'CRAB_WALK',
        runDistanceBefore: runDist
      },

      // Station 4: Burpee Broad Jump
      {
        name: 'Burpee Broad Jump',
        mode: StationMode.DISTANCE,
        requirement: Math.round(80 * ws),
        instruction: 'Burpee + Broad Jump',
        prefabType: 'BURPEE_BROAD_JUMP',
        runDistanceBefore: runDist
      },

      // Station 5: Rowing → Power Row Gates
      // Pull hands backward from forward position
      {
        name: 'Power Row Gates',
        mode: StationMode.ZONE_HIT,
        requirement: Math.round(50 * ws),
        instruction: 'Reach forward then PULL BACK',
        prefabType: 'POWER_ROW',
        runDistanceBefore: runDist,
        motionType: MotionType.BACKWARD_PULL
      },

      // Station 6: Farmers Carry → Heavy Carry Lane
      {
        name: 'Heavy Carry Lane',
        mode: StationMode.DISTANCE,
        requirement: Math.round(200 * ws),
        instruction: 'Carry through the lane!',
        prefabType: 'HEAVY_CARRY',
        runDistanceBefore: runDist
      },

      // Station 7: Lunges
      {
        name: 'Walking Lunges',
        mode: StationMode.DISTANCE,
        requirement: Math.round(100 * ws),
        instruction: 'Walking Lunges',
        prefabType: 'WALKING_LUNGES',
        runDistanceBefore: runDist
      },

      // Station 8: Wall Balls → Target Press
      // Reach up to hit overhead target
      {
        name: 'Target Press',
        mode: StationMode.ZONE_HIT,
        requirement: Math.round(75 * ws),
        instruction: 'Squat DOWN then reach UP to target!',
        prefabType: 'TARGET_PRESS',
        runDistanceBefore: runDist,
        motionType: MotionType.OVERHEAD_REACH
      },

      // FINISH
      {
        name: 'FINISH',
        mode: StationMode.TIMED,
        requirement: 0,
        instruction: 'RACE COMPLETE!',
        prefabType: 'FINISH',
        runDistanceBefore: 0
      }
    ];
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  onAwake(): void {
    this.stationConfigs = this.buildCourseConfig();
    print('[CourseManager] HYROX Bodyweight course initialized');
    print('[CourseManager] Run scale: ' + this.runDistanceScale + ' (each run = ' +
      (this.FULL_RUN_DISTANCE * this.runDistanceScale) + 'm)');
    print('[CourseManager] Workout scale: ' + this.workoutScale);
    print('[CourseManager] Total stations: ' + this.stationConfigs.length);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  placeCourseAt(pos: vec3, rot: quat): void {
    if (this.isCoursePlaced) {
      print('[CourseManager] Already placed. resetCourse() first.');
      return;
    }

    print('[CourseManager] Placing course at pos=(' +
      pos.x.toFixed(1) + ',' + pos.y.toFixed(1) + ',' + pos.z.toFixed(1) + ')');

    // Calculate forward direction
    var rawForward = rot.multiplyVec3(vec3.back());
    var forwardDir = new vec3(rawForward.x, 0, rawForward.z);
    if (forwardDir.length < 0.01) {
      forwardDir = new vec3(0, 0, 1);
    }
    forwardDir = forwardDir.normalize();
    var lateralDir = new vec3(-forwardDir.z, 0, forwardDir.x);

    this.layoutStations(pos, forwardDir, lateralDir);
  }

  getStationConfig(index: number): StationConfig {
    if (index < 0 || index >= this.stationConfigs.length) {
      return null;
    }
    return this.stationConfigs[index];
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

  setStationActive(index: number): void {
    if (index >= 0 && index < this.stationObjects.length && this.activeMaterial) {
      this.applyMaterial(this.stationObjects[index], this.activeMaterial);
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
    this.stationObjects = [];
    this.stationCompleted = [];
    this.isCoursePlaced = false;
    this.stationCount = 0;
    this.currentRunTarget = 0;
    this.currentRunDistance = 0;
    print('[CourseManager] Course reset');
  }

  // ── Layout ───────────────────────────────────────────────────────────────

  private layoutStations(origin: vec3, forwardDir: vec3, lateralDir: vec3): void {
    var currentPos = new vec3(origin.x, origin.y, origin.z);

    for (var i = 0; i < this.stationConfigs.length; i++) {
      var cfg = this.stationConfigs[i];

      // Move forward for station spacing (physical markers)
      if (i > 0) {
        currentPos = new vec3(
          currentPos.x + forwardDir.x * this.stationSpacing,
          currentPos.y,
          currentPos.z + forwardDir.z * this.stationSpacing
        );
      }

      var prefab = this.getPrefab(cfg.prefabType);
      var obj: SceneObject = null;

      if (prefab) {
        obj = prefab.instantiate(null);
        obj.getTransform().setWorldPosition(currentPos);
        obj.getTransform().setWorldRotation(quat.lookAt(forwardDir, vec3.up()));
      } else {
        print('[CourseManager] No prefab for ' + cfg.prefabType + ' — station will still be tracked');
      }

      // Always track station, even without visual prefab
      this.stationNames.push(cfg.name);
      this.stationPositions.push(new vec3(currentPos.x, currentPos.y, currentPos.z));
      this.stationObjects.push(obj);  // May be null
      this.stationCompleted.push(false);

      print('[CourseManager] Station ' + i + ': ' + cfg.name +
        ' (' + cfg.mode + ': ' + cfg.requirement + ')' +
        ' run before: ' + cfg.runDistanceBefore + 'm');
    }

    this.stationCount = this.stationNames.length;
    this.isCoursePlaced = true;

    if (this.highlightMaterial && this.stationObjects.length > 0) {
      this.applyMaterial(this.stationObjects[0], this.highlightMaterial);
    }

    print('[CourseManager] Course placed — ' + this.stationCount + ' stations');
    this.printCourseSummary();
  }

  private printCourseSummary(): void {
    print('═══════════════════════════════════════════');
    print('  HYROX MIRAGE — AR Bodyweight Edition');
    print('═══════════════════════════════════════════');

    var totalRun = 0;
    var totalReps = 0;
    var totalDistance = 0;
    var totalZoneHits = 0;

    for (var i = 0; i < this.stationConfigs.length; i++) {
      var cfg = this.stationConfigs[i];
      totalRun += cfg.runDistanceBefore;

      if (cfg.mode === StationMode.REPS) {
        totalReps += cfg.requirement;
      } else if (cfg.mode === StationMode.DISTANCE) {
        totalDistance += cfg.requirement;
      } else if (cfg.mode === StationMode.ZONE_HIT) {
        totalZoneHits += cfg.requirement;
      }
    }

    print('  Total Run: ' + totalRun + 'm');
    print('  Total Zone Hits: ' + totalZoneHits);
    print('  Total Reps: ' + totalReps);
    print('  Total Movement Distance: ' + totalDistance + 'm');
    print('═══════════════════════════════════════════');
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getPrefab(type: string): ObjectPrefab {
    switch (type) {
      case 'START':
        return this.startLinePrefab;

      case 'FINISH':
        return this.finishPrefab;

      case 'OVERHEAD_PULL':
        return this.overheadPullPrefab || this.defaultWorkoutPrefab;

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

  private applyMaterial(obj: SceneObject, mat: Material): void {
    var count = obj.getChildrenCount();
    for (var i = 0; i < count; i++) {
      var rmv = obj.getChild(i).getComponent('Component.RenderMeshVisual') as RenderMeshVisual;
      if (rmv) rmv.mainMaterial = mat;
    }
    var rootRmv = obj.getComponent('Component.RenderMeshVisual') as RenderMeshVisual;
    if (rootRmv) rootRmv.mainMaterial = mat;
  }
}
