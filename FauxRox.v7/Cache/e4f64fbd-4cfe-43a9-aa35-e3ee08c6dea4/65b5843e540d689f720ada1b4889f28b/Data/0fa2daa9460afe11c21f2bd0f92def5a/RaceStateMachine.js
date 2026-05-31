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
exports.RaceStateMachine = void 0;
var __selfType = requireType("./RaceStateMachine");
function component(target) { target.getTypeName = function () { return __selfType; }; }
// ============================================================================
// RaceStateMachine.ts — HYROX MIRAGE Core Game Loop
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Handles real HYROX format: 8 × 1km runs + 8 workout stations
// Station modes: TIMED, DISTANCE, REPS, RUN
// ============================================================================
const CourseManager_1 = require("./CourseManager");
var RaceState;
(function (RaceState) {
    RaceState["IDLE"] = "IDLE";
    RaceState["COUNTDOWN"] = "COUNTDOWN";
    RaceState["RUNNING"] = "RUNNING";
    RaceState["STATION"] = "STATION";
    RaceState["PAUSED"] = "PAUSED";
    RaceState["FINISHED"] = "FINISHED";
})(RaceState || (RaceState = {}));
let RaceStateMachine = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var RaceStateMachine = _classThis = class extends _classSuper {
        constructor() {
            super();
            this.courseManagerScript = this.courseManagerScript;
            this.proximityDetectorScript = this.proximityDetectorScript;
            this.courseSetupScript = this.courseSetupScript; // For player position tracking (indoor fallback)
            this.locationTracker = this.locationTracker; // GPS tracking (outdoor)
            this.handZoneDetector = this.handZoneDetector; // Hand zone detection for ZONE_HIT stations
            this.statusText = this.statusText;
            this.timerText = this.timerText;
            this.stationInfoText = this.stationInfoText;
            this.instructionText = this.instructionText; // "Tap START" text - cleared on race start
            this.finishTunnelVfx = this.finishTunnelVfx;
            this.countdownSeconds = this.countdownSeconds;
            /** Pinch counts as X reps (for rep-based stations) */
            this.repsPerPinch = this.repsPerPinch;
            /** Use GPS for distance tracking (outdoor mode) */
            this.useGPSTracking = this.useGPSTracking;
            // ── State ──────────────────────────────────────────────────────────────────
            this._state = RaceState.IDLE;
            this._raceStartTime = 0;
            this._stationArrivalTime = 0;
            this._currentStationIndex = -1;
            this._countdownRemaining = 0;
            this._isInsideStation = false;
            this._pausedFromState = RaceState.RUNNING;
            // Split tracking
            this._splitNames = [];
            this._splitDurations = [];
            // Current station progress
            this._currentConfig = null;
            this._stationProgress = 0; // reps done, distance moved, or time elapsed
            this._stationRequirement = 0; // target reps, distance, or time
            // Run tracking
            this._runTarget = 0; // meters to run before next station
            this._runDistance = 0; // meters run so far
            this._lastPlayerPos = null;
        }
        __initialize() {
            super.__initialize();
            this.courseManagerScript = this.courseManagerScript;
            this.proximityDetectorScript = this.proximityDetectorScript;
            this.courseSetupScript = this.courseSetupScript; // For player position tracking (indoor fallback)
            this.locationTracker = this.locationTracker; // GPS tracking (outdoor)
            this.handZoneDetector = this.handZoneDetector; // Hand zone detection for ZONE_HIT stations
            this.statusText = this.statusText;
            this.timerText = this.timerText;
            this.stationInfoText = this.stationInfoText;
            this.instructionText = this.instructionText; // "Tap START" text - cleared on race start
            this.finishTunnelVfx = this.finishTunnelVfx;
            this.countdownSeconds = this.countdownSeconds;
            /** Pinch counts as X reps (for rep-based stations) */
            this.repsPerPinch = this.repsPerPinch;
            /** Use GPS for distance tracking (outdoor mode) */
            this.useGPSTracking = this.useGPSTracking;
            // ── State ──────────────────────────────────────────────────────────────────
            this._state = RaceState.IDLE;
            this._raceStartTime = 0;
            this._stationArrivalTime = 0;
            this._currentStationIndex = -1;
            this._countdownRemaining = 0;
            this._isInsideStation = false;
            this._pausedFromState = RaceState.RUNNING;
            // Split tracking
            this._splitNames = [];
            this._splitDurations = [];
            // Current station progress
            this._currentConfig = null;
            this._stationProgress = 0; // reps done, distance moved, or time elapsed
            this._stationRequirement = 0; // target reps, distance, or time
            // Run tracking
            this._runTarget = 0; // meters to run before next station
            this._runDistance = 0; // meters run so far
            this._lastPlayerPos = null;
        }
        cm() { return this.courseManagerScript; }
        pd() { return this.proximityDetectorScript; }
        setup() { return this.courseSetupScript; }
        // ── Public Getters ─────────────────────────────────────────────────────────
        get state() { return this._state; }
        get currentStationIndex() { return this._currentStationIndex; }
        get elapsedMs() {
            if (this._raceStartTime === 0)
                return 0;
            return (getTime() * 1000) - this._raceStartTime;
        }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        onAwake() {
            this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));
            // Bind proximity detector callbacks
            var detector = this.pd();
            if (detector) {
                detector.onStationEnter = (index, name, dist) => {
                    this.handleStationEnter(index, name);
                };
                detector.onStationExit = (index, name, dist) => {
                    this.handleStationExit(index, name);
                };
            }
            // Bind pinch for rep counting
            this.bindPinchForReps();
            this.setUIIdle();
            print('[RaceStateMachine] Init — IDLE');
        }
        bindPinchForReps() {
            try {
                var SIK = require('SpectaclesInteractionKit.lspkg/SIK').SIK;
                var handInputData = SIK.HandInputData;
                var rightHand = handInputData.getHand('right');
                rightHand.onPinchDown.add(() => this.handleRepPinch());
                var leftHand = handInputData.getHand('left');
                leftHand.onPinchDown.add(() => this.handleRepPinch());
                print('[RaceStateMachine] Pinch bound for rep counting');
            }
            catch (e) {
                print('[RaceStateMachine] Could not bind pinch: ' + e);
            }
        }
        // ── Public API ─────────────────────────────────────────────────────────────
        startRace() {
            if (this._state !== RaceState.IDLE && this._state !== RaceState.FINISHED) {
                print('[RaceStateMachine] Cannot start from ' + this._state);
                return;
            }
            var course = this.cm();
            if (!course || course.stationCount === 0) {
                print('[RaceStateMachine] ERROR: No stations!');
                return;
            }
            // Reset state
            this._splitNames = [];
            this._splitDurations = [];
            this._currentStationIndex = 0;
            this._stationProgress = 0;
            this._stationRequirement = 0;
            this._currentConfig = null;
            this._runTarget = 0;
            this._runDistance = 0;
            this._lastPlayerPos = null;
            this._isInsideStation = false;
            this._countdownRemaining = this.countdownSeconds;
            // Setup detector
            var detector = this.pd();
            if (detector) {
                detector.refreshStations();
                detector.setActiveStation(0);
            }
            // Clear instruction text
            if (this.instructionText) {
                this.instructionText.text = '';
            }
            this._state = RaceState.COUNTDOWN;
            print('[RaceStateMachine] Countdown started');
        }
        togglePause() {
            if (this._state === RaceState.RUNNING || this._state === RaceState.STATION) {
                this._pausedFromState = this._state;
                this._state = RaceState.PAUSED;
                if (this.statusText)
                    this.statusText.text = 'PAUSED\nPinch to Resume';
            }
            else if (this._state === RaceState.PAUSED) {
                this._state = this._pausedFromState;
            }
        }
        resetRace() {
            // Stop GPS tracking if running
            if (this.locationTracker) {
                this.locationTracker.stopTracking();
            }
            // Stop hand zone detection if running
            if (this.handZoneDetector) {
                this.handZoneDetector.stopDetection();
            }
            // Hide direction arrow
            this.hideDirectionArrow();
            this._state = RaceState.IDLE;
            this._raceStartTime = 0;
            this._currentStationIndex = -1;
            this._splitNames = [];
            this._splitDurations = [];
            this._stationProgress = 0;
            this._currentConfig = null;
            this._runTarget = 0;
            this._runDistance = 0;
            this._lastPlayerPos = null;
            this._isInsideStation = false;
            if (this.finishTunnelVfx)
                this.finishTunnelVfx.enabled = false;
            this.setUIIdle();
            print('[RaceStateMachine] Reset');
        }
        // ── Update Loop ────────────────────────────────────────────────────────────
        onUpdate() {
            var dt = getDeltaTime();
            if (this._state === RaceState.COUNTDOWN) {
                this.updateCountdown(dt);
                return;
            }
            if (this._state === RaceState.RUNNING) {
                this.updateTimerUI();
                this.trackRunDistance();
                this.updateRunningUI();
                this.updateDirectionArrow();
                return;
            }
            if (this._state === RaceState.STATION) {
                this.updateTimerUI();
                if (this._isInsideStation && this._currentConfig) {
                    this.updateStationProgress(dt);
                }
                return;
            }
        }
        updateCountdown(dt) {
            this._countdownRemaining -= dt;
            // Clear other texts during countdown
            if (this.stationInfoText)
                this.stationInfoText.text = '';
            if (this.instructionText)
                this.instructionText.text = '';
            if (this.statusText) {
                var num = Math.ceil(this._countdownRemaining);
                this.statusText.text = num > 0 ? num.toString() : 'GO!';
            }
            if (this._countdownRemaining <= 0) {
                this._raceStartTime = getTime() * 1000;
                this.prepareForStation(0);
                print('[RaceStateMachine] GO!');
            }
        }
        // ── Direction Arrow ────────────────────────────────────────────────────────
        updateDirectionArrow() {
            var course = this.cm();
            if (!course)
                return;
            // Get player position from camera
            var courseSetup = this.setup();
            if (!courseSetup)
                return;
            var playerPos = courseSetup.getPlayerGroundPosition();
            if (!playerPos)
                return;
            // Update arrow to point at current target station
            course.updateDirectionArrow(playerPos, this._currentStationIndex);
        }
        hideDirectionArrow() {
            var course = this.cm();
            if (course) {
                course.hideDirectionArrow();
            }
        }
        // ── Run Tracking ───────────────────────────────────────────────────────────
        trackRunDistance() {
            // Use GPS if available and enabled
            if (this.useGPSTracking && this.locationTracker && this.locationTracker.isLocationReady()) {
                this._runDistance = this.locationTracker.getDistance();
                return;
            }
            // Fallback to camera position tracking (indoor)
            var courseSetup = this.setup();
            if (!courseSetup)
                return;
            var playerPos = courseSetup.getPlayerGroundPosition();
            if (!playerPos)
                return;
            if (this._lastPlayerPos !== null) {
                // Calculate horizontal distance moved (ignore Y)
                var dx = playerPos.x - this._lastPlayerPos.x;
                var dz = playerPos.z - this._lastPlayerPos.z;
                var dist = Math.sqrt(dx * dx + dz * dz);
                // Lens Studio uses cm, convert to meters
                this._runDistance += dist / 100;
            }
            this._lastPlayerPos = new vec3(playerPos.x, playerPos.y, playerPos.z);
        }
        // ── Station Handling ───────────────────────────────────────────────────────
        prepareForStation(index) {
            var course = this.cm();
            if (!course)
                return;
            this._currentStationIndex = index;
            this._currentConfig = course.getStationConfig(index);
            if (!this._currentConfig) {
                print('[RaceStateMachine] ERROR: No config for station ' + index);
                return;
            }
            // Progressive reveal: show the next station when preparing for it
            if (course.progressiveReveal) {
                course.revealStation(index);
            }
            // Check if there's a run before this station
            if (this._currentConfig.runDistanceBefore > 0) {
                this._runTarget = this._currentConfig.runDistanceBefore;
                this._runDistance = 0;
                this._lastPlayerPos = null;
                // Start GPS tracking for run segment
                if (this.useGPSTracking && this.locationTracker) {
                    this.locationTracker.startTracking((totalDist, deltaDist) => {
                        this._runDistance = totalDist;
                    });
                    print('[RaceStateMachine] GPS tracking started for run');
                }
                this._state = RaceState.RUNNING;
                print('[RaceStateMachine] Run ' + this._runTarget + 'm to ' + this._currentConfig.name);
            }
            else {
                // No run, go directly to station (START marker)
                this._state = RaceState.RUNNING;
            }
            // Highlight station
            course.highlightStation(index);
            var detector = this.pd();
            if (detector)
                detector.setActiveStation(index);
            this.updateRunningUI();
        }
        handleStationEnter(index, name) {
            if (this._state !== RaceState.RUNNING)
                return;
            if (index !== this._currentStationIndex)
                return;
            var course = this.cm();
            this._currentConfig = course ? course.getStationConfig(index) : null;
            if (!this._currentConfig) {
                print('[RaceStateMachine] ERROR: No config for station ' + index);
                return;
            }
            // Stop GPS tracking and record run split if there was a run
            if (this._runTarget > 0) {
                // Stop GPS tracking
                var actualDistance = this._runDistance;
                if (this.useGPSTracking && this.locationTracker) {
                    actualDistance = this.locationTracker.stopTracking();
                }
                var runName = 'Run to ' + this._currentConfig.name;
                var runDuration = (getTime() * 1000) - this._raceStartTime;
                if (this._splitDurations.length > 0) {
                    var prevTotal = 0;
                    for (var i = 0; i < this._splitDurations.length; i++) {
                        prevTotal += this._splitDurations[i];
                    }
                    runDuration = runDuration - prevTotal;
                }
                this._splitNames.push(runName);
                this._splitDurations.push(runDuration);
                // Log with actual distance covered
                print('[RaceStateMachine] ' + runName + ': ' + (runDuration / 1000).toFixed(1) + 's');
                print('[RaceStateMachine] Actual distance: ' + actualDistance.toFixed(1) + 'm (target: ' + this._runTarget + 'm)');
            }
            // Enter station
            this._isInsideStation = true;
            this._stationArrivalTime = getTime() * 1000;
            this._stationProgress = 0;
            this._stationRequirement = this._currentConfig.requirement;
            this._lastPlayerPos = null;
            // Hide direction arrow when arriving at station
            this.hideDirectionArrow();
            // Start GPS tracking for distance-based stations
            if (this._currentConfig.mode === CourseManager_1.StationMode.DISTANCE) {
                if (this.useGPSTracking && this.locationTracker) {
                    this.locationTracker.startTracking((totalDist, deltaDist) => {
                        this._stationProgress = totalDist;
                    });
                    print('[RaceStateMachine] GPS tracking started for distance station');
                }
            }
            // Start hand zone detection for ZONE_HIT stations
            if (this._currentConfig.mode === CourseManager_1.StationMode.ZONE_HIT) {
                if (this.handZoneDetector && this._currentConfig.motionType) {
                    // Get station world position for station-relative targeting
                    var stationPos = null;
                    if (course && index < course.stationPositions.length) {
                        stationPos = course.stationPositions[index];
                    }
                    this.handZoneDetector.startDetection(this._currentConfig.motionType, // MotionType enum
                    (repCount) => {
                        this._stationProgress = repCount;
                        this.updateStationUI();
                        // Check if complete
                        if (this._stationProgress >= this._stationRequirement) {
                            this.completeCurrentStation();
                        }
                    }, null, // onStateChange (optional)
                    stationPos // Station world position for anchored targeting
                    );
                    print('[RaceStateMachine] Hand zone detection started: ' + this._currentConfig.motionType +
                        (stationPos ? ' (station-anchored)' : ' (camera-follow)'));
                }
            }
            // Show finish VFX if this is the last station
            if (course && index === course.stationCount - 1 && this.finishTunnelVfx) {
                this.finishTunnelVfx.enabled = true;
            }
            this._state = RaceState.STATION;
            if (this.statusText) {
                this.statusText.text = this._currentConfig.name;
            }
            print('[RaceStateMachine] Entered station ' + index + ': ' + name);
            print('[RaceStateMachine] Mode: ' + this._currentConfig.mode + ', Req: ' + this._stationRequirement);
            this.updateStationUI();
        }
        handleStationExit(index, name) {
            if (this._state !== RaceState.STATION)
                return;
            if (index !== this._currentStationIndex)
                return;
            // For DISTANCE mode, keep tracking even if player exits briefly
            if (this._currentConfig && this._currentConfig.mode === CourseManager_1.StationMode.DISTANCE) {
                print('[RaceStateMachine] Distance station — tracking continues');
                return;
            }
            this._isInsideStation = false;
            this._stationProgress = 0;
            this._state = RaceState.RUNNING;
            this.updateRunningUI();
            print('[RaceStateMachine] Exited ' + index + ' early');
        }
        // ── Station Progress ───────────────────────────────────────────────────────
        updateStationProgress(dt) {
            if (!this._currentConfig)
                return;
            var mode = this._currentConfig.mode;
            switch (mode) {
                case CourseManager_1.StationMode.TIMED:
                    // Count up time
                    this._stationProgress += dt;
                    if (this._stationProgress >= this._stationRequirement) {
                        this.completeCurrentStation();
                    }
                    break;
                case CourseManager_1.StationMode.DISTANCE:
                    // Track movement distance
                    this.trackStationDistance();
                    if (this._stationProgress >= this._stationRequirement) {
                        this.completeCurrentStation();
                    }
                    break;
                case CourseManager_1.StationMode.REPS:
                    // Reps are counted via pinch (handleRepPinch)
                    // Just update UI here
                    break;
                case CourseManager_1.StationMode.RUN:
                    // Run mode is handled during RUNNING state, not STATION
                    break;
            }
            this.updateStationUI();
        }
        trackStationDistance() {
            // Use GPS if available and enabled
            if (this.useGPSTracking && this.locationTracker && this.locationTracker.isLocationReady()) {
                this._stationProgress = this.locationTracker.getDistance();
                return;
            }
            // Fallback to camera position tracking (indoor)
            var courseSetup = this.setup();
            if (!courseSetup)
                return;
            var playerPos = courseSetup.getPlayerGroundPosition();
            if (!playerPos)
                return;
            if (this._lastPlayerPos !== null) {
                var dx = playerPos.x - this._lastPlayerPos.x;
                var dz = playerPos.z - this._lastPlayerPos.z;
                var dist = Math.sqrt(dx * dx + dz * dz);
                // Convert cm to meters
                this._stationProgress += dist / 100;
            }
            this._lastPlayerPos = new vec3(playerPos.x, playerPos.y, playerPos.z);
        }
        handleRepPinch() {
            // Only count reps when at a REPS station
            if (this._state !== RaceState.STATION)
                return;
            if (!this._currentConfig || this._currentConfig.mode !== CourseManager_1.StationMode.REPS)
                return;
            this._stationProgress += this.repsPerPinch;
            print('[RaceStateMachine] Reps: ' + this._stationProgress + '/' + this._stationRequirement);
            if (this._stationProgress >= this._stationRequirement) {
                this.completeCurrentStation();
            }
            else {
                this.updateStationUI();
            }
        }
        // ── Station Completion ─────────────────────────────────────────────────────
        completeCurrentStation() {
            var now = getTime() * 1000;
            var course = this.cm();
            var name = this._currentConfig ? this._currentConfig.name : 'Station';
            var mode = this._currentConfig ? this._currentConfig.mode : null;
            var duration = now - this._stationArrivalTime;
            // Stop GPS tracking for distance stations and get actual distance
            var actualDistance = this._stationProgress;
            if (mode === CourseManager_1.StationMode.DISTANCE) {
                if (this.useGPSTracking && this.locationTracker) {
                    actualDistance = this.locationTracker.stopTracking();
                }
                print('[RaceStateMachine] ' + name + ' — Distance: ' + actualDistance.toFixed(1) + 'm');
            }
            // Stop hand zone detection for ZONE_HIT stations
            var actualReps = this._stationProgress;
            if (mode === CourseManager_1.StationMode.ZONE_HIT) {
                if (this.handZoneDetector) {
                    actualReps = this.handZoneDetector.stopDetection();
                }
                print('[RaceStateMachine] ' + name + ' — Zone Hits: ' + actualReps);
            }
            this._splitNames.push(name);
            this._splitDurations.push(duration);
            print('[RaceStateMachine] ' + name + ' COMPLETE — ' + (duration / 1000).toFixed(1) + 's');
            this._currentStationIndex++;
            this._isInsideStation = false;
            this._stationProgress = 0;
            this._currentConfig = null;
            this._lastPlayerPos = null;
            if (course && this._currentStationIndex >= course.stationCount) {
                this.finishRace();
            }
            else {
                this.prepareForStation(this._currentStationIndex);
            }
        }
        finishRace() {
            var totalMs = (getTime() * 1000) - this._raceStartTime;
            this._state = RaceState.FINISHED;
            // Hide direction arrow
            this.hideDirectionArrow();
            if (this.statusText)
                this.statusText.text = 'FINISHED!';
            if (this.timerText)
                this.timerText.text = this.formatTime(totalMs);
            // Show split summary
            if (this.stationInfoText) {
                var lines = '';
                var fastIdx = 0;
                var slowIdx = 0;
                var best = Infinity;
                var worst = 0;
                for (var i = 0; i < this._splitDurations.length; i++) {
                    if (this._splitDurations[i] < best) {
                        best = this._splitDurations[i];
                        fastIdx = i;
                    }
                    if (this._splitDurations[i] > worst) {
                        worst = this._splitDurations[i];
                        slowIdx = i;
                    }
                }
                for (var j = 0; j < this._splitNames.length; j++) {
                    var dur = (this._splitDurations[j] / 1000).toFixed(1);
                    var tag = j === fastIdx ? ' *FAST*' : j === slowIdx ? ' *SLOW*' : '';
                    lines += this._splitNames[j] + ': ' + dur + 's' + tag + '\n';
                }
                this.stationInfoText.text = lines;
            }
            print('[RaceStateMachine] FINISHED ' + (totalMs / 1000).toFixed(1) + 's');
        }
        // ── UI Updates ─────────────────────────────────────────────────────────────
        setUIIdle() {
            if (this.statusText)
                this.statusText.text = 'HYROX MIRAGE';
            if (this.stationInfoText)
                this.stationInfoText.text = '';
            if (this.timerText)
                this.timerText.text = '00:00';
            if (this.instructionText)
                this.instructionText.text = 'Pinch to Start Race';
        }
        updateRunningUI() {
            if (this.statusText) {
                this.statusText.text = 'RUN';
            }
            if (this.stationInfoText && this._currentConfig) {
                var nextName = this._currentConfig.name;
                var runInfo = '';
                if (this._runTarget > 0) {
                    var covered = this._runDistance;
                    var trackingMode = (this.useGPSTracking && this.locationTracker && this.locationTracker.isLocationReady())
                        ? 'GPS' : 'CAM';
                    runInfo = covered.toFixed(0) + 'm / ' + this._runTarget.toFixed(0) + 'm [' + trackingMode + ']';
                }
                // Add physical distance to station marker
                var course = this.cm();
                var courseSetup = this.setup();
                if (course && courseSetup) {
                    var playerPos = courseSetup.getPlayerGroundPosition();
                    if (playerPos) {
                        var distToStation = course.getDistanceToStation(playerPos, this._currentStationIndex);
                        // Convert cm to m
                        var distM = distToStation / 100;
                        runInfo += '\n→ ' + distM.toFixed(0) + 'm to marker';
                    }
                }
                this.stationInfoText.text = 'Next: ' + nextName + '\n' + runInfo;
            }
        }
        updateStationUI() {
            if (!this.stationInfoText || !this._currentConfig)
                return;
            var mode = this._currentConfig.mode;
            var instruction = this._currentConfig.instruction;
            var progress = this._stationProgress;
            var target = this._stationRequirement;
            var progressText = '';
            switch (mode) {
                case CourseManager_1.StationMode.TIMED:
                    var remaining = Math.max(0, target - progress);
                    progressText = instruction + '\n' + remaining.toFixed(0) + 's remaining';
                    break;
                case CourseManager_1.StationMode.DISTANCE:
                    var distTrackMode = (this.useGPSTracking && this.locationTracker && this.locationTracker.isLocationReady())
                        ? 'GPS' : 'CAM';
                    progressText = instruction + '\n' + progress.toFixed(1) + 'm / ' + target + 'm [' + distTrackMode + ']';
                    break;
                case CourseManager_1.StationMode.REPS:
                    progressText = instruction + '\n' + Math.floor(progress) + ' / ' + target + ' reps\n(Pinch to count)';
                    break;
                case CourseManager_1.StationMode.ZONE_HIT:
                    progressText = instruction + '\n' + Math.floor(progress) + ' / ' + target + ' hits';
                    break;
                default:
                    progressText = instruction;
            }
            // Progress bar
            var pct = Math.min(1, progress / Math.max(1, target));
            var barLen = 10;
            var filled = Math.round(pct * barLen);
            var bar = '[';
            for (var i = 0; i < barLen; i++) {
                bar += i < filled ? '#' : '-';
            }
            bar += '] ' + Math.floor(pct * 100) + '%';
            this.stationInfoText.text = progressText + '\n' + bar;
        }
        updateTimerUI() {
            if (!this.timerText)
                return;
            this.timerText.text = this.formatTime(this.elapsedMs);
        }
        // ── Helpers ────────────────────────────────────────────────────────────────
        formatTime(ms) {
            var totalSec = Math.floor(ms / 1000);
            var min = Math.floor(totalSec / 60);
            var sec = totalSec % 60;
            var centis = Math.floor((ms % 1000) / 10);
            return this.pad2(min) + ':' + this.pad2(sec) + '.' + this.pad2(centis);
        }
        pad2(n) {
            return n < 10 ? '0' + n : '' + n;
        }
    };
    __setFunctionName(_classThis, "RaceStateMachine");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        RaceStateMachine = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return RaceStateMachine = _classThis;
})();
exports.RaceStateMachine = RaceStateMachine;
//# sourceMappingURL=RaceStateMachine.js.map