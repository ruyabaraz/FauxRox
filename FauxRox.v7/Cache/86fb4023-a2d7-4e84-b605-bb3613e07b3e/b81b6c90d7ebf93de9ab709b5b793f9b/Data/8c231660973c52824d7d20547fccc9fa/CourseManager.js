"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CourseManager = exports.MotionType = exports.StationMode = void 0;
var __selfType = requireType("./CourseManager");
function component(target) { target.getTypeName = function () { return __selfType; }; }
// ============================================================================
// CourseManager.ts — HYROX MIRAGE Course Placement
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Real HYROX format: 8 × 1km runs + 8 workout stations
// Bodyweight alternatives for equipment-free training
// ============================================================================
// Station completion type
var StationMode;
(function (StationMode) {
    StationMode["TIMED"] = "TIMED";
    StationMode["DISTANCE"] = "DISTANCE";
    StationMode["REPS"] = "REPS";
    StationMode["RUN"] = "RUN";
    StationMode["ZONE_HIT"] = "ZONE_HIT";
})(StationMode || (exports.StationMode = StationMode = {}));
// Motion type for zone-based stations
var MotionType;
(function (MotionType) {
    MotionType["OVERHEAD_REACH"] = "OVERHEAD_REACH";
    MotionType["OVERHEAD_PULL"] = "OVERHEAD_PULL";
    MotionType["FORWARD_PUSH"] = "FORWARD_PUSH";
    MotionType["BACKWARD_PULL"] = "BACKWARD_PULL";
})(MotionType || (exports.MotionType = MotionType = {}));
let CourseManager = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var CourseManager = _classThis = class extends _classSuper {
        constructor() {
            super();
            // ── Prefabs ──────────────────────────────────────────────────────────────
            this.startLinePrefab = this.startLinePrefab;
            this.finishPrefab = this.finishPrefab;
            // Station-specific prefabs (8 workout stations)
            this.mountainClimbersPrefab = this.mountainClimbersPrefab; // Station 1: Ski Erg alt
            this.bearCrawlPrefab = this.bearCrawlPrefab; // Station 2: Sled Push alt
            this.crabWalkPrefab = this.crabWalkPrefab; // Station 3: Sled Pull alt
            this.burpeeBroadJumpPrefab = this.burpeeBroadJumpPrefab; // Station 4: Same
            this.jumpSquatsPrefab = this.jumpSquatsPrefab; // Station 5: Rowing alt
            this.farmersCarryPrefab = this.farmersCarryPrefab; // Station 6: Same
            this.walkingLungesPrefab = this.walkingLungesPrefab; // Station 7: Lunges
            this.squatPressPrefab = this.squatPressPrefab; // Station 8: Wall Balls alt
            // Fallback prefab if station-specific not assigned
            this.defaultWorkoutPrefab = this.defaultWorkoutPrefab;
            this.highlightMaterial = this.highlightMaterial;
            this.completedMaterial = this.completedMaterial;
            this.activeMaterial = this.activeMaterial;
            // ── Settings ─────────────────────────────────────────────────────────────
            /** Run distance scale: 1.0 = full 1km, 0.1 = 100m per segment */
            this.runDistanceScale = this.runDistanceScale;
            /** Workout intensity scale: 1.0 = full reps/time, 0.5 = half */
            this.workoutScale = this.workoutScale;
            /** Physical spacing between station markers (cm) */
            this.stationSpacing = this.stationSpacing;
            // ── Public Data ──────────────────────────────────────────────────────────
            this.stationConfigs = [];
            this.stationNames = [];
            this.stationPositions = [];
            this.stationObjects = [];
            this.stationCompleted = [];
            this.isCoursePlaced = false;
            this.stationCount = 0;
            // Current run tracking
            this.currentRunTarget = 0; // meters to run
            this.currentRunDistance = 0; // meters run so far
            // ── Real HYROX Course Config (Bodyweight Version) ────────────────────────
            this.FULL_RUN_DISTANCE = 1000; // 1km in meters
        }
        __initialize() {
            super.__initialize();
            // ── Prefabs ──────────────────────────────────────────────────────────────
            this.startLinePrefab = this.startLinePrefab;
            this.finishPrefab = this.finishPrefab;
            // Station-specific prefabs (8 workout stations)
            this.mountainClimbersPrefab = this.mountainClimbersPrefab; // Station 1: Ski Erg alt
            this.bearCrawlPrefab = this.bearCrawlPrefab; // Station 2: Sled Push alt
            this.crabWalkPrefab = this.crabWalkPrefab; // Station 3: Sled Pull alt
            this.burpeeBroadJumpPrefab = this.burpeeBroadJumpPrefab; // Station 4: Same
            this.jumpSquatsPrefab = this.jumpSquatsPrefab; // Station 5: Rowing alt
            this.farmersCarryPrefab = this.farmersCarryPrefab; // Station 6: Same
            this.walkingLungesPrefab = this.walkingLungesPrefab; // Station 7: Lunges
            this.squatPressPrefab = this.squatPressPrefab; // Station 8: Wall Balls alt
            // Fallback prefab if station-specific not assigned
            this.defaultWorkoutPrefab = this.defaultWorkoutPrefab;
            this.highlightMaterial = this.highlightMaterial;
            this.completedMaterial = this.completedMaterial;
            this.activeMaterial = this.activeMaterial;
            // ── Settings ─────────────────────────────────────────────────────────────
            /** Run distance scale: 1.0 = full 1km, 0.1 = 100m per segment */
            this.runDistanceScale = this.runDistanceScale;
            /** Workout intensity scale: 1.0 = full reps/time, 0.5 = half */
            this.workoutScale = this.workoutScale;
            /** Physical spacing between station markers (cm) */
            this.stationSpacing = this.stationSpacing;
            // ── Public Data ──────────────────────────────────────────────────────────
            this.stationConfigs = [];
            this.stationNames = [];
            this.stationPositions = [];
            this.stationObjects = [];
            this.stationCompleted = [];
            this.isCoursePlaced = false;
            this.stationCount = 0;
            // Current run tracking
            this.currentRunTarget = 0; // meters to run
            this.currentRunDistance = 0; // meters run so far
            // ── Real HYROX Course Config (Bodyweight Version) ────────────────────────
            this.FULL_RUN_DISTANCE = 1000; // 1km in meters
        }
        buildCourseConfig() {
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
        onAwake() {
            this.stationConfigs = this.buildCourseConfig();
            print('[CourseManager] HYROX Bodyweight course initialized');
            print('[CourseManager] Run scale: ' + this.runDistanceScale + ' (each run = ' +
                (this.FULL_RUN_DISTANCE * this.runDistanceScale) + 'm)');
            print('[CourseManager] Workout scale: ' + this.workoutScale);
            print('[CourseManager] Total stations: ' + this.stationConfigs.length);
        }
        // ── Public API ───────────────────────────────────────────────────────────
        placeCourseAt(pos, rot) {
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
        getStationConfig(index) {
            if (index < 0 || index >= this.stationConfigs.length) {
                return null;
            }
            return this.stationConfigs[index];
        }
        highlightStation(index) {
            for (var i = 0; i < this.stationObjects.length; i++) {
                if (i < index && this.completedMaterial) {
                    this.applyMaterial(this.stationObjects[i], this.completedMaterial);
                    this.stationCompleted[i] = true;
                }
                else if (i === index && this.highlightMaterial) {
                    this.applyMaterial(this.stationObjects[i], this.highlightMaterial);
                }
            }
        }
        setStationActive(index) {
            if (index >= 0 && index < this.stationObjects.length && this.activeMaterial) {
                this.applyMaterial(this.stationObjects[index], this.activeMaterial);
            }
        }
        resetCourse() {
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
        layoutStations(origin, forwardDir, lateralDir) {
            var currentPos = new vec3(origin.x, origin.y, origin.z);
            for (var i = 0; i < this.stationConfigs.length; i++) {
                var cfg = this.stationConfigs[i];
                // Move forward for station spacing (physical markers)
                if (i > 0) {
                    currentPos = new vec3(currentPos.x + forwardDir.x * this.stationSpacing, currentPos.y, currentPos.z + forwardDir.z * this.stationSpacing);
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
        printCourseSummary() {
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
                }
                else if (cfg.mode === StationMode.DISTANCE) {
                    totalDistance += cfg.requirement;
                }
            }
            print('  Total Run: ' + totalRun + 'm');
            print('  Total Reps: ' + totalReps);
            print('  Total Movement Distance: ' + totalDistance + 'm');
            print('═══════════════════════════════════════════');
        }
        // ── Helpers ──────────────────────────────────────────────────────────────
        getPrefab(type) {
            switch (type) {
                case 'START':
                    return this.startLinePrefab;
                case 'FINISH':
                    return this.finishPrefab;
                case 'MOUNTAIN_CLIMBERS':
                    return this.mountainClimbersPrefab || this.defaultWorkoutPrefab;
                case 'BEAR_CRAWL':
                    return this.bearCrawlPrefab || this.defaultWorkoutPrefab;
                case 'CRAB_WALK':
                    return this.crabWalkPrefab || this.defaultWorkoutPrefab;
                case 'BURPEE_BROAD_JUMP':
                    return this.burpeeBroadJumpPrefab || this.defaultWorkoutPrefab;
                case 'JUMP_SQUATS':
                    return this.jumpSquatsPrefab || this.defaultWorkoutPrefab;
                case 'FARMERS_CARRY':
                    return this.farmersCarryPrefab || this.defaultWorkoutPrefab;
                case 'WALKING_LUNGES':
                    return this.walkingLungesPrefab || this.defaultWorkoutPrefab;
                case 'SQUAT_PRESS':
                    return this.squatPressPrefab || this.defaultWorkoutPrefab;
                default:
                    return this.defaultWorkoutPrefab;
            }
        }
        applyMaterial(obj, mat) {
            var count = obj.getChildrenCount();
            for (var i = 0; i < count; i++) {
                var rmv = obj.getChild(i).getComponent('Component.RenderMeshVisual');
                if (rmv)
                    rmv.mainMaterial = mat;
            }
            var rootRmv = obj.getComponent('Component.RenderMeshVisual');
            if (rootRmv)
                rootRmv.mainMaterial = mat;
        }
    };
    __setFunctionName(_classThis, "CourseManager");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CourseManager = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CourseManager = _classThis;
})();
exports.CourseManager = CourseManager;
//# sourceMappingURL=CourseManager.js.map