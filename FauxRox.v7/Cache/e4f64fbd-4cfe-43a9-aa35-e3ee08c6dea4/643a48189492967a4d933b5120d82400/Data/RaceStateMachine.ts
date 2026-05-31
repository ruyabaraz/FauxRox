// ============================================================================
// RaceStateMachine.ts — HYROX MIRAGE Core Game Loop
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Handles real HYROX format: 8 × 1km runs + 8 workout stations
// Station modes: TIMED, DISTANCE, REPS, RUN
// ============================================================================

import { StationMode, StationConfig, MotionType } from "./CourseManager";
import { LocationTracker } from "./LocationTracker";
import { HandZoneDetector } from "./HandZoneDetector";

enum RaceState {
  IDLE        = 'IDLE',
  COUNTDOWN   = 'COUNTDOWN',
  RUNNING     = 'RUNNING',      // Running to next station
  STATION     = 'STATION',      // At workout station
  PAUSED      = 'PAUSED',
  FINISHED    = 'FINISHED',
}

@component
export class RaceStateMachine extends BaseScriptComponent {

  @input courseManagerScript: ScriptComponent;
  @input proximityDetectorScript: ScriptComponent;
  @input courseSetupScript: ScriptComponent;  // For player position tracking (indoor fallback)
  @input locationTracker: LocationTracker;    // GPS tracking (outdoor)
  @input handZoneDetector: HandZoneDetector;  // Hand zone detection for ZONE_HIT stations

  @input statusText: Text;
  @input timerText: Text;
  @input stationInfoText: Text;
  @input @allowUndefined instructionText: Text;  // "Tap START" text - cleared on race start
  @input @allowUndefined finishTunnelVfx: SceneObject;

  @input countdownSeconds: number = 3;

  /** Pinch counts as X reps (for rep-based stations) */
  @input repsPerPinch: number = 10;

  /** Use GPS for distance tracking (outdoor mode) */
  @input useGPSTracking: boolean = true;

  private cm(): any { return this.courseManagerScript as any; }
  private pd(): any { return this.proximityDetectorScript as any; }
  private setup(): any { return this.courseSetupScript as any; }

  // ── State ──────────────────────────────────────────────────────────────────

  private _state: RaceState = RaceState.IDLE;
  private _raceStartTime: number = 0;
  private _stationArrivalTime: number = 0;
  private _currentStationIndex: number = -1;
  private _countdownRemaining: number = 0;
  private _isInsideStation: boolean = false;
  private _pausedFromState: RaceState = RaceState.RUNNING;

  // Split tracking
  private _splitNames: string[] = [];
  private _splitDurations: number[] = [];

  // Current station progress
  private _currentConfig: StationConfig = null;
  private _stationProgress: number = 0;        // reps done, distance moved, or time elapsed
  private _stationRequirement: number = 0;     // target reps, distance, or time

  // Run tracking
  private _runTarget: number = 0;              // meters to run before next station
  private _runDistance: number = 0;            // meters run so far
  private _lastPlayerPos: vec3 = null;

  // ── Public Getters ─────────────────────────────────────────────────────────

  get state(): string { return this._state; }
  get currentStationIndex(): number { return this._currentStationIndex; }
  get elapsedMs(): number {
    if (this._raceStartTime === 0) return 0;
    return (getTime() * 1000) - this._raceStartTime;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onAwake(): void {
    this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));

    // Bind proximity detector callbacks
    var detector = this.pd();
    if (detector) {
      detector.onStationEnter = (index: number, name: string, dist: number) => {
        this.handleStationEnter(index, name);
      };
      detector.onStationExit = (index: number, name: string, dist: number) => {
        this.handleStationExit(index, name);
      };
    }

    // Bind pinch for rep counting
    this.bindPinchForReps();

    this.setUIIdle();
    print('[RaceStateMachine] Init — IDLE');
  }

  private bindPinchForReps(): void {
    try {
      var SIK = require('SpectaclesInteractionKit.lspkg/SIK').SIK;
      var handInputData = SIK.HandInputData;

      var rightHand = handInputData.getHand('right');
      rightHand.onPinchDown.add(() => this.handleRepPinch());

      var leftHand = handInputData.getHand('left');
      leftHand.onPinchDown.add(() => this.handleRepPinch());

      print('[RaceStateMachine] Pinch bound for rep counting');
    } catch (e) {
      print('[RaceStateMachine] Could not bind pinch: ' + e);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  startRace(): void {
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

  togglePause(): void {
    if (this._state === RaceState.RUNNING || this._state === RaceState.STATION) {
      this._pausedFromState = this._state;
      this._state = RaceState.PAUSED;
      if (this.statusText) this.statusText.text = 'PAUSED\nPinch to Resume';
    } else if (this._state === RaceState.PAUSED) {
      this._state = this._pausedFromState;
    }
  }

  resetRace(): void {
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
    if (this.finishTunnelVfx) this.finishTunnelVfx.enabled = false;
    this.setUIIdle();
    print('[RaceStateMachine] Reset');
  }

  // ── Update Loop ────────────────────────────────────────────────────────────

  private onUpdate(): void {
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

  private updateCountdown(dt: number): void {
    this._countdownRemaining -= dt;

    // Clear other texts during countdown
    if (this.stationInfoText) this.stationInfoText.text = '';
    if (this.instructionText) this.instructionText.text = '';

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

  private updateDirectionArrow(): void {
    var course = this.cm();
    if (!course || !course.progressiveReveal) return;

    // Get player position
    var courseSetup = this.setup();
    if (!courseSetup) return;

    var playerPos = courseSetup.getPlayerGroundPosition();
    if (!playerPos) return;

    // Update arrow to point at current target station
    course.updateDirectionArrow(playerPos, this._currentStationIndex);
  }

  private hideDirectionArrow(): void {
    var course = this.cm();
    if (course) {
      course.hideDirectionArrow();
    }
  }

  // ── Run Tracking ───────────────────────────────────────────────────────────

  private trackRunDistance(): void {
    // Use GPS if available and enabled
    if (this.useGPSTracking && this.locationTracker && this.locationTracker.isLocationReady()) {
      this._runDistance = this.locationTracker.getDistance();
      return;
    }

    // Fallback to camera position tracking (indoor)
    var courseSetup = this.setup();
    if (!courseSetup) return;

    var playerPos = courseSetup.getPlayerGroundPosition();
    if (!playerPos) return;

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

  private prepareForStation(index: number): void {
    var course = this.cm();
    if (!course) return;

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
    } else {
      // No run, go directly to station (START marker)
      this._state = RaceState.RUNNING;
    }

    // Highlight station
    course.highlightStation(index);
    var detector = this.pd();
    if (detector) detector.setActiveStation(index);

    this.updateRunningUI();
  }

  private handleStationEnter(index: number, name: string): void {
    if (this._state !== RaceState.RUNNING) return;
    if (index !== this._currentStationIndex) return;

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
    if (this._currentConfig.mode === StationMode.DISTANCE) {
      if (this.useGPSTracking && this.locationTracker) {
        this.locationTracker.startTracking((totalDist, deltaDist) => {
          this._stationProgress = totalDist;
        });
        print('[RaceStateMachine] GPS tracking started for distance station');
      }
    }

    // Start hand zone detection for ZONE_HIT stations
    if (this._currentConfig.mode === StationMode.ZONE_HIT) {
      if (this.handZoneDetector && this._currentConfig.motionType) {
        this.handZoneDetector.startDetection(
          this._currentConfig.motionType as any,  // MotionType enum
          (repCount: number) => {
            this._stationProgress = repCount;
            this.updateStationUI();

            // Check if complete
            if (this._stationProgress >= this._stationRequirement) {
              this.completeCurrentStation();
            }
          }
        );
        print('[RaceStateMachine] Hand zone detection started: ' + this._currentConfig.motionType);
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

  private handleStationExit(index: number, name: string): void {
    if (this._state !== RaceState.STATION) return;
    if (index !== this._currentStationIndex) return;

    // For DISTANCE mode, keep tracking even if player exits briefly
    if (this._currentConfig && this._currentConfig.mode === StationMode.DISTANCE) {
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

  private updateStationProgress(dt: number): void {
    if (!this._currentConfig) return;

    var mode = this._currentConfig.mode;

    switch (mode) {
      case StationMode.TIMED:
        // Count up time
        this._stationProgress += dt;
        if (this._stationProgress >= this._stationRequirement) {
          this.completeCurrentStation();
        }
        break;

      case StationMode.DISTANCE:
        // Track movement distance
        this.trackStationDistance();
        if (this._stationProgress >= this._stationRequirement) {
          this.completeCurrentStation();
        }
        break;

      case StationMode.REPS:
        // Reps are counted via pinch (handleRepPinch)
        // Just update UI here
        break;

      case StationMode.RUN:
        // Run mode is handled during RUNNING state, not STATION
        break;
    }

    this.updateStationUI();
  }

  private trackStationDistance(): void {
    // Use GPS if available and enabled
    if (this.useGPSTracking && this.locationTracker && this.locationTracker.isLocationReady()) {
      this._stationProgress = this.locationTracker.getDistance();
      return;
    }

    // Fallback to camera position tracking (indoor)
    var courseSetup = this.setup();
    if (!courseSetup) return;

    var playerPos = courseSetup.getPlayerGroundPosition();
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

  private handleRepPinch(): void {
    // Only count reps when at a REPS station
    if (this._state !== RaceState.STATION) return;
    if (!this._currentConfig || this._currentConfig.mode !== StationMode.REPS) return;

    this._stationProgress += this.repsPerPinch;
    print('[RaceStateMachine] Reps: ' + this._stationProgress + '/' + this._stationRequirement);

    if (this._stationProgress >= this._stationRequirement) {
      this.completeCurrentStation();
    } else {
      this.updateStationUI();
    }
  }

  // ── Station Completion ─────────────────────────────────────────────────────

  private completeCurrentStation(): void {
    var now = getTime() * 1000;
    var course = this.cm();
    var name = this._currentConfig ? this._currentConfig.name : 'Station';
    var mode = this._currentConfig ? this._currentConfig.mode : null;
    var duration = now - this._stationArrivalTime;

    // Stop GPS tracking for distance stations and get actual distance
    var actualDistance = this._stationProgress;
    if (mode === StationMode.DISTANCE) {
      if (this.useGPSTracking && this.locationTracker) {
        actualDistance = this.locationTracker.stopTracking();
      }
      print('[RaceStateMachine] ' + name + ' — Distance: ' + actualDistance.toFixed(1) + 'm');
    }

    // Stop hand zone detection for ZONE_HIT stations
    var actualReps = this._stationProgress;
    if (mode === StationMode.ZONE_HIT) {
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
    } else {
      this.prepareForStation(this._currentStationIndex);
    }
  }

  private finishRace(): void {
    var totalMs = (getTime() * 1000) - this._raceStartTime;
    this._state = RaceState.FINISHED;

    if (this.statusText) this.statusText.text = 'FINISHED!';
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
    if (this.statusText) this.statusText.text = 'HYROX MIRAGE';
    if (this.stationInfoText) this.stationInfoText.text = '';
    if (this.timerText) this.timerText.text = '00:00';
    if (this.instructionText) this.instructionText.text = 'Pinch to Start Race';
  }

  private updateRunningUI(): void {
    if (this.statusText) {
      this.statusText.text = 'RUN';
    }

    if (this.stationInfoText && this._currentConfig) {
      var nextName = this._currentConfig.name;
      var runInfo = '';

      if (this._runTarget > 0) {
        var remaining = Math.max(0, this._runTarget - this._runDistance);
        var covered = this._runDistance;
        var trackingMode = (this.useGPSTracking && this.locationTracker && this.locationTracker.isLocationReady())
          ? 'GPS' : 'CAM';

        runInfo = covered.toFixed(0) + 'm / ' + this._runTarget.toFixed(0) + 'm\n[' + trackingMode + ']';
      }

      this.stationInfoText.text = 'Next: ' + nextName + '\n' + runInfo;
    }
  }

  private updateStationUI(): void {
    if (!this.stationInfoText || !this._currentConfig) return;

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
        var distTrackMode = (this.useGPSTracking && this.locationTracker && this.locationTracker.isLocationReady())
          ? 'GPS' : 'CAM';
        progressText = instruction + '\n' + progress.toFixed(1) + 'm / ' + target + 'm [' + distTrackMode + ']';
        break;

      case StationMode.REPS:
        progressText = instruction + '\n' + Math.floor(progress) + ' / ' + target + ' reps\n(Pinch to count)';
        break;

      case StationMode.ZONE_HIT:
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

  private updateTimerUI(): void {
    if (!this.timerText) return;
    this.timerText.text = this.formatTime(this.elapsedMs);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private formatTime(ms: number): string {
    var totalSec = Math.floor(ms / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    var centis = Math.floor((ms % 1000) / 10);
    return this.pad2(min) + ':' + this.pad2(sec) + '.' + this.pad2(centis);
  }

  private pad2(n: number): string {
    return n < 10 ? '0' + n : '' + n;
  }
}
