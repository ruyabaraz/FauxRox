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
// CourseManager.ts — HYROX MIRAGE Dynamic Course System
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// DYNAMIC "follow-the-runner" system:
// - Stations spawn in front of the player when run distance completes
// - Fade in/out animations
// - No fixed course layout
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
    MotionType["AIR_SKIERG"] = "AIR_SKIERG";
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
            this.airSkiergPrefab = this.airSkiergPrefab;
            this.powerLanePrefab = this.powerLanePrefab;
            this.crabWalkPrefab = this.crabWalkPrefab;
            this.burpeeBroadJumpPrefab = this.burpeeBroadJumpPrefab;
            this.powerRowPrefab = this.powerRowPrefab;
            this.heavyCarryPrefab = this.heavyCarryPrefab;
            this.walkingLungesPrefab = this.walkingLungesPrefab;
            this.targetPressPrefab = this.targetPressPrefab;
            // Fallback prefab if station-specific not assigned
            this.defaultWorkoutPrefab = this.defaultWorkoutPrefab;
            // ── Settings ─────────────────────────────────────────────────────────────
            /** Run distance scale: 1.0 = full 1km, 0.1 = 100m per segment */
            this.runDistanceScale = this.runDistanceScale;
            /** Workout intensity scale: 1.0 = full reps/time, 0.5 = half */
            this.workoutScale = this.workoutScale;
            /** Distance to spawn station in front of player (cm) */
            this.spawnDistanceAhead = this.spawnDistanceAhead; // Reduced from 300 - closer to player
            /** Fade duration in seconds */
            this.fadeDuration = this.fadeDuration;
            // ── Public State ─────────────────────────────────────────────────────────
            this.stationConfigs = [];
            this.stationCount = 0;
            this.isReady = false;
            // Current active station
            this._activeStation = null;
            this._activeStationIndex = -1;
            // Floor height (set by CourseSetup after calibration)
            this._floorY = 0;
            this._floorCalibrated = false;
            // ── Real HYROX Course Config (Bodyweight Version) ────────────────────────
            this.FULL_RUN_DISTANCE = 1000; // 1km in meters
        }
        __initialize() {
            super.__initialize();
            // ── Prefabs ──────────────────────────────────────────────────────────────
            this.startLinePrefab = this.startLinePrefab;
            this.finishPrefab = this.finishPrefab;
            // Station-specific prefabs (8 workout stations)
            this.airSkiergPrefab = this.airSkiergPrefab;
            this.powerLanePrefab = this.powerLanePrefab;
            this.crabWalkPrefab = this.crabWalkPrefab;
            this.burpeeBroadJumpPrefab = this.burpeeBroadJumpPrefab;
            this.powerRowPrefab = this.powerRowPrefab;
            this.heavyCarryPrefab = this.heavyCarryPrefab;
            this.walkingLungesPrefab = this.walkingLungesPrefab;
            this.targetPressPrefab = this.targetPressPrefab;
            // Fallback prefab if station-specific not assigned
            this.defaultWorkoutPrefab = this.defaultWorkoutPrefab;
            // ── Settings ─────────────────────────────────────────────────────────────
            /** Run distance scale: 1.0 = full 1km, 0.1 = 100m per segment */
            this.runDistanceScale = this.runDistanceScale;
            /** Workout intensity scale: 1.0 = full reps/time, 0.5 = half */
            this.workoutScale = this.workoutScale;
            /** Distance to spawn station in front of player (cm) */
            this.spawnDistanceAhead = this.spawnDistanceAhead; // Reduced from 300 - closer to player
            /** Fade duration in seconds */
            this.fadeDuration = this.fadeDuration;
            // ── Public State ─────────────────────────────────────────────────────────
            this.stationConfigs = [];
            this.stationCount = 0;
            this.isReady = false;
            // Current active station
            this._activeStation = null;
            this._activeStationIndex = -1;
            // Floor height (set by CourseSetup after calibration)
            this._floorY = 0;
            this._floorCalibrated = false;
            // ── Real HYROX Course Config (Bodyweight Version) ────────────────────────
            this.FULL_RUN_DISTANCE = 1000; // 1km in meters
        }
        /**
         * Returns true when floor is calibrated and START line is spawned
         * (Used by StartTrigger to know when pinch should start race)
         */
        get isCoursePlaced() {
            return this._floorCalibrated && this._activeStationIndex >= 0;
        }
        buildCourseConfig() {
            var runDist = this.FULL_RUN_DISTANCE * this.runDistanceScale;
            var ws = this.workoutScale;
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
                // Station 1: SkiErg → Air SkiErg
                {
                    name: 'Air SkiErg',
                    mode: StationMode.ZONE_HIT,
                    requirement: Math.round(50 * ws),
                    instruction: 'Reach UP then PULL DOWN',
                    prefabType: 'AIR_SKIERG',
                    runDistanceBefore: runDist,
                    motionType: MotionType.AIR_SKIERG
                },
                // Station 2: Sled Push → Power Lane
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
            this.stationCount = this.stationConfigs.length;
            this.isReady = true;
            print('[CourseManager] Dynamic course initialized');
            print('[CourseManager] Run distance: ' + (this.FULL_RUN_DISTANCE * this.runDistanceScale) + 'm per segment');
            print('[CourseManager] Workout scale: ' + this.workoutScale);
            print('[CourseManager] Total stations: ' + this.stationCount);
        }
        // ── Public API ───────────────────────────────────────────────────────────
        /**
         * Set floor height (called by CourseSetup after calibration)
         */
        setFloorHeight(floorY) {
            this._floorY = floorY;
            this._floorCalibrated = true;
            print('[CourseManager] Floor height set: ' + floorY.toFixed(1));
        }
        /**
         * Get station config by index
         */
        getStationConfig(index) {
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
        spawnStationInFrontOfPlayer(stationIndex, playerPos, playerForward) {
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
            var spawnPos = new vec3(playerPos.x + flatForward.x * this.spawnDistanceAhead, this._floorY, playerPos.z + flatForward.z * this.spawnDistanceAhead);
            // Create rotation facing the player
            var toPlayer = new vec3(playerPos.x - spawnPos.x, 0, playerPos.z - spawnPos.z).normalize();
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
        spawnStartAtPlayer(playerPos, playerForward) {
            return this.spawnStationInFrontOfPlayer(0, playerPos, playerForward);
        }
        /**
         * Destroy the current active station with fade-out
         */
        destroyActiveStation() {
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
        fadeOutAndDestroy(onComplete) {
            if (!this._activeStation) {
                if (onComplete)
                    onComplete();
                return;
            }
            var station = this._activeStation;
            this._activeStation = null;
            this.fadeOut(station, () => {
                station.destroy();
                if (onComplete)
                    onComplete();
            });
        }
        /**
         * Get current active station index
         */
        getActiveStationIndex() {
            return this._activeStationIndex;
        }
        /**
         * Get active station object
         */
        getActiveStation() {
            return this._activeStation;
        }
        /**
         * Reset course state (keeps floor calibration)
         */
        resetCourse() {
            this.destroyActiveStation();
            this._activeStationIndex = -1;
            // Note: Keep _floorCalibrated true - no need to recalibrate floor
            print('[CourseManager] Course reset');
        }
        /**
         * Full reset including floor calibration
         */
        fullReset() {
            this.destroyActiveStation();
            this._activeStationIndex = -1;
            this._floorCalibrated = false;
            this._floorY = 0;
            print('[CourseManager] Full reset (floor calibration cleared)');
        }
        // ── Fade Animations ──────────────────────────────────────────────────────
        fadeIn(obj) {
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
        fadeOut(obj, onComplete) {
            var startTime = getTime();
            var duration = this.fadeDuration;
            var fadeEvent = this.createEvent('UpdateEvent');
            fadeEvent.bind(() => {
                var elapsed = getTime() - startTime;
                var t = Math.min(1, elapsed / duration);
                this.setObjectAlpha(obj, 1 - t);
                if (t >= 1) {
                    this.removeEvent(fadeEvent);
                    if (onComplete)
                        onComplete();
                }
            });
        }
        setObjectAlpha(obj, alpha) {
            // Try to set alpha on all RenderMeshVisuals in hierarchy
            this.forEachRenderMesh(obj, (rmv) => {
                var mat = rmv.mainMaterial;
                if (mat) {
                    // Try to set baseColor alpha or opacity
                    try {
                        var pass = mat.mainPass;
                        if (pass.baseColor) {
                            var color = pass.baseColor;
                            pass.baseColor = new vec4(color.r, color.g, color.b, alpha);
                        }
                    }
                    catch (e) {
                        // Material doesn't support alpha, ignore
                    }
                }
            });
            // Also handle Text components
            var textComponents = obj.getComponents('Component.Text');
            for (var i = 0; i < textComponents.length; i++) {
                try {
                    var tc = textComponents[i];
                    if (tc.textFill && tc.textFill.color) {
                        var c = tc.textFill.color;
                        tc.textFill.color = new vec4(c.r, c.g, c.b, alpha);
                    }
                }
                catch (e) {
                    // Ignore
                }
            }
        }
        forEachRenderMesh(obj, callback) {
            // Check this object
            var rmv = obj.getComponent('Component.RenderMeshVisual');
            if (rmv)
                callback(rmv);
            // Check children recursively
            var childCount = obj.getChildrenCount();
            for (var i = 0; i < childCount; i++) {
                this.forEachRenderMesh(obj.getChild(i), callback);
            }
        }
        // ── Helpers ──────────────────────────────────────────────────────────────
        getPrefab(type) {
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