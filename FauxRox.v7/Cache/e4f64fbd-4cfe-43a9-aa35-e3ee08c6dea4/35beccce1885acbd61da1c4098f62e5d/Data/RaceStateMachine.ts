// ============================================================================
// RaceStateMachine.ts — FauxRox Core Game Loop (HR Edition)
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// DYNAMIC follow-the-runner system with Heart Rate monitoring:
// - Stations spawn in front of player when run distance completes
// - Real-time heart rate display from BLE HR monitor
// - Camera-based distance tracking (no GPS)
// ============================================================================

import { StationMode, StationConfig, MotionType } from "./CourseManager";
import { HeartRateTracker, HRConnectionState, HRZone } from "./HeartRateTracker";
import { HandZoneDetector } from "./HandZoneDetector";
import { BLEConnectionUI } from "./BLEConnectionUI";
import { CloudManager, RaceRecord, SplitData } from "./CloudManager";
import { AICoach } from "./AICoach";
import { ProfileManager } from "./ProfileManager";
import { OnboardingUI } from "./OnboardingUI";
import { RunArrowGuide } from "./RunArrowGuide";

enum RaceState {
  IDLE        = 'IDLE',
  COUNTDOWN   = 'COUNTDOWN',
  RUNNING     = 'RUNNING',      // Running to reach distance target
  APPROACHING_STATION = 'APPROACHING_STATION',  // Walking to station gate
  STATION     = 'STATION',      // At workout station
  PAUSED      = 'PAUSED',
  FINISHED    = 'FINISHED',
}

@component
export class RaceStateMachine extends BaseScriptComponent {

  // ── References ────────────────────────────────────────────────────────────

  @input courseManagerScript: ScriptComponent;
  @input courseSetupScript: ScriptComponent;
  @input @allowUndefined heartRateTracker: HeartRateTracker;
  @input @allowUndefined bleConnectionUI: BLEConnectionUI;
  @input @allowUndefined heartRateHUD: SceneObject;  // Entire HR section - disabled if user says NO
  @input handZoneDetector: HandZoneDetector;
  @input camera: SceneObject;  // For player position and forward direction

  /** Arrow guide for run segments */
  @input @allowUndefined runArrowGuide: RunArrowGuide;

  /** Cloud manager for saving race data */
  @input @allowUndefined cloudManager: CloudManager;

  /** AI Coach reference - for checking if AI is speaking before playing SFX */
  @input @allowUndefined aiCoach: AICoach;

  // ── Onboarding References ───────────────────────────────────────────────

  /** Profile manager for user profile data */
  @input @allowUndefined profileManager: ProfileManager;

  /** Onboarding UI for first-launch profile setup */
  @input @allowUndefined onboardingUI: OnboardingUI;

  // ── UI Elements ───────────────────────────────────────────────────────────

  @input statusText: Text;
  @input timerText: Text;
  @input @allowUndefined timerBG: SceneObject;  // Parent of timerText - enable/disable this
  @input stationInfoText: Text;
  @input @allowUndefined countdownText: Text;   // Separate text for 3-2-1 countdown

  /** Countdown sound effects */
  @input @allowUndefined countdownBeepSound: AudioComponent;  // Plays ONCE at countdown start (SFX contains all beeps)
  @input @allowUndefined countdownGoSound: AudioComponent;    // Plays on GO!
  @input @allowUndefined instructionText: Text;
  @input @allowUndefined finishTunnelVfx: SceneObject;

  /** Title image (FauxRox logo) - fades out after display */
  @input @allowUndefined titleImage: Image;

  /** Heart rate display text */
  @input @allowUndefined heartRateText: Text;

  /** HR zone indicator text */
  @input @allowUndefined hrZoneText: Text;

  /** HR connection status text - shown before race starts */
  @input @allowUndefined hrStatusText: Text;

  /** HR connected icon (beating heart) - shown instead of text when connected */
  @input @allowUndefined hrConnectedIcon: SceneObject;

  /** Station name text - displays current station name during workout */
  @input @allowUndefined stationNameText: Text;

  /** Station info background - synced with stationInfoText visibility */
  @input @allowUndefined stationInfoBG: SceneObject;

  /** Next station text - displays upcoming station name */
  @input @allowUndefined nextStationText: Text;

  /** Progress text - displays distance or rep count */
  @input @allowUndefined progressText: Text;

  /** Visual progress bar (from Orthographic Camera package) */
  @input @allowUndefined progressBar: ScriptComponent;

  /** Start button object - hidden after race starts */
  @input @allowUndefined startButtonObject: SceneObject;

  /** SkiErg motion guide animations - enabled only during SkiErg station */
  @input @allowUndefined skiergGuides: SceneObject;

  // ── Form Feedback Audio ────────────────────────────────────────────────────

  /** Audio cue for form reminder ("Get lower!", etc.) */
  @input @allowUndefined formReminderSound: AudioComponent;

  /** Audio cue for good form acknowledgment */
  @input @allowUndefined goodFormSound: AudioComponent;


  // ── Finish Panel UI ─────────────────────────────────────────────────────────

  /** Finish panel container - shown on race finish/stop */
  @input @allowUndefined finishPanel: SceneObject;

  /** Finish status text - "FINISHED!" or "STOPPED" */
  @input @allowUndefined finishStatusText: Text;

  /** Finish total time text - large, prominent */
  @input @allowUndefined finishTotalTimeText: Text;

  /** PB Badge container - only shown when new PB achieved */
  @input @allowUndefined finishPBBadge: SceneObject;

  /** PB difference text - e.g. "-0:32" */
  @input @allowUndefined finishPBText: Text;

  /** Finish average HR text */
  @input @allowUndefined finishAvgHRText: Text;

  /** Finish peak HR text */
  @input @allowUndefined finishPeakHRText: Text;

  /** Split Insights - Fastest station text */
  @input @allowUndefined finishFastestText: Text;

  /** Split Insights - Needs work station text */
  @input @allowUndefined finishNeedsWorkText: Text;

  /** Finish splits text - displays all splits (used by VIEW SPLITS) */
  @input @allowUndefined finishSplitsText: Text;

  /** Splits detail panel - shown when VIEW SPLITS pressed */
  @input @allowUndefined finishSplitsPanel: SceneObject;

  /** Race Again button - primary action */
  @input @allowUndefined finishRaceAgainButton: ScriptComponent;

  /** View Splits button - secondary action */
  @input @allowUndefined finishViewSplitsButton: ScriptComponent;

  /** Reset button on finish panel (legacy, can use finishRaceAgainButton instead) */
  @input @allowUndefined finishResetButton: ScriptComponent;

  // ── Settings ──────────────────────────────────────────────────────────────

  @input countdownSeconds: number = 3;

  // ── Accessors ─────────────────────────────────────────────────────────────

  private cm(): any { return this.courseManagerScript as any; }
  private setup(): any { return this.courseSetupScript as any; }
  private camTransform: Transform = null;

  // ── State ──────────────────────────────────────────────────────────────────

  private _state: RaceState = RaceState.IDLE;
  private _raceStartTime: number = 0;
  private _stationStartTime: number = 0;
  private _currentStationIndex: number = -1;
  private _countdownRemaining: number = 0;
  private _pausedFromState: RaceState = RaceState.RUNNING;
  private _hrStatusMessage: string = '';
  private _hrConnected: boolean = false;

  // Pause tracking
  private _totalPausedTime: number = 0;      // Total ms spent paused
  private _pauseStartTime: number = 0;        // When current pause started

  // Split tracking
  private _splitNames: string[] = [];
  private _splitDurations: number[] = [];
  private _splitAvgHR: number[] = [];  // Average HR per split
  private _splitPeakHR: number[] = []; // Peak HR per split

  // Current station progress
  private _currentConfig: StationConfig = null;
  private _stationProgress: number = 0;
  private _stationRequirement: number = 0;

  // Run tracking (camera-based)
  private _runTarget: number = 0;
  private _runDistance: number = 0;
  private _lastPlayerPos: vec3 = null;

  // START line crossing detection
  private _waitingForStartLineCross: boolean = false;
  private _startLinePos: vec3 = null;
  private _startLineForward: vec3 = null;

  // Station gate crossing detection (APPROACHING_STATION state)
  private _gatePos: vec3 = null;
  private _gateForward: vec3 = null;
  private _previousGateDot: number = 1;  // For crossing detection (start positive = behind gate)
  private readonly GATE_HALF_WIDTH: number = 100;  // 100cm = half gate width
  private readonly PROXIMITY_FALLBACK: number = 70; // 70cm fallback distance

  // Title fade out
  private _titleFading: boolean = false;
  private _titleAlpha: number = 1.0;
  private readonly TITLE_DISPLAY_TIME: number = 3.0;
  private readonly TITLE_FADE_DURATION: number = 0.5;

  // Personal Best tracking for end screen
  private _cachedPersonalBest: RaceRecord = null;
  private _isNewPB: boolean = false;

  // StatusText zoom animation
  private _statusAnimating: boolean = false;
  private _statusAnimTime: number = 0;
  private _statusAnimPhase: 'in' | 'out' = 'in';
  private _statusOriginalScale: vec3 = null;
  private readonly STATUS_ZOOM_DURATION: number = 0.15;
  private readonly STATUS_ZOOM_SCALE: number = 1.3;

  // SkiErg guide fadeout
  private _skiergGuidesActive: boolean = false;
  private _skiergGuidesFading: boolean = false;

  // ── Form Detection State ────────────────────────────────────────────────────

  // Camera Y tracking for form detection
  private _cameraYHistory: number[] = [];
  private readonly CAMERA_Y_HISTORY_SIZE: number = 30;  // ~0.5s at 60fps

  // Burpee form state
  private _burpeeState: 'waiting_drop' | 'waiting_rise' | 'waiting_jump' = 'waiting_drop';
  private _burpeeDropY: number = 0;
  private _burpeeGoodReps: number = 0;
  private _burpeeJumpStartPos: vec3 = null;  // Position when rise completes
  private _burpeeJumpForward: vec3 = null;   // Forward direction at jump start
  private readonly BURPEE_JUMP_DISTANCE: number = 10;  // 50cm forward = valid jump
  private _burpeeLastFeedbackTime: number = 0;
  private _burpeeStationStartTime: number = -1;  // When burpee station started (-1 = not started)
  private readonly BURPEE_FEEDBACK_COOLDOWN: number = 2.0;  // seconds between UI feedback
  private readonly BURPEE_FIRST_FEEDBACK_DELAY: number = 3.0;  // Wait before first feedback

  // Lunge form state
  private _lungeBounceCount: number = 0;
  private _lungeLastPeakY: number = 0;
  private _lungeLastValleyY: number = 0;
  private _lungeDirection: 'rising' | 'falling' = 'rising';

  // Form feedback timing
  private _lastFormReminderTime: number = 0;
  private readonly FORM_REMINDER_COOLDOWN: number = 10.0;  // seconds between AI voice reminders (longer = less spam)

  // Thresholds (in cm)
  private readonly BURPEE_DROP_THRESHOLD: number = 20;   // Head must drop 20cm
  private readonly LUNGE_BOUNCE_THRESHOLD: number = 10;  // 10cm bounce = lunge detected
  private _skiergGuidesAlpha: number = 1.0;
  private readonly SKIERG_GUIDE_FADE_DURATION: number = 0.5;

  // Heart rate tracking for current split
  private _splitHRReadings: number[] = [];
  private _splitPeakBPM: number = 0;

  // Countdown zoom punch animation
  private _countdownAnimating: boolean = false;
  private _countdownAnimTime: number = 0;
  private _countdownOriginalScale: vec3 = null;
  private _lastCountdownNum: number = -1;
  private readonly COUNTDOWN_ZOOM_DURATION: number = 0.3;
  private readonly COUNTDOWN_ZOOM_SCALE: number = 1.5;
  private readonly COUNTDOWN_GO_ZOOM_SCALE: number = 0.8;  // GO! için daha küçük

  // Station name zoom punch animation
  private _stationNameAnimating: boolean = false;
  private _stationNameAnimTime: number = 0;
  private _stationNameOriginalScale: vec3 = null;
  private readonly STATION_NAME_ZOOM_DURATION: number = 0.3;
  private readonly STATION_NAME_ZOOM_SCALE: number = 1.4;


  // ── Public Getters ─────────────────────────────────────────────────────────

  get state(): string { return this._state; }
  get currentStationIndex(): number { return this._currentStationIndex; }
  get currentConfig(): StationConfig | null { return this._currentConfig; }
  get splits(): { name: string; duration: number }[] {
    const result: { name: string; duration: number }[] = [];
    for (let i = 0; i < this._splitNames.length; i++) {
      result.push({ name: this._splitNames[i], duration: this._splitDurations[i] });
    }
    return result;
  }
  get elapsedMs(): number {
    return this.getRaceElapsedMsAt(getTime() * 1000);
  }

  // ── Time Calculation Helper ─────────────────────────────────────────────────
  // Single source of truth for all elapsed time calculations (pause-aware)

  private getRaceElapsedMsAt(now: number): number {
    if (this._raceStartTime === 0) return 0;

    var paused = this._totalPausedTime;

    // Include active pause duration (not yet added to _totalPausedTime)
    if (this._state === RaceState.PAUSED && this._pauseStartTime > 0) {
      paused += now - this._pauseStartTime;
    }

    return Math.max(0, now - this._raceStartTime - paused);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onAwake(): void {
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

    // Hide finish sub-elements initially
    if (this.finishPBBadge) {
      this.finishPBBadge.enabled = false;
    }
    if (this.finishSplitsPanel) {
      this.finishSplitsPanel.enabled = false;
    }

    // Hide HR connected icon initially
    if (this.hrConnectedIcon) {
      this.hrConnectedIcon.enabled = false;
    }

    // Bind finish buttons
    this.createEvent('OnStartEvent').bind(() => {
      this.bindFinishButtons();
    });

    this.setUIIdle();
    this.showTitle();
    print('[RaceStateMachine] Init — IDLE (HR Edition)');
  }

  private bindFinishButtons(): void {
    // Legacy reset button
    if (this.finishResetButton) {
      var btn = this.finishResetButton as any;
      if (btn.onTriggerUp && btn.onTriggerUp.add) {
        btn.onTriggerUp.add(() => {
          this.resetRace();
        });
        print('[RaceStateMachine] Finish reset button bound');
      }
    }

    // Race Again button (primary action)
    if (this.finishRaceAgainButton) {
      var raceAgainBtn = this.finishRaceAgainButton as any;
      if (raceAgainBtn.onTriggerUp && raceAgainBtn.onTriggerUp.add) {
        raceAgainBtn.onTriggerUp.add(() => {
          this.resetRace();
        });
        print('[RaceStateMachine] Race Again button bound');
      }
    }

    // View Splits button (toggle splits panel)
    if (this.finishViewSplitsButton) {
      var viewSplitsBtn = this.finishViewSplitsButton as any;
      if (viewSplitsBtn.onTriggerUp && viewSplitsBtn.onTriggerUp.add) {
        viewSplitsBtn.onTriggerUp.add(() => {
          this.toggleSplitsPanel();
        });
        print('[RaceStateMachine] View Splits button bound');
      }
    }
  }

  private toggleSplitsPanel(): void {
    if (this.finishSplitsPanel) {
      this.finishSplitsPanel.enabled = !this.finishSplitsPanel.enabled;
      print('[RaceStateMachine] Splits panel: ' + (this.finishSplitsPanel.enabled ? 'shown' : 'hidden'));
    }
  }

  // ── Heart Rate Monitor Setup ──────────────────────────────────────────────

  private initHeartRateMonitor(): void {
    // If no HeartRateTracker or BLEConnectionUI, skip to floor calibration
    if (isNull(this.heartRateTracker) || isNull(this.bleConnectionUI)) {
      print('[RaceStateMachine] No HR setup — skipping to floor calibration');
      this.onBLEFlowComplete();
      return;
    }

    // Register BPM update callback
    this.heartRateTracker.onBPMUpdate((bpm: number, zone: HRZone) => {
      this.onHeartRateUpdate(bpm, zone);
    });

    // Show BLE connection dialog
    print('[RaceStateMachine] Showing BLE connection dialog');
    this.bleConnectionUI.show((connected: boolean) => {
      if (connected) {
        print('[RaceStateMachine] HR Monitor connected');
        this._hrStatusMessage = '';  // No text, using icon
        this._hrConnected = true;
      } else {
        print('[RaceStateMachine] HR Monitor disabled by user');
        this._hrStatusMessage = '';
        this._hrConnected = false;
      }

      // BLE flow complete — start floor calibration
      this.onBLEFlowComplete();
    });
  }

  private onBLEFlowComplete(): void {
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
    } else {
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
    } else {
      print('[RaceStateMachine] WARNING: CourseSetup not available for calibration');
    }
  }

  // ── Heart Pulse Animation ────────────────────────────────────────────────

  private _heartPulseActive: boolean = false;
  private _heartOriginalScale: vec3 = null;
  private _heartPulseTime: number = 0;
  private readonly HEART_PULSE_SPEED: number = 1.2;  // Pulses per second (resting HR feel)
  private readonly HEART_PULSE_SCALE: number = 0.15;

  private startHeartPulse(): void {
    if (!this.hrConnectedIcon) return;

    this._heartOriginalScale = this.hrConnectedIcon.getTransform().getLocalScale();
    this._heartPulseActive = true;
    this._heartPulseTime = 0;
  }

  private stopHeartPulse(): void {
    this._heartPulseActive = false;
    if (this.hrConnectedIcon && this._heartOriginalScale) {
      this.hrConnectedIcon.getTransform().setLocalScale(this._heartOriginalScale);
    }
  }

  private updateHeartPulse(dt: number): void {
    if (!this._heartPulseActive || !this.hrConnectedIcon || !this._heartOriginalScale) return;

    this._heartPulseTime += dt;

    // Double-beat pattern like real heart
    var t = this._heartPulseTime * this.HEART_PULSE_SPEED * Math.PI * 2;
    var beat1 = Math.max(0, Math.sin(t));
    var beat2 = Math.max(0, Math.sin(t + 0.5));
    var pulse = (beat1 + beat2 * 0.6) * this.HEART_PULSE_SCALE;

    var scale = 1.0 + pulse;
    this.hrConnectedIcon.getTransform().setLocalScale(this._heartOriginalScale.uniformScale(scale));
  }

  private onHeartRateUpdate(bpm: number, _zone: HRZone): void {
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

  private showTitle(): void {
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
    (fadeDelay as DelayedCallbackEvent).reset(this.TITLE_DISPLAY_TIME);
  }

  private updateTitleFade(dt: number): void {
    if (!this._titleFading || !this.titleImage) return;

    this._titleAlpha -= dt / this.TITLE_FADE_DURATION;

    if (this._titleAlpha <= 0) {
      this._titleAlpha = 0;
      this._titleFading = false;
      this.titleImage.enabled = false;
      this.onTitleFadeComplete();
    }

    this.setTitleAlpha(this._titleAlpha);
  }

  private onTitleFadeComplete(): void {
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
  private needsOnboarding(): boolean {
    if (!this.profileManager || !this.onboardingUI) {
      return false; // No ProfileManager/OnboardingUI = skip
    }
    return true; // Always show, previous values will be pre-filled
  }

  /**
   * Show onboarding UI flow
   */
  private showOnboarding(): void {
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
    this.onboardingUI.show(snapUserName, (profile: any) => {
      this.onOnboardingComplete(profile);
    });
  }

  /**
   * Called when onboarding flow completes
   */
  private onOnboardingComplete(profile: any): void {
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
  private continueAfterOnboarding(): void {
    print('[RaceStateMachine] Continuing to BLE flow');

    // Start BLE connection flow (will trigger floor calibration when complete)
    this.initHeartRateMonitor();
  }

  /**
   * Get ProfileManager reference (for AI Coach and other systems)
   */
  getProfileManager(): ProfileManager | null {
    return this.profileManager;
  }

  private setTitleAlpha(alpha: number): void {
    if (!this.titleImage) return;
    var color = this.titleImage.mainPass.baseColor;
    this.titleImage.mainPass.baseColor = new vec4(color.r, color.g, color.b, alpha);
  }

  // ── StatusText Zoom Animation ─────────────────────────────────────────────

  private triggerStatusZoom(): void {
    if (!this.statusText) return;

    if (this._statusOriginalScale === null) {
      this._statusOriginalScale = this.statusText.getSceneObject().getTransform().getLocalScale();
    }

    this._statusAnimating = true;
    this._statusAnimTime = 0;
    this._statusAnimPhase = 'in';
  }

  private updateStatusZoom(dt: number): void {
    if (!this._statusAnimating || !this.statusText) return;

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
    } else {
      var t = Math.min(1, this._statusAnimTime / this.STATUS_ZOOM_DURATION);
      var scale = this.STATUS_ZOOM_SCALE - (this.STATUS_ZOOM_SCALE - 1) * t;
      transform.setLocalScale(this._statusOriginalScale.uniformScale(scale));

      if (t >= 1) {
        transform.setLocalScale(this._statusOriginalScale);
        this._statusAnimating = false;
      }
    }
  }

  private updateSkiergGuidesFade(dt: number): void {
    if (!this._skiergGuidesFading || !this.skiergGuides) return;

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
      var image = child.getComponent('Component.Image') as Image;
      if (image) {
        var color = image.mainPass.baseColor;
        image.mainPass.baseColor = new vec4(color.r, color.g, color.b, this._skiergGuidesAlpha);
      }
    }
  }

  private startSkiergGuidesFadeout(): void {
    if (!this.skiergGuides || !this._skiergGuidesActive) return;

    this._skiergGuidesFading = true;
    print('[RaceStateMachine] SkiErg guides fading out');
  }

  private showSkiergGuides(): void {
    if (!this.skiergGuides) return;

    this._skiergGuidesActive = true;
    this._skiergGuidesFading = false;
    this._skiergGuidesAlpha = 1.0;
    this.skiergGuides.enabled = true;

    // Reset alpha to 1 for all children
    for (var i = 0; i < this.skiergGuides.getChildrenCount(); i++) {
      var child = this.skiergGuides.getChild(i);
      var image = child.getComponent('Component.Image') as Image;
      if (image) {
        var color = image.mainPass.baseColor;
        image.mainPass.baseColor = new vec4(color.r, color.g, color.b, 1.0);
      }
    }

    print('[RaceStateMachine] SkiErg guides shown');
  }

  private hideSkiergGuides(): void {
    if (!this.skiergGuides) return;

    this._skiergGuidesActive = false;
    this._skiergGuidesFading = false;
    this.skiergGuides.enabled = false;
  }

  // ── Finish Panel ────────────────────────────────────────────────────────────

  private showFinishPanel(status: string, totalMs: number, hrStats: { avgBPM: number, peakBPM: number }, incompleteStations: string[]): void {
    // Show the panel
    if (this.finishPanel) {
      this.finishPanel.enabled = true;
    }

    // Hide splits panel initially (shown via VIEW SPLITS button)
    if (this.finishSplitsPanel) {
      this.finishSplitsPanel.enabled = false;
    }

    // Status text - "FINISHED" or "STOPPED"
    if (this.finishStatusText) {
      this.finishStatusText.text = status;
    }

    // Total time - large, prominent (just the time, no label)
    if (this.finishTotalTimeText) {
      this.finishTotalTimeText.text = this.formatTime(totalMs);
    }

    // HR stats - compact format for the two boxes
    if (this.finishAvgHRText) {
      this.finishAvgHRText.text = hrStats.avgBPM > 0 ? hrStats.avgBPM.toString() : '--';
    }
    if (this.finishPeakHRText) {
      this.finishPeakHRText.text = hrStats.peakBPM > 0 ? hrStats.peakBPM.toString() : '--';
    }

    // Calculate and show split insights
    this.populateSplitInsights();

    // Populate detailed splits for VIEW SPLITS panel
    this.populateFinishSplits(incompleteStations);

    // Check for Personal Best (async)
    this.checkAndShowPB(totalMs);
  }

  /**
   * Calculate and display split insights (Fastest / Needs Work)
   */
  private populateSplitInsights(): void {
    if (this._splitNames.length === 0) {
      if (this.finishFastestText) this.finishFastestText.text = '';
      if (this.finishNeedsWorkText) this.finishNeedsWorkText.text = '';
      return;
    }

    // Find fastest and slowest splits (excluding RUN segments for fair comparison)
    var fastestIdx = -1;
    var slowestIdx = -1;
    var fastestTime = Number.MAX_VALUE;
    var slowestTime = 0;

    for (var i = 0; i < this._splitNames.length; i++) {
      var name = this._splitNames[i];
      var duration = this._splitDurations[i];

      // Skip RUN segments - only compare workout stations
      if (name.toLowerCase().indexOf('run') === 0) continue;

      if (duration < fastestTime) {
        fastestTime = duration;
        fastestIdx = i;
      }
      if (duration > slowestTime) {
        slowestTime = duration;
        slowestIdx = i;
      }
    }

    // Fastest split
    if (this.finishFastestText) {
      if (fastestIdx >= 0) {
        var fastName = this._splitNames[fastestIdx].toUpperCase();
        var fastTimeStr = this.formatTimeSplit(this._splitDurations[fastestIdx]);
        this.finishFastestText.text = 'Fastest:  ' + fastName + '  ' + fastTimeStr;
      } else {
        this.finishFastestText.text = '';
      }
    }

    // Needs work (slowest split)
    if (this.finishNeedsWorkText) {
      if (slowestIdx >= 0 && slowestIdx !== fastestIdx) {
        var slowName = this._splitNames[slowestIdx].toUpperCase();
        // Calculate how much slower than fastest
        var diff = this._splitDurations[slowestIdx] - fastestTime;
        var diffStr = '+' + this.formatTimeSplit(diff);
        this.finishNeedsWorkText.text = 'Needs work:  ' + slowName + '  ' + diffStr;
      } else {
        this.finishNeedsWorkText.text = '';
      }
    }
  }

  /**
   * Format split time as M:SS (e.g., "0:41")
   */
  private formatTimeSplit(ms: number): string {
    var totalSec = Math.floor(ms / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    return min + ':' + (sec < 10 ? '0' : '') + sec;
  }

  /**
   * Check Personal Best and show PB badge if new record
   */
  private checkAndShowPB(currentTotalMs: number): void {
    // Hide PB badge initially
    if (this.finishPBBadge) {
      this.finishPBBadge.enabled = false;
    }

    // Need CloudManager to check PB
    if (!this.cloudManager) {
      print('[RaceStateMachine] No CloudManager - skipping PB check');
      return;
    }

    // Fetch personal best async
    var cloud = this.cloudManager as any;
    if (cloud.getPersonalBest) {
      cloud.getPersonalBest().then((pb: RaceRecord) => {
        if (!pb) {
          // First completed race - this IS the PB!
          this._isNewPB = true;
          this._cachedPersonalBest = null;
          this.showPBBadge(0, true); // First race, no comparison
          print('[RaceStateMachine] First race completed - NEW PB!');
          return;
        }

        this._cachedPersonalBest = pb;
        var diff = currentTotalMs - pb.totalTime;

        if (diff < 0) {
          // New PB!
          this._isNewPB = true;
          this.showPBBadge(diff, false);
          print('[RaceStateMachine] NEW PB! Beat previous by ' + Math.abs(diff) + 'ms');
        } else {
          // Not a PB
          this._isNewPB = false;
          print('[RaceStateMachine] Not a PB. Previous best: ' + pb.totalTime + 'ms');
        }
      }).catch((e: any) => {
        print('[RaceStateMachine] PB check error: ' + e);
      });
    }
  }

  /**
   * Show PB badge with difference text
   */
  private showPBBadge(diffMs: number, isFirstRace: boolean): void {
    if (this.finishPBBadge) {
      this.finishPBBadge.enabled = true;
    }

    if (this.finishPBText) {
      if (isFirstRace) {
        this.finishPBText.text = 'NEW PB';
      } else {
        // Format difference as -M:SS (e.g., "-0:32")
        var absDiff = Math.abs(diffMs);
        var diffStr = '-' + this.formatTimeSplit(absDiff);
        this.finishPBText.text = 'NEW PB  ' + diffStr;
      }
    }
  }

  /**
   * Populate detailed splits list (for VIEW SPLITS panel)
   */
  private populateFinishSplits(incompleteStations: string[]): void {
    if (!this.finishSplitsText) return;

    var lines = '';

    // Add completed splits with ✓
    for (var j = 0; j < this._splitNames.length; j++) {
      var dur = this.formatTimeSplit(this._splitDurations[j]);
      var avgHR = this._splitAvgHR[j] > 0 ? '  [' + this._splitAvgHR[j] + ' BPM]' : '';
      lines += '✓ ' + this._splitNames[j] + ':  ' + dur + avgHR + '\n';
    }

    // Add incomplete stations with ○
    if (incompleteStations && incompleteStations.length > 0) {
      for (var k = 0; k < incompleteStations.length; k++) {
        lines += '○ ' + incompleteStations[k] + '\n';
      }
    }

    this.finishSplitsText.text = lines;
  }

  private hideFinishPanel(): void {
    if (this.finishPanel) {
      this.finishPanel.enabled = false;
    }
    if (this.finishPBBadge) {
      this.finishPBBadge.enabled = false;
    }
    if (this.finishSplitsPanel) {
      this.finishSplitsPanel.enabled = false;
    }
    if (this.finishSplitsText) {
      this.finishSplitsText.text = '';
    }

    // Reset PB state
    this._isNewPB = false;
    this._cachedPersonalBest = null;
  }

  // ── Cloud Save ──────────────────────────────────────────────────────────────

  private saveRaceToCloud(totalMs: number, completed: boolean, hrStats: { avgBPM: number, peakBPM: number }): void {
    if (!this.cloudManager) {
      print('[RaceStateMachine] Cloud save skipped - no CloudManager');
      return;
    }

    // Check if guest mode (skip cloud save)
    var isGuest = this.profileManager ? this.profileManager.isGuest() : false;

    // Build splits data
    var splits: SplitData[] = [];
    for (var i = 0; i < this._splitNames.length; i++) {
      splits.push({
        name: this._splitNames[i],
        duration: this._splitDurations[i],
        avgHR: this._splitAvgHR[i] || 0
      });
    }

    var record: RaceRecord = {
      totalTime: totalMs,
      completed: completed,
      splits: splits,
      avgHR: hrStats.avgBPM,
      peakHR: hrStats.peakBPM
    };

    this.cloudManager.saveRace(record, isGuest).then((success) => {
      if (success) {
        print('[RaceStateMachine] Race saved to cloud');
      } else {
        print('[RaceStateMachine] Cloud save failed');
      }
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  startRace(): void {
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

  togglePause(): void {
    if (this._state === RaceState.RUNNING || this._state === RaceState.STATION || this._state === RaceState.APPROACHING_STATION) {
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

    } else if (this._state === RaceState.PAUSED) {
      // RESUME
      var pauseDuration = (getTime() * 1000) - this._pauseStartTime;
      this._totalPausedTime += pauseDuration;
      this._pauseStartTime = 0;
      this._state = this._pausedFromState;

      // Reset camera position tracking to avoid distance jump
      this._lastPlayerPos = null;

      // Resume hand zone detection if we were in STATION
      if (this._pausedFromState === RaceState.STATION && this.handZoneDetector) {
        this.handZoneDetector.resumeDetection(
          (repCount) => {
            this._stationProgress = repCount;
            this.updateStationUI();
          }
        );
      }

      // Restore UI based on which state we're resuming to
      if (this._pausedFromState === RaceState.RUNNING) {
        if (this.stationNameText) {
          this.stationNameText.text = 'RUN';
        }
        if (this.statusText) {
          this.statusText.text = '';
        }
      } else if (this._pausedFromState === RaceState.APPROACHING_STATION && this._currentConfig) {
        if (this.stationNameText) {
          this.stationNameText.text = this._currentConfig.name;
        }
        if (this.statusText) {
          this.statusText.text = this._currentConfig.mode === StationMode.DISTANCE ? 'Cross station line' : 'Enter station';
        }
      } else if (this._pausedFromState === RaceState.STATION && this._currentConfig) {
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

  resetRace(): void {
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
    this._gatePos = null;
    this._gateForward = null;
    this._previousGateDot = 1;
    this._splitHRReadings = [];
    this._splitPeakBPM = 0;

    // Reset form detection state
    this.resetFormState();

    if (this.finishTunnelVfx) this.finishTunnelVfx.enabled = false;

    // Reset progress bar
    if (this.progressBar) {
      (this.progressBar as any).setProgress(0);
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
  scanForHRMonitor(): void {
    if (this.heartRateTracker && !this.heartRateTracker.isConnected) {
      this.heartRateTracker.startScan();
    }
  }

  private respawnStartLine(): void {
    var course = this.cm();
    if (!course) return;

    var playerPos = this.getPlayerPosition();
    var playerForward = this.getPlayerForward();
    course.spawnStationInFrontOfPlayer(0, playerPos, playerForward);
    print('[RaceStateMachine] START line respawned');
  }

  // ── Update Loop ────────────────────────────────────────────────────────────

  private onUpdate(): void {
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

    if (this._state === RaceState.APPROACHING_STATION) {
      this.updateTimerUI();
      this.checkStationGateCrossing();
      this.updateApproachingUI();
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

  private updateCountdown(dt: number): void {
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
      (hideDelay as DelayedCallbackEvent).reset(0.5);

      // Show station info BG after countdown
      if (this.stationInfoBG) {
        this.stationInfoBG.enabled = true;
      }
      this.startFirstStation();
      print('[RaceStateMachine] GO!');
    }
  }

  // ── Countdown Animation ─────────────────────────────────────────────────────

  private triggerCountdownZoom(): void {
    var target = this.countdownText || this.statusText;
    if (!target) return;

    if (this._countdownOriginalScale === null) {
      this._countdownOriginalScale = target.getSceneObject().getTransform().getLocalScale();
    }

    // GO! için daha küçük scale kullan
    var zoomScale = this._lastCountdownNum <= 0 ? this.COUNTDOWN_GO_ZOOM_SCALE : this.COUNTDOWN_ZOOM_SCALE;

    // Start big, animate to normal
    var transform = target.getSceneObject().getTransform();
    transform.setLocalScale(this._countdownOriginalScale.uniformScale(zoomScale));

    this._countdownAnimating = true;
    this._countdownAnimTime = 0;
  }

  private updateCountdownZoom(dt: number): void {
    if (!this._countdownAnimating) return;

    var target = this.countdownText || this.statusText;
    if (!target || this._countdownOriginalScale === null) return;

    this._countdownAnimTime += dt;
    var t = Math.min(1, this._countdownAnimTime / this.COUNTDOWN_ZOOM_DURATION);

    // Ease out - starts fast, slows down
    var eased = 1 - Math.pow(1 - t, 3);

    // GO! için daha küçük scale kullan
    var zoomScale = this._lastCountdownNum <= 0 ? this.COUNTDOWN_GO_ZOOM_SCALE : this.COUNTDOWN_ZOOM_SCALE;

    // Interpolate from zoom scale to 1.0
    var scale = zoomScale - (zoomScale - 1) * eased;
    var transform = target.getSceneObject().getTransform();
    transform.setLocalScale(this._countdownOriginalScale.uniformScale(scale));

    if (t >= 1) {
      transform.setLocalScale(this._countdownOriginalScale);
      this._countdownAnimating = false;
    }
  }

  private playCountdownBeep(): void {
    if (this.countdownBeepSound && !isNull(this.countdownBeepSound)) {
      this.countdownBeepSound.play(1);
    }
  }

  private playCountdownGo(): void {
    if (this.countdownGoSound && !isNull(this.countdownGoSound)) {
      this.countdownGoSound.play(1);
    }
  }

  // ── Station Name Zoom Animation ─────────────────────────────────────────────

  private triggerStationNameZoom(): void {
    if (!this.stationNameText) return;

    if (this._stationNameOriginalScale === null) {
      this._stationNameOriginalScale = this.stationNameText.getSceneObject().getTransform().getLocalScale();
    }

    // Start big, animate to normal
    var transform = this.stationNameText.getSceneObject().getTransform();
    transform.setLocalScale(this._stationNameOriginalScale.uniformScale(this.STATION_NAME_ZOOM_SCALE));

    this._stationNameAnimating = true;
    this._stationNameAnimTime = 0;
  }

  private updateStationNameZoom(dt: number): void {
    if (!this._stationNameAnimating || !this.stationNameText) return;

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

  private startFirstStation(): void {
    var course = this.cm();
    if (!course) return;

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
    } else {
      course.fadeOutAndDestroy(() => {
        this.spawnStationAndApproach();
      });
    }
  }

  private onStartLineCrossed(): void {
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

  private checkStartLineCrossing(): void {
    if (!this._startLinePos || !this._startLineForward) {
      this.onStartLineCrossed();
      return;
    }

    var playerPos = this.getPlayerPosition();

    var toPlayer = new vec3(
      playerPos.x - this._startLinePos.x,
      0,
      playerPos.z - this._startLinePos.z
    );

    var dot = toPlayer.x * this._startLineForward.x + toPlayer.z * this._startLineForward.z;

    if (dot < 0) {
      this.onStartLineCrossed();
    }
  }

  private checkStationGateCrossing(): void {
    if (!this._gatePos || !this._gateForward) {
      this.onStationGateCrossed();
      return;
    }

    var playerPos = this.getPlayerPosition();

    // Vector from gate to player (horizontal only)
    var toPlayer = new vec3(
      playerPos.x - this._gatePos.x,
      0,
      playerPos.z - this._gatePos.z
    );

    // Current dot product (positive = in front of gate, negative = behind/past)
    var currentDot = toPlayer.x * this._gateForward.x + toPlayer.z * this._gateForward.z;

    // Lateral distance (perpendicular to gate forward)
    var gateRight = new vec3(-this._gateForward.z, 0, this._gateForward.x);
    var lateralDist = Math.abs(toPlayer.x * gateRight.x + toPlayer.z * gateRight.z);

    // PRIMARY: Plane crossing within gate width
    var crossedPlane = this._previousGateDot > 0 && currentDot <= 0;
    var withinGateWidth = lateralDist < this.GATE_HALF_WIDTH;

    if (crossedPlane && withinGateWidth) {
      print('[RaceStateMachine] Gate crossed via plane detection');
      this.onStationGateCrossed();
      return;
    }

    // FALLBACK: Very close proximity (safety net)
    var distance = Math.sqrt(toPlayer.x * toPlayer.x + toPlayer.z * toPlayer.z);
    if (distance < this.PROXIMITY_FALLBACK) {
      print('[RaceStateMachine] Gate crossed via proximity fallback (' + distance.toFixed(0) + 'cm)');
      this.onStationGateCrossed();
      return;
    }

    // Update previous dot for next frame
    this._previousGateDot = currentDot;
  }

  private onStationGateCrossed(): void {
    print('[RaceStateMachine] Station gate crossed: ' + this._currentConfig.name);

    this._gatePos = null;
    this._gateForward = null;
    this._previousGateDot = 1;
    this._lastPlayerPos = null;

    // Now enter station mode
    this.enterStationMode();
  }

  private updateApproachingUI(): void {
    if (this.statusText) {
      // Show appropriate message based on station type
      if (this._currentConfig && this._currentConfig.mode === StationMode.DISTANCE) {
        this.statusText.text = 'Cross station line';
      } else {
        this.statusText.text = 'Enter station';
      }
    }
    if (this.stationNameText) {
      this.stationNameText.text = this._currentConfig ? this._currentConfig.name : '';
    }
    if (this.progressText) {
      this.progressText.text = '';
    }
  }

  private prepareForNextStation(): void {
    var course = this.cm();
    if (!course) return;

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
    } else {
      this.spawnStationAndApproach();
    }
  }

  private onRunDistanceComplete(): void {
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

    // Spawn station and wait for gate crossing
    this.spawnStationAndApproach();
  }

  private spawnStationAndApproach(): void {
    var course = this.cm();
    if (!course) return;

    var playerPos = this.getPlayerPosition();
    var playerForward = this.getPlayerForward();

    var spawnReferencePos = new vec3(
      playerPos.x + playerForward.x * 200,
      playerPos.y,
      playerPos.z + playerForward.z * 200
    );

    course.spawnStationInFrontOfPlayer(this._currentStationIndex, spawnReferencePos, playerForward);

    // Only use APPROACHING_STATION for DISTANCE mode (sled push, etc.)
    // Rep-based stations (ZONE_HIT, REPS, TIMED) enter immediately
    if (this._currentConfig.mode !== StationMode.DISTANCE) {
      this.enterStationMode();
      return;
    }

    // Set up gate plane for crossing detection (DISTANCE mode only)
    var activeStation = course.getActiveStation();
    if (activeStation) {
      this._gatePos = activeStation.getTransform().getWorldPosition();
      var fwd = activeStation.getTransform().forward;
      this._gateForward = new vec3(fwd.x, 0, fwd.z).normalize();
      this._previousGateDot = 1;  // Start positive (behind gate)

      this._state = RaceState.APPROACHING_STATION;
      print('[RaceStateMachine] APPROACHING_STATION: ' + this._currentConfig.name);
    } else {
      // Fallback: enter immediately if no station
      this.enterStationMode();
    }
  }

  private enterStationMode(): void {
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
    if (this._currentConfig.mode === StationMode.ZONE_HIT) {
      if (this.handZoneDetector && this._currentConfig.motionType) {
        var stationPos: vec3 = null;
        var targetObject: SceneObject = null;

        if (this._currentConfig.motionType === MotionType.OVERHEAD_REACH) {
          var course = this.cm();
          var activeStation = course?.getActiveStation();
          if (activeStation) {
            stationPos = activeStation.getTransform().getWorldPosition();
            // Find target sphere child (for squat press, wallball, etc.)
            targetObject = this.findTargetSphere(activeStation);
          }
        }

        this.handZoneDetector.startDetection(
          this._currentConfig.motionType as any,
          (repCount: number) => {
            // Fade out SkiErg guides on first rep
            if (repCount === 1 && this._skiergGuidesActive) {
              this.startSkiergGuidesFadeout();
            }

            this._stationProgress = repCount;
            this.updateStationUI();

            if (this._stationProgress >= this._stationRequirement) {
              this.completeCurrentStation();
            }
          },
          null,
          stationPos,
          targetObject
        );
      }
    }

    // Show SkiErg guides if this is a SkiErg station
    var stationName = this._currentConfig.name.toUpperCase();
    if (stationName.indexOf('SKIERG') >= 0 || stationName.indexOf('SKI ERG') >= 0) {
      this.showSkiergGuides();
    } else {
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

  private updateStationProgress(dt: number): void {
    if (!this._currentConfig) return;

    var mode = this._currentConfig.mode;

    switch (mode) {
      case StationMode.TIMED:
        this._stationProgress += dt;
        if (this._stationProgress >= this._stationRequirement) {
          this.completeCurrentStation();
        }
        break;

      case StationMode.DISTANCE:
        this.trackStationDistance();
        if (this._stationProgress >= this._stationRequirement) {
          this.completeCurrentStation();
        }
        break;

      case StationMode.REPS:
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

  private trackStationDistance(): void {
    // Camera-based distance tracking
    var playerPos = this.getPlayerPosition();
    if (!playerPos) return;

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
      } else if (stationName.indexOf('LUNGE') >= 0) {
        this.checkLungeForm(cameraY);
      }
    }
  }

  /**
   * Track burpee reps using camera-based detection (hard gate)
   * Requires: DROP (head down 40cm) → RISE → JUMP (forward 50cm)
   */
  private trackBurpeeReps(): void {
    if (!this.camTransform) return;

    var cameraY = this.camTransform.getWorldPosition().y;
    this.updateCameraYHistory(cameraY);

    // Run the burpee form state machine
    this.checkBurpeeForm(cameraY);

    // Use good reps as station progress
    this._stationProgress = this._burpeeGoodReps;
  }

  // ── Form Detection ──────────────────────────────────────────────────────────

  private updateCameraYHistory(cameraY: number): void {
    this._cameraYHistory.push(cameraY);
    if (this._cameraYHistory.length > this.CAMERA_Y_HISTORY_SIZE) {
      this._cameraYHistory.shift();
    }
  }

  private resetFormState(): void {
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
    } else {
      this._lungeLastPeakY = 0;
      this._lungeLastValleyY = 0;
    }
  }

  private checkBurpeeForm(cameraY: number): void {
    if (this._cameraYHistory.length < 5) return;

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
        } else if (canShowFeedback && stationElapsed > this.BURPEE_FIRST_FEEDBACK_DELAY) {
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
            // Get flat forward direction (Spectacles camera looks down -Z, so use back)
            var fwd = this.camTransform.back;
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

          // DEBUG: Log forward distance
          print('[Burpee DEBUG] forwardDist=' + forwardDist.toFixed(1) + ' dx=' + dx.toFixed(1) + ' dz=' + dz.toFixed(1));

          if (forwardDist >= this.BURPEE_JUMP_DISTANCE) {
            this._burpeeGoodReps++;
            print('[FormDetect] Burpee: GOOD REP #' + this._burpeeGoodReps + ' (forward: ' + forwardDist.toFixed(0) + 'cm)');
            this.showBurpeeFeedback('+1');
            this.playGoodFormSound();
            this._burpeeState = 'waiting_drop';
            this._burpeeJumpStartPos = null;
            this._burpeeJumpForward = null;
            // Reset start Y for next rep
            this._cameraYHistory = [cameraY];
          } else if (canShowFeedback) {
            // Not jumping forward enough
            this.showBurpeeFeedback('JUMP FORWARD');
            this._burpeeLastFeedbackTime = now;
          }
        }
        break;
    }
  }

  private showBurpeeFeedback(msg: string): void {
    if (this.instructionText) {
      this.instructionText.text = msg;
    }
    print('[Burpee] ' + msg);
  }

  private checkLungeForm(cameraY: number): void {
    if (this._cameraYHistory.length < 10) return;

    var currentTime = getTime();

    // Detect vertical bounce pattern (head goes down during lunge)
    if (this._lungeDirection === 'rising') {
      if (cameraY < this._lungeLastPeakY - this.LUNGE_BOUNCE_THRESHOLD) {
        // Started falling - found a peak
        this._lungeDirection = 'falling';
        this._lungeLastValleyY = cameraY;
      } else if (cameraY > this._lungeLastPeakY) {
        this._lungeLastPeakY = cameraY;
      }
    } else {
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
      } else if (cameraY < this._lungeLastValleyY) {
        this._lungeLastValleyY = cameraY;
      }
    }

    // If user has traveled distance without bounces, remind them
    var expectedBounces = Math.floor(this._stationProgress * 2);  // ~2 lunges per meter
    if (expectedBounces > 3 && this._lungeBounceCount < expectedBounces * 0.3) {
      this.playFormReminder();
    }
  }

  private isAIBusy(): boolean {
    if (this.aiCoach && !isNull(this.aiCoach)) {
      return (this.aiCoach as any).isBusy === true;
    }
    return false;
  }

  private playFormReminder(): void {
    var currentTime = getTime();
    if (currentTime - this._lastFormReminderTime < this.FORM_REMINDER_COOLDOWN) return;

    // Skip if AI is speaking/processing/recording
    if (this.isAIBusy()) {
      print('[FormDetect] Skipping form reminder - AI is busy');
      return;
    }

    this._lastFormReminderTime = currentTime;

    // Prefer AI coach voice for form reminders
    if (this.aiCoach && !isNull(this.aiCoach)) {
      var exerciseName = this._currentConfig?.name || 'exercise';
      (this.aiCoach as any).speakFormReminder(exerciseName);
      print('[FormDetect] AI coach speaking form reminder for: ' + exerciseName);
      return;
    }

    // Fallback to SFX if AI coach not available
    if (this.formReminderSound && !isNull(this.formReminderSound)) {
      this.formReminderSound.play(1);
      print('[FormDetect] Playing form reminder SFX (fallback)');
    }
  }

  private playGoodFormSound(): void {
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

  private trackRunDistance(): void {
    var playerPos = this.getPlayerPosition();
    if (!playerPos) return;

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

  private completeCurrentStation(): void {
    var name = this._currentConfig ? this._currentConfig.name : 'Station';
    var mode = this._currentConfig ? this._currentConfig.mode : null;
    var duration = this.calculateSplitDuration();

    // Stop hand zone detection for ZONE_HIT stations
    if (mode === StationMode.ZONE_HIT) {
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
    } else {
      this.prepareForNextStation();
    }
  }

  private finishRace(): void {
    var totalMs = this.getRaceElapsedMsAt(getTime() * 1000);
    this._state = RaceState.FINISHED;

    // End HR session
    var hrStats = { avgBPM: 0, peakBPM: 0 };
    if (this.heartRateTracker) {
      hrStats = this.heartRateTracker.endSession();
    }

    // Clear running UI
    if (this.statusText) this.statusText.text = '';
    if (this.stationNameText) this.stationNameText.text = '';
    if (this.nextStationText) this.nextStationText.text = '';
    if (this.progressText) this.progressText.text = '';
    if (this.stationInfoText) this.stationInfoText.text = '';
    if (this.stationInfoBG) this.stationInfoBG.enabled = false;
    if (this.timerText) this.timerText.text = '';
    if (this.timerBG) this.timerBG.enabled = false;

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
  stopRace(): void {
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
      course.fadeOutAndDestroy(() => {});
    }

    // Build incomplete stations list
    var incompleteStations: string[] = [];
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
    if (this.statusText) this.statusText.text = '';
    if (this.stationNameText) this.stationNameText.text = '';
    if (this.nextStationText) this.nextStationText.text = '';
    if (this.progressText) this.progressText.text = '';
    if (this.stationInfoText) this.stationInfoText.text = '';
    if (this.stationInfoBG) this.stationInfoBG.enabled = false;
    if (this.timerText) this.timerText.text = '';
    if (this.timerBG) this.timerBG.enabled = false;

    // Show finish panel
    this.showFinishPanel('STOPPED', totalMs, hrStats, incompleteStations);

    // Save to cloud (incomplete)
    this.saveRaceToCloud(totalMs, false, hrStats);

    print('[RaceStateMachine] STOPPED at ' + (totalMs / 1000).toFixed(1) + 's');
  }

  // ── HR Stats Calculation ──────────────────────────────────────────────────

  private calculateSplitAvgHR(): number {
    if (this._splitHRReadings.length === 0) return 0;

    var sum = 0;
    for (var i = 0; i < this._splitHRReadings.length; i++) {
      sum += this._splitHRReadings[i];
    }
    return Math.round(sum / this._splitHRReadings.length);
  }

  // ── UI Updates ─────────────────────────────────────────────────────────────

  private setUIIdle(): void {
    if (this.statusText) this.statusText.text = '';
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

  private updateRunningUI(): void {
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
          (this.progressBar as any).setProgress(0);
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
        (this.progressBar as any).setProgress(pct);
      }
    }
  }

  private updateStationUI(): void {
    if (!this._currentConfig) return;

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
        } else if (nextConfig) {
          this.nextStationText.text = 'Next: ' + nextConfig.name;
        }
      } else {
        this.nextStationText.text = 'Next: FINISH';
      }
    }

    // Progress info (rep count, distance, time)
    var progressInfo = '';
    switch (mode) {
      case StationMode.TIMED:
        var remaining = Math.max(0, target - progress);
        progressInfo = remaining.toFixed(0) + 's remaining';
        break;

      case StationMode.DISTANCE:
        progressInfo = progress.toFixed(1) + 'm / ' + target + 'm';
        break;

      case StationMode.ZONE_HIT:
        progressInfo = Math.floor(progress) + ' / ' + target;
        break;

      case StationMode.REPS:
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
      (this.progressBar as any).setProgress(pct);
    }
  }

  private updateTimerUI(): void {
    if (!this.timerText) return;
    if (this.timerBG && !this.timerBG.enabled) {
      this.timerBG.enabled = true;
    }
    this.timerText.text = this.formatTime(this.elapsedMs);
  }

  // ── Player Position/Direction ──────────────────────────────────────────────

  private getPlayerPosition(): vec3 {
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

  private getPlayerForward(): vec3 {
    if (!this.camTransform) {
      return new vec3(0, 0, -1);
    }

    return vec3.up().cross(this.camTransform.right).normalize();
  }

  // ── Run Arrow Guide ────────────────────────────────────────────────────────

  private startRunArrowGuide(): void {
    if (!this.runArrowGuide) return;

    var playerPos = this.getPlayerPosition();
    var playerForward = this.getPlayerForward();

    // Calculate target position: run distance ahead in forward direction
    var runDistanceCm = this._runTarget * 100;  // Convert meters to cm
    var targetPos = new vec3(
      playerPos.x + playerForward.x * runDistanceCm,
      playerPos.y,
      playerPos.z + playerForward.z * runDistanceCm
    );

    this.runArrowGuide.startGuide(targetPos);
    print('[RaceStateMachine] Arrow guide started, target ' + this._runTarget + 'm ahead');
  }

  private stopRunArrowGuide(): void {
    if (!this.runArrowGuide) return;

    this.runArrowGuide.stopGuide();
    print('[RaceStateMachine] Arrow guide stopped');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Find target sphere child in station prefab (for OVERHEAD_REACH stations) */
  private findTargetSphere(station: SceneObject): SceneObject {
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
      if (found) return found;
    }
    return null;
  }

  private calculateSplitDuration(): number {
    var elapsed = this.getRaceElapsedMsAt(getTime() * 1000);

    var prevTotal = 0;
    for (var i = 0; i < this._splitDurations.length; i++) {
      prevTotal += this._splitDurations[i];
    }

    return Math.max(0, elapsed - prevTotal);
  }

  private formatTime(ms: number): string {
    var totalSec = Math.floor(ms / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    return this.pad2(min) + ':' + this.pad2(sec);
  }

  private pad2(n: number): string {
    return n < 10 ? '0' + n : '' + n;
  }
}
