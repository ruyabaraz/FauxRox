// ============================================================================
// RaceStateMachine.ts — FauxRox Core Game Loop
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// DYNAMIC follow-the-runner system:
// - Stations spawn in front of player when run distance completes
// - No fixed course layout - works anywhere
// ============================================================================

import { StationMode, StationConfig, MotionType } from "./CourseManager";
import { LocationTracker } from "./LocationTracker";
import { HandZoneDetector } from "./HandZoneDetector";

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
  @input locationTracker: LocationTracker;
  @input handZoneDetector: HandZoneDetector;
  @input camera: SceneObject;  // For player position and forward direction

  // ── UI Elements ───────────────────────────────────────────────────────────

  @input statusText: Text;
  @input timerText: Text;
  @input @allowUndefined timerBG: SceneObject;  // Parent of timerText - enable/disable this
  @input stationInfoText: Text;
  @input @allowUndefined countdownText: Text;   // Separate text for 3-2-1 countdown
  @input @allowUndefined instructionText: Text;
  @input @allowUndefined finishTunnelVfx: SceneObject;

  /** Title image (FauxRox logo) - fades out after display */
  @input @allowUndefined titleImage: Image;

  /** GPS status text - separate from stationInfoText, shown before race starts */
  @input @allowUndefined gpsStatusText: Text;

  /** Station name text - displays current station name during workout */
  @input @allowUndefined stationNameText: Text;

  /** Next station text - displays upcoming station name during running */
  @input @allowUndefined nextStationText: Text;

  /** Visual progress bar (from Orthographic Camera package) */
  @input @allowUndefined progressBar: ScriptComponent;

  // ── Settings ──────────────────────────────────────────────────────────────

  @input countdownSeconds: number = 3;
  @input useGPSTracking: boolean = true;

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
  private _gpsStatusText: string = '';

  // Pause tracking
  private _totalPausedTime: number = 0;      // Total ms spent paused
  private _pauseStartTime: number = 0;        // When current pause started

  // Split tracking
  private _splitNames: string[] = [];
  private _splitDurations: number[] = [];

  // Current station progress
  private _currentConfig: StationConfig = null;
  private _stationProgress: number = 0;
  private _stationRequirement: number = 0;

  // Run tracking
  private _runTarget: number = 0;
  private _runDistance: number = 0;
  private _lastPlayerPos: vec3 = null;

  // Title fade out
  private _titleFading: boolean = false;
  private _titleAlpha: number = 1.0;
  private readonly TITLE_DISPLAY_TIME: number = 2.0;
  private readonly TITLE_FADE_DURATION: number = 0.5;

  // StatusText zoom animation
  private _statusAnimating: boolean = false;
  private _statusAnimTime: number = 0;
  private _statusAnimPhase: 'in' | 'out' = 'in';
  private _statusOriginalScale: vec3 = null;
  private readonly STATUS_ZOOM_DURATION: number = 0.15;  // Each phase duration
  private readonly STATUS_ZOOM_SCALE: number = 1.3;      // Max scale during zoom

  // ── Public Getters ─────────────────────────────────────────────────────────

  get state(): string { return this._state; }
  get currentStationIndex(): number { return this._currentStationIndex; }
  get elapsedMs(): number {
    if (this._raceStartTime === 0) return 0;
    var now = getTime() * 1000;
    var elapsed = now - this._raceStartTime - this._totalPausedTime;
    // If currently paused, don't count time since pause started
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

    // Monitor GPS status (delayed to ensure LocationTracker is initialized)
    this.createEvent('OnStartEvent').bind(() => {
      this.initGpsStatusMonitor();
    });

    this.setUIIdle();
    this.showTitle();
    print('[RaceStateMachine] Init — IDLE (Dynamic Mode — FauxRox)');
  }

  // ── Title Display & Fade Out ────────────────────────────────────────────────

  private showTitle(): void {
    // Hide calibration and GPS texts until title fades out
    if (this.instructionText) {
      this.instructionText.getSceneObject().enabled = false;
    }
    if (this.stationInfoText) {
      this.stationInfoText.getSceneObject().enabled = false;
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
    // Enable calibration instruction text
    if (this.instructionText) {
      this.instructionText.getSceneObject().enabled = true;
    }
    // Enable stationInfoText (used during race for progress)
    if (this.stationInfoText) {
      this.stationInfoText.getSceneObject().enabled = true;
    }
    // Enable GPS status text
    if (this.gpsStatusText) {
      this.gpsStatusText.getSceneObject().enabled = true;
    }
    // Note: Start button is enabled by CourseSetup after floor calibration
    print('[RaceStateMachine] Title fade complete — UI enabled');
  }

  private setTitleAlpha(alpha: number): void {
    if (!this.titleImage) return;
    var color = this.titleImage.mainPass.baseColor;
    this.titleImage.mainPass.baseColor = new vec4(color.r, color.g, color.b, alpha);
  }

  // ── StatusText Zoom Animation ─────────────────────────────────────────────

  private triggerStatusZoom(): void {
    if (!this.statusText) return;

    // Store original scale on first animation
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
      // Zoom in phase
      var t = Math.min(1, this._statusAnimTime / this.STATUS_ZOOM_DURATION);
      var scale = 1 + (this.STATUS_ZOOM_SCALE - 1) * t;
      transform.setLocalScale(this._statusOriginalScale.uniformScale(scale));

      if (t >= 1) {
        this._statusAnimPhase = 'out';
        this._statusAnimTime = 0;
      }
    } else {
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

  private initGpsStatusMonitor(): void {
    if (!this.locationTracker) {
      print('[RaceStateMachine] No LocationTracker linked');
      return;
    }

    if (typeof this.locationTracker.onGpsStatusChange !== 'function') {
      print('[RaceStateMachine] LocationTracker.onGpsStatusChange not available');
      return;
    }

    this.locationTracker.onGpsStatusChange((status: string, message: string) => {
      this._gpsStatusText = this.formatGpsStatusBanner(status, message);
      // Update GPS text directly
      if (this.gpsStatusText && this._state === RaceState.IDLE) {
        this.gpsStatusText.text = this._gpsStatusText;
      }
    });
    print('[RaceStateMachine] GPS status monitor initialized');
  }

  private formatGpsStatusBanner(status: string, message: string): string {
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

    // Clear instruction text
    if (this.instructionText) {
      this.instructionText.text = '';
    }

    // Hide GPS status text after race starts
    if (this.gpsStatusText) {
      this.gpsStatusText.getSceneObject().enabled = false;
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

      // Pause GPS tracking
      if (this.locationTracker) {
        this.locationTracker.stopTracking();
      }

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

      // Resume GPS tracking if needed (use resumeTracking to keep distance)
      if (this._pausedFromState === RaceState.RUNNING && this.locationTracker) {
        this.locationTracker.resumeTracking((dist) => {
          this._runDistance = dist;
        });
      }

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
        // Station name is in stationNameText, statusText stays clear
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
    this._totalPausedTime = 0;
    this._pauseStartTime = 0;

    if (this.finishTunnelVfx) this.finishTunnelVfx.enabled = false;

    // Reset progress bar
    if (this.progressBar) {
      (this.progressBar as any).setProgress(0);
    }

    // Refresh GPS status banner
    if (this.locationTracker && typeof this.locationTracker.getGpsStatus === 'function') {
      this._gpsStatusText = this.formatGpsStatusBanner(
        this.locationTracker.getGpsStatus(),
        this.locationTracker.getGpsStatusMessage()
      );
    }

    // Respawn START line
    this.respawnStartLine();

    // Re-enable GPS status text
    if (this.gpsStatusText) {
      this.gpsStatusText.getSceneObject().enabled = true;
    }

    this.setUIIdle();
    print('[RaceStateMachine] Reset');
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

  private updateCountdown(dt: number): void {
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
  private startFirstStation(): void {
    var course = this.cm();
    if (!course) return;

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
        // Show "RUN" in stationNameText (not statusText)
        if (this.stationNameText) {
          this.stationNameText.text = 'RUN';
        }
        // Clear statusText during running
        if (this.statusText) {
          this.statusText.text = '';
          this.triggerStatusZoom();
        }
        print('[RaceStateMachine] RUN ' + this._runTarget + 'm to ' + this._currentConfig.name);
        this.updateRunningUI();
      } else {
        this.spawnAndEnterStation();
      }
    });
  }

  /**
   * Prepare for next station - start running phase
   */
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

      // Start GPS tracking for run segment
      if (this.useGPSTracking && this.locationTracker) {
        this.locationTracker.startTracking((totalDist, _deltaDist) => {
          this._runDistance = totalDist;
        });
        print('[RaceStateMachine] GPS tracking started for run');
      }

      this._state = RaceState.RUNNING;
      // Show "RUN" in stationNameText (not statusText)
      if (this.stationNameText) {
        this.stationNameText.text = 'RUN';
      }
      // Clear statusText during running
      if (this.statusText) {
        this.statusText.text = '';
        this.triggerStatusZoom();
      }
      print('[RaceStateMachine] RUN ' + this._runTarget + 'm to ' + this._currentConfig.name);
      this.updateRunningUI();
    } else {
      // No run before this station → spawn immediately
      this.spawnAndEnterStation();
    }
  }

  /**
   * Called when run distance target is reached
   */
  private onRunDistanceComplete(): void {
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
  private spawnAndEnterStation(): void {
    var course = this.cm();
    if (!course) return;

    var playerPos = this.getPlayerPosition();
    var playerForward = this.getPlayerForward();

    print('[RaceStateMachine] spawnAndEnterStation: stationIndex=' + this._currentStationIndex);
    print('[RaceStateMachine] spawnAndEnterStation: playerPos=(' + playerPos.x.toFixed(0) + ', ' + playerPos.y.toFixed(0) + ', ' + playerPos.z.toFixed(0) + ')');
    print('[RaceStateMachine] spawnAndEnterStation: playerForward=(' + playerForward.x.toFixed(2) + ', ' + playerForward.y.toFixed(2) + ', ' + playerForward.z.toFixed(2) + ')');

    course.spawnStationInFrontOfPlayer(this._currentStationIndex, playerPos, playerForward);
    this.enterStationMode();
  }

  /**
   * Enter station mode - start tracking progress
   */
  private enterStationMode(): void {
    this._stationStartTime = getTime() * 1000;
    this._stationProgress = 0;
    this._stationRequirement = this._currentConfig.requirement;
    this._lastPlayerPos = null;

    // Start GPS tracking for distance-based stations
    if (this._currentConfig.mode === StationMode.DISTANCE) {
      if (this.useGPSTracking && this.locationTracker) {
        this.locationTracker.startTracking((totalDist, _deltaDist) => {
          this._stationProgress = totalDist;
        });
        print('[RaceStateMachine] GPS tracking started for distance station');
      }
    }

    // Start hand zone detection for ZONE_HIT stations
    if (this._currentConfig.mode === StationMode.ZONE_HIT) {
      if (this.handZoneDetector && this._currentConfig.motionType) {
        // Target Press (OVERHEAD_REACH) uses fixed station position for the sphere target
        // Air SkiErg and Power Row use camera-relative (null)
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
            this._stationProgress = repCount;
            this.updateStationUI();

            if (this._stationProgress >= this._stationRequirement) {
              this.completeCurrentStation();
            }
          },
          null,
          stationPos
        );
        print('[RaceStateMachine] Hand zone detection started: ' + this._currentConfig.motionType + (stationPos ? ' (station-anchored)' : ' (camera-follow)'));
      }
    }

    // Show finish VFX if this is the last station
    var course = this.cm();
    if (course && this._currentStationIndex === course.stationCount - 1 && this.finishTunnelVfx) {
      this.finishTunnelVfx.enabled = true;
    }

    this._state = RaceState.STATION;

    // Show station name in dedicated stationNameText
    if (this.stationNameText) {
      this.stationNameText.text = this._currentConfig.name;
    }

    // Clear nextStationText (we've arrived at the station)
    if (this.nextStationText) {
      this.nextStationText.text = '';
    }

    // Clear statusText (or could show "STATION")
    if (this.statusText) {
      this.statusText.text = '';
    }

    print('[RaceStateMachine] Entered: ' + this._currentConfig.name);
    print('[RaceStateMachine] Mode: ' + this._currentConfig.mode + ', Req: ' + this._stationRequirement);

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
    // Check if GPS is ACTUALLY providing updates (not just "connected" status)
    if (this.useGPSTracking && this.locationTracker && this.locationTracker.isGpsActivelyUpdating(3.0)) {
      // GPS is giving us real updates - trust the callback
      return;
    }

    // Fallback to camera position tracking (indoor or GPS not responding)
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

  // ── Run Tracking ───────────────────────────────────────────────────────────

  private trackRunDistance(): void {
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
    } else {
      print('[RaceStateMachine] trackRunDistance: first position set');
    }

    this._lastPlayerPos = new vec3(playerPos.x, playerPos.y, playerPos.z);
  }

  // ── Station Completion ─────────────────────────────────────────────────────

  private completeCurrentStation(): void {
    var name = this._currentConfig ? this._currentConfig.name : 'Station';
    var mode = this._currentConfig ? this._currentConfig.mode : null;
    var duration = this.calculateSplitDuration();

    // Stop GPS tracking for distance stations
    if (mode === StationMode.DISTANCE) {
      if (this.useGPSTracking && this.locationTracker) {
        this.locationTracker.stopTracking();
      }
      print('[RaceStateMachine] ' + name + ' — Distance: ' + this._stationProgress.toFixed(1) + 'm');
    }

    // Stop hand zone detection for ZONE_HIT stations
    if (mode === StationMode.ZONE_HIT) {
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
    } else {
      this.prepareForNextStation();
    }
  }

  private finishRace(): void {
    var totalMs = (getTime() * 1000) - this._raceStartTime;
    this._state = RaceState.FINISHED;

    if (this.statusText) {
      this.statusText.text = 'FINISHED!';
      this.triggerStatusZoom();
    }
    // Clear station name and next station
    if (this.stationNameText) {
      this.stationNameText.text = '';
    }
    if (this.nextStationText) {
      this.nextStationText.text = '';
    }
    if (this.timerText) this.timerText.text = this.formatTime(totalMs);

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

  private setUIIdle(): void {
    // statusText starts empty, CourseSetup will show calibration status
    if (this.statusText) this.statusText.text = '';
    // Show GPS status in dedicated gpsStatusText (not stationInfoText)
    if (this.gpsStatusText) {
      this.gpsStatusText.text = this._gpsStatusText || '';
    }
    // stationInfoText is for race progress, hide in IDLE
    if (this.stationInfoText) {
      this.stationInfoText.text = '';
    }
    // stationNameText is for station names, clear in IDLE
    if (this.stationNameText) {
      this.stationNameText.text = '';
    }
    // nextStationText is for upcoming station, clear in IDLE
    if (this.nextStationText) {
      this.nextStationText.text = '';
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

  private updateRunningUI(): void {
    // statusText is set to 'RUN' with zoom animation when entering RUNNING state
    // Don't update it here every frame to avoid resetting mid-animation

    // Ensure stationInfoText is visible during running
    if (this.stationInfoText && !this.stationInfoText.getSceneObject().enabled) {
      this.stationInfoText.getSceneObject().enabled = true;
    }

    if (this._currentConfig) {
      var nextName = this._currentConfig.name;
      // Show actual tracking mode: GPS only if actively updating, otherwise STEP (camera)
      var trackingMode = (this.useGPSTracking && this.locationTracker && this.locationTracker.isGpsActivelyUpdating(3.0))
        ? 'GPS' : 'STEP';

      var runInfo = this._runDistance.toFixed(0) + 'm / ' + this._runTarget.toFixed(0) + 'm';

      // Progress bar
      var pct = Math.min(1, this._runDistance / Math.max(1, this._runTarget));

      // Update visual progress bar
      if (this.progressBar) {
        (this.progressBar as any).setProgress(pct);
        print('[RaceStateMachine] progressBar.setProgress(' + pct.toFixed(2) + ')');
      } else {
        print('[RaceStateMachine] progressBar is NULL!');
      }

      // Show "Next: stationName" in separate nextStationText
      if (this.nextStationText) {
        this.nextStationText.text = 'Next: ' + nextName;
      }

      // Show distance info in stationInfoText (without next station)
      if (this.stationInfoText) {
        this.stationInfoText.text = runInfo + ' [' + trackingMode + ']';
      }
    }
  }

  private updateStationUI(): void {
    if (!this._currentConfig) return;

    // Ensure stationInfoText is visible during station
    if (this.stationInfoText && !this.stationInfoText.getSceneObject().enabled) {
      this.stationInfoText.getSceneObject().enabled = true;
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
        // Show actual tracking mode: GPS only if actively updating, otherwise STEP (camera)
        var distTrackMode = (this.useGPSTracking && this.locationTracker && this.locationTracker.isGpsActivelyUpdating(3.0))
          ? 'GPS' : 'STEP';
        progressText = instruction + '\n' + progress.toFixed(1) + 'm / ' + target + 'm [' + distTrackMode + ']';
        break;

      case StationMode.ZONE_HIT:
        progressText = instruction + '\n' + Math.floor(progress) + ' / ' + target + ' hits';
        break;

      default:
        progressText = instruction;
    }

    // Progress bar
    var pct = Math.min(1, progress / Math.max(1, target));

    // Update visual progress bar
    if (this.progressBar) {
      (this.progressBar as any).setProgress(pct);
    }

    this.stationInfoText.text = progressText;
  }

  private updateTimerUI(): void {
    if (!this.timerText) return;
    // Ensure timer BG is visible during race
    if (this.timerBG && !this.timerBG.enabled) {
      this.timerBG.enabled = true;
    }
    this.timerText.text = this.formatTime(this.elapsedMs);
  }

  // ── Player Position/Direction ──────────────────────────────────────────────

  private getPlayerPosition(): vec3 {
    if (!this.camTransform) {
      print('[RaceStateMachine] getPlayerPosition: camTransform is null!');
      return vec3.zero();
    }

    // Always use RaceStateMachine's own camera reference for current position
    var camPos = this.camTransform.getWorldPosition();

    // Get calibrated floor Y from CourseSetup
    var setup = this.setup();
    var floorY = camPos.y; // Default to camera Y if not calibrated

    if (setup && setup.isCalibrated && typeof setup.floorY !== 'undefined') {
      floorY = setup.floorY;
    }

    var groundPos = new vec3(camPos.x, floorY, camPos.z);

    print('[RaceStateMachine] getPlayerPosition: camPos=(' + camPos.x.toFixed(0) + ', ' + camPos.y.toFixed(0) + ', ' + camPos.z.toFixed(0) + '), floorY=' + floorY.toFixed(0) + ', groundPos=(' + groundPos.x.toFixed(0) + ', ' + groundPos.y.toFixed(0) + ', ' + groundPos.z.toFixed(0) + ')');

    return groundPos;
  }

  private getPlayerForward(): vec3 {
    if (!this.camTransform) {
      return new vec3(0, 0, -1);  // Default forward
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

  private calculateSplitDuration(): number {
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
