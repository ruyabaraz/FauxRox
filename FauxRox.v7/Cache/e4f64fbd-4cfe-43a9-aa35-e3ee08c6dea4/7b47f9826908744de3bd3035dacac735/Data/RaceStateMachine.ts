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

enum RaceState {
  IDLE        = 'IDLE',
  COUNTDOWN   = 'COUNTDOWN',
  RUNNING     = 'RUNNING',      // Running to reach distance target
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

  /** Cloud manager for saving race data */
  @input @allowUndefined cloudManager: CloudManager;

  // ── UI Elements ───────────────────────────────────────────────────────────

  @input statusText: Text;
  @input timerText: Text;
  @input @allowUndefined timerBG: SceneObject;  // Parent of timerText - enable/disable this
  @input stationInfoText: Text;
  @input @allowUndefined countdownText: Text;   // Separate text for 3-2-1 countdown

  /** Countdown sound effects */
  @input @allowUndefined countdownBeepSound: AudioComponent;  // Plays on 3, 2, 1
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

  /** Station name text - displays current station name during workout */
  @input @allowUndefined stationNameText: Text;

  /** Station info background - synced with stationInfoText visibility */
  @input @allowUndefined stationInfoBG: SceneObject;

  /** Next station text - displays upcoming station name during running */
  @input @allowUndefined nextStationText: Text;

  /** Visual progress bar (from Orthographic Camera package) */
  @input @allowUndefined progressBar: ScriptComponent;

  /** Start button object - hidden after race starts */
  @input @allowUndefined startButtonObject: SceneObject;

  /** SkiErg motion guide animations - enabled only during SkiErg station */
  @input @allowUndefined skiergGuides: SceneObject;


  // ── Finish Panel UI ─────────────────────────────────────────────────────────

  /** Finish panel container - shown on race finish/stop */
  @input @allowUndefined finishPanel: SceneObject;

  /** Finish status text - "FINISHED!" or "STOPPED" */
  @input @allowUndefined finishStatusText: Text;

  /** Finish total time text */
  @input @allowUndefined finishTotalTimeText: Text;

  /** Finish average HR text */
  @input @allowUndefined finishAvgHRText: Text;

  /** Finish peak HR text */
  @input @allowUndefined finishPeakHRText: Text;

  /** Finish splits text - displays all splits */
  @input @allowUndefined finishSplitsText: Text;

  /** Reset button on finish panel */
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

  // Title fade out
  private _titleFading: boolean = false;
  private _titleAlpha: number = 1.0;
  private readonly TITLE_DISPLAY_TIME: number = 3.0;
  private readonly TITLE_FADE_DURATION: number = 0.5;

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


  // ── Public Getters ─────────────────────────────────────────────────────────

  get state(): string { return this._state; }
  get currentStationIndex(): number { return this._currentStationIndex; }
  get splits(): { name: string; duration: number }[] {
    const result: { name: string; duration: number }[] = [];
    for (let i = 0; i < this._splitNames.length; i++) {
      result.push({ name: this._splitNames[i], duration: this._splitDurations[i] });
    }
    return result;
  }
  get elapsedMs(): number {
    if (this._raceStartTime === 0) return 0;
    var now = getTime() * 1000;
    var elapsed = now - this._raceStartTime - this._totalPausedTime;
    if (this._state === RaceState.PAUSED && this._pauseStartTime > 0) {
      elapsed -= (now - this._pauseStartTime);
    }
    return elapsed;
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

    // Bind finish reset button
    this.createEvent('OnStartEvent').bind(() => {
      this.bindFinishResetButton();
    });

    this.setUIIdle();
    this.showTitle();
    print('[RaceStateMachine] Init — IDLE (HR Edition)');
  }

  private bindFinishResetButton(): void {
    if (this.finishResetButton) {
      var btn = this.finishResetButton as any;
      if (btn.onTriggerUp && btn.onTriggerUp.add) {
        btn.onTriggerUp.add(() => {
          this.resetRace();
        });
        print('[RaceStateMachine] Finish reset button bound');
      }
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
        this._hrStatusMessage = 'HR Connected';
      } else {
        print('[RaceStateMachine] HR Monitor disabled by user');
        this._hrStatusMessage = 'HR Disabled';
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
    if (this.hrStatusText) {
      this.hrStatusText.getSceneObject().enabled = true;
      this.hrStatusText.text = this._hrStatusMessage;
    }

    // Start floor calibration via CourseSetup
    var setup = this.setup();
    if (setup && typeof setup.startCalibration === 'function') {
      setup.startCalibration();
    } else {
      print('[RaceStateMachine] WARNING: CourseSetup not available for calibration');
    }
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
    print('[RaceStateMachine] Title fade complete — starting BLE flow');

    // Start BLE connection flow (will trigger floor calibration when complete)
    this.initHeartRateMonitor();
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

  private populateFinishSplits(incompleteStations: string[]): void {
    if (!this.finishSplitsText) return;

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

  private hideFinishPanel(): void {
    if (this.finishPanel) {
      this.finishPanel.enabled = false;
    }
    if (this.finishSplitsText) {
      this.finishSplitsText.text = '';
    }
  }

  // ── Cloud Save ──────────────────────────────────────────────────────────────

  private saveRaceToCloud(totalMs: number, completed: boolean, hrStats: { avgBPM: number, peakBPM: number }): void {
    if (!this.cloudManager) {
      print('[RaceStateMachine] Cloud save skipped - no CloudManager');
      return;
    }

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

    this.cloudManager.saveRace(record).then((success) => {
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

  togglePause(): void {
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

      // Restore station name text
      if (this._pausedFromState === RaceState.RUNNING) {
        if (this.stationNameText) {
          this.stationNameText.text = 'RUN';
        }
        if (this.statusText) {
          this.statusText.text = '';
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

      // Play sound
      if (num > 0) {
        this.playCountdownBeep();
      } else {
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

    // Start big, animate to normal
    var transform = target.getSceneObject().getTransform();
    transform.setLocalScale(this._countdownOriginalScale.uniformScale(this.COUNTDOWN_ZOOM_SCALE));

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

    // Interpolate from zoom scale to 1.0
    var scale = this.COUNTDOWN_ZOOM_SCALE - (this.COUNTDOWN_ZOOM_SCALE - 1) * eased;
    var transform = target.getSceneObject().getTransform();
    transform.setLocalScale(this._countdownOriginalScale.uniformScale(scale));

    if (t >= 1) {
      transform.setLocalScale(this._countdownOriginalScale);
      this._countdownAnimating = false;
    }
  }

  private playCountdownBeep(): void {
    if (this.countdownBeepSound) {
      this.countdownBeepSound.play(1);
    }
  }

  private playCountdownGo(): void {
    if (this.countdownGoSound) {
      this.countdownGoSound.play(1);
    } else if (this.countdownBeepSound) {
      // Fallback to beep if no GO sound
      this.countdownBeepSound.play(1);
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
      }
      if (this.statusText) {
        this.statusText.text = '';
        this.triggerStatusZoom();
      }
      print('[RaceStateMachine] Waiting for START line crossing...');
      this.updateRunningUI();
    } else {
      course.fadeOutAndDestroy(() => {
        this.spawnAndEnterStation();
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
    } else {
      this.spawnAndEnterStation();
    }
  }

  private onRunDistanceComplete(): void {
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

  private spawnAndEnterStation(): void {
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
    this.enterStationMode();
  }

  private enterStationMode(): void {
    this._stationStartTime = getTime() * 1000;
    this._stationProgress = 0;
    this._stationRequirement = this._currentConfig.requirement;
    this._lastPlayerPos = null;

    // Reset HR tracking for this split
    this._splitHRReadings = [];
    this._splitPeakBPM = 0;

    // Start hand zone detection for ZONE_HIT stations
    if (this._currentConfig.mode === StationMode.ZONE_HIT) {
      if (this.handZoneDetector && this._currentConfig.motionType) {
        var stationPos: vec3 = null;
        if (this._currentConfig.motionType === MotionType.OVERHEAD_REACH) {
          var course = this.cm();
          var activeStation = course?.getActiveStation();
          if (activeStation) {
            stationPos = activeStation.getTransform().getWorldPosition();
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
          stationPos
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

      // ZONE_HIT is handled by callback in handZoneDetector
    }

    this.updateStationUI();
  }

  private trackStationDistance(): void {
    // Camera-based distance tracking
    var playerPos = this.getPlayerPosition();
    if (!playerPos) return;

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
    var totalMs = (getTime() * 1000) - this._raceStartTime - this._totalPausedTime;
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

    var totalMs = (getTime() * 1000) - this._raceStartTime - this._totalPausedTime;
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
    if (this.stationInfoText && !this.stationInfoText.getSceneObject().enabled) {
      this.stationInfoText.getSceneObject().enabled = true;
    }
    if (this.stationInfoBG && !this.stationInfoBG.enabled) {
      this.stationInfoBG.enabled = true;
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
          (this.progressBar as any).setProgress(0);
        }
        return;
      }

      var runInfo = this._runDistance.toFixed(0) + 'm / ' + this._runTarget.toFixed(0) + 'm';
      var pct = Math.min(1, this._runDistance / Math.max(1, this._runTarget));

      if (this.progressBar) {
        (this.progressBar as any).setProgress(pct);
      }

      if (this.stationInfoText) {
        this.stationInfoText.text = runInfo;
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

    if (!this.stationInfoText) return;

    var mode = this._currentConfig.mode;
    var instruction = this._currentConfig.instruction;
    var progress = this._stationProgress;
    var target = this._stationRequirement;

    var progressText = '';

    switch (mode) {
      case StationMode.TIMED:
        var remaining = Math.max(0, target - progress);
        progressText = instruction + '\n' + remaining.toFixed(0) + 's remaining';
        break;

      case StationMode.DISTANCE:
        progressText = instruction + '\n' + progress.toFixed(1) + 'm / ' + target + 'm';
        break;

      case StationMode.ZONE_HIT:
        progressText = instruction + '\n' + Math.floor(progress) + ' / ' + target + ' hits';
        break;

      default:
        progressText = instruction;
    }

    var pct = Math.min(1, progress / Math.max(1, target));

    if (this.progressBar) {
      (this.progressBar as any).setProgress(pct);
    }

    this.stationInfoText.text = progressText;
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

  // ── Helpers ────────────────────────────────────────────────────────────────

  private calculateSplitDuration(): number {
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
