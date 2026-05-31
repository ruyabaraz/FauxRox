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
  REPS = 'REPS',             // Complete after X repetitions
  RUN = 'RUN',               // Run segment (distance-based)
}

// Station configuration interface
export interface StationConfig {
  name: string;
  mode: StationMode;
  requirement: number;        // seconds, meters, or reps depending on mode
  instruction: string;        // What to do at this station
  prefabType: string;
  runDistanceBefore: number;  // meters to run before this station (0 for first)
}

@component
export class CourseManager extends BaseScriptComponent {

  // ── Prefabs ──────────────────────────────────────────────────────────────

  @input startLinePrefab: ObjectPrefab;
  @input finishPrefab: ObjectPrefab;

  // Station-specific prefabs (8 workout stations)
  @input @allowUndefined mountainClimbersPrefab: ObjectPrefab;   // Station 1: Ski Erg alt
  @input @allowUndefined bearCrawlPrefab: ObjectPrefab;          // Station 2: Sled Push alt
  @input @allowUndefined crabWalkPrefab: ObjectPrefab;           // Station 3: Sled Pull alt
  @input @allowUndefined burpeeBroadJumpPrefab: ObjectPrefab;    // Station 4: Same
  @input @allowUndefined jumpSquatsPrefab: ObjectPrefab;         // Station 5: Rowing alt
  @input @allowUndefined farmersCarryPrefab: ObjectPrefab;       // Station 6: Same
  @input @allowUndefined walkingLungesPrefab: ObjectPrefab;      // Station 7: Lunges
  @input @allowUndefined squatPressPrefab: ObjectPrefab;         // Station 8: Wall Balls alt

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

      // Station 1: Ski Erg alternative → Mountain Climbers
      {
        name: 'Mountain Climbers',
        mode: StationMode.REPS,
        requirement: Math.round(100 * ws),
        instruction: 'Mountain Climbers',
        prefabType: 'WORKOUT',
        runDistanceBefore: runDist
      },

      // Station 2: Sled Push alternative → Bear Crawl
      {
        name: 'Bear Crawl',
        mode: StationMode.DISTANCE,
        requirement: Math.round(50 * ws),
        instruction: 'Bear Crawl Forward',
        prefabType: 'WORKOUT',
        runDistanceBefore: runDist
      },

      // Station 3: Sled Pull alternative → Crab Walk
      {
        name: 'Crab Walk',
        mode: StationMode.DISTANCE,
        requirement: Math.round(50 * ws),
        instruction: 'Crab Walk Backward',
        prefabType: 'WORKOUT',
        runDistanceBefore: runDist
      },

      // Station 4: Burpee Broad Jump (same as original)
      {
        name: 'Burpee Broad Jump',
        mode: StationMode.DISTANCE,
        requirement: Math.round(80 * ws),
        instruction: 'Burpee + Broad Jump',
        prefabType: 'WORKOUT',
        runDistanceBefore: runDist
      },

      // Station 5: Rowing alternative → Jump Squats
      {
        name: 'Jump Squats',
        mode: StationMode.REPS,
        requirement: Math.round(100 * ws),
        instruction: 'Explosive Jump Squats',
        prefabType: 'WORKOUT',
        runDistanceBefore: runDist
      },

      // Station 6: Farmers Carry (use any weight: bags, bottles)
      {
        name: 'Farmers Carry',
        mode: StationMode.DISTANCE,
        requirement: Math.round(200 * ws),
        instruction: 'Carry Heavy Objects',
        prefabType: 'WORKOUT',
        runDistanceBefore: runDist
      },

      // Station 7: Lunges
      {
        name: 'Walking Lunges',
        mode: StationMode.DISTANCE,
        requirement: Math.round(100 * ws),
        instruction: 'Walking Lunges',
        prefabType: 'WORKOUT',
        runDistanceBefore: runDist
      },

      // Station 8: Wall Balls alternative → Air Squat + Press
      {
        name: 'Squat Press',
        mode: StationMode.REPS,
        requirement: Math.round(100 * ws),
        instruction: 'Squat + Overhead Press',
        prefabType: 'WORKOUT',
        runDistanceBefore: runDist
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
      if (!prefab) {
        print('[CourseManager] No prefab for ' + cfg.prefabType);
        continue;
      }

      var obj = prefab.instantiate(null);
      obj.getTransform().setWorldPosition(currentPos);
      obj.getTransform().setWorldRotation(quat.lookAt(forwardDir, vec3.up()));

      this.stationNames.push(cfg.name);
      this.stationPositions.push(new vec3(currentPos.x, currentPos.y, currentPos.z));
      this.stationObjects.push(obj);
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
    print('  HYROX MIRAGE — Bodyweight Edition');
    print('═══════════════════════════════════════════');

    var totalRun = 0;
    var totalReps = 0;
    var totalDistance = 0;

    for (var i = 0; i < this.stationConfigs.length; i++) {
      var cfg = this.stationConfigs[i];
      totalRun += cfg.runDistanceBefore;

      if (cfg.mode === StationMode.REPS) {
        totalReps += cfg.requirement;
      } else if (cfg.mode === StationMode.DISTANCE) {
        totalDistance += cfg.requirement;
      }
    }

    print('  Total Run: ' + totalRun + 'm');
    print('  Total Reps: ' + totalReps);
    print('  Total Movement Distance: ' + totalDistance + 'm');
    print('═══════════════════════════════════════════');
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getPrefab(type: string): ObjectPrefab {
    switch (type) {
      case 'START':    return this.startLinePrefab;
      case 'WORKOUT':  return this.workoutPrefab;
      case 'FINISH':   return this.finishPrefab;
      default:         return this.workoutPrefab;
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
