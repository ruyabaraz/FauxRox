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
function component(target) {
    target.getTypeName = function () { return __selfType; };
    if (target.prototype.hasOwnProperty("getTypeName"))
        return;
    Object.defineProperty(target.prototype, "getTypeName", {
        value: function () { return __selfType; },
        configurable: true,
        writable: true
    });
}
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
            /** Arrow guide for run segments */
            this.runArrowGuide = this.runArrowGuide;
            /** Cloud manager for saving race data */
            this.cloudManager = this.cloudManager;
            /** AI Coach reference - for checking if AI is speaking before playing SFX */
            this.aiCoach = this.aiCoach;
            // ── Onboarding References ───────────────────────────────────────────────
            /** Profile manager for user profile data */
            this.profileManager = this.profileManager;
            /** Onboarding UI for first-launch profile setup */
            this.onboardingUI = this.onboardingUI;
            // ── UI Elements ───────────────────────────────────────────────────────────
            this.statusText = this.statusText;
            this.timerText = this.timerText;
            this.timerBG = this.timerBG; // Parent of timerText - enable/disable this
            this.stationInfoText = this.stationInfoText;
            this.countdownText = this.countdownText; // Separate text for 3-2-1 countdown
            /** Countdown sound effects */
            this.countdownBeepSound = this.countdownBeepSound; // Plays ONCE at countdown start (SFX contains all beeps)
            this.countdownGoSound = this.countdownGoSound; // Plays on GO!
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
            /** HR connected icon (beating heart) - shown instead of text when connected */
            this.hrConnectedIcon = this.hrConnectedIcon;
            /** Station name text - displays current station name during workout */
            this.stationNameText = this.stationNameText;
            /** Station info background - synced with stationInfoText visibility */
            this.stationInfoBG = this.stationInfoBG;
            /** Next station text - displays upcoming station name */
            this.nextStationText = this.nextStationText;
            /** Progress text - displays distance or rep count */
            this.progressText = this.progressText;
            /** Visual progress bar (from Orthographic Camera package) */
            this.progressBar = this.progressBar;
            /** Start button object - hidden after race starts */
            this.startButtonObject = this.startButtonObject;
            /** SkiErg motion guide animations - enabled only during SkiErg station */
            this.skiergGuides = this.skiergGuides;
            // ── Form Feedback Audio ────────────────────────────────────────────────────
            /** Audio cue for form reminder ("Get lower!", etc.) */
            this.formReminderSound = this.formReminderSound;
            /** Audio cue for good form acknowledgment */
            this.goodFormSound = this.goodFormSound;
            // ── Finish Panel UI ─────────────────────────────────────────────────────────
            /** Finish panel container - shown on race finish/stop */
            this.finishPanel = this.finishPanel;
            /** Finish status text - "FINISHED!" or "STOPPED" */
            this.finishStatusText = this.finishStatusText;
            /** Finish total time text */
            this.finishTotalTimeText = this.finishTotalTimeText;
            /** Finish average HR text */
            this.finishAvgHRText = this.finishAvgHRText;
            /** Finish peak HR text */
            this.finishPeakHRText = this.finishPeakHRText;
            /** Finish splits text - displays all splits */
            this.finishSplitsText = this.finishSplitsText;
            /** Reset button on finish panel */
            this.finishResetButton = this.finishResetButton;
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
            this._hrConnected = false;
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
            // SkiErg guide fadeout
            this._skiergGuidesActive = false;
            this._skiergGuidesFading = false;
            // ── Form Detection State ────────────────────────────────────────────────────
            // Camera Y tracking for form detection
            this._cameraYHistory = [];
            this.CAMERA_Y_HISTORY_SIZE = 30; // ~0.5s at 60fps
            // Burpee form state
            this._burpeeState = 'waiting_drop';
            this._burpeeDropY = 0;
            this._burpeeGoodReps = 0;
            this._burpeeJumpStartPos = null; // Position when rise completes
            this._burpeeJumpForward = null; // Forward direction at jump start
            this.BURPEE_JUMP_DISTANCE = 50; // 50cm forward = valid jump
            this._burpeeLastFeedbackTime = 0;
            this._burpeeStationStartTime = -1; // When burpee station started (-1 = not started)
            this.BURPEE_FEEDBACK_COOLDOWN = 2.0; // seconds between UI feedback
            this.BURPEE_FIRST_FEEDBACK_DELAY = 3.0; // Wait before first feedback
            // Lunge form state
            this._lungeBounceCount = 0;
            this._lungeLastPeakY = 0;
            this._lungeLastValleyY = 0;
            this._lungeDirection = 'rising';
            // Form feedback timing
            this._lastFormReminderTime = 0;
            this.FORM_REMINDER_COOLDOWN = 10.0; // seconds between AI voice reminders (longer = less spam)
            // Thresholds (in cm)
            this.BURPEE_DROP_THRESHOLD = 40; // Head must drop 40cm
            this.LUNGE_BOUNCE_THRESHOLD = 10; // 10cm bounce = lunge detected
            this._skiergGuidesAlpha = 1.0;
            this.SKIERG_GUIDE_FADE_DURATION = 0.5;
            // Heart rate tracking for current split
            this._splitHRReadings = [];
            this._splitPeakBPM = 0;
            // Countdown zoom punch animation
            this._countdownAnimating = false;
            this._countdownAnimTime = 0;
            this._countdownOriginalScale = null;
            this._lastCountdownNum = -1;
            this.COUNTDOWN_ZOOM_DURATION = 0.3;
            this.COUNTDOWN_ZOOM_SCALE = 1.5;
            // Station name zoom punch animation
            this._stationNameAnimating = false;
            this._stationNameAnimTime = 0;
            this._stationNameOriginalScale = null;
            this.STATION_NAME_ZOOM_DURATION = 0.3;
            this.STATION_NAME_ZOOM_SCALE = 1.4;
            // ── Heart Pulse Animation ────────────────────────────────────────────────
            this._heartPulseActive = false;
            this._heartOriginalScale = null;
            this._heartPulseTime = 0;
            this.HEART_PULSE_SPEED = 1.2; // Pulses per second (resting HR feel)
            this.HEART_PULSE_SCALE = 0.15;
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
            /** Arrow guide for run segments */
            this.runArrowGuide = this.runArrowGuide;
            /** Cloud manager for saving race data */
            this.cloudManager = this.cloudManager;
            /** AI Coach reference - for checking if AI is speaking before playing SFX */
            this.aiCoach = this.aiCoach;
            // ── Onboarding References ───────────────────────────────────────────────
            /** Profile manager for user profile data */
            this.profileManager = this.profileManager;
            /** Onboarding UI for first-launch profile setup */
            this.onboardingUI = this.onboardingUI;
            // ── UI Elements ───────────────────────────────────────────────────────────
            this.statusText = this.statusText;
            this.timerText = this.timerText;
            this.timerBG = this.timerBG; // Parent of timerText - enable/disable this
            this.stationInfoText = this.stationInfoText;
            this.countdownText = this.countdownText; // Separate text for 3-2-1 countdown
            /** Countdown sound effects */
            this.countdownBeepSound = this.countdownBeepSound; // Plays ONCE at countdown start (SFX contains all beeps)
            this.countdownGoSound = this.countdownGoSound; // Plays on GO!
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
            /** HR connected icon (beating heart) - shown instead of text when connected */
            this.hrConnectedIcon = this.hrConnectedIcon;
            /** Station name text - displays current station name during workout */
            this.stationNameText = this.stationNameText;
            /** Station info background - synced with stationInfoText visibility */
            this.stationInfoBG = this.stationInfoBG;
            /** Next station text - displays upcoming station name */
            this.nextStationText = this.nextStationText;
            /** Progress text - displays distance or rep count */
            this.progressText = this.progressText;
            /** Visual progress bar (from Orthographic Camera package) */
            this.progressBar = this.progressBar;
            /** Start button object - hidden after race starts */
            this.startButtonObject = this.startButtonObject;
            /** SkiErg motion guide animations - enabled only during SkiErg station */
            this.skiergGuides = this.skiergGuides;
            // ── Form Feedback Audio ────────────────────────────────────────────────────
            /** Audio cue for form reminder ("Get lower!", etc.) */
            this.formReminderSound = this.formReminderSound;
            /** Audio cue for good form acknowledgment */
            this.goodFormSound = this.goodFormSound;
            // ── Finish Panel UI ─────────────────────────────────────────────────────────
            /** Finish panel container - shown on race finish/stop */
            this.finishPanel = this.finishPanel;
            /** Finish status text - "FINISHED!" or "STOPPED" */
            this.finishStatusText = this.finishStatusText;
            /** Finish total time text */
            this.finishTotalTimeText = this.finishTotalTimeText;
            /** Finish average HR text */
            this.finishAvgHRText = this.finishAvgHRText;
            /** Finish peak HR text */
            this.finishPeakHRText = this.finishPeakHRText;
            /** Finish splits text - displays all splits */
            this.finishSplitsText = this.finishSplitsText;
            /** Reset button on finish panel */
            this.finishResetButton = this.finishResetButton;
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
            this._hrConnected = false;
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
            // SkiErg guide fadeout
            this._skiergGuidesActive = false;
            this._skiergGuidesFading = false;
            // ── Form Detection State ────────────────────────────────────────────────────
            // Camera Y tracking for form detection
            this._cameraYHistory = [];
            this.CAMERA_Y_HISTORY_SIZE = 30; // ~0.5s at 60fps
            // Burpee form state
            this._burpeeState = 'waiting_drop';
            this._burpeeDropY = 0;
            this._burpeeGoodReps = 0;
            this._burpeeJumpStartPos = null; // Position when rise completes
            this._burpeeJumpForward = null; // Forward direction at jump start
            this.BURPEE_JUMP_DISTANCE = 50; // 50cm forward = valid jump
            this._burpeeLastFeedbackTime = 0;
            this._burpeeStationStartTime = -1; // When burpee station started (-1 = not started)
            this.BURPEE_FEEDBACK_COOLDOWN = 2.0; // seconds between UI feedback
            this.BURPEE_FIRST_FEEDBACK_DELAY = 3.0; // Wait before first feedback
            // Lunge form state
            this._lungeBounceCount = 0;
            this._lungeLastPeakY = 0;
            this._lungeLastValleyY = 0;
            this._lungeDirection = 'rising';
            // Form feedback timing
            this._lastFormReminderTime = 0;
            this.FORM_REMINDER_COOLDOWN = 10.0; // seconds between AI voice reminders (longer = less spam)
            // Thresholds (in cm)
            this.BURPEE_DROP_THRESHOLD = 40; // Head must drop 40cm
            this.LUNGE_BOUNCE_THRESHOLD = 10; // 10cm bounce = lunge detected
            this._skiergGuidesAlpha = 1.0;
            this.SKIERG_GUIDE_FADE_DURATION = 0.5;
            // Heart rate tracking for current split
            this._splitHRReadings = [];
            this._splitPeakBPM = 0;
            // Countdown zoom punch animation
            this._countdownAnimating = false;
            this._countdownAnimTime = 0;
            this._countdownOriginalScale = null;
            this._lastCountdownNum = -1;
            this.COUNTDOWN_ZOOM_DURATION = 0.3;
            this.COUNTDOWN_ZOOM_SCALE = 1.5;
            // Station name zoom punch animation
            this._stationNameAnimating = false;
            this._stationNameAnimTime = 0;
            this._stationNameOriginalScale = null;
            this.STATION_NAME_ZOOM_DURATION = 0.3;
            this.STATION_NAME_ZOOM_SCALE = 1.4;
            // ── Heart Pulse Animation ────────────────────────────────────────────────
            this._heartPulseActive = false;
            this._heartOriginalScale = null;
            this._heartPulseTime = 0;
            this.HEART_PULSE_SPEED = 1.2; // Pulses per second (resting HR feel)
            this.HEART_PULSE_SCALE = 0.15;
        }
        // ── Accessors ─────────────────────────────────────────────────────────────
        cm() { return this.courseManagerScript; }
        setup() { return this.courseSetupScript; }
        // ── Public Getters ─────────────────────────────────────────────────────────
        get state() { return this._state; }
        get currentStationIndex() { return this._currentStationIndex; }
        get currentConfig() { return this._currentConfig; }
        get splits() {
            const result = [];
            for (let i = 0; i < this._splitNames.length; i++) {
                result.push({ name: this._splitNames[i], duration: this._splitDurations[i] });
            }
            return result;
        }
        get elapsedMs() {
            return this.getRaceElapsedMsAt(getTime() * 1000);
        }
        // ── Time Calculation Helper ─────────────────────────────────────────────────
        // Single source of truth for all elapsed time calculations (pause-aware)
        getRaceElapsedMsAt(now) {
            if (this._raceStartTime === 0)
                return 0;
            var paused = this._totalPausedTime;
            // Include active pause duration (not yet added to _totalPausedTime)
            if (this._state === RaceState.PAUSED && this._pauseStartTime > 0) {
                paused += now - this._pauseStartTime;
            }
            return Math.max(0, now - this._raceStartTime - paused);
        }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        onAwake() {
            if (this.camera) {
                this.camTransform = this.camera.getTransform();
            }
            this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));
            // Hide SkiErg guides initially
            if (this.skiergGuides) {
                this.skiergGuides.enabled = false;
            }
            // Hide finish panel initially
            if (this.finishPanel) {
                this.finishPanel.enabled = false;
            }
            // Hide HR connected icon initially
            if (this.hrConnectedIcon) {
                this.hrConnectedIcon.enabled = false;
            }
            // Bind finish reset button
            this.createEvent('OnStartEvent').bind(() => {
                this.bindFinishResetButton();
            });
            this.setUIIdle();
            this.showTitle();
            print('[RaceStateMachine] Init — IDLE (HR Edition)');
        }
        bindFinishResetButton() {
            if (this.finishResetButton) {
                var btn = this.finishResetButton;
                if (btn.onTriggerUp && btn.onTriggerUp.add) {
                    btn.onTriggerUp.add(() => {
                        this.resetRace();
                    });
                    print('[RaceStateMachine] Finish reset button bound');
                }
            }
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
                    this._hrStatusMessage = ''; // No text, using icon
                    this._hrConnected = true;
                }
                else {
                    print('[RaceStateMachine] HR Monitor disabled by user');
                    this._hrStatusMessage = '';
                    this._hrConnected = false;
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
            // Show HR connected icon or hide status text
            if (this._hrConnected && this.hrConnectedIcon) {
                // Show beating heart icon
                this.hrConnectedIcon.enabled = true;
                this.startHeartPulse();
                if (this.hrStatusText) {
                    this.hrStatusText.getSceneObject().enabled = false;
                }
            }
            else {
                // Hide icon, hide text (no HR)
                if (this.hrConnectedIcon) {
                    this.hrConnectedIcon.enabled = false;
                }
                if (this.hrStatusText) {
                    this.hrStatusText.getSceneObject().enabled = false;
                }
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
        startHeartPulse() {
            if (!this.hrConnectedIcon)
                return;
            this._heartOriginalScale = this.hrConnectedIcon.getTransform().getLocalScale();
            this._heartPulseActive = true;
            this._heartPulseTime = 0;
        }
        stopHeartPulse() {
            this._heartPulseActive = false;
            if (this.hrConnectedIcon && this._heartOriginalScale) {
                this.hrConnectedIcon.getTransform().setLocalScale(this._heartOriginalScale);
            }
        }
        updateHeartPulse(dt) {
            if (!this._heartPulseActive || !this.hrConnectedIcon || !this._heartOriginalScale)
                return;
            this._heartPulseTime += dt;
            // Double-beat pattern like real heart
            var t = this._heartPulseTime * this.HEART_PULSE_SPEED * Math.PI * 2;
            var beat1 = Math.max(0, Math.sin(t));
            var beat2 = Math.max(0, Math.sin(t + 0.5));
            var pulse = (beat1 + beat2 * 0.6) * this.HEART_PULSE_SCALE;
            var scale = 1.0 + pulse;
            this.hrConnectedIcon.getTransform().setLocalScale(this._heartOriginalScale.uniformScale(scale));
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
            if (this.stationInfoBG) {
                this.stationInfoBG.enabled = false;
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
            print('[RaceStateMachine] Title fade complete');
            // Check if onboarding is needed
            if (this.needsOnboarding()) {
                print('[RaceStateMachine] Onboarding required, showing onboarding UI');
                this.showOnboarding();
                return;
            }
            // Already has profile, continue to BLE flow
            this.continueAfterOnboarding();
        }
        // ── Onboarding ────────────────────────────────────────────────────────────
        /**
         * Always show onboarding so user can adjust settings (goal changes per session)
         */
        needsOnboarding() {
            if (!this.profileManager || !this.onboardingUI) {
                return false; // No ProfileManager/OnboardingUI = skip
            }
            return true; // Always show, previous values will be pre-filled
        }
        /**
         * Show onboarding UI flow
         */
        showOnboarding() {
            if (!this.onboardingUI) {
                print('[RaceStateMachine] WARNING: OnboardingUI not assigned, skipping');
                this.continueAfterOnboarding();
                return;
            }
            // Get display name from CloudManager if available
            var snapUserName = '';
            if (this.cloudManager) {
                snapUserName = this.cloudManager.displayName || '';
            }
            // Show onboarding UI
            this.onboardingUI.show(snapUserName, (profile) => {
                this.onOnboardingComplete(profile);
            });
        }
        /**
         * Called when onboarding flow completes
         */
        onOnboardingComplete(profile) {
            print('[RaceStateMachine] Onboarding complete');
            // Update HeartRateTracker with personalized maxHR
            if (profile && this.profileManager && this.heartRateTracker) {
                var maxHR = this.profileManager.getMaxHeartRate();
                this.heartRateTracker.updateMaxHeartRate(maxHR);
                print('[RaceStateMachine] MaxHR set to: ' + maxHR);
            }
            // Continue to BLE flow
            this.continueAfterOnboarding();
        }
        /**
         * Continue startup flow after onboarding (or if already onboarded)
         */
        continueAfterOnboarding() {
            print('[RaceStateMachine] Continuing to BLE flow');
            // Start BLE connection flow (will trigger floor calibration when complete)
            this.initHeartRateMonitor();
        }
        /**
         * Get ProfileManager reference (for AI Coach and other systems)
         */
        getProfileManager() {
            return this.profileManager;
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
        updateSkiergGuidesFade(dt) {
            if (!this._skiergGuidesFading || !this.skiergGuides)
                return;
            this._skiergGuidesAlpha -= dt / this.SKIERG_GUIDE_FADE_DURATION;
            if (this._skiergGuidesAlpha <= 0) {
                this._skiergGuidesAlpha = 0;
                this._skiergGuidesFading = false;
                this._skiergGuidesActive = false;
                this.skiergGuides.enabled = false;
                print('[RaceStateMachine] SkiErg guides hidden');
                return;
            }
            // Apply alpha to both child guide animations
            for (var i = 0; i < this.skiergGuides.getChildrenCount(); i++) {
                var child = this.skiergGuides.getChild(i);
                var image = child.getComponent('Component.Image');
                if (image) {
                    var color = image.mainPass.baseColor;
                    image.mainPass.baseColor = new vec4(color.r, color.g, color.b, this._skiergGuidesAlpha);
                }
            }
        }
        startSkiergGuidesFadeout() {
            if (!this.skiergGuides || !this._skiergGuidesActive)
                return;
            this._skiergGuidesFading = true;
            print('[RaceStateMachine] SkiErg guides fading out');
        }
        showSkiergGuides() {
            if (!this.skiergGuides)
                return;
            this._skiergGuidesActive = true;
            this._skiergGuidesFading = false;
            this._skiergGuidesAlpha = 1.0;
            this.skiergGuides.enabled = true;
            // Reset alpha to 1 for all children
            for (var i = 0; i < this.skiergGuides.getChildrenCount(); i++) {
                var child = this.skiergGuides.getChild(i);
                var image = child.getComponent('Component.Image');
                if (image) {
                    var color = image.mainPass.baseColor;
                    image.mainPass.baseColor = new vec4(color.r, color.g, color.b, 1.0);
                }
            }
            print('[RaceStateMachine] SkiErg guides shown');
        }
        hideSkiergGuides() {
            if (!this.skiergGuides)
                return;
            this._skiergGuidesActive = false;
            this._skiergGuidesFading = false;
            this.skiergGuides.enabled = false;
        }
        // ── Finish Panel ────────────────────────────────────────────────────────────
        showFinishPanel(status, totalMs, hrStats, incompleteStations) {
            // Show the panel
            if (this.finishPanel) {
                this.finishPanel.enabled = true;
            }
            // Status text
            if (this.finishStatusText) {
                this.finishStatusText.text = status;
            }
            // Total time
            if (this.finishTotalTimeText) {
                this.finishTotalTimeText.text = 'Total Time: ' + this.formatTime(totalMs);
            }
            // HR stats
            if (this.finishAvgHRText) {
                this.finishAvgHRText.text = hrStats.avgBPM > 0 ? 'Avg HR: ' + hrStats.avgBPM + ' BPM' : '';
            }
            if (this.finishPeakHRText) {
                this.finishPeakHRText.text = hrStats.peakBPM > 0 ? 'Peak HR: ' + hrStats.peakBPM + ' BPM' : '';
            }
            // Populate splits
            this.populateFinishSplits(incompleteStations);
        }
        populateFinishSplits(incompleteStations) {
            if (!this.finishSplitsText)
                return;
            var lines = '';
            // Add completed splits with ✓
            for (var j = 0; j < this._splitNames.length; j++) {
                var dur = (this._splitDurations[j] / 1000).toFixed(1);
                var avgHR = this._splitAvgHR[j] > 0 ? ' [' + this._splitAvgHR[j] + ' BPM]' : '';
                lines += '✓ ' + this._splitNames[j] + ': ' + dur + 's' + avgHR + '\n';
            }
            // Add incomplete stations with ○
            if (incompleteStations && incompleteStations.length > 0) {
                for (var k = 0; k < incompleteStations.length; k++) {
                    lines += '○ ' + incompleteStations[k] + '\n';
                }
            }
            this.finishSplitsText.text = lines;
        }
        hideFinishPanel() {
            if (this.finishPanel) {
                this.finishPanel.enabled = false;
            }
            if (this.finishSplitsText) {
                this.finishSplitsText.text = '';
            }
        }
        // ── Cloud Save ──────────────────────────────────────────────────────────────
        saveRaceToCloud(totalMs, completed, hrStats) {
            if (!this.cloudManager) {
                print('[RaceStateMachine] Cloud save skipped - no CloudManager');
                return;
            }
            // Check if guest mode (skip cloud save)
            var isGuest = this.profileManager ? this.profileManager.isGuest() : false;
            // Build splits data
            var splits = [];
            for (var i = 0; i < this._splitNames.length; i++) {
                splits.push({
                    name: this._splitNames[i],
                    duration: this._splitDurations[i],
                    avgHR: this._splitAvgHR[i] || 0
                });
            }
            var record = {
                totalTime: totalMs,
                completed: completed,
                splits: splits,
                avgHR: hrStats.avgBPM,
                peakHR: hrStats.peakBPM
            };
            this.cloudManager.saveRace(record, isGuest).then((success) => {
                if (success) {
                    print('[RaceStateMachine] Race saved to cloud');
                }
                else {
                    print('[RaceStateMachine] Cloud save failed');
                }
            });
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
            this._lastCountdownNum = -1;
            this._countdownAnimating = false;
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
            // Hide HR status text, show HR display (keep heart icon beating)
            if (this.hrStatusText) {
                this.hrStatusText.getSceneObject().enabled = false;
            }
            // hrConnectedIcon stays visible and beating during race
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
            // Play countdown beep sound ONCE (SFX contains all beeps)
            this.playCountdownBeep();
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
            // Stop arrow guide
            this.stopRunArrowGuide();
            // Hide SkiErg guides
            this.hideSkiergGuides();
            // Hide finish panel
            this.hideFinishPanel();
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
            // Reset form detection state
            this.resetFormState();
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
            // Show onboarding again so user can adjust goal/settings
            if (this.needsOnboarding()) {
                this.showOnboarding();
            }
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
            this.updateSkiergGuidesFade(dt);
            this.updateStationNameZoom(dt);
            this.updateHeartPulse(dt);
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
            // Update countdown zoom animation
            this.updateCountdownZoom(dt);
            // Show timer BG during countdown
            if (this.timerBG && !this.timerBG.enabled) {
                this.timerBG.enabled = true;
            }
            if (this.timerText) {
                this.timerText.text = '00:00';
            }
            // Show countdown in separate countdownText (or fallback to statusText)
            var countdownTarget = this.countdownText || this.statusText;
            var num = Math.ceil(this._countdownRemaining);
            // Detect number change to trigger effects
            if (num !== this._lastCountdownNum) {
                this._lastCountdownNum = num;
                if (countdownTarget) {
                    countdownTarget.text = num > 0 ? num.toString() : 'GO!';
                }
                // Trigger zoom punch
                this.triggerCountdownZoom();
                // Play GO sound when countdown reaches 0
                if (num <= 0) {
                    this.playCountdownGo();
                }
            }
            if (this._countdownRemaining <= 0) {
                this._raceStartTime = getTime() * 1000;
                // Delay hiding countdown text to show "GO!" briefly
                var hideDelay = this.createEvent('DelayedCallbackEvent');
                hideDelay.bind(() => {
                    if (this.countdownText) {
                        this.countdownText.getSceneObject().enabled = false;
                    }
                });
                hideDelay.reset(0.5);
                // Show station info BG after countdown
                if (this.stationInfoBG) {
                    this.stationInfoBG.enabled = true;
                }
                this.startFirstStation();
                print('[RaceStateMachine] GO!');
            }
        }
        // ── Countdown Animation ─────────────────────────────────────────────────────
        triggerCountdownZoom() {
            var target = this.countdownText || this.statusText;
            if (!target)
                return;
            if (this._countdownOriginalScale === null) {
                this._countdownOriginalScale = target.getSceneObject().getTransform().getLocalScale();
            }
            // Start big, animate to normal
            var transform = target.getSceneObject().getTransform();
            transform.setLocalScale(this._countdownOriginalScale.uniformScale(this.COUNTDOWN_ZOOM_SCALE));
            this._countdownAnimating = true;
            this._countdownAnimTime = 0;
        }
        updateCountdownZoom(dt) {
            if (!this._countdownAnimating)
                return;
            var target = this.countdownText || this.statusText;
            if (!target || this._countdownOriginalScale === null)
                return;
            this._countdownAnimTime += dt;
            var t = Math.min(1, this._countdownAnimTime / this.COUNTDOWN_ZOOM_DURATION);
            // Ease out - starts fast, slows down
            var eased = 1 - Math.pow(1 - t, 3);
            // Interpolate from zoom scale to 1.0
            var scale = this.COUNTDOWN_ZOOM_SCALE - (this.COUNTDOWN_ZOOM_SCALE - 1) * eased;
            var transform = target.getSceneObject().getTransform();
            transform.setLocalScale(this._countdownOriginalScale.uniformScale(scale));
            if (t >= 1) {
                transform.setLocalScale(this._countdownOriginalScale);
                this._countdownAnimating = false;
            }
        }
        playCountdownBeep() {
            if (this.countdownBeepSound && !isNull(this.countdownBeepSound)) {
                this.countdownBeepSound.play(1);
            }
        }
        playCountdownGo() {
            if (this.countdownGoSound && !isNull(this.countdownGoSound)) {
                this.countdownGoSound.play(1);
            }
        }
        // ── Station Name Zoom Animation ─────────────────────────────────────────────
        triggerStationNameZoom() {
            if (!this.stationNameText)
                return;
            if (this._stationNameOriginalScale === null) {
                this._stationNameOriginalScale = this.stationNameText.getSceneObject().getTransform().getLocalScale();
            }
            // Start big, animate to normal
            var transform = this.stationNameText.getSceneObject().getTransform();
            transform.setLocalScale(this._stationNameOriginalScale.uniformScale(this.STATION_NAME_ZOOM_SCALE));
            this._stationNameAnimating = true;
            this._stationNameAnimTime = 0;
        }
        updateStationNameZoom(dt) {
            if (!this._stationNameAnimating || !this.stationNameText)
                return;
            this._stationNameAnimTime += dt;
            var t = Math.min(1, this._stationNameAnimTime / this.STATION_NAME_ZOOM_DURATION);
            // Ease out
            var eased = 1 - Math.pow(1 - t, 3);
            var scale = this.STATION_NAME_ZOOM_SCALE - (this.STATION_NAME_ZOOM_SCALE - 1) * eased;
            var transform = this.stationNameText.getSceneObject().getTransform();
            transform.setLocalScale(this._stationNameOriginalScale.uniformScale(scale));
            if (t >= 1) {
                transform.setLocalScale(this._stationNameOriginalScale);
                this._stationNameAnimating = false;
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
                    this.triggerStationNameZoom();
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
            // Start arrow guide toward run direction
            this.startRunArrowGuide();
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
            // Check if this is the finish marker (not a workout station)
            if (this._currentConfig.isFinish) {
                // Spawn FINISH prefab for visual effect
                var playerPos = this.getPlayerPosition();
                var playerForward = this.getPlayerForward();
                course.spawnStationInFrontOfPlayer(this._currentStationIndex, playerPos, playerForward);
                // Go directly to finish (no station mode)
                this.finishRace();
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
                // Start arrow guide for run segment
                this.startRunArrowGuide();
                this._state = RaceState.RUNNING;
                if (this.stationNameText) {
                    this.stationNameText.text = 'RUN';
                    this.triggerStationNameZoom();
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
            // Stop arrow guide
            this.stopRunArrowGuide();
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
            // Reset form detection state for DISTANCE stations
            this.resetFormState();
            // Start hand zone detection for ZONE_HIT stations
            if (this._currentConfig.mode === CourseManager_1.StationMode.ZONE_HIT) {
                if (this.handZoneDetector && this._currentConfig.motionType) {
                    var stationPos = null;
                    var targetObject = null;
                    if (this._currentConfig.motionType === CourseManager_1.MotionType.OVERHEAD_REACH) {
                        var course = this.cm();
                        var activeStation = course?.getActiveStation();
                        if (activeStation) {
                            stationPos = activeStation.getTransform().getWorldPosition();
                            // Find target sphere child (for squat press, wallball, etc.)
                            targetObject = this.findTargetSphere(activeStation);
                        }
                    }
                    this.handZoneDetector.startDetection(this._currentConfig.motionType, (repCount) => {
                        // Fade out SkiErg guides on first rep
                        if (repCount === 1 && this._skiergGuidesActive) {
                            this.startSkiergGuidesFadeout();
                        }
                        this._stationProgress = repCount;
                        this.updateStationUI();
                        if (this._stationProgress >= this._stationRequirement) {
                            this.completeCurrentStation();
                        }
                    }, null, stationPos, targetObject);
                }
            }
            // Show SkiErg guides if this is a SkiErg station
            var stationName = this._currentConfig.name.toUpperCase();
            if (stationName.indexOf('SKIERG') >= 0 || stationName.indexOf('SKI ERG') >= 0) {
                this.showSkiergGuides();
            }
            else {
                this.hideSkiergGuides();
            }
            // Show finish VFX if this is the last station
            var course = this.cm();
            if (course && this._currentStationIndex === course.stationCount - 1 && this.finishTunnelVfx) {
                this.finishTunnelVfx.enabled = true;
            }
            this._state = RaceState.STATION;
            if (this.stationNameText) {
                this.stationNameText.text = this._currentConfig.name;
                this.triggerStationNameZoom();
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
                case CourseManager_1.StationMode.REPS:
                    // Burpee uses camera-based rep detection (drop/rise/jump)
                    this.trackBurpeeReps();
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
            // Get raw camera Y for form detection (not floor-adjusted)
            var cameraY = this.camTransform ? this.camTransform.getWorldPosition().y : playerPos.y;
            this.updateCameraYHistory(cameraY);
            if (this._lastPlayerPos !== null) {
                var dx = playerPos.x - this._lastPlayerPos.x;
                var dz = playerPos.z - this._lastPlayerPos.z;
                var dist = Math.sqrt(dx * dx + dz * dz);
                // Convert cm to meters
                this._stationProgress += dist / 100;
            }
            this._lastPlayerPos = new vec3(playerPos.x, playerPos.y, playerPos.z);
            // Form detection based on station type
            if (this._currentConfig) {
                var stationName = this._currentConfig.name.toUpperCase();
                if (stationName.indexOf('BURPEE') >= 0) {
                    this.checkBurpeeForm(cameraY);
                }
                else if (stationName.indexOf('LUNGE') >= 0) {
                    this.checkLungeForm(cameraY);
                }
            }
        }
        /**
         * Track burpee reps using camera-based detection (hard gate)
         * Requires: DROP (head down 40cm) → RISE → JUMP (forward 50cm)
         */
        trackBurpeeReps() {
            if (!this.camTransform)
                return;
            var cameraY = this.camTransform.getWorldPosition().y;
            this.updateCameraYHistory(cameraY);
            // Run the burpee form state machine
            this.checkBurpeeForm(cameraY);
            // Use good reps as station progress
            this._stationProgress = this._burpeeGoodReps;
        }
        // ── Form Detection ──────────────────────────────────────────────────────────
        updateCameraYHistory(cameraY) {
            this._cameraYHistory.push(cameraY);
            if (this._cameraYHistory.length > this.CAMERA_Y_HISTORY_SIZE) {
                this._cameraYHistory.shift();
            }
        }
        resetFormState() {
            this._cameraYHistory = [];
            this._burpeeState = 'waiting_drop';
            this._burpeeDropY = 0;
            this._burpeeGoodReps = 0;
            this._burpeeJumpStartPos = null;
            this._burpeeJumpForward = null;
            this._burpeeLastFeedbackTime = 0;
            this._burpeeStationStartTime = getTime();
            this._lungeBounceCount = 0;
            this._lungeDirection = 'rising';
            // Initialize peak/valley Y from current camera position
            if (this.camTransform) {
                var currentY = this.camTransform.getWorldPosition().y;
                this._lungeLastPeakY = currentY;
                this._lungeLastValleyY = currentY;
            }
            else {
                this._lungeLastPeakY = 0;
                this._lungeLastValleyY = 0;
            }
        }
        checkBurpeeForm(cameraY) {
            if (this._cameraYHistory.length < 5)
                return;
            var startY = this._cameraYHistory[0];
            var now = getTime();
            var canShowFeedback = (now - this._burpeeLastFeedbackTime) >= this.BURPEE_FEEDBACK_COOLDOWN;
            var stationElapsed = this._burpeeStationStartTime > 0 ? (now - this._burpeeStationStartTime) : 0;
            switch (this._burpeeState) {
                case 'waiting_drop':
                    // Waiting for user to drop down (head goes low)
                    if (startY - cameraY > this.BURPEE_DROP_THRESHOLD) {
                        this._burpeeDropY = cameraY;
                        this._burpeeState = 'waiting_rise';
                        this.showBurpeeFeedback('DROP!');
                        print('[FormDetect] Burpee: DROP detected');
                    }
                    else if (canShowFeedback && stationElapsed > this.BURPEE_FIRST_FEEDBACK_DELAY) {
                        // Show feedback after initial delay (even for first rep)
                        this.showBurpeeFeedback('GET LOWER');
                        this._burpeeLastFeedbackTime = now;
                    }
                    break;
                case 'waiting_rise':
                    // Waiting for user to rise back up
                    if (cameraY - this._burpeeDropY > this.BURPEE_DROP_THRESHOLD * 0.7) {
                        // Record position and forward direction when rise completes
                        if (this.camTransform) {
                            var pos = this.camTransform.getWorldPosition();
                            this._burpeeJumpStartPos = new vec3(pos.x, pos.y, pos.z);
                            // Get flat forward direction (no Y component)
                            var fwd = this.camTransform.forward;
                            this._burpeeJumpForward = new vec3(fwd.x, 0, fwd.z).normalize();
                        }
                        this._burpeeState = 'waiting_jump';
                        this.showBurpeeFeedback('JUMP!');
                        print('[FormDetect] Burpee: RISE detected, waiting for forward jump');
                    }
                    break;
                case 'waiting_jump':
                    // Waiting for forward displacement (jump in facing direction)
                    if (this._burpeeJumpStartPos !== null && this._burpeeJumpForward !== null && this.camTransform) {
                        var currentPos = this.camTransform.getWorldPosition();
                        var dx = currentPos.x - this._burpeeJumpStartPos.x;
                        var dz = currentPos.z - this._burpeeJumpStartPos.z;
                        // Project movement onto forward direction (dot product)
                        var forwardDist = dx * this._burpeeJumpForward.x + dz * this._burpeeJumpForward.z;
                        if (forwardDist >= this.BURPEE_JUMP_DISTANCE) {
                            this._burpeeGoodReps++;
                            print('[FormDetect] Burpee: GOOD REP #' + this._burpeeGoodReps + ' (forward: ' + forwardDist.toFixed(0) + 'cm)');
                            this.showBurpeeFeedback('+1  (' + this._burpeeGoodReps + '/' + this._stationRequirement + ')');
                            this.playGoodFormSound();
                            this._burpeeState = 'waiting_drop';
                            this._burpeeJumpStartPos = null;
                            this._burpeeJumpForward = null;
                            // Reset start Y for next rep
                            this._cameraYHistory = [cameraY];
                        }
                        else if (canShowFeedback) {
                            // Not jumping forward enough
                            this.showBurpeeFeedback('JUMP FORWARD');
                            this._burpeeLastFeedbackTime = now;
                        }
                    }
                    break;
            }
        }
        showBurpeeFeedback(msg) {
            if (this.instructionText) {
                this.instructionText.text = msg;
            }
            print('[Burpee] ' + msg);
        }
        checkLungeForm(cameraY) {
            if (this._cameraYHistory.length < 10)
                return;
            var currentTime = getTime();
            // Detect vertical bounce pattern (head goes down during lunge)
            if (this._lungeDirection === 'rising') {
                if (cameraY < this._lungeLastPeakY - this.LUNGE_BOUNCE_THRESHOLD) {
                    // Started falling - found a peak
                    this._lungeDirection = 'falling';
                    this._lungeLastValleyY = cameraY;
                }
                else if (cameraY > this._lungeLastPeakY) {
                    this._lungeLastPeakY = cameraY;
                }
            }
            else {
                // falling
                if (cameraY > this._lungeLastValleyY + this.LUNGE_BOUNCE_THRESHOLD) {
                    // Started rising - found a valley, count bounce
                    this._lungeBounceCount++;
                    this._lungeDirection = 'rising';
                    this._lungeLastPeakY = cameraY;
                    print('[FormDetect] Lunge: BOUNCE #' + this._lungeBounceCount);
                    // Every 3 bounces, play positive feedback
                    if (this._lungeBounceCount % 3 === 0) {
                        this.playGoodFormSound();
                    }
                }
                else if (cameraY < this._lungeLastValleyY) {
                    this._lungeLastValleyY = cameraY;
                }
            }
            // If user has traveled distance without bounces, remind them
            var expectedBounces = Math.floor(this._stationProgress * 2); // ~2 lunges per meter
            if (expectedBounces > 3 && this._lungeBounceCount < expectedBounces * 0.3) {
                this.playFormReminder();
            }
        }
        isAIBusy() {
            if (this.aiCoach && !isNull(this.aiCoach)) {
                return this.aiCoach.isBusy === true;
            }
            return false;
        }
        playFormReminder() {
            var currentTime = getTime();
            if (currentTime - this._lastFormReminderTime < this.FORM_REMINDER_COOLDOWN)
                return;
            // Skip if AI is speaking/processing/recording
            if (this.isAIBusy()) {
                print('[FormDetect] Skipping form reminder - AI is busy');
                return;
            }
            this._lastFormReminderTime = currentTime;
            // Prefer AI coach voice for form reminders
            if (this.aiCoach && !isNull(this.aiCoach)) {
                var exerciseName = this._currentConfig?.name || 'exercise';
                this.aiCoach.speakFormReminder(exerciseName);
                print('[FormDetect] AI coach speaking form reminder for: ' + exerciseName);
                return;
            }
            // Fallback to SFX if AI coach not available
            if (this.formReminderSound && !isNull(this.formReminderSound)) {
                this.formReminderSound.play(1);
                print('[FormDetect] Playing form reminder SFX (fallback)');
            }
        }
        playGoodFormSound() {
            // Skip SFX if AI is speaking/processing/recording
            if (this.isAIBusy()) {
                print('[FormDetect] Skipping good form sound - AI is busy');
                return;
            }
            if (this.goodFormSound && !isNull(this.goodFormSound)) {
                this.goodFormSound.play(1);
            }
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
            // Hide SkiErg guides when station completes
            this.hideSkiergGuides();
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
            var totalMs = this.getRaceElapsedMsAt(getTime() * 1000);
            this._state = RaceState.FINISHED;
            // End HR session
            var hrStats = { avgBPM: 0, peakBPM: 0 };
            if (this.heartRateTracker) {
                hrStats = this.heartRateTracker.endSession();
            }
            // Clear running UI
            if (this.statusText)
                this.statusText.text = '';
            if (this.stationNameText)
                this.stationNameText.text = '';
            if (this.nextStationText)
                this.nextStationText.text = '';
            if (this.progressText)
                this.progressText.text = '';
            if (this.stationInfoText)
                this.stationInfoText.text = '';
            if (this.stationInfoBG)
                this.stationInfoBG.enabled = false;
            if (this.timerText)
                this.timerText.text = '';
            if (this.timerBG)
                this.timerBG.enabled = false;
            // Show finish panel
            this.showFinishPanel('FINISHED!', totalMs, hrStats, null);
            // Save to cloud
            this.saveRaceToCloud(totalMs, true, hrStats);
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
            var totalMs = this.getRaceElapsedMsAt(getTime() * 1000);
            this._state = RaceState.FINISHED;
            // Stop hand zone detection
            if (this.handZoneDetector) {
                this.handZoneDetector.stopDetection();
            }
            // Hide SkiErg guides
            this.hideSkiergGuides();
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
            // Build incomplete stations list
            var incompleteStations = [];
            if (course) {
                var totalStations = course.stationCount;
                var nextIdx = this._currentStationIndex;
                for (var k = nextIdx; k < totalStations; k++) {
                    var config = course.getStationConfig(k);
                    if (config) {
                        incompleteStations.push(config.name);
                    }
                }
            }
            // Clear running UI
            if (this.statusText)
                this.statusText.text = '';
            if (this.stationNameText)
                this.stationNameText.text = '';
            if (this.nextStationText)
                this.nextStationText.text = '';
            if (this.progressText)
                this.progressText.text = '';
            if (this.stationInfoText)
                this.stationInfoText.text = '';
            if (this.stationInfoBG)
                this.stationInfoBG.enabled = false;
            if (this.timerText)
                this.timerText.text = '';
            if (this.timerBG)
                this.timerBG.enabled = false;
            // Show finish panel
            this.showFinishPanel('STOPPED', totalMs, hrStats, incompleteStations);
            // Save to cloud (incomplete)
            this.saveRaceToCloud(totalMs, false, hrStats);
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
            if (this.progressText) {
                this.progressText.text = '';
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
            if (this.stationInfoBG && !this.stationInfoBG.enabled) {
                this.stationInfoBG.enabled = true;
            }
            if (this._currentConfig) {
                var nextName = this._currentConfig.name;
                // Next station text always shows next station
                if (this.nextStationText) {
                    this.nextStationText.text = 'Next: ' + nextName;
                }
                if (this._waitingForStartLineCross) {
                    if (this.stationInfoText) {
                        this.stationInfoText.getSceneObject().enabled = true;
                        this.stationInfoText.text = 'Cross the START line!';
                    }
                    if (this.progressText) {
                        this.progressText.text = '';
                    }
                    if (this.progressBar) {
                        this.progressBar.setProgress(0);
                    }
                    return;
                }
                // Hide stationInfoText during running (instruction not needed)
                if (this.stationInfoText) {
                    this.stationInfoText.getSceneObject().enabled = false;
                }
                // Progress text shows distance
                var runInfo = this._runDistance.toFixed(0) + 'm / ' + this._runTarget.toFixed(0) + 'm';
                var pct = Math.min(1, this._runDistance / Math.max(1, this._runTarget));
                if (this.progressText) {
                    this.progressText.text = runInfo;
                }
                if (this.progressBar) {
                    this.progressBar.setProgress(pct);
                }
            }
        }
        updateStationUI() {
            if (!this._currentConfig)
                return;
            if (this.stationInfoText && !this.stationInfoText.getSceneObject().enabled) {
                this.stationInfoText.getSceneObject().enabled = true;
            }
            if (this.stationInfoBG && !this.stationInfoBG.enabled) {
                this.stationInfoBG.enabled = true;
            }
            var mode = this._currentConfig.mode;
            var instruction = this._currentConfig.instruction;
            var progress = this._stationProgress;
            var target = this._stationRequirement;
            // Update next station text - show what comes after this station
            if (this.nextStationText) {
                var course = this.cm();
                var nextIdx = this._currentStationIndex + 1;
                if (course && nextIdx < course.stationCount) {
                    var nextConfig = course.getStationConfig(nextIdx);
                    if (nextConfig && nextConfig.runDistanceBefore > 0) {
                        this.nextStationText.text = 'Next: RUN';
                    }
                    else if (nextConfig) {
                        this.nextStationText.text = 'Next: ' + nextConfig.name;
                    }
                }
                else {
                    this.nextStationText.text = 'Next: FINISH';
                }
            }
            // Progress info (rep count, distance, time)
            var progressInfo = '';
            switch (mode) {
                case CourseManager_1.StationMode.TIMED:
                    var remaining = Math.max(0, target - progress);
                    progressInfo = remaining.toFixed(0) + 's remaining';
                    break;
                case CourseManager_1.StationMode.DISTANCE:
                    progressInfo = progress.toFixed(1) + 'm / ' + target + 'm';
                    break;
                case CourseManager_1.StationMode.ZONE_HIT:
                    progressInfo = Math.floor(progress) + ' / ' + target;
                    break;
                case CourseManager_1.StationMode.REPS:
                    progressInfo = Math.floor(progress) + ' / ' + target;
                    break;
            }
            // Set progress text
            if (this.progressText) {
                this.progressText.text = progressInfo;
            }
            // Set instruction in stationInfoText
            if (this.stationInfoText) {
                this.stationInfoText.text = instruction;
            }
            // Update progress bar
            var pct = Math.min(1, progress / Math.max(1, target));
            if (this.progressBar) {
                this.progressBar.setProgress(pct);
            }
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
        // ── Run Arrow Guide ────────────────────────────────────────────────────────
        startRunArrowGuide() {
            if (!this.runArrowGuide)
                return;
            var playerPos = this.getPlayerPosition();
            var playerForward = this.getPlayerForward();
            // Calculate target position: run distance ahead in forward direction
            var runDistanceCm = this._runTarget * 100; // Convert meters to cm
            var targetPos = new vec3(playerPos.x + playerForward.x * runDistanceCm, playerPos.y, playerPos.z + playerForward.z * runDistanceCm);
            this.runArrowGuide.startGuide(targetPos);
            print('[RaceStateMachine] Arrow guide started, target ' + this._runTarget + 'm ahead');
        }
        stopRunArrowGuide() {
            if (!this.runArrowGuide)
                return;
            this.runArrowGuide.stopGuide();
            print('[RaceStateMachine] Arrow guide stopped');
        }
        // ── Helpers ────────────────────────────────────────────────────────────────
        /** Find target sphere child in station prefab (for OVERHEAD_REACH stations) */
        findTargetSphere(station) {
            // Look for child with Physics Collider or specific name
            for (var i = 0; i < station.getChildrenCount(); i++) {
                var child = station.getChild(i);
                // Check if child has a collider (sphere target)
                var collider = child.getComponent('Physics.ColliderComponent');
                if (collider) {
                    print('[RaceStateMachine] Found target sphere: ' + child.name);
                    return child;
                }
                // Recursively check children
                var found = this.findTargetSphere(child);
                if (found)
                    return found;
            }
            return null;
        }
        calculateSplitDuration() {
            var elapsed = this.getRaceElapsedMsAt(getTime() * 1000);
            var prevTotal = 0;
            for (var i = 0; i < this._splitDurations.length; i++) {
                prevTotal += this._splitDurations[i];
            }
            return Math.max(0, elapsed - prevTotal);
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