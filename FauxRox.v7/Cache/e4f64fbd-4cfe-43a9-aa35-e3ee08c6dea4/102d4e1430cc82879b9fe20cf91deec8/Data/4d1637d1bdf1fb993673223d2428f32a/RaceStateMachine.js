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
// RaceStateMachine.ts — FauxRox Core Game Loop (HR Edition)
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// DYNAMIC follow-the-runner system with Heart Rate monitoring:
// - Stations spawn in front of player when run distance completes
// - Real-time heart rate display from BLE HR monitor
// - Camera-based distance tracking (no GPS)
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
            this.heartRateTracker = this.heartRateTracker;
            this.bleConnectionUI = this.bleConnectionUI;
            this.heartRateHUD = this.heartRateHUD; // Entire HR section - disabled if user says NO
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
            /** Heart rate display text */
            this.heartRateText = this.heartRateText;
            /** HR zone indicator text */
            this.hrZoneText = this.hrZoneText;
            /** HR connection status text - shown before race starts */
            this.hrStatusText = this.hrStatusText;
            /** Station name text - displays current station name during workout */
            this.stationNameText = this.stationNameText;
            /** Next station text - displays upcoming station name during running */
            this.nextStationText = this.nextStationText;
            /** Visual progress bar (from Orthographic Camera package) */
            this.progressBar = this.progressBar;
            /** Start button object - hidden after race starts */
            this.startButtonObject = this.startButtonObject;
            // ── Settings ──────────────────────────────────────────────────────────────
            this.countdownSeconds = this.countdownSeconds;
            this.camTransform = null;
            // ── State ──────────────────────────────────────────────────────────────────
            this._state = RaceState.IDLE;
            this._raceStartTime = 0;
            this._stationStartTime = 0;
            this._currentStationIndex = -1;
            this._countdownRemaining = 0;
            this._pausedFromState = RaceState.RUNNING;
            this._hrStatusMessage = '';
            // Pause tracking
            this._totalPausedTime = 0; // Total ms spent paused
            this._pauseStartTime = 0; // When current pause started
            // Split tracking
            this._splitNames = [];
            this._splitDurations = [];
            this._splitAvgHR = []; // Average HR per split
            this._splitPeakHR = []; // Peak HR per split
            // Current station progress
            this._currentConfig = null;
            this._stationProgress = 0;
            this._stationRequirement = 0;
            // Run tracking (camera-based)
            this._runTarget = 0;
            this._runDistance = 0;
            this._lastPlayerPos = null;
            // START line crossing detection
            this._waitingForStartLineCross = false;
            this._startLinePos = null;
            this._startLineForward = null;
            // Title fade out
            this._titleFading = false;
            this._titleAlpha = 1.0;
            this.TITLE_DISPLAY_TIME = 3.0;
            this.TITLE_FADE_DURATION = 0.5;
            // StatusText zoom animation
            this._statusAnimating = false;
            this._statusAnimTime = 0;
            this._statusAnimPhase = 'in';
            this._statusOriginalScale = null;
            this.STATUS_ZOOM_DURATION = 0.15;
            this.STATUS_ZOOM_SCALE = 1.3;
            // Heart rate tracking for current split
            this._splitHRReadings = [];
            this._splitPeakBPM = 0;
        }
        __initialize() {
            super.__initialize();
            // ── References ────────────────────────────────────────────────────────────
            this.courseManagerScript = this.courseManagerScript;
            this.courseSetupScript = this.courseSetupScript;
            this.heartRateTracker = this.heartRateTracker;
            this.bleConnectionUI = this.bleConnectionUI;
            this.heartRateHUD = this.heartRateHUD; // Entire HR section - disabled if user says NO
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
            /** Heart rate display text */
            this.heartRateText = this.heartRateText;
            /** HR zone indicator text */
            this.hrZoneText = this.hrZoneText;
            /** HR connection status text - shown before race starts */
            this.hrStatusText = this.hrStatusText;
            /** Station name text - displays current station name during workout */
            this.stationNameText = this.stationNameText;
            /** Next station text - displays upcoming station name during running */
            this.nextStationText = this.nextStationText;
            /** Visual progress bar (from Orthographic Camera package) */
            this.progressBar = this.progressBar;
            /** Start button object - hidden after race starts */
            this.startButtonObject = this.startButtonObject;
            // ── Settings ──────────────────────────────────────────────────────────────
            this.countdownSeconds = this.countdownSeconds;
            this.camTransform = null;
            // ── State ──────────────────────────────────────────────────────────────────
            this._state = RaceState.IDLE;
            this._raceStartTime = 0;
            this._stationStartTime = 0;
            this._currentStationIndex = -1;
            this._countdownRemaining = 0;
            this._pausedFromState = RaceState.RUNNING;
            this._hrStatusMessage = '';
            // Pause tracking
            this._totalPausedTime = 0; // Total ms spent paused
            this._pauseStartTime = 0; // When current pause started
            // Split tracking
            this._splitNames = [];
            this._splitDurations = [];
            this._splitAvgHR = []; // Average HR per split
            this._splitPeakHR = []; // Peak HR per split
            // Current station progress
            this._currentConfig = null;
            this._stationProgress = 0;
            this._stationRequirement = 0;
            // Run tracking (camera-based)
            this._runTarget = 0;
            this._runDistance = 0;
            this._lastPlayerPos = null;
            // START line crossing detection
            this._waitingForStartLineCross = false;
            this._startLinePos = null;
            this._startLineForward = null;
            // Title fade out
            this._titleFading = false;
            this._titleAlpha = 1.0;
            this.TITLE_DISPLAY_TIME = 3.0;
            this.TITLE_FADE_DURATION = 0.5;
            // StatusText zoom animation
            this._statusAnimating = false;
            this._statusAnimTime = 0;
            this._statusAnimPhase = 'in';
            this._statusOriginalScale = null;
            this.STATUS_ZOOM_DURATION = 0.15;
            this.STATUS_ZOOM_SCALE = 1.3;
            // Heart rate tracking for current split
            this._splitHRReadings = [];
            this._splitPeakBPM = 0;
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
            var now = getTime() * 1000;
            var elapsed = now - this._raceStartTime - this._totalPausedTime;
            if (this._state === RaceState.PAUSED && this._pauseStartTime > 0) {
                elapsed -= (now - this._pauseStartTime);
            }
            return elapsed;
        }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        onAwake() {
            if (this.camera) {
                this.camTransform = this.camera.getTransform();
            }
            this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));
            this.setUIIdle();
            this.showTitle();
            print('[RaceStateMachine] Init — IDLE (HR Edition)');
        }
        // ── Heart Rate Monitor Setup ──────────────────────────────────────────────
        initHeartRateMonitor() {
            // If no HeartRateTracker or BLEConnectionUI, skip to floor calibration
            if (isNull(this.heartRateTracker) || isNull(this.bleConnectionUI)) {
                print('[RaceStateMachine] No HR setup — skipping to floor calibration');
                this.onBLEFlowComplete();
                return;
            }
            // Register BPM update callback
            this.heartRateTracker.onBPMUpdate((bpm, zone) => {
                this.onHeartRateUpdate(bpm, zone);
            });
            // Show BLE connection dialog
            print('[RaceStateMachine] Showing BLE connection dialog');
            this.bleConnectionUI.show((connected) => {
                if (connected) {
                    print('[RaceStateMachine] HR Monitor connected');
                    this._hrStatusMessage = 'HR Connected';
                }
                else {
                    print('[RaceStateMachine] HR Monitor disabled by user');
                    this._hrStatusMessage = 'HR Disabled';
                }
                // BLE flow complete — start floor calibration
                this.onBLEFlowComplete();
            });
        }
        onBLEFlowComplete() {
            print('[RaceStateMachine] BLE flow complete — starting floor calibration');
            // Enable UI elements
            if (this.instructionText) {
                this.instructionText.getSceneObject().enabled = true;
            }
            if (this.stationInfoText) {
                this.stationInfoText.getSceneObject().enabled = true;
            }
            if (this.hrStatusText) {
                this.hrStatusText.getSceneObject().enabled = true;
                this.hrStatusText.text = this._hrStatusMessage;
            }
            // Start floor calibration via CourseSetup
            var setup = this.setup();
            if (setup && typeof setup.startCalibration === 'function') {
                setup.startCalibration();
            }
            else {
                print('[RaceStateMachine] WARNING: CourseSetup not available for calibration');
            }
        }
        onHeartRateUpdate(bpm, _zone) {
            if (this.heartRateText) {
                this.heartRateText.text = bpm.toString();
            }
            // Track for current split
            if (this._state === RaceState.RUNNING || this._state === RaceState.STATION) {
                this._splitHRReadings.push(bpm);
                if (bpm > this._splitPeakBPM) {
                    this._splitPeakBPM = bpm;
                }
            }
        }
        // ── Title Display & Fade Out ────────────────────────────────────────────────
        showTitle() {
            if (this.instructionText) {
                this.instructionText.getSceneObject().enabled = false;
            }
            if (this.stationInfoText) {
                this.stationInfoText.getSceneObject().enabled = false;
            }
            if (this.hrStatusText) {
                this.hrStatusText.getSceneObject().enabled = false;
            }
            // Hide HR display until race starts
            if (this.heartRateText) {
                this.heartRateText.getSceneObject().enabled = false;
            }
            if (this.hrZoneText) {
                this.hrZoneText.getSceneObject().enabled = false;
            }
            if (!this.titleImage) {
                this.onTitleFadeComplete();
                return;
            }
            this.titleImage.enabled = true;
            this._titleAlpha = 1.0;
            this.setTitleAlpha(1.0);
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
            print('[RaceStateMachine] Title fade complete — starting BLE flow');
            // Start BLE connection flow (will trigger floor calibration when complete)
            this.initHeartRateMonitor();
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
                var t = Math.min(1, this._statusAnimTime / this.STATUS_ZOOM_DURATION);
                var scale = 1 + (this.STATUS_ZOOM_SCALE - 1) * t;
                transform.setLocalScale(this._statusOriginalScale.uniformScale(scale));
                if (t >= 1) {
                    this._statusAnimPhase = 'out';
                    this._statusAnimTime = 0;
                }
            }
            else {
                var t = Math.min(1, this._statusAnimTime / this.STATUS_ZOOM_DURATION);
                var scale = this.STATUS_ZOOM_SCALE - (this.STATUS_ZOOM_SCALE - 1) * t;
                transform.setLocalScale(this._statusOriginalScale.uniformScale(scale));
                if (t >= 1) {
                    transform.setLocalScale(this._statusOriginalScale);
                    this._statusAnimating = false;
                }
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
            this._splitAvgHR = [];
            this._splitPeakHR = [];
            this._currentStationIndex = -1;
            this._stationProgress = 0;
            this._stationRequirement = 0;
            this._currentConfig = null;
            this._runTarget = 0;
            this._runDistance = 0;
            this._lastPlayerPos = null;
            this._countdownRemaining = this.countdownSeconds;
            this._totalPausedTime = 0;
            this._pauseStartTime = 0;
            this._waitingForStartLineCross = false;
            this._startLinePos = null;
            this._startLineForward = null;
            this._splitHRReadings = [];
            this._splitPeakBPM = 0;
            // Start HR session
            if (this.heartRateTracker) {
                this.heartRateTracker.startSession();
            }
            // Clear instruction text
            if (this.instructionText) {
                this.instructionText.text = '';
            }
            // Hide start button after race starts
            if (this.startButtonObject) {
                this.startButtonObject.enabled = false;
            }
            // Hide HR status text, show HR display
            if (this.hrStatusText) {
                this.hrStatusText.getSceneObject().enabled = false;
            }
            if (this.heartRateText) {
                this.heartRateText.getSceneObject().enabled = true;
            }
            if (this.hrZoneText) {
                this.hrZoneText.getSceneObject().enabled = true;
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
                // PAUSE
                this._pausedFromState = this._state;
                this._pauseStartTime = getTime() * 1000;
                this._state = RaceState.PAUSED;
                // Pause hand zone detection
                if (this.handZoneDetector) {
                    this.handZoneDetector.stopDetection();
                }
                if (this.statusText) {
                    this.statusText.text = 'PAUSED';
                }
                print('[RaceStateMachine] PAUSED');
            }
            else if (this._state === RaceState.PAUSED) {
                // RESUME
                var pauseDuration = (getTime() * 1000) - this._pauseStartTime;
                this._totalPausedTime += pauseDuration;
                this._pauseStartTime = 0;
                this._state = this._pausedFromState;
                // Reset camera position tracking to avoid distance jump
                this._lastPlayerPos = null;
                // Resume hand zone detection if we were in STATION
                if (this._pausedFromState === RaceState.STATION && this.handZoneDetector) {
                    this.handZoneDetector.resumeDetection((repCount) => {
                        this._stationProgress = repCount;
                        this.updateStationUI();
                    });
                }
                // Restore station name text
                if (this._pausedFromState === RaceState.RUNNING) {
                    if (this.stationNameText) {
                        this.stationNameText.text = 'RUN';
                    }
                    if (this.statusText) {
                        this.statusText.text = '';
                    }
                }
                else if (this._pausedFromState === RaceState.STATION && this._currentConfig) {
                    if (this.stationNameText) {
                        this.stationNameText.text = this._currentConfig.name;
                    }
                    if (this.statusText) {
                        this.statusText.text = '';
                    }
                }
                print('[RaceStateMachine] RESUMED → ' + this._pausedFromState);
            }
        }
        resetRace() {
            // Stop hand zone detection
            if (this.handZoneDetector) {
                this.handZoneDetector.stopDetection();
            }
            // End HR session
            if (this.heartRateTracker) {
                this.heartRateTracker.endSession();
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
            this._splitAvgHR = [];
            this._splitPeakHR = [];
            this._stationProgress = 0;
            this._currentConfig = null;
            this._runTarget = 0;
            this._runDistance = 0;
            this._lastPlayerPos = null;
            this._totalPausedTime = 0;
            this._pauseStartTime = 0;
            this._waitingForStartLineCross = false;
            this._startLinePos = null;
            this._startLineForward = null;
            this._splitHRReadings = [];
            this._splitPeakBPM = 0;
            if (this.finishTunnelVfx)
                this.finishTunnelVfx.enabled = false;
            // Reset progress bar
            if (this.progressBar) {
                this.progressBar.setProgress(0);
            }
            // Respawn START line
            this.respawnStartLine();
            // Re-enable start button
            if (this.startButtonObject) {
                this.startButtonObject.enabled = true;
            }
            // Show start hint
            if (this.instructionText) {
                this.instructionText.text = 'Pinch Start to begin.';
            }
            // Re-enable HR status text, hide HR display
            if (this.hrStatusText) {
                this.hrStatusText.getSceneObject().enabled = true;
            }
            if (this.heartRateText) {
                this.heartRateText.getSceneObject().enabled = false;
            }
            if (this.hrZoneText) {
                this.hrZoneText.getSceneObject().enabled = false;
            }
            this.setUIIdle();
            print('[RaceStateMachine] Reset');
        }
        /** Manually trigger HR scan (can be called from StartTrigger) */
        scanForHRMonitor() {
            if (this.heartRateTracker && !this.heartRateTracker.isConnected) {
                this.heartRateTracker.startScan();
            }
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
                // Check for START line crossing before tracking distance
                if (this._waitingForStartLineCross) {
                    this.checkStartLineCrossing();
                    this.updateRunningUI();
                    return;
                }
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
        startFirstStation() {
            var course = this.cm();
            if (!course)
                return;
            // Get START line position and forward direction for crossing detection
            var startStation = course.getActiveStation();
            if (startStation) {
                this._startLinePos = startStation.getTransform().getWorldPosition();
                var startForward = startStation.getTransform().forward;
                this._startLineForward = new vec3(startForward.x, 0, startForward.z).normalize();
            }
            // Set up first station config
            this._currentStationIndex = 1;
            this._currentConfig = course.getStationConfig(1);
            if (!this._currentConfig) {
                print('[RaceStateMachine] ERROR: No config for station 1');
                return;
            }
            // Set run target but DON'T start tracking yet
            if (this._currentConfig.runDistanceBefore > 0) {
                this._runTarget = this._currentConfig.runDistanceBefore;
                this._runDistance = 0;
                this._lastPlayerPos = null;
                // Wait for START line crossing before starting distance tracking
                this._waitingForStartLineCross = true;
                this._state = RaceState.RUNNING;
                if (this.stationNameText) {
                    this.stationNameText.text = 'RUN';
                }
                if (this.statusText) {
                    this.statusText.text = '';
                    this.triggerStatusZoom();
                }
                print('[RaceStateMachine] Waiting for START line crossing...');
                this.updateRunningUI();
            }
            else {
                course.fadeOutAndDestroy(() => {
                    this.spawnAndEnterStation();
                });
            }
        }
        onStartLineCrossed() {
            print('[RaceStateMachine] START line crossed! Beginning distance tracking.');
            this._waitingForStartLineCross = false;
            this._startLinePos = null;
            this._startLineForward = null;
            // Reset camera tracking position
            this._lastPlayerPos = null;
            // Reset HR tracking for this split
            this._splitHRReadings = [];
            this._splitPeakBPM = 0;
            // Fade out START line
            var course = this.cm();
            if (course) {
                course.fadeOutAndDestroy(() => {
                    print('[RaceStateMachine] START line faded out');
                });
            }
            print('[RaceStateMachine] RUN ' + this._runTarget + 'm to ' + this._currentConfig.name);
        }
        checkStartLineCrossing() {
            if (!this._startLinePos || !this._startLineForward) {
                this.onStartLineCrossed();
                return;
            }
            var playerPos = this.getPlayerPosition();
            var toPlayer = new vec3(playerPos.x - this._startLinePos.x, 0, playerPos.z - this._startLinePos.z);
            var dot = toPlayer.x * this._startLineForward.x + toPlayer.z * this._startLineForward.z;
            if (dot < 0) {
                this.onStartLineCrossed();
            }
        }
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
                // Reset HR tracking for this split
                this._splitHRReadings = [];
                this._splitPeakBPM = 0;
                this._state = RaceState.RUNNING;
                if (this.stationNameText) {
                    this.stationNameText.text = 'RUN';
                }
                if (this.statusText) {
                    this.statusText.text = '';
                    this.triggerStatusZoom();
                }
                print('[RaceStateMachine] RUN ' + this._runTarget + 'm to ' + this._currentConfig.name);
                this.updateRunningUI();
            }
            else {
                this.spawnAndEnterStation();
            }
        }
        onRunDistanceComplete() {
            print('[RaceStateMachine] Run complete! ' + this._runDistance.toFixed(1) + 'm / ' + this._runTarget + 'm');
            // Record split with HR data
            var runName = 'Run to ' + this._currentConfig.name;
            var runDuration = this.calculateSplitDuration();
            this._splitNames.push(runName);
            this._splitDurations.push(runDuration);
            this._splitAvgHR.push(this.calculateSplitAvgHR());
            this._splitPeakHR.push(this._splitPeakBPM);
            print('[RaceStateMachine] ' + runName + ': ' + (runDuration / 1000).toFixed(1) + 's, Avg HR: ' + this._splitAvgHR[this._splitAvgHR.length - 1]);
            // Clear run state
            this._runTarget = 0;
            this._runDistance = 0;
            this._splitHRReadings = [];
            this._splitPeakBPM = 0;
            // Spawn station in front of player and enter
            this.spawnAndEnterStation();
        }
        spawnAndEnterStation() {
            var course = this.cm();
            if (!course)
                return;
            var playerPos = this.getPlayerPosition();
            var playerForward = this.getPlayerForward();
            var spawnReferencePos = new vec3(playerPos.x + playerForward.x * 200, playerPos.y, playerPos.z + playerForward.z * 200);
            course.spawnStationInFrontOfPlayer(this._currentStationIndex, spawnReferencePos, playerForward);
            this.enterStationMode();
        }
        enterStationMode() {
            this._stationStartTime = getTime() * 1000;
            this._stationProgress = 0;
            this._stationRequirement = this._currentConfig.requirement;
            this._lastPlayerPos = null;
            // Reset HR tracking for this split
            this._splitHRReadings = [];
            this._splitPeakBPM = 0;
            // Start hand zone detection for ZONE_HIT stations
            if (this._currentConfig.mode === CourseManager_1.StationMode.ZONE_HIT) {
                if (this.handZoneDetector && this._currentConfig.motionType) {
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
                }
            }
            // Show finish VFX if this is the last station
            var course = this.cm();
            if (course && this._currentStationIndex === course.stationCount - 1 && this.finishTunnelVfx) {
                this.finishTunnelVfx.enabled = true;
            }
            this._state = RaceState.STATION;
            if (this.stationNameText) {
                this.stationNameText.text = this._currentConfig.name;
            }
            if (this.nextStationText) {
                this.nextStationText.text = '';
            }
            if (this.statusText) {
                this.statusText.text = '';
            }
            print('[RaceStateMachine] Entered: ' + this._currentConfig.name);
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
            // Camera-based distance tracking
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
        // ── Run Tracking (Camera-based) ───────────────────────────────────────────
        trackRunDistance() {
            var playerPos = this.getPlayerPosition();
            if (!playerPos)
                return;
            if (this._lastPlayerPos !== null) {
                var dx = playerPos.x - this._lastPlayerPos.x;
                var dz = playerPos.z - this._lastPlayerPos.z;
                var dist = Math.sqrt(dx * dx + dz * dz);
                // Convert cm to meters
                var deltaMeter = dist / 100;
                this._runDistance += deltaMeter;
            }
            this._lastPlayerPos = new vec3(playerPos.x, playerPos.y, playerPos.z);
        }
        // ── Station Completion ─────────────────────────────────────────────────────
        completeCurrentStation() {
            var name = this._currentConfig ? this._currentConfig.name : 'Station';
            var mode = this._currentConfig ? this._currentConfig.mode : null;
            var duration = this.calculateSplitDuration();
            // Stop hand zone detection for ZONE_HIT stations
            if (mode === CourseManager_1.StationMode.ZONE_HIT) {
                if (this.handZoneDetector) {
                    this.handZoneDetector.stopDetection();
                }
            }
            // Record split with HR data
            this._splitNames.push(name);
            this._splitDurations.push(duration);
            this._splitAvgHR.push(this.calculateSplitAvgHR());
            this._splitPeakHR.push(this._splitPeakBPM);
            print('[RaceStateMachine] ' + name + ' COMPLETE — ' + (duration / 1000).toFixed(1) + 's, Avg HR: ' + this._splitAvgHR[this._splitAvgHR.length - 1]);
            // Reset HR tracking
            this._splitHRReadings = [];
            this._splitPeakBPM = 0;
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
            // End HR session
            var hrStats = { avgBPM: 0, peakBPM: 0 };
            if (this.heartRateTracker) {
                hrStats = this.heartRateTracker.endSession();
            }
            if (this.statusText) {
                this.statusText.text = 'FINISHED!';
                this.triggerStatusZoom();
            }
            if (this.stationNameText) {
                this.stationNameText.text = '';
            }
            if (this.nextStationText) {
                this.nextStationText.text = '';
            }
            if (this.timerText)
                this.timerText.text = this.formatTime(totalMs);
            // Show split summary with HR data
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
                    var avgHR = this._splitAvgHR[j] > 0 ? ' [' + this._splitAvgHR[j] + ' BPM]' : '';
                    var tag = j === fastIdx ? ' *FAST*' : j === slowIdx ? ' *SLOW*' : '';
                    lines += this._splitNames[j] + ': ' + dur + 's' + avgHR + tag + '\n';
                }
                // Add overall HR stats
                if (hrStats.avgBPM > 0) {
                    lines += '\nAvg HR: ' + hrStats.avgBPM + ' BPM\n';
                    lines += 'Peak HR: ' + hrStats.peakBPM + ' BPM';
                }
                this.stationInfoText.text = lines;
            }
            // Show reset hint
            if (this.instructionText) {
                this.instructionText.text = 'Pinch to Reset';
            }
            // Re-enable start button for reset
            if (this.startButtonObject) {
                this.startButtonObject.enabled = true;
            }
            print('[RaceStateMachine] FINISHED ' + (totalMs / 1000).toFixed(1) + 's');
            if (hrStats.avgBPM > 0) {
                print('[RaceStateMachine] Avg HR: ' + hrStats.avgBPM + ', Peak HR: ' + hrStats.peakBPM);
            }
        }
        /** Stop race early - shows summary with incomplete stations */
        stopRace() {
            if (this._state !== RaceState.RUNNING &&
                this._state !== RaceState.STATION &&
                this._state !== RaceState.PAUSED) {
                print('[RaceStateMachine] Cannot stop from ' + this._state);
                return;
            }
            var totalMs = (getTime() * 1000) - this._raceStartTime - this._totalPausedTime;
            this._state = RaceState.FINISHED;
            // Stop hand zone detection
            if (this.handZoneDetector) {
                this.handZoneDetector.stopDetection();
            }
            // End HR session
            var hrStats = { avgBPM: 0, peakBPM: 0 };
            if (this.heartRateTracker) {
                hrStats = this.heartRateTracker.endSession();
            }
            // Fade out current station
            var course = this.cm();
            if (course) {
                course.fadeOutAndDestroy(() => { });
            }
            if (this.statusText) {
                this.statusText.text = 'STOPPED';
                this.triggerStatusZoom();
            }
            if (this.stationNameText) {
                this.stationNameText.text = '';
            }
            if (this.nextStationText) {
                this.nextStationText.text = '';
            }
            if (this.timerText)
                this.timerText.text = this.formatTime(totalMs);
            // Build summary with completed + incomplete stations
            if (this.stationInfoText) {
                var lines = '';
                // Completed splits
                if (this._splitNames.length > 0) {
                    lines += '=== COMPLETED ===\n';
                    for (var j = 0; j < this._splitNames.length; j++) {
                        var dur = (this._splitDurations[j] / 1000).toFixed(1);
                        var avgHR = this._splitAvgHR[j] > 0 ? ' [' + this._splitAvgHR[j] + ' BPM]' : '';
                        lines += this._splitNames[j] + ': ' + dur + 's' + avgHR + '\n';
                    }
                }
                // Incomplete stations
                if (course) {
                    var totalStations = course.stationCount;
                    var nextIdx = this._currentStationIndex;
                    if (nextIdx < totalStations) {
                        lines += '\n=== INCOMPLETE ===\n';
                        for (var k = nextIdx; k < totalStations; k++) {
                            var config = course.getStationConfig(k);
                            if (config) {
                                lines += '• ' + config.name + '\n';
                            }
                        }
                    }
                }
                // HR stats
                if (hrStats.avgBPM > 0) {
                    lines += '\nAvg HR: ' + hrStats.avgBPM + ' BPM\n';
                    lines += 'Peak HR: ' + hrStats.peakBPM + ' BPM';
                }
                this.stationInfoText.text = lines;
            }
            // Show reset hint
            if (this.instructionText) {
                this.instructionText.text = 'Pinch to Reset';
            }
            // Re-enable start button for reset
            if (this.startButtonObject) {
                this.startButtonObject.enabled = true;
            }
            print('[RaceStateMachine] STOPPED at ' + (totalMs / 1000).toFixed(1) + 's');
        }
        // ── HR Stats Calculation ──────────────────────────────────────────────────
        calculateSplitAvgHR() {
            if (this._splitHRReadings.length === 0)
                return 0;
            var sum = 0;
            for (var i = 0; i < this._splitHRReadings.length; i++) {
                sum += this._splitHRReadings[i];
            }
            return Math.round(sum / this._splitHRReadings.length);
        }
        // ── UI Updates ─────────────────────────────────────────────────────────────
        setUIIdle() {
            if (this.statusText)
                this.statusText.text = '';
            if (this.hrStatusText) {
                this.hrStatusText.text = this._hrStatusMessage || '';
            }
            if (this.stationInfoText) {
                this.stationInfoText.text = '';
            }
            if (this.stationNameText) {
                this.stationNameText.text = '';
            }
            if (this.nextStationText) {
                this.nextStationText.text = '';
            }
            if (this.timerBG) {
                this.timerBG.enabled = false;
            }
            if (this.countdownText) {
                this.countdownText.getSceneObject().enabled = false;
            }
            if (this.progressBar) {
                this.progressBar.getSceneObject().enabled = false;
            }
        }
        updateRunningUI() {
            if (this.stationInfoText && !this.stationInfoText.getSceneObject().enabled) {
                this.stationInfoText.getSceneObject().enabled = true;
            }
            if (this._currentConfig) {
                var nextName = this._currentConfig.name;
                if (this.nextStationText) {
                    this.nextStationText.text = 'Next: ' + nextName;
                }
                if (this._waitingForStartLineCross) {
                    if (this.stationInfoText) {
                        this.stationInfoText.text = 'Cross the START line!';
                    }
                    if (this.progressBar) {
                        this.progressBar.setProgress(0);
                    }
                    return;
                }
                var runInfo = this._runDistance.toFixed(0) + 'm / ' + this._runTarget.toFixed(0) + 'm';
                var pct = Math.min(1, this._runDistance / Math.max(1, this._runTarget));
                if (this.progressBar) {
                    this.progressBar.setProgress(pct);
                }
                if (this.stationInfoText) {
                    this.stationInfoText.text = runInfo;
                }
            }
        }
        updateStationUI() {
            if (!this._currentConfig)
                return;
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
                    progressText = instruction + '\n' + progress.toFixed(1) + 'm / ' + target + 'm';
                    break;
                case CourseManager_1.StationMode.ZONE_HIT:
                    progressText = instruction + '\n' + Math.floor(progress) + ' / ' + target + ' hits';
                    break;
                default:
                    progressText = instruction;
            }
            var pct = Math.min(1, progress / Math.max(1, target));
            if (this.progressBar) {
                this.progressBar.setProgress(pct);
            }
            this.stationInfoText.text = progressText;
        }
        updateTimerUI() {
            if (!this.timerText)
                return;
            if (this.timerBG && !this.timerBG.enabled) {
                this.timerBG.enabled = true;
            }
            this.timerText.text = this.formatTime(this.elapsedMs);
        }
        // ── Player Position/Direction ──────────────────────────────────────────────
        getPlayerPosition() {
            if (!this.camTransform) {
                return vec3.zero();
            }
            var camPos = this.camTransform.getWorldPosition();
            var setup = this.setup();
            var floorY = camPos.y;
            if (setup && setup.isCalibrated && typeof setup.floorY !== 'undefined') {
                floorY = setup.floorY;
            }
            return new vec3(camPos.x, floorY, camPos.z);
        }
        getPlayerForward() {
            if (!this.camTransform) {
                return new vec3(0, 0, -1);
            }
            return vec3.up().cross(this.camTransform.right).normalize();
        }
        // ── Helpers ────────────────────────────────────────────────────────────────
        calculateSplitDuration() {
            var now = getTime() * 1000;
            var splitStart = this._stationStartTime > 0 ? this._stationStartTime : this._raceStartTime;
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