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
// RaceStateMachine.ts — FauxRox Core Game Loop
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// DYNAMIC follow-the-runner system:
// - Stations spawn in front of player when run distance completes
// - No fixed course layout - works anywhere
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
            // ── References ────────────────────────────────────────────────────────────
            this.courseManagerScript = this.courseManagerScript;
            this.courseSetupScript = this.courseSetupScript;
            this.locationTracker = this.locationTracker;
            this.handZoneDetector = this.handZoneDetector;
            this.camera = this.camera; // For player position and forward direction
            // ── UI Elements ───────────────────────────────────────────────────────────
            this.statusText = this.statusText;
            this.timerText = this.timerText;
            this.timerBG = this.timerBG; // Parent of timerText - enable/disable this
            this.stationInfoText = this.stationInfoText;
            this.countdownText = this.countdownText; // Separate text for 3-2-1 countdown
            this.instructionText = this.instructionText;
            this.finishTunnelVfx = this.finishTunnelVfx;
            /** Title image (FauxRox logo) - fades out after display */
            this.titleImage = this.titleImage;
            /** Start button - enabled after title fades, disabled after race starts */
            this.startButtonObject = this.startButtonObject;
            /** GPS status text - separate from stationInfoText, shown before race starts */
            this.gpsStatusText = this.gpsStatusText;
            /** Visual progress bar (from Orthographic Camera package) */
            this.progressBar = this.progressBar;
            // ── Settings ──────────────────────────────────────────────────────────────
            this.countdownSeconds = this.countdownSeconds;
            this.useGPSTracking = this.useGPSTracking;
            this.camTransform = null;
            // ── State ──────────────────────────────────────────────────────────────────
            this._state = RaceState.IDLE;
            this._raceStartTime = 0;
            this._stationStartTime = 0;
            this._currentStationIndex = -1;
            this._countdownRemaining = 0;
            this._pausedFromState = RaceState.RUNNING;
            this._gpsStatusText = '';
            // Split tracking
            this._splitNames = [];
            this._splitDurations = [];
            // Current station progress
            this._currentConfig = null;
            this._stationProgress = 0;
            this._stationRequirement = 0;
            // Run tracking
            this._runTarget = 0;
            this._runDistance = 0;
            this._lastPlayerPos = null;
            // Title fade out
            this._titleFading = false;
            this._titleAlpha = 1.0;
            this.TITLE_DISPLAY_TIME = 2.0;
            this.TITLE_FADE_DURATION = 0.5;
            // StatusText zoom animation
            this._statusAnimating = false;
            this._statusAnimTime = 0;
            this._statusAnimPhase = 'in';
            this._statusOriginalScale = null;
            this.STATUS_ZOOM_DURATION = 0.15; // Each phase duration
            this.STATUS_ZOOM_SCALE = 1.3; // Max scale during zoom
        }
        __initialize() {
            super.__initialize();
            // ── References ────────────────────────────────────────────────────────────
            this.courseManagerScript = this.courseManagerScript;
            this.courseSetupScript = this.courseSetupScript;
            this.locationTracker = this.locationTracker;
            this.handZoneDetector = this.handZoneDetector;
            this.camera = this.camera; // For player position and forward direction
            // ── UI Elements ───────────────────────────────────────────────────────────
            this.statusText = this.statusText;
            this.timerText = this.timerText;
            this.timerBG = this.timerBG; // Parent of timerText - enable/disable this
            this.stationInfoText = this.stationInfoText;
            this.countdownText = this.countdownText; // Separate text for 3-2-1 countdown
            this.instructionText = this.instructionText;
            this.finishTunnelVfx = this.finishTunnelVfx;
            /** Title image (FauxRox logo) - fades out after display */
            this.titleImage = this.titleImage;
            /** Start button - enabled after title fades, disabled after race starts */
            this.startButtonObject = this.startButtonObject;
            /** GPS status text - separate from stationInfoText, shown before race starts */
            this.gpsStatusText = this.gpsStatusText;
            /** Visual progress bar (from Orthographic Camera package) */
            this.progressBar = this.progressBar;
            // ── Settings ──────────────────────────────────────────────────────────────
            this.countdownSeconds = this.countdownSeconds;
            this.useGPSTracking = this.useGPSTracking;
            this.camTransform = null;
            // ── State ──────────────────────────────────────────────────────────────────
            this._state = RaceState.IDLE;
            this._raceStartTime = 0;
            this._stationStartTime = 0;
            this._currentStationIndex = -1;
            this._countdownRemaining = 0;
            this._pausedFromState = RaceState.RUNNING;
            this._gpsStatusText = '';
            // Split tracking
            this._splitNames = [];
            this._splitDurations = [];
            // Current station progress
            this._currentConfig = null;
            this._stationProgress = 0;
            this._stationRequirement = 0;
            // Run tracking
            this._runTarget = 0;
            this._runDistance = 0;
            this._lastPlayerPos = null;
            // Title fade out
            this._titleFading = false;
            this._titleAlpha = 1.0;
            this.TITLE_DISPLAY_TIME = 2.0;
            this.TITLE_FADE_DURATION = 0.5;
            // StatusText zoom animation
            this._statusAnimating = false;
            this._statusAnimTime = 0;
            this._statusAnimPhase = 'in';
            this._statusOriginalScale = null;
            this.STATUS_ZOOM_DURATION = 0.15; // Each phase duration
            this.STATUS_ZOOM_SCALE = 1.3; // Max scale during zoom
        }
        // ── Accessors ─────────────────────────────────────────────────────────────
        cm() { return this.courseManagerScript; }
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
            if (this.camera) {
                this.camTransform = this.camera.getTransform();
            }
            this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));
            // Monitor GPS status (delayed to ensure LocationTracker is initialized)
            this.createEvent('OnStartEvent').bind(() => {
                this.initGpsStatusMonitor();
            });
            this.setUIIdle();
            this.showTitle();
            print('[RaceStateMachine] Init — IDLE (Dynamic Mode — FauxRox)');
        }
        // ── Title Display & Fade Out ────────────────────────────────────────────────
        showTitle() {
            // Hide calibration and GPS texts until title fades out
            if (this.instructionText) {
                this.instructionText.getSceneObject().enabled = false;
            }
            if (this.stationInfoText) {
                this.stationInfoText.getSceneObject().enabled = false;
            }
            // Hide start button until title fades out
            if (this.startButtonObject) {
                this.startButtonObject.enabled = false;
            }
            // Hide GPS status text until title fades out
            if (this.gpsStatusText) {
                this.gpsStatusText.getSceneObject().enabled = false;
            }
            if (!this.titleImage) {
                // No title image - enable texts immediately
                this.onTitleFadeComplete();
                return;
            }
            // Show title at full opacity
            this.titleImage.enabled = true;
            this._titleAlpha = 1.0;
            this.setTitleAlpha(1.0);
            // Start fade out after delay
            var fadeDelay = this.createEvent('DelayedCallbackEvent');
            fadeDelay.bind(() => {
                this._titleFading = true;
            });
            fadeDelay.reset(this.TITLE_DISPLAY_TIME);
        }
        updateTitleFade(dt) {
            if (!this._titleFading || !this.titleImage)
                return;
            this._titleAlpha -= dt / this.TITLE_FADE_DURATION;
            if (this._titleAlpha <= 0) {
                this._titleAlpha = 0;
                this._titleFading = false;
                this.titleImage.enabled = false;
                this.onTitleFadeComplete();
            }
            this.setTitleAlpha(this._titleAlpha);
        }
        onTitleFadeComplete() {
            // Enable calibration instruction text
            if (this.instructionText) {
                this.instructionText.getSceneObject().enabled = true;
            }
            // Enable GPS status text
            if (this.stationInfoText) {
                this.stationInfoText.getSceneObject().enabled = true;
            }
            print('[RaceStateMachine] Title fade complete — UI texts enabled');
        }
        setTitleAlpha(alpha) {
            if (!this.titleImage)
                return;
            var color = this.titleImage.mainPass.baseColor;
            this.titleImage.mainPass.baseColor = new vec4(color.r, color.g, color.b, alpha);
        }
        // ── StatusText Zoom Animation ─────────────────────────────────────────────
        triggerStatusZoom() {
            if (!this.statusText)
                return;
            // Store original scale on first animation
            if (this._statusOriginalScale === null) {
                this._statusOriginalScale = this.statusText.getSceneObject().getTransform().getLocalScale();
            }
            this._statusAnimating = true;
            this._statusAnimTime = 0;
            this._statusAnimPhase = 'in';
        }
        updateStatusZoom(dt) {
            if (!this._statusAnimating || !this.statusText)
                return;
            this._statusAnimTime += dt;
            var transform = this.statusText.getSceneObject().getTransform();
            if (this._statusAnimPhase === 'in') {
                // Zoom in phase
                var t = Math.min(1, this._statusAnimTime / this.STATUS_ZOOM_DURATION);
                var scale = 1 + (this.STATUS_ZOOM_SCALE - 1) * t;
                transform.setLocalScale(this._statusOriginalScale.uniformScale(scale));
                if (t >= 1) {
                    this._statusAnimPhase = 'out';
                    this._statusAnimTime = 0;
                }
            }
            else {
                // Zoom out phase
                var t = Math.min(1, this._statusAnimTime / this.STATUS_ZOOM_DURATION);
                var scale = this.STATUS_ZOOM_SCALE - (this.STATUS_ZOOM_SCALE - 1) * t;
                transform.setLocalScale(this._statusOriginalScale.uniformScale(scale));
                if (t >= 1) {
                    // Animation complete - restore exact original scale
                    transform.setLocalScale(this._statusOriginalScale);
                    this._statusAnimating = false;
                }
            }
        }
        initGpsStatusMonitor() {
            if (!this.locationTracker) {
                print('[RaceStateMachine] No LocationTracker linked');
                return;
            }
            if (typeof this.locationTracker.onGpsStatusChange !== 'function') {
                print('[RaceStateMachine] LocationTracker.onGpsStatusChange not available');
                return;
            }
            this.locationTracker.onGpsStatusChange((status, message) => {
                this._gpsStatusText = this.formatGpsStatusBanner(status, message);
                if (this._state === RaceState.IDLE) {
                    this.setUIIdle();
                }
            });
            print('[RaceStateMachine] GPS status monitor initialized');
        }
        formatGpsStatusBanner(status, message) {
            switch (status) {
                case 'CONNECTED':
                    return '[GPS] Connected';
                case 'CHECKING':
                    return '[GPS] Checking...';
                case 'NOT_AVAILABLE':
                    return '[!] GPS Not Available\nUsing step tracking';
                case 'PERMISSION_DENIED':
                    return '[!] GPS Permission Denied\nEnable in Spectacles settings';
                default:
                    return '';
            }
        }
        // ── Public API ─────────────────────────────────────────────────────────────
        startRace() {
            if (this._state !== RaceState.IDLE && this._state !== RaceState.FINISHED) {
                print('[RaceStateMachine] Cannot start from ' + this._state);
                return;
            }
            var course = this.cm();
            if (!course || !course.isReady) {
                print('[RaceStateMachine] ERROR: CourseManager not ready!');
                return;
            }
            // Reset state
            this._splitNames = [];
            this._splitDurations = [];
            this._currentStationIndex = -1;
            this._stationProgress = 0;
            this._stationRequirement = 0;
            this._currentConfig = null;
            this._runTarget = 0;
            this._runDistance = 0;
            this._lastPlayerPos = null;
            this._countdownRemaining = this.countdownSeconds;
            // Clear instruction text
            if (this.instructionText) {
                this.instructionText.text = '';
            }
            // Show countdown text
            if (this.countdownText) {
                this.countdownText.getSceneObject().enabled = true;
            }
            // Show progress bar
            if (this.progressBar) {
                this.progressBar.getSceneObject().enabled = true;
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
            // Stop GPS tracking
            if (this.locationTracker) {
                this.locationTracker.stopTracking();
            }
            // Stop hand zone detection
            if (this.handZoneDetector) {
                this.handZoneDetector.stopDetection();
            }
            // Reset course
            var course = this.cm();
            if (course) {
                course.resetCourse();
            }
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
            if (this.finishTunnelVfx)
                this.finishTunnelVfx.enabled = false;
            // Reset progress bar
            if (this.progressBar) {
                this.progressBar.setProgress(0);
            }
            // Refresh GPS status banner
            if (this.locationTracker && typeof this.locationTracker.getGpsStatus === 'function') {
                this._gpsStatusText = this.formatGpsStatusBanner(this.locationTracker.getGpsStatus(), this.locationTracker.getGpsStatusMessage());
            }
            // Respawn START line
            this.respawnStartLine();
            this.setUIIdle();
            print('[RaceStateMachine] Reset');
        }
        respawnStartLine() {
            var course = this.cm();
            if (!course)
                return;
            var playerPos = this.getPlayerPosition();
            var playerForward = this.getPlayerForward();
            course.spawnStationInFrontOfPlayer(0, playerPos, playerForward);
            print('[RaceStateMachine] START line respawned');
        }
        // ── Update Loop ────────────────────────────────────────────────────────────
        onUpdate() {
            var dt = getDeltaTime();
            // Always update animations
            this.updateTitleFade(dt);
            this.updateStatusZoom(dt);
            if (this._state === RaceState.COUNTDOWN) {
                this.updateCountdown(dt);
                return;
            }
            if (this._state === RaceState.RUNNING) {
                this.updateTimerUI();
                this.trackRunDistance();
                // Check if run distance is complete
                if (this._runTarget > 0 && this._runDistance >= this._runTarget) {
                    this.onRunDistanceComplete();
                    return;
                }
                this.updateRunningUI();
                return;
            }
            if (this._state === RaceState.STATION) {
                this.updateTimerUI();
                if (this._currentConfig) {
                    this.updateStationProgress(dt);
                }
                return;
            }
        }
        // ── Countdown ──────────────────────────────────────────────────────────────
        updateCountdown(dt) {
            this._countdownRemaining -= dt;
            // Show timer BG during countdown
            if (this.timerBG && !this.timerBG.enabled) {
                this.timerBG.enabled = true;
            }
            if (this.timerText) {
                this.timerText.text = '00:00';
            }
            // Show countdown in separate countdownText (or fallback to statusText)
            var countdownTarget = this.countdownText || this.statusText;
            if (countdownTarget) {
                var num = Math.ceil(this._countdownRemaining);
                countdownTarget.text = num > 0 ? num.toString() : 'GO!';
            }
            if (this._countdownRemaining <= 0) {
                this._raceStartTime = getTime() * 1000;
                // Hide countdown text after GO
                if (this.countdownText) {
                    this.countdownText.getSceneObject().enabled = false;
                }
                this.startFirstStation();
                print('[RaceStateMachine] GO!');
            }
        }
        // ── Station Flow ───────────────────────────────────────────────────────────
        /**
         * Start the race - fade out START line and begin first run
         */
        startFirstStation() {
            var course = this.cm();
            if (!course)
                return;
            // START line is just visual, skip to first real station (index 1)
            // Fade out START and begin run to first workout station
            course.fadeOutAndDestroy(() => {
                this._currentStationIndex = 1;
                this._currentConfig = course.getStationConfig(1);
                if (!this._currentConfig) {
                    print('[RaceStateMachine] ERROR: No config for station 1');
                    return;
                }
                // Start running to first workout station
                if (this._currentConfig.runDistanceBefore > 0) {
                    this._runTarget = this._currentConfig.runDistanceBefore;
                    this._runDistance = 0;
                    this._lastPlayerPos = null;
                    if (this.useGPSTracking && this.locationTracker) {
                        this.locationTracker.startTracking((totalDist, _deltaDist) => {
                            this._runDistance = totalDist;
                        });
                    }
                    this._state = RaceState.RUNNING;
                    if (this.statusText) {
                        this.statusText.text = 'RUN';
                        this.triggerStatusZoom();
                    }
                    print('[RaceStateMachine] RUN ' + this._runTarget + 'm to ' + this._currentConfig.name);
                    this.updateRunningUI();
                }
                else {
                    this.spawnAndEnterStation();
                }
            });
        }
        /**
         * Prepare for next station - start running phase
         */
        prepareForNextStation() {
            var course = this.cm();
            if (!course)
                return;
            this._currentStationIndex++;
            if (this._currentStationIndex >= course.stationCount) {
                this.finishRace();
                return;
            }
            this._currentConfig = course.getStationConfig(this._currentStationIndex);
            if (!this._currentConfig) {
                print('[RaceStateMachine] ERROR: No config for station ' + this._currentStationIndex);
                return;
            }
            // Check if there's a run before this station
            if (this._currentConfig.runDistanceBefore > 0) {
                this._runTarget = this._currentConfig.runDistanceBefore;
                this._runDistance = 0;
                this._lastPlayerPos = null;
                // Start GPS tracking for run segment
                if (this.useGPSTracking && this.locationTracker) {
                    this.locationTracker.startTracking((totalDist, _deltaDist) => {
                        this._runDistance = totalDist;
                    });
                    print('[RaceStateMachine] GPS tracking started for run');
                }
                this._state = RaceState.RUNNING;
                if (this.statusText) {
                    this.statusText.text = 'RUN';
                    this.triggerStatusZoom();
                }
                print('[RaceStateMachine] RUN ' + this._runTarget + 'm to ' + this._currentConfig.name);
                this.updateRunningUI();
            }
            else {
                // No run before this station → spawn immediately
                this.spawnAndEnterStation();
            }
        }
        /**
         * Called when run distance target is reached
         */
        onRunDistanceComplete() {
            print('[RaceStateMachine] Run complete! ' + this._runDistance.toFixed(1) + 'm / ' + this._runTarget + 'm');
            // Stop GPS tracking and record run split
            var actualDistance = this._runDistance;
            if (this.useGPSTracking && this.locationTracker) {
                actualDistance = this.locationTracker.stopTracking();
            }
            // Record split
            var runName = 'Run to ' + this._currentConfig.name;
            var runDuration = this.calculateSplitDuration();
            this._splitNames.push(runName);
            this._splitDurations.push(runDuration);
            print('[RaceStateMachine] ' + runName + ': ' + (runDuration / 1000).toFixed(1) + 's (' + actualDistance.toFixed(1) + 'm)');
            // Clear run state
            this._runTarget = 0;
            this._runDistance = 0;
            // Spawn station in front of player and enter
            this.spawnAndEnterStation();
        }
        /**
         * Spawn current station in front of player and enter station mode
         */
        spawnAndEnterStation() {
            var course = this.cm();
            if (!course)
                return;
            var playerPos = this.getPlayerPosition();
            var playerForward = this.getPlayerForward();
            course.spawnStationInFrontOfPlayer(this._currentStationIndex, playerPos, playerForward);
            this.enterStationMode();
        }
        /**
         * Enter station mode - start tracking progress
         */
        enterStationMode() {
            this._stationStartTime = getTime() * 1000;
            this._stationProgress = 0;
            this._stationRequirement = this._currentConfig.requirement;
            this._lastPlayerPos = null;
            // Start GPS tracking for distance-based stations
            if (this._currentConfig.mode === CourseManager_1.StationMode.DISTANCE) {
                if (this.useGPSTracking && this.locationTracker) {
                    this.locationTracker.startTracking((totalDist, _deltaDist) => {
                        this._stationProgress = totalDist;
                    });
                    print('[RaceStateMachine] GPS tracking started for distance station');
                }
            }
            // Start hand zone detection for ZONE_HIT stations
            if (this._currentConfig.mode === CourseManager_1.StationMode.ZONE_HIT) {
                if (this.handZoneDetector && this._currentConfig.motionType) {
                    // Target Press (OVERHEAD_REACH) uses fixed station position for the sphere target
                    // Air SkiErg and Power Row use camera-relative (null)
                    var stationPos = null;
                    if (this._currentConfig.motionType === CourseManager_1.MotionType.OVERHEAD_REACH) {
                        var course = this.cm();
                        var activeStation = course?.getActiveStation();
                        if (activeStation) {
                            stationPos = activeStation.getTransform().getWorldPosition();
                        }
                    }
                    this.handZoneDetector.startDetection(this._currentConfig.motionType, (repCount) => {
                        this._stationProgress = repCount;
                        this.updateStationUI();
                        if (this._stationProgress >= this._stationRequirement) {
                            this.completeCurrentStation();
                        }
                    }, null, stationPos);
                    print('[RaceStateMachine] Hand zone detection started: ' + this._currentConfig.motionType + (stationPos ? ' (station-anchored)' : ' (camera-follow)'));
                }
            }
            // Show finish VFX if this is the last station
            var course = this.cm();
            if (course && this._currentStationIndex === course.stationCount - 1 && this.finishTunnelVfx) {
                this.finishTunnelVfx.enabled = true;
            }
            this._state = RaceState.STATION;
            if (this.statusText) {
                this.statusText.text = this._currentConfig.name;
                this.triggerStatusZoom();
            }
            print('[RaceStateMachine] Entered: ' + this._currentConfig.name);
            print('[RaceStateMachine] Mode: ' + this._currentConfig.mode + ', Req: ' + this._stationRequirement);
            this.updateStationUI();
        }
        // ── Station Progress ───────────────────────────────────────────────────────
        updateStationProgress(dt) {
            if (!this._currentConfig)
                return;
            var mode = this._currentConfig.mode;
            switch (mode) {
                case CourseManager_1.StationMode.TIMED:
                    this._stationProgress += dt;
                    if (this._stationProgress >= this._stationRequirement) {
                        this.completeCurrentStation();
                    }
                    break;
                case CourseManager_1.StationMode.DISTANCE:
                    this.trackStationDistance();
                    if (this._stationProgress >= this._stationRequirement) {
                        this.completeCurrentStation();
                    }
                    break;
                // ZONE_HIT is handled by callback in handZoneDetector
            }
            this.updateStationUI();
        }
        trackStationDistance() {
            // Check if GPS is ACTUALLY providing updates (not just "connected" status)
            if (this.useGPSTracking && this.locationTracker && this.locationTracker.isGpsActivelyUpdating(3.0)) {
                // GPS is giving us real updates - trust the callback
                return;
            }
            // Fallback to camera position tracking (indoor or GPS not responding)
            var playerPos = this.getPlayerPosition();
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
        // ── Run Tracking ───────────────────────────────────────────────────────────
        trackRunDistance() {
            // Check if GPS is ACTUALLY providing updates (not just "connected" status)
            var gpsActive = this.useGPSTracking && this.locationTracker && this.locationTracker.isGpsActivelyUpdating(3.0);
            if (gpsActive) {
                // GPS is giving us real updates - trust the callback
                print('[RaceStateMachine] trackRunDistance: GPS active, skipping camera');
                return;
            }
            // Fallback to camera position tracking (indoor or GPS not responding)
            var playerPos = this.getPlayerPosition();
            if (!playerPos) {
                print('[RaceStateMachine] trackRunDistance: playerPos is null!');
                return;
            }
            if (this._lastPlayerPos !== null) {
                var dx = playerPos.x - this._lastPlayerPos.x;
                var dz = playerPos.z - this._lastPlayerPos.z;
                var dist = Math.sqrt(dx * dx + dz * dz);
                // Convert cm to meters
                var deltaMeter = dist / 100;
                this._runDistance += deltaMeter;
                // Debug log every 0.5m or significant movement
                if (deltaMeter > 0.01) {
                    print('[RaceStateMachine] trackRunDistance: delta=' + deltaMeter.toFixed(3) + 'm, total=' + this._runDistance.toFixed(2) + 'm');
                }
            }
            else {
                print('[RaceStateMachine] trackRunDistance: first position set');
            }
            this._lastPlayerPos = new vec3(playerPos.x, playerPos.y, playerPos.z);
        }
        // ── Station Completion ─────────────────────────────────────────────────────
        completeCurrentStation() {
            var name = this._currentConfig ? this._currentConfig.name : 'Station';
            var mode = this._currentConfig ? this._currentConfig.mode : null;
            var duration = this.calculateSplitDuration();
            // Stop GPS tracking for distance stations
            if (mode === CourseManager_1.StationMode.DISTANCE) {
                if (this.useGPSTracking && this.locationTracker) {
                    this.locationTracker.stopTracking();
                }
                print('[RaceStateMachine] ' + name + ' — Distance: ' + this._stationProgress.toFixed(1) + 'm');
            }
            // Stop hand zone detection for ZONE_HIT stations
            if (mode === CourseManager_1.StationMode.ZONE_HIT) {
                if (this.handZoneDetector) {
                    this.handZoneDetector.stopDetection();
                }
                print('[RaceStateMachine] ' + name + ' — Zone Hits: ' + this._stationProgress);
            }
            // Record split
            this._splitNames.push(name);
            this._splitDurations.push(duration);
            print('[RaceStateMachine] ' + name + ' COMPLETE — ' + (duration / 1000).toFixed(1) + 's');
            // Fade out current station and prepare for next
            var course = this.cm();
            if (course) {
                course.fadeOutAndDestroy(() => {
                    this.prepareForNextStation();
                });
            }
            else {
                this.prepareForNextStation();
            }
        }
        finishRace() {
            var totalMs = (getTime() * 1000) - this._raceStartTime;
            this._state = RaceState.FINISHED;
            if (this.statusText) {
                this.statusText.text = 'FINISHED!';
                this.triggerStatusZoom();
            }
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
            // statusText starts empty, CourseSetup will show calibration status
            if (this.statusText)
                this.statusText.text = '';
            // Show GPS status
            if (this.stationInfoText) {
                this.stationInfoText.getSceneObject().enabled = true;
                this.stationInfoText.text = this._gpsStatusText || '';
            }
            // Hide timer BG (and its child timerText) until race starts
            if (this.timerBG) {
                this.timerBG.enabled = false;
            }
            // Hide countdown text until countdown starts
            if (this.countdownText) {
                this.countdownText.getSceneObject().enabled = false;
            }
            // Hide progress bar until race starts
            if (this.progressBar) {
                this.progressBar.getSceneObject().enabled = false;
            }
            // instructionText is managed by CourseSetup for calibration
            // titleImage is shown separately and fades out after TITLE_DISPLAY_TIME
        }
        updateRunningUI() {
            // statusText is set to 'RUN' with zoom animation when entering RUNNING state
            // Don't update it here every frame to avoid resetting mid-animation
            // Ensure stationInfoText is visible during running
            if (this.stationInfoText && !this.stationInfoText.getSceneObject().enabled) {
                this.stationInfoText.getSceneObject().enabled = true;
            }
            if (this.stationInfoText && this._currentConfig) {
                var nextName = this._currentConfig.name;
                // Show actual tracking mode: GPS only if actively updating, otherwise STEP (camera)
                var trackingMode = (this.useGPSTracking && this.locationTracker && this.locationTracker.isGpsActivelyUpdating(3.0))
                    ? 'GPS' : 'STEP';
                var runInfo = this._runDistance.toFixed(0) + 'm / ' + this._runTarget.toFixed(0) + 'm';
                // Progress bar
                var pct = Math.min(1, this._runDistance / Math.max(1, this._runTarget));
                // Update visual progress bar
                if (this.progressBar) {
                    this.progressBar.setProgress(pct);
                    print('[RaceStateMachine] progressBar.setProgress(' + pct.toFixed(2) + ')');
                }
                else {
                    print('[RaceStateMachine] progressBar is NULL!');
                }
                this.stationInfoText.text = 'Next: ' + nextName + '\n' + runInfo + ' [' + trackingMode + ']';
            }
        }
        updateStationUI() {
            if (!this._currentConfig)
                return;
            // Ensure stationInfoText is visible during station
            if (this.stationInfoText && !this.stationInfoText.getSceneObject().enabled) {
                this.stationInfoText.getSceneObject().enabled = true;
            }
            if (!this.stationInfoText)
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
                    // Show actual tracking mode: GPS only if actively updating, otherwise STEP (camera)
                    var distTrackMode = (this.useGPSTracking && this.locationTracker && this.locationTracker.isGpsActivelyUpdating(3.0))
                        ? 'GPS' : 'STEP';
                    progressText = instruction + '\n' + progress.toFixed(1) + 'm / ' + target + 'm [' + distTrackMode + ']';
                    break;
                case CourseManager_1.StationMode.ZONE_HIT:
                    progressText = instruction + '\n' + Math.floor(progress) + ' / ' + target + ' hits';
                    break;
                default:
                    progressText = instruction;
            }
            // Progress bar
            var pct = Math.min(1, progress / Math.max(1, target));
            // Update visual progress bar
            if (this.progressBar) {
                this.progressBar.setProgress(pct);
            }
            this.stationInfoText.text = progressText;
        }
        updateTimerUI() {
            if (!this.timerText)
                return;
            // Ensure timer BG is visible during race
            if (this.timerBG && !this.timerBG.enabled) {
                this.timerBG.enabled = true;
            }
            this.timerText.text = this.formatTime(this.elapsedMs);
        }
        // ── Player Position/Direction ──────────────────────────────────────────────
        getPlayerPosition() {
            // Try to get ground position from CourseSetup
            var setup = this.setup();
            if (setup && typeof setup.getPlayerGroundPosition === 'function') {
                return setup.getPlayerGroundPosition();
            }
            // Fallback to camera position
            if (this.camTransform) {
                return this.camTransform.getWorldPosition();
            }
            return vec3.zero();
        }
        getPlayerForward() {
            if (!this.camTransform) {
                return new vec3(0, 0, -1); // Default forward
            }
            // Get camera forward, flatten to horizontal
            // In Lens Studio, camera looks down -Z axis, but Transform.forward may return +Z
            // We need the direction the player is LOOKING, which is typically -Z local axis
            var forward = this.camTransform.forward;
            // Use back direction instead (camera looks opposite to Transform.forward)
            var back = this.camTransform.back;
            var flatForward = new vec3(back.x, 0, back.z).normalize();
            print('[RaceStateMachine] getPlayerForward: forward=(' + forward.x.toFixed(2) + ',' + forward.z.toFixed(2) + '), back=(' + back.x.toFixed(2) + ',' + back.z.toFixed(2) + '), using back');
            return flatForward;
        }
        // ── Helpers ────────────────────────────────────────────────────────────────
        calculateSplitDuration() {
            var now = getTime() * 1000;
            var splitStart = this._stationStartTime > 0 ? this._stationStartTime : this._raceStartTime;
            // Account for previous splits
            if (this._splitDurations.length > 0) {
                var prevTotal = 0;
                for (var i = 0; i < this._splitDurations.length; i++) {
                    prevTotal += this._splitDurations[i];
                }
                return (now - this._raceStartTime) - prevTotal;
            }
            return now - splitStart;
        }
        formatTime(ms) {
            var totalSec = Math.floor(ms / 1000);
            var min = Math.floor(totalSec / 60);
            var sec = totalSec % 60;
            return this.pad2(min) + ':' + this.pad2(sec);
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