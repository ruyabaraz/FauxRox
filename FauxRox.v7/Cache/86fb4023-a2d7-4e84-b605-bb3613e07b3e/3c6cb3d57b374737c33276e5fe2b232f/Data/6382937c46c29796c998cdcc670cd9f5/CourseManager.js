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
// CourseManager.ts — FauxRox Dynamic Course System
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
            // ── Run Settings ────────────────────────────────────────────────────────
            this.runDistance = this.runDistance;
            /** Distance to spawn station in front of player (cm) */
            this.spawnDistanceAhead = this.spawnDistanceAhead;
            /** Fade duration in seconds */
            this.fadeDuration = this.fadeDuration;
            // ── Station Requirements (for demo, reduce these values) ───────────────
            this.airSkiergReps = this.airSkiergReps;
            /** Power Row Gates: pull back reps (full HYROX ~50) */
            this.powerRowReps = this.powerRowReps;
            /** Target Press: reach up reps (full HYROX ~75) */
            this.targetPressReps = this.targetPressReps;
            this.powerLaneDistance = this.powerLaneDistance;
            /** Crab Walk: distance in meters (full HYROX ~50m) */
            this.crabWalkDistance = this.crabWalkDistance;
            /** Burpee Broad Jump: distance in meters (full HYROX ~80m) */
            this.burpeeDistance = this.burpeeDistance;
            /** Heavy Carry Lane: distance in meters (full HYROX ~200m) */
            this.heavyCarryDistance = this.heavyCarryDistance;
            /** Walking Lunges: distance in meters (full HYROX ~100m) */
            this.lungesDistance = this.lungesDistance;
            // ── Public State ─────────────────────────────────────────────────────────
            this.stationConfigs = [];
            this.stationCount = 0;
            this.isReady = false;
            // Current active station
            this._activeStation = null;
            this._activeStationIndex = -1;
            this._activeStationMaxAlpha = 1.0;
            // Floor height (set by CourseSetup after calibration)
            this._floorY = 0;
            this._floorCalibrated = false;
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
            // ── Run Settings ────────────────────────────────────────────────────────
            this.runDistance = this.runDistance;
            /** Distance to spawn station in front of player (cm) */
            this.spawnDistanceAhead = this.spawnDistanceAhead;
            /** Fade duration in seconds */
            this.fadeDuration = this.fadeDuration;
            // ── Station Requirements (for demo, reduce these values) ───────────────
            this.airSkiergReps = this.airSkiergReps;
            /** Power Row Gates: pull back reps (full HYROX ~50) */
            this.powerRowReps = this.powerRowReps;
            /** Target Press: reach up reps (full HYROX ~75) */
            this.targetPressReps = this.targetPressReps;
            this.powerLaneDistance = this.powerLaneDistance;
            /** Crab Walk: distance in meters (full HYROX ~50m) */
            this.crabWalkDistance = this.crabWalkDistance;
            /** Burpee Broad Jump: distance in meters (full HYROX ~80m) */
            this.burpeeDistance = this.burpeeDistance;
            /** Heavy Carry Lane: distance in meters (full HYROX ~200m) */
            this.heavyCarryDistance = this.heavyCarryDistance;
            /** Walking Lunges: distance in meters (full HYROX ~100m) */
            this.lungesDistance = this.lungesDistance;
            // ── Public State ─────────────────────────────────────────────────────────
            this.stationConfigs = [];
            this.stationCount = 0;
            this.isReady = false;
            // Current active station
            this._activeStation = null;
            this._activeStationIndex = -1;
            this._activeStationMaxAlpha = 1.0;
            // Floor height (set by CourseSetup after calibration)
            this._floorY = 0;
            this._floorCalibrated = false;
        }
        /**
         * Returns true when floor is calibrated and START line is spawned
         * (Used by StartTrigger to know when pinch should start race)
         */
        get isCoursePlaced() {
            return this._floorCalibrated && this._activeStationIndex >= 0;
        }
        // ── Real HYROX Course Config (Bodyweight Version) ────────────────────────
        buildCourseConfig() {
            return [
                // START - just a visual marker, completes instantly
                {
                    name: 'START',
                    mode: StationMode.TIMED,
                    requirement: 0,
                    instruction: '',
                    prefabType: 'START',
                    runDistanceBefore: 0,
                    maxAlpha: 0.3
                },
                // Station 1: SkiErg → Air SkiErg
                {
                    name: 'Air SkiErg',
                    mode: StationMode.ZONE_HIT,
                    requirement: this.airSkiergReps,
                    instruction: 'Reach UP then PULL DOWN',
                    prefabType: 'AIR_SKIERG',
                    runDistanceBefore: this.runDistance,
                    motionType: MotionType.AIR_SKIERG
                },
                // Station 2: Sled Push → Power Lane
                {
                    name: 'Power Lane',
                    mode: StationMode.DISTANCE,
                    requirement: this.powerLaneDistance,
                    instruction: 'Push through the lane!',
                    prefabType: 'POWER_LANE',
                    runDistanceBefore: this.runDistance
                },
                // Station 3: Sled Pull → Crab Walk
                {
                    name: 'Crab Walk',
                    mode: StationMode.DISTANCE,
                    requirement: this.crabWalkDistance,
                    instruction: 'Crab Walk Backward',
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
                // Station 5: Rowing → Power Row Gates
                {
                    name: 'Power Row Gates',
                    mode: StationMode.ZONE_HIT,
                    requirement: this.powerRowReps,
                    instruction: 'Reach forward then PULL BACK',
                    prefabType: 'POWER_ROW',
                    runDistanceBefore: this.runDistance,
                    motionType: MotionType.BACKWARD_PULL
                },
                // Station 6: Farmers Carry → Heavy Carry Lane
                {
                    name: 'Heavy Carry Lane',
                    mode: StationMode.DISTANCE,
                    requirement: this.heavyCarryDistance,
                    instruction: 'Carry through the lane!',
                    prefabType: 'HEAVY_CARRY',
                    runDistanceBefore: this.runDistance
                },
                // Station 7: Lunges
                {
                    name: 'Walking Lunges',
                    mode: StationMode.DISTANCE,
                    requirement: this.lungesDistance,
                    instruction: 'Walking Lunges',
                    prefabType: 'WALKING_LUNGES',
                    runDistanceBefore: this.runDistance
                },
                // Station 8: Wall Balls → Target Press
                {
                    name: 'Target Press',
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
            print('[CourseManager] Run distance: ' + this.runDistance + 'm per segment');
            print('[CourseManager] Zone hits: SkiErg=' + this.airSkiergReps + ', Row=' + this.powerRowReps + ', Press=' + this.targetPressReps);
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
            this._activeStationMaxAlpha = cfg.maxAlpha ?? 1.0;
            print('[CourseManager] Spawned station ' + stationIndex + ': ' + cfg.name);
            print('[CourseManager] Position: (' + spawnPos.x.toFixed(0) + ', ' + spawnPos.y.toFixed(0) + ', ' + spawnPos.z.toFixed(0) + ')');
            // Start fade-in animation (use station's maxAlpha, default 1.0)
            this.fadeIn(obj, cfg.maxAlpha ?? 1.0);
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
            var maxAlpha = this._activeStationMaxAlpha;
            this._activeStation = null;
            this.fadeOut(station, maxAlpha, () => {
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
            this._activeStationMaxAlpha = 1.0;
            // Note: Keep _floorCalibrated true - no need to recalibrate floor
            print('[CourseManager] Course reset');
        }
        /**
         * Full reset including floor calibration
         */
        fullReset() {
            this.destroyActiveStation();
            this._activeStationIndex = -1;
            this._activeStationMaxAlpha = 1.0;
            this._floorCalibrated = false;
            this._floorY = 0;
            print('[CourseManager] Full reset (floor calibration cleared)');
        }
        // ── Fade Animations ──────────────────────────────────────────────────────
        fadeIn(obj, defaultMaxAlpha = 1.0) {
            // Start invisible
            this.setObjectAlpha(obj, 0, defaultMaxAlpha);
            obj.enabled = true;
            // Animate to visible
            var startTime = getTime();
            var duration = this.fadeDuration;
            var fadeEvent = this.createEvent('UpdateEvent');
            fadeEvent.bind(() => {
                var elapsed = getTime() - startTime;
                var t = Math.min(1, elapsed / duration);
                this.setObjectAlpha(obj, t, defaultMaxAlpha);
                if (t >= 1) {
                    this.removeEvent(fadeEvent);
                }
            });
        }
        fadeOut(obj, defaultMaxAlpha = 1.0, onComplete) {
            var startTime = getTime();
            var duration = this.fadeDuration;
            var fadeEvent = this.createEvent('UpdateEvent');
            fadeEvent.bind(() => {
                var elapsed = getTime() - startTime;
                var t = Math.min(1, elapsed / duration);
                this.setObjectAlpha(obj, 1 - t, defaultMaxAlpha);
                if (t >= 1) {
                    this.removeEvent(fadeEvent);
                    if (onComplete)
                        onComplete();
                }
            });
        }
        /**
         * Get maxAlpha from AlphaOverride component if present
         * Returns null if no component found (use default)
         */
        getMaxAlphaOverride(obj) {
            // Get all script components and check for AlphaOverride
            var scripts = obj.getComponents('Component.ScriptComponent');
            // DEBUG
            if (scripts.length > 0) {
                print('[CourseManager] Found ' + scripts.length + ' scripts on: ' + obj.name);
            }
            for (var i = 0; i < scripts.length; i++) {
                var script = scripts[i];
                // DEBUG: log all properties
                print('[CourseManager] Script ' + i + ' keys: ' + Object.keys(script).join(', '));
                print('[CourseManager] script.maxAlpha = ' + script.maxAlpha);
                // Check if this script has maxAlpha property (is AlphaOverride)
                if (script.maxAlpha !== undefined && typeof script.maxAlpha === 'number') {
                    print('[CourseManager] Found AlphaOverride on ' + obj.name + ' = ' + script.maxAlpha);
                    return script.maxAlpha;
                }
            }
            return null;
        }
        setObjectAlpha(obj, fadeProgress, defaultMaxAlpha = 1.0) {
            // Set alpha on all RenderMeshVisuals in hierarchy
            // Each mesh can have its own maxAlpha via AlphaOverride component
            this.forEachRenderMesh(obj, (rmv, meshObj) => {
                // Per-mesh alpha override from component, fallback to station default
                var meshMaxAlpha = this.getMaxAlphaOverride(meshObj);
                var actualMax = meshMaxAlpha !== null ? meshMaxAlpha : defaultMaxAlpha;
                var alpha = fadeProgress * actualMax;
                var mat = rmv.mainMaterial;
                if (mat) {
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
            // Handle Text components
            this.forEachText(obj, (textComp, textObj) => {
                var textMaxAlpha = this.getMaxAlphaOverride(textObj);
                var actualMax = textMaxAlpha !== null ? textMaxAlpha : defaultMaxAlpha;
                var alpha = fadeProgress * actualMax;
                try {
                    if (textComp.textFill && textComp.textFill.color) {
                        var c = textComp.textFill.color;
                        textComp.textFill.color = new vec4(c.r, c.g, c.b, alpha);
                    }
                }
                catch (e) {
                    // Ignore
                }
            });
        }
        forEachRenderMesh(obj, callback) {
            // Check this object
            var rmv = obj.getComponent('Component.RenderMeshVisual');
            if (rmv)
                callback(rmv, obj);
            // Check children recursively
            var childCount = obj.getChildrenCount();
            for (var i = 0; i < childCount; i++) {
                this.forEachRenderMesh(obj.getChild(i), callback);
            }
        }
        forEachText(obj, callback) {
            // Check this object
            var textComp = obj.getComponent('Component.Text');
            if (textComp)
                callback(textComp, obj);
            // Check children recursively
            var childCount = obj.getChildrenCount();
            for (var i = 0; i < childCount; i++) {
                this.forEachText(obj.getChild(i), callback);
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