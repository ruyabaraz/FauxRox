// ============================================================================
// CourseManager.ts — FauxRox Dynamic Course System
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// DYNAMIC "follow-the-runner" system:
// - Stations spawn in front of the player when run distance completes
// - Fade in/out animations
// - No fixed course layout
// ============================================================================

import {
  StationMode,
  MotionType,
  StationConfig,
  SessionKind,
  SessionPlan,
  makeStartMarker,
  makeFinishMarker,
  wrapPlanStations,
  estimateMinutes,
  stationCostSeconds,
  stationWorkCostSeconds,
  simplifyForPreview,
  distanceRun,
  timedRun,
  hasRun,
  runMetresOf,
  runSecondsOf,
  RunPrescription,
  withRun,
  formatRunClock,
  isRunOnlyStation,
  shortenRunForPreview,
  needsHandTracking,
  isWarmupStation,
  isRestStation,
  runCostSeconds,
  buildModelBaselines,
} from './SessionTypes';

// The workout vocabulary lives in SessionTypes so that the generator and the
// test suite can use it without pulling in a component. Re-exported here
// because everything else in the project already imports it from CourseManager.
export { StationMode, MotionType, SessionKind } from './SessionTypes';

/**
 * How a run reads in a log line: "400m", "12:00", or nothing.
 *
 * Both layers of the plan print through this, so a distance run and a timed
 * one are compared as what they say rather than as a number that only one of
 * them has.
 */
function runLabelOf(run?: RunPrescription): string {
  if (!hasRun(run)) return 'none';
  return run.kind === 'TIME' ? formatRunClock(run.seconds) : run.metres + 'm';
}
export type { StationConfig, SessionPlan } from './SessionTypes';

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

  // ── Preview / No-Hardware Mode ───────────────────────────────────────────

  @ui.separator
  @ui.label("Preview (Editor Only)")

  /**
   * In Lens Studio preview there are no tracked hands, so ZONE_HIT and REPS
   * stations can never be completed and the course cannot be walked end to
   * end. With this on, those stations auto-complete on a timer instead.
   *
   * Editor only - it has no effect on device, whatever this is set to.
   * Races run this way are marked as not counting, so they never reach the
   * leaderboard or contaminate personal baselines.
   */
  @input previewAutoComplete: boolean = true;

  /** Seconds each auto-completed station takes in preview */
  @input previewStationSeconds: number = 4;

  /**
   * Seconds each warm-up drill takes in preview.
   *
   * Editor only. A warm-up is three drills at thirty to forty seconds each,
   * which is right on device and is two minutes of waiting before the part
   * being tested. Shortening them changes nothing that is measured: the
   * warm-up is excluded from the analysis by construction, so this is the one
   * duration that can be cut without making the session dishonest.
   */
  @input previewWarmupSeconds: number = 6;

  /**
   * Longest run in preview, metres.
   *
   * Editor only. A training session prescribes real distances - a full
   * running session is kilometres - and none of that can be covered in front
   * of a desk. Shortened the same way a hand-tracked station is: what has to
   * be done to finish changes, what the session was prescribing does not.
   */
  @input previewMaxRunMetres: number = 6;

  /**
   * Longest timed run in preview, seconds.
   *
   * Editor only, and the clock twin of the metres above. An easy run is
   * prescribed as fifteen continuous minutes because that is the session;
   * the editor has no way to shorten that on the ground, since there is no
   * ground being covered to cut.
   */
  @input previewMaxRunSeconds: number = 8;

  /**
   * Longest continuous run in preview, seconds.
   *
   * Separate from the cap above, and much longer, because the two are not the
   * same kind of thing. A run that leads to a station is a gap between two
   * pieces of work and there are eight of them; cutting each to a few seconds
   * is what makes the session walkable at a desk.
   *
   * A continuous easy run is the whole session. Cut to the same few seconds
   * it is over before it can be looked at - the settling stretch, the clock
   * counting down, the run holding when the athlete stops, all of it gone in
   * one breath. Long enough to watch is the only useful value here, and it is
   * still a stand-in: the prescription says fifteen minutes and the plan log
   * goes on saying so.
   */
  @input previewMaxContinuousRunSeconds: number = 40;

  /**
   * Editor only: serve every run on the clock instead of on the ground.
   *
   * Nothing generates a timed run yet - the archetypes that need one are the
   * next step - so the runtime path for it has been written and type-checked
   * and never once executed. Shipping it that way means finding out whether
   * it works in front of somebody.
   *
   * This turns the runs a running session already produces into timed ones so
   * that path can be walked: the countdown, the clock ending the run, the
   * accumulator still measuring underneath it, a pause actually freezing it.
   * It is a fixture, not a feature - it cannot reach a device, it changes the
   * execution layer only, and the prescription the plan log prints is the
   * real one either way.
   */
  @input previewTimedRunFixture: boolean = false;

  /** Seconds each fixture run lasts - long enough to watch, and to pause */
  @input previewFixtureRunSeconds: number = 12;

  /**
   * Longest rest in preview, seconds.
   *
   * Editor only. Rest is prescribed against the work it follows, so a real
   * session's breaks are real: an engine session's eight rounds of 24s plus
   * five of 38s plus a finisher is eight minutes of standing still, in a
   * preview whose work has already been cut to four seconds a station. Ten
   * minutes to test, two of them moving.
   *
   * Safe to shorten because rest is never a performance measurement - the
   * analysis excludes it by construction - so this changes how long testing
   * takes and nothing about what the session means.
   */
  @input previewMaxRestSeconds: number = 5;

  /**
   * Longest timed hold in preview, seconds.
   *
   * Editor only. A hand-tracked station is replaced in preview because there
   * are no hands; a timed hold needs no replacing, so it fell through and ran
   * at its prescribed length. That is thirty seconds of sitting at a desk
   * watching a bar fill, four times a block.
   *
   * It shortens on the same grounds as the warm-up and the rest. A hold
   * finishes on the clock, not on the athlete, so its duration is a
   * prescription being read back rather than anything measured - which is why
   * the analysis refuses to rank one - and cutting it takes nothing away.
   */
  @input previewMaxHoldSeconds: number = 5;

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

  /** Burpee Broad Jump: reps (hard gate - camera drop/rise/jump) */
  @input burpeeReps: number = 25;

  /** Heavy Carry Lane: distance in meters (full HYROX ~200m) */
  @input heavyCarryDistance: number = 200;

  /** Walking Lunges: distance in meters (full HYROX ~100m) */
  @input lungesDistance: number = 100;

  // ── Public State ─────────────────────────────────────────────────────────

  stationConfigs: StationConfig[] = [];
  stationCount: number = 0;
  isReady: boolean = false;

  /** The session currently loaded into stationConfigs */
  activePlan: SessionPlan = null;

  /** True when the loaded plan was simplified for preview */
  private _previewSimplified: boolean = false;

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
      makeStartMarker(),

      // Station 1: Air Skierg
      {
        name: 'AIR SKIERG',
        mode: StationMode.ZONE_HIT,
        requirement: this.airSkiergReps,
        instruction: 'Reach UP and PULL DOWN',
        prefabType: 'AIR_SKIERG',
        run: distanceRun(this.runDistance),
        motionType: MotionType.AIR_SKIERG
      },

      // Station 2: Dumbell Bear Crawl
      {
        name: 'DUMBBELL BEAR CRAWL',
        mode: StationMode.DISTANCE,
        requirement: this.powerLaneDistance,
        instruction: 'Push through the lane!',
        prefabType: 'POWER_LANE',
        run: distanceRun(this.runDistance)
      },

      // Station 3: Goblet Reverse Walk
      {
        name: 'GOBLET REVERSE WALK',
        mode: StationMode.DISTANCE,
        requirement: this.crabWalkDistance,
        instruction: 'Walk backward with goblet hold',
        prefabType: 'CRAB_WALK',
        run: distanceRun(this.runDistance)
      },

      // Station 4: Burpee Broad Jump (hard gate - camera detection)
      {
        name: 'BURPEE BROAD JUMP',
        mode: StationMode.REPS,
        requirement: this.burpeeReps,
        instruction: 'Drop DOWN, rise UP, JUMP forward!',
        prefabType: 'BURPEE_BROAD_JUMP',
        run: distanceRun(this.runDistance)
      },

      // Station 5: Standing Row
      {
        name: 'STANDING ROW',
        mode: StationMode.ZONE_HIT,
        requirement: this.powerRowReps,
        instruction: 'Reach forward then PULL BACK',
        prefabType: 'POWER_ROW',
        run: distanceRun(this.runDistance),
        motionType: MotionType.BACKWARD_PULL
      },

      // Station 6: Heavy Carry
      {
        name: 'HEAVY CARRY',
        mode: StationMode.DISTANCE,
        requirement: this.heavyCarryDistance,
        instruction: 'Carry through the lane!',
        prefabType: 'HEAVY_CARRY',
        run: distanceRun(this.runDistance)
      },

      // Station 7: DB Walking Lunges
      {
        name: 'DB WALKING LUNGES',
        mode: StationMode.DISTANCE,
        requirement: this.lungesDistance,
        instruction: 'Walking Lunges with dumbbells',
        prefabType: 'WALKING_LUNGES',
        run: distanceRun(this.runDistance)
      },

      // Station 8: Squat Target Reach
      {
        name: 'SQUAT TARGET REACH',
        mode: StationMode.ZONE_HIT,
        requirement: this.targetPressReps,
        instruction: 'Squat DOWN then reach UP to target!',
        prefabType: 'TARGET_PRESS',
        run: distanceRun(this.runDistance),
        motionType: MotionType.OVERHEAD_REACH
      },

      // FINISH
      makeFinishMarker('RACE COMPLETE!')
    ];
  }

  /**
   * The full race as a loadable plan. This is the default session and its
   * station list is identical to what onAwake used to build directly.
   */
  buildRacePlan(): SessionPlan {
    var stations = this.buildCourseConfig();
    return {
      id: 'race-full',
      kind: SessionKind.RACE,
      title: 'Race Day',
      rationale: 'Full course, timed. Counts for your PB and the leaderboard.',
      estimatedMinutes: CourseManager.estimateMinutes(stations),
      stations: stations,
      source: 'authored'
    };
  }

  // ── Training Sessions ────────────────────────────────────────────────────
  //
  // Every training plan is derived from the race course rather than
  // re-declaring stations, so the @input tuning above stays the single source
  // of truth. Changing burpeeReps changes the race AND every burpee session.

  /**
   * The workout stations, without the START / FINISH markers.
   * Public so AdaptiveSessionGenerator can compose from them.
   */
  getWorkoutTemplates(): StationConfig[] {
    var out: StationConfig[] = [];
    var all = this.buildCourseConfig();

    for (var i = 0; i < all.length; i++) {
      var cfg = all[i];
      if (cfg.prefabType === 'START' || cfg.isFinish) {
        continue;
      }
      out.push(cfg);
    }

    return out;
  }

  /**
   * Look up a race station by name, case and space insensitive.
   * Used by the session builders and, later, by AICoach.prescribeSession.
   */
  findStationTemplate(name: string): StationConfig {
    if (!name) return null;

    var wanted = name.toUpperCase().replace(/\s+/g, ' ').trim();
    var templates = this.getWorkoutTemplates();

    for (var i = 0; i < templates.length; i++) {
      if (templates[i].name.toUpperCase().trim() === wanted) {
        return templates[i];
      }
    }

    return null;
  }

  /**
   * Everything AdaptiveSessionGenerator needs to build a session.
   *
   * Accessories are left to the generator's default catalogue. Pass a limiter
   * when the Coach's Verdict has named one, and the session will be built
   * around what develops it.
   */
  getGeneratorInput(limiterPrefabType?: string): {
    templates: StationConfig[],
    baseRunMetres: number,
    limiterPrefabType?: string,
  } {
    return {
      templates: this.getWorkoutTemplates(),
      baseRunMetres: this.runDistance,
      limiterPrefabType: limiterPrefabType,
    };
  }

  /** Station names a session may be built from - the AI is limited to these */
  getWorkoutStationNames(): string[] {
    var names: string[] = [];
    var templates = this.getWorkoutTemplates();

    for (var i = 0; i < templates.length; i++) {
      names.push(templates[i].name);
    }

    return names;
  }

  /**
   * Copy a race station at reduced volume.
   * @param pct fraction of the station's race requirement, e.g. 0.4
   * @param runBefore metres to run before this station
   */
  private deriveStation(src: StationConfig, pct: number, runBefore: number): StationConfig {
    var floor = src.mode === StationMode.DISTANCE ? 10 : 5;
    var scaled = Math.max(floor, Math.round(src.requirement * pct));

    return {
      name: src.name,
      mode: src.mode,
      requirement: scaled,
      instruction: src.instruction,
      prefabType: src.prefabType,
      run: distanceRun(runBefore),
      motionType: src.motionType
    };
  }

  /** Wrap workout stations with the START / FINISH markers a plan requires */
  private wrapPlan(stations: StationConfig[], finishText: string): StationConfig[] {
    return wrapPlanStations(stations, finishText);
  }

  private makePlan(
    id: string,
    title: string,
    rationale: string,
    stations: StationConfig[],
    finishText: string
  ): SessionPlan {
    var wrapped = this.wrapPlan(stations, finishText);
    return {
      id: id,
      kind: SessionKind.TRAINING,
      title: title,
      rationale: rationale,
      estimatedMinutes: CourseManager.estimateMinutes(wrapped),
      stations: wrapped,
      source: 'authored'
    };
  }

  /**
   * Three sets of a single station at reduced volume, with short runs between.
   * Parametric so the AI coach can prescribe a focus session for whichever
   * station it diagnoses as the athlete's limiter.
   */
  buildStationFocus(stationName: string): SessionPlan {
    var template = this.findStationTemplate(stationName);

    if (!template) {
      print('[CourseManager] buildStationFocus: unknown station "' + stationName + '"');
      return null;
    }

    var sets: StationConfig[] = [
      this.deriveStation(template, 0.4, 50),
      this.deriveStation(template, 0.4, 50),
      this.deriveStation(template, 0.4, 50)
    ];

    return this.makePlan(
      'focus-' + template.name.toLowerCase().replace(/\s+/g, '-'),
      this.toTitleCase(template.name) + ' Focus',
      'Three sets of ' + this.toTitleCase(template.name) + ' with short runs between. Build the station that slows you down.',
      sets,
      'SESSION COMPLETE'
    );
  }

  /**
   * Running is the point here. The short timed blocks between run segments are
   * turnaround/recovery beats - StationMode.RUN exists in the enum but
   * RaceStateMachine never handles it, so timed blocks carry the structure.
   */
  buildSpeedIntervals(): SessionPlan {
    var reps: StationConfig[] = [];

    for (var i = 0; i < 4; i++) {
      reps.push({
        name: 'RECOVER',
        mode: StationMode.TIMED,
        requirement: 20,
        instruction: 'Catch your breath',
        prefabType: 'RECOVERY',
        run: distanceRun(150)
      });
    }

    return this.makePlan(
      'speed-intervals',
      'Speed Intervals',
      'Four hard 150m efforts with 20 seconds recovery. Sharpen your running legs.',
      reps,
      'INTERVALS DONE'
    );
  }

  /**
   * Three stations back to back at half volume with barely any run between -
   * trains the compromised-running feeling that decides a race.
   */
  buildHybridBlocks(): SessionPlan {
    var wanted = ['AIR SKIERG', 'BURPEE BROAD JUMP', 'DB WALKING LUNGES'];
    var blocks: StationConfig[] = [];

    for (var i = 0; i < wanted.length; i++) {
      var template = this.findStationTemplate(wanted[i]);
      if (template) {
        blocks.push(this.deriveStation(template, 0.5, i === 0 ? 50 : 25));
      }
    }

    if (blocks.length === 0) {
      print('[CourseManager] buildHybridBlocks: no templates matched');
      return null;
    }

    return this.makePlan(
      'hybrid-blocks',
      'Hybrid Blocks',
      'Three stations back to back with almost no run between. Trains racing on tired legs.',
      blocks,
      'BLOCKS DONE'
    );
  }

  /** Low intensity, no long runs - meant to be run before a Race Day session */
  buildWarmup(): SessionPlan {
    var wanted = ['AIR SKIERG', 'STANDING ROW', 'DB WALKING LUNGES'];
    var blocks: StationConfig[] = [];

    for (var i = 0; i < wanted.length; i++) {
      var template = this.findStationTemplate(wanted[i]);
      if (template) {
        blocks.push(this.deriveStation(template, 0.3, 25));
      }
    }

    if (blocks.length === 0) {
      print('[CourseManager] buildWarmup: no templates matched');
      return null;
    }

    return this.makePlan(
      'warmup',
      'Warm-up',
      'Light movement through three stations. Run this before a Race Day attempt.',
      blocks,
      'WARMED UP'
    );
  }

  /** Everything the session picker can offer, Race Day first */
  getAllPlans(): SessionPlan[] {
    var plans: SessionPlan[] = [this.buildRacePlan()];
    var candidates: SessionPlan[] = [
      this.buildWarmup(),
      this.buildSpeedIntervals(),
      this.buildHybridBlocks(),
      this.buildStationFocus('BURPEE BROAD JUMP')
    ];

    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i]) {
        plans.push(candidates[i]);
      }
    }

    return plans;
  }

  /** 'AIR SKIERG' -> 'Air Skierg', for session titles */
  private toTitleCase(name: string): string {
    var words = name.toLowerCase().split(' ');

    for (var i = 0; i < words.length; i++) {
      if (words[i].length > 0) {
        words[i] = words[i].charAt(0).toUpperCase() + words[i].substring(1);
      }
    }

    return words.join(' ');
  }

  // ── Cost Model ───────────────────────────────────────────────────────────
  //
  // The model itself lives in SessionTypes. These forwarders exist because
  // callers already reach for CourseManager, and because the generator needs
  // the same numbers without touching a component.

  static estimateMinutes(stations: StationConfig[]): number {
    return estimateMinutes(stations);
  }

  static stationCostSeconds(cfg: StationConfig): number {
    return stationCostSeconds(cfg);
  }

  static stationWorkCostSeconds(cfg: StationConfig): number {
    return stationWorkCostSeconds(cfg);
  }

  static runCostSeconds(metres: number): number {
    return runCostSeconds(metres);
  }

  /**
   * Modelled baseline per split for the loaded plan, keyed the way
   * RaceStateMachine names splits.
   */
  buildModelBaselines(stations?: StationConfig[]): { [splitName: string]: number } {
    return buildModelBaselines(stations || this.stationConfigs);
  }

  // ── Display Names ────────────────────────────────────────────────────────
  //
  // Station `name` is the stable key used in splits and cloud records, so it
  // must not change. These are what the athlete actually reads.

  static readonly DISPLAY_NAMES: { [stationName: string]: string } = {
    'AIR SKIERG': 'Air SkiErg',
    'DUMBBELL BEAR CRAWL': 'Dumbbell Bear Crawl',
    'GOBLET REVERSE WALK': 'Goblet Reverse Walk',
    'BURPEE BROAD JUMP': 'Burpee Broad Jump',
    'STANDING ROW': 'Standing Row',
    'HEAVY CARRY': 'Heavy Carry',
    'DB WALKING LUNGES': 'Dumbbell Walking Lunges',
    'SQUAT TARGET REACH': 'Squat Target Reach',
  };

  /** Display names for RaceAnalysis, which stays free of course knowledge */
  getDisplayNameMap(): { [stationName: string]: string } {
    return CourseManager.DISPLAY_NAMES;
  }

  /**
   * Identifies the tuning a race was run with. Personal baselines are only
   * comparable across races that share this - change burpeeReps and old races
   * stop being a valid reference.
   */
  getConfigKey(): string {
    return [
      'r' + this.runDistance,
      'sk' + this.airSkiergReps,
      'ro' + this.powerRowReps,
      'tp' + this.targetPressReps,
      'pl' + this.powerLaneDistance,
      'cw' + this.crabWalkDistance,
      'bu' + this.burpeeReps,
      'hc' + this.heavyCarryDistance,
      'lu' + this.lungesDistance,
    ].join('_');
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  onAwake(): void {
    this.loadPlan(this.buildRacePlan());

    print('[CourseManager] Dynamic course initialized');
    print('[CourseManager] Run distance: ' + this.runDistance + 'm per segment');
    print('[CourseManager] Zone hits: SkiErg=' + this.airSkiergReps + ', Row=' + this.powerRowReps + ', Press=' + this.targetPressReps);
    print('[CourseManager] Total stations: ' + this.stationCount);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Swap the active session. Must be called before the race starts -
   * RaceStateMachine reads stations lazily via getStationConfig(), so
   * replacing the list mid-race would desync the current station index.
   */
  loadPlan(plan: SessionPlan): void {
    if (!plan || !plan.stations || plan.stations.length === 0) {
      print('[CourseManager] loadPlan: empty plan ignored');
      return;
    }

    // Clear anything already placed in the world from the previous plan
    this.destroyActiveStation();
    this._activeStationIndex = -1;

    var stations = this.applyPreviewMode(plan.stations);

    this.activePlan = plan;
    this.stationConfigs = stations;
    this.stationCount = stations.length;
    this.isReady = true;

    print('[CourseManager] Plan loaded: ' + plan.title + ' (' + plan.kind +
          ', ' + this.stationCount + ' stations, ~' + plan.estimatedMinutes + ' min)' +
          (this._previewSimplified ? ' [PREVIEW: simplified for the editor]' : ''));

    this.logPlanLayers(plan, stations);
  }

  /**
   * Print the plan twice: what it prescribes, and what preview will actually
   * make the athlete do.
   *
   * The two are deliberately different in the editor - a 216m interval cannot
   * be run at a desk - and keeping them on separate lines means a bug found
   * while previewing can be attributed to the layer it came from rather than
   * guessed at. On device the two lines are identical.
   */
  private logPlanLayers(plan: SessionPlan, executed: StationConfig[]): void {
    if (!plan.blocks || plan.blocks.length === 0) return;

    print('[CourseManager] ── PRESCRIPTION (what the session asks for) ──');
    for (var b = 0; b < plan.blocks.length; b++) {
      var block = plan.blocks[b];
      print('[CourseManager]   ' + b + '. ' + block.label +
            '  · ' + block.rounds + ' rounds' +
            (block.restSeconds > 0 ? ' · ' + block.restSeconds + 's rest' : '') +
            (block.legMetres !== undefined
              ? ' · shuttled in ' + block.legMetres + 'm legs' : ''));

      for (var i = 0; i < block.items.length; i++) {
        var item = block.items[i];
        print('[CourseManager]        ' + item.name + ': ' +
              item.requirement + ' ' + this.unitFor(item.mode) +
              (item.legMetres !== undefined
                ? '  (shuttle ' + item.legMetres + 'm legs)' : ''));
      }
    }

    if (!this._previewSimplified) {
      print('[CourseManager] ── EXECUTION: as prescribed (on device) ──');
      return;
    }

    print('[CourseManager] ── EXECUTION (what preview will actually run) ──');

    var shown: { [name: string]: boolean } = {};
    for (var k = 0; k < executed.length; k++) {
      var cfg = executed[k];
      if (cfg.prefabType === 'START' || cfg.isFinish) continue;
      if (shown[cfg.name]) continue;
      shown[cfg.name] = true;

      var original = plan.stations[k];
      var changed = !original ||
                    original.requirement !== cfg.requirement ||
                    original.mode !== cfg.mode ||
                    runLabelOf(original.run) !== runLabelOf(cfg.run);
      if (!changed) continue;

      // A station whose work is entirely in its run has no requirement to
      // report, and printing "0 m → 0 m" beside the one number that did
      // change reads as the session having asked for nothing.
      if (isRunOnlyStation(cfg)) {
        print('[CourseManager]   ' + cfg.name + ': run ' +
              runLabelOf(original.run) + ' → ' + runLabelOf(cfg.run));
        continue;
      }

      print('[CourseManager]   ' + cfg.name + ': ' +
            original.requirement + ' ' + this.unitFor(original.mode) +
            ' → ' + cfg.requirement + ' ' + this.unitFor(cfg.mode) +
            (runLabelOf(original.run) !== runLabelOf(cfg.run)
              ? '   |  run ' + runLabelOf(original.run) + ' → ' +
                runLabelOf(cfg.run)
              : ''));
    }
  }

  /** "400m" or "12:00", or nothing at all */
  private runLabelOf(run?: RunPrescription): string { return runLabelOf(run); }

  private unitFor(mode: StationMode): string {
    switch (mode) {
      case StationMode.DISTANCE: return 'm';
      case StationMode.TIMED:    return 's';
      case StationMode.RUN:      return 'm';
      default:                   return 'reps';
    }
  }

  /**
   * Replace hand-tracked stations with timed ones so the course can be walked
   * in preview. Returns the list untouched on device, or when switched off.
   *
   * The original plan is never mutated - buildRacePlan and the session
   * builders hand out fresh arrays, but a caller may still hold a reference.
   */
  private applyPreviewMode(stations: StationConfig[]): StationConfig[] {
    this._previewSimplified = false;

    if (!this.previewAutoComplete) return stations;
    if (!global.deviceInfoSystem.isEditor()) return stations;

    var out: StationConfig[] = [];
    var replaced = 0;
    var shortened = 0;
    var shortenedRuns = 0;
    var shortenedTimedRuns = 0;
    var timedByFixture = 0;
    var shortenedRests = 0;
    var shortenedHolds = 0;

    for (var i = 0; i < stations.length; i++) {
      var cfg = stations[i];

      // Runs are shortened wherever they appear, station or interval alike.
      // The fixture sets the run outright, and then this station is done:
      // the shortening below would cut its twelve seconds to the eight-second
      // cap and the fixture's own setting would mean nothing. It is already
      // short - that is what it is for.
      if (this.previewTimedRunFixture && hasRun(cfg.run)) {
        cfg = withRun(cfg, timedRun(this.previewFixtureRunSeconds));
        timedByFixture++;
      } else {
        // A run is shortened in whichever unit it was asked for. Six metres
        // is a stand-in for four hundred; it is not a stand-in for fifteen
        // minutes, which has to be cut on the clock or the athlete sits at a
        // desk for a quarter of an hour.
        //
        // And a run that IS the session gets longer than one that leads to a
        // station, because cutting the whole session to eight seconds leaves
        // nothing to look at.
        var secondsCap = isRunOnlyStation(cfg)
          ? this.previewMaxContinuousRunSeconds
          : this.previewMaxRunSeconds;

        if (runSecondsOf(cfg.run) > secondsCap) {
          cfg = shortenRunForPreview(cfg, this.previewMaxRunMetres, secondsCap);
          shortenedTimedRuns++;
        } else if (runMetresOf(cfg.run) > this.previewMaxRunMetres) {
          cfg = shortenRunForPreview(cfg, this.previewMaxRunMetres, secondsCap);
          shortenedRuns++;
        }
      }

      // Rest is real and proportional to the work, which in preview means
      // sitting out breaks earned by work that was itself cut to four
      // seconds. Never a measurement, so never a lie to shorten.
      if (isRestStation(cfg) && cfg.requirement > this.previewMaxRestSeconds) {
        out.push(simplifyForPreview(cfg, this.previewMaxRestSeconds));
        shortenedRests++;
        continue;
      }

      // Warm-up drills already complete on their own; they are just long.
      //
      // Deliberately does not count as a replacement: the flag below means
      // "a station that gets measured was faked", and a warm-up is never
      // measured. Cutting it short costs the analysis nothing.
      if (isWarmupStation(cfg)) {
        out.push(simplifyForPreview(cfg, this.previewWarmupSeconds));
        shortened++;
        continue;
      }

      // A timed hold finishes on the clock whoever is wearing the glasses,
      // so it needed no replacing and got none - and ran its full thirty
      // seconds in an editor where everything around it had been cut to five.
      if (cfg.mode === StationMode.TIMED &&
          cfg.requirement > this.previewMaxHoldSeconds) {
        out.push(simplifyForPreview(cfg, this.previewMaxHoldSeconds));
        shortenedHolds++;
        continue;
      }

      // Distance stations are walkable in preview already
      if (!needsHandTracking(cfg)) {
        out.push(cfg);
        continue;
      }

      replaced++;
      out.push(simplifyForPreview(cfg, this.previewStationSeconds));
    }

    if (shortened > 0) {
      print('[CourseManager] Preview mode: ' + shortened +
            ' warm-up drills shortened to ' + this.previewWarmupSeconds + 's each');
    }

    if (shortenedRests > 0) {
      print('[CourseManager] Preview mode: ' + shortenedRests +
            ' rests shortened to ' + this.previewMaxRestSeconds + 's each');
    }

    if (shortenedHolds > 0) {
      print('[CourseManager] Preview mode: ' + shortenedHolds +
            ' timed holds shortened to ' + this.previewMaxHoldSeconds + 's each');
    }

    if (timedByFixture > 0) {
      this._previewSimplified = true;
      print('[CourseManager] Preview FIXTURE: ' + timedByFixture +
            ' runs served on the clock (' + this.previewFixtureRunSeconds +
            's) instead of on the ground — editor only, not a prescription');
    }

    // Counted apart, and reported in the unit each was actually cut in. One
    // counter said "shortened to 6m" for a run that was never asked for in
    // metres and had just been cut from fifteen minutes to forty seconds -
    // which is the distinction B0 exists to keep, undone in the log.
    if (shortenedRuns > 0) {
      this._previewSimplified = true;
      print('[CourseManager] Preview mode: ' + shortenedRuns +
            ' runs shortened to ' + this.previewMaxRunMetres + 'm');
    }

    if (shortenedTimedRuns > 0) {
      this._previewSimplified = true;
      print('[CourseManager] Preview mode: ' + shortenedTimedRuns +
            ' timed runs shortened on the clock');
    }

    if (replaced > 0) {
      this._previewSimplified = true;
      print('[CourseManager] Preview mode: ' + replaced +
            ' hand-tracked stations auto-complete after ' +
            this.previewStationSeconds + 's each');
    }

    return out;
  }

  /** True when the current plan was simplified for preview */
  get isPreviewSimplified(): boolean {
    return this._previewSimplified;
  }

  /**
   * True when the loaded session should count for PB / leaderboard.
   * A preview-simplified race never does - its station times are a timer,
   * not a performance, and would poison both the leaderboard and the
   * personal baselines the Coach's Verdict is built on.
   */
  get isRaceSession(): boolean {
    if (this._previewSimplified) return false;
    return !this.activePlan || this.activePlan.kind === SessionKind.RACE;
  }

  /**
   * Set floor height (called by CourseSetup after calibration)
   */
  setFloorHeight(floorY: number): void {
    this._floorY = floorY;
    this._floorCalibrated = true;
    print('[CourseManager] Floor height set: ' + floorY.toFixed(1));
  }

  /**
   * Get floor height
   */
  getFloorHeight(): number {
    return this._floorY;
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
  /**
   * Put a station at a fixed place rather than in front of whoever is walking.
   *
   * A race lays itself out ahead of the athlete: you run, the next station
   * appears, the course advances. A training session is done on one spot - the
   * movement changes, the place does not - so training needs to spawn at an
   * anchor instead of at a moving reference.
   */
  spawnStationAtAnchor(stationIndex: number, anchorPos: vec3, anchorForward: vec3): SceneObject {
    return this.spawnStationInFrontOfPlayer(stationIndex, anchorPos, anchorForward, 0);
  }

  spawnStationInFrontOfPlayer(
    stationIndex: number,
    playerPos: vec3,
    playerForward: vec3,
    distanceOverride?: number
  ): SceneObject {
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

    // Calculate spawn position: in front of player at floor level.
    // An anchor spawn passes 0 so the station lands exactly where it is told.
    var ahead = distanceOverride === undefined
      ? this.spawnDistanceAhead
      : distanceOverride;

    var flatForward = new vec3(playerForward.x, 0, playerForward.z).normalize();
    var spawnPos = new vec3(
      playerPos.x + flatForward.x * ahead,
      this._floorY,
      playerPos.z + flatForward.z * ahead
    );

    print('[CourseManager] spawnStation: playerPos=(' + playerPos.x.toFixed(0) + ', ' + playerPos.z.toFixed(0) + ')');
    print('[CourseManager] spawnStation: flatForward=(' + flatForward.x.toFixed(2) + ', ' + flatForward.z.toFixed(2) + '), dist=' + ahead);

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
      // The station can be destroyed mid-fade - a training session advances
      // fast enough that a spawn and the next destroy overlap. Reading a
      // component off a destroyed object throws, so stop first.
      if (isNull(obj)) {
        this.removeEvent(fadeEvent);
        return;
      }

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
      // Already gone - nothing left to fade, but whoever was waiting on this
      // still has to be told, or the race stalls waiting for a callback.
      if (isNull(obj)) {
        this.removeEvent(fadeEvent);
        if (onComplete) onComplete();
        return;
      }

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
    if (isNull(obj)) return 1.0;

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
    if (isNull(obj)) return;

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
    if (isNull(obj)) return;

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
    if (isNull(obj)) return;

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
