// ============================================================================
// RaceStateMachine.ts — HYROX MIRAGE Core Game Loop
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Attach to "RaceController" SceneObject.
// References CourseManager and ProximityDetector via @input.
// ============================================================================

// ── Race States ─────────────────────────────────────────────────────────────

enum RaceState {
  IDLE        = 'IDLE',
  COUNTDOWN   = 'COUNTDOWN',
  RUNNING     = 'RUNNING',
  STATION     = 'STATION',
  PAUSED      = 'PAUSED',
  FINISHED    = 'FINISHED',
}

// ============================================================================

@component
export class RaceStateMachine extends BaseScriptComponent {

  // ── Inspector Inputs ────────────────────────────────────────────────────

  /** Drag CourseRoot here → picks up CourseManager component */
  @input courseManager: CourseManager;

  /** Drag RaceController here → picks up ProximityDetector component */
  @input proximityDetector: ProximityDetector;

  /** Head-locked UI texts */
  @input statusText: Text;
  @input timerText: Text;
  @input stationInfoText: Text;

  /** Optional finish VFX object (enabled on last station) */
  @input @allowUndefined finishTunnelVfx: SceneObject;

  /** Countdown duration */
  @input countdownSeconds: number = 3;

  /** Seconds user holds at station to complete it */
  @input stationHoldTime: number = 5.0;

  // ── Internal State ──────────────────────────────────────────────────────

  private _state: RaceState = RaceState.IDLE;
  private _raceStartTime: number = 0;
  private _stationArrivalTime: number = 0;
  private _currentStationIndex: number = -1;
  private _countdownRemaining: number = 0;
  private _stationHoldElapsed: number = 0;
  private _isInsideStation: boolean = false;
  private _pausedFromState: RaceState = RaceState.RUNNING;

  // Split tracking
  private _splitStationNames: string[] = [];
  private _splitArrivalTimes: number[] = [];
  private _splitCompletionTimes: number[] = [];
  private _splitDurations: number[] = [];

  // ── Public Getters ──────────────────────────────────────────────────────

  get state(): RaceState { return this._state; }
  get currentStationIndex(): number { return this._currentStationIndex; }
  get elapsedMs(): number {
    if (this._raceStartTime === 0) return 0;
    return (getTime() * 1000) - this._raceStartTime;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  onAwake(): void {
    this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));

    // Wire up proximity callbacks
    if (this.proximityDetector) {
      this.proximityDetector.onStationEnter = (index: number, name: string, dist: number) => {
        this.handleStationEnter(index, name);
      };
      this.proximityDetector.onStationExit = (index: number, name: string, dist: number) => {
        this.handleStationExit(index, name);
      };
    }

    this.setUIState(RaceState.IDLE);
    print('[RaceStateMachine] Init — state: IDLE');
  }

  // ── Public API ────────────────────────────────────────────────────────

  /** Start the race. Call after course is placed. */
  startRace(): void {
    if (this._state !== RaceState.IDLE && this._state !== RaceState.FINISHED) {
      print('[RaceStateMachine] Cannot start from state ' + this._state);
      return;
    }

    if (!this.courseManager || this.courseManager.stationCount === 0) {
      print('[RaceStateMachine] ERROR: No stations!');
      return;
    }

    // Reset splits
    this._splitStationNames = [];
    this._splitArrivalTimes = [];
    this._splitCompletionTimes = [];
    this._splitDurations = [];

    this._currentStationIndex = 0;
    this._stationHoldElapsed = 0;
    this._isInsideStation = false;
    this._countdownRemaining = this.countdownSeconds;

    // Tell proximity detector about stations
    if (this.proximityDetector) {
      this.proximityDetector.refreshStations();
      this.proximityDetector.setActiveStation(0);
    }

    this.transitionTo(RaceState.COUNTDOWN);
    print('[RaceStateMachine] Countdown started');
  }

  /** Pause / resume toggle */
  togglePause(): void {
    if (this._state === RaceState.RUNNING || this._state === RaceState.STATION) {
      this._pausedFromState = this._state;
      this.transitionTo(RaceState.PAUSED);
    } else if (this._state === RaceState.PAUSED) {
      this.transitionTo(this._pausedFromState);
    }
  }

  /** Full reset */
  resetRace(): void {
    this._state = RaceState.IDLE;
    this._raceStartTime = 0;
    this._currentStationIndex = -1;
    this._splitStationNames = [];
    this._splitArrivalTimes = [];
    this._splitCompletionTimes = [];
    this._splitDurations = [];
    this._stationHoldElapsed = 0;
    this._isInsideStation = false;

    if (this.finishTunnelVfx) {
      this.finishTunnelVfx.enabled = false;
    }

    this.setUIState(RaceState.IDLE);
    print('[RaceStateMachine] Reset to IDLE');
  }

  // ── Per-Frame Update ──────────────────────────────────────────────────

  private onUpdate(): void {
    var dt = getDeltaTime();

    switch (this._state) {

      case RaceState.COUNTDOWN:
        this._countdownRemaining -= dt;
        this.updateCountdownUI();
        if (this._countdownRemaining <= 0) {
          this._raceStartTime = getTime() * 1000;
          this.transitionTo(RaceState.RUNNING);
          print('[RaceStateMachine] GO!');
        }
        break;

      case RaceState.RUNNING:
        this.updateTimerUI();
        break;

      case RaceState.STATION:
        this.updateTimerUI();
        if (this._isInsideStation) {
          this._stationHoldElapsed += dt;
          this.updateStationProgressUI();
          if (this._stationHoldElapsed >= this.stationHoldTime) {
            this.completeCurrentStation();
          }
        }
        break;

      case RaceState.PAUSED:
        break;
      case RaceState.FINISHED:
        break;
      case RaceState.IDLE:
        break;
    }
  }

  // ── Proximity Callbacks ───────────────────────────────────────────────

  private handleStationEnter(stationIndex: number, stationName: string): void {
    if (this._state !== RaceState.RUNNING) return;
    if (stationIndex !== this._currentStationIndex) return;

    print('[RaceStateMachine] Entered station ' + stationIndex + ': ' + stationName);

    this._isInsideStation = true;
    this._stationHoldElapsed = 0;
    this._stationArrivalTime = getTime() * 1000;

    // Show finish VFX on last station
    if (this.courseManager && stationIndex === this.courseManager.stationCount - 1) {
      if (this.finishTunnelVfx) {
        this.finishTunnelVfx.enabled = true;
      }
    }

    this.transitionTo(RaceState.STATION);
  }

  private handleStationExit(stationIndex: number, stationName: string): void {
    if (this._state !== RaceState.STATION) return;
    if (stationIndex !== this._currentStationIndex) return;

    print('[RaceStateMachine] Exited station ' + stationIndex + ' before completion');
    this._isInsideStation = false;
    this._stationHoldElapsed = 0;
    this.transitionTo(RaceState.RUNNING);
  }

  // ── Station Completion ────────────────────────────────────────────────

  private completeCurrentStation(): void {
    var now = getTime() * 1000;
    var name = this.courseManager.stationNames[this._currentStationIndex];
    var duration = now - this._stationArrivalTime;

    this._splitStationNames.push(name);
    this._splitArrivalTimes.push(this._stationArrivalTime - this._raceStartTime);
    this._splitCompletionTimes.push(now - this._raceStartTime);
    this._splitDurations.push(duration);

    print('[RaceStateMachine] Station ' + this._currentStationIndex
      + ' complete — ' + (duration / 1000).toFixed(1) + 's');

    this._currentStationIndex++;
    this._isInsideStation = false;
    this._stationHoldElapsed = 0;

    if (this._currentStationIndex >= this.courseManager.stationCount) {
      this.finishRace();
    } else {
      // Advance highlight and proximity target
      this.courseManager.highlightStation(this._currentStationIndex);
      if (this.proximityDetector) {
        this.proximityDetector.setActiveStation(this._currentStationIndex);
      }
      this.transitionTo(RaceState.RUNNING);
    }
  }

  private finishRace(): void {
    var totalMs = (getTime() * 1000) - this._raceStartTime;
    this.transitionTo(RaceState.FINISHED);
    this.showResults(totalMs);
    print('[RaceStateMachine] FINISHED! Total: ' + (totalMs / 1000).toFixed(1) + 's');
  }

  // ── State Transition ──────────────────────────────────────────────────

  private transitionTo(newState: RaceState): void {
    var prev = this._state;
    this._state = newState;
    this.setUIState(newState);
    print('[RaceStateMachine] ' + prev + ' -> ' + newState);
  }

  // ── UI ────────────────────────────────────────────────────────────────

  private setUIState(state: RaceState): void {
    if (!this.statusText) return;

    switch (state) {
      case RaceState.IDLE:
        this.statusText.text = 'HYROX MIRAGE\nPinch to Start';
        if (this.stationInfoText) this.stationInfoText.text = '';
        if (this.timerText) this.timerText.text = '00:00';
        break;

      case RaceState.RUNNING:
        this.statusText.text = 'RUN';
        if (this.stationInfoText && this.courseManager) {
          var nextName = this.courseManager.stationNames[this._currentStationIndex] || '';
          var nextDist = this.courseManager.stationDistanceLabels[this._currentStationIndex] || '';
          this.stationInfoText.text = 'Next: ' + nextName + ' (' + nextDist + ')';
        }
        break;

      case RaceState.STATION:
        if (this.courseManager) {
          this.statusText.text = this.courseManager.stationNames[this._currentStationIndex] || 'STATION';
        }
        break;

      case RaceState.PAUSED:
        this.statusText.text = 'PAUSED\nPinch to Resume';
        break;

      default:
        break;
    }
  }

  private updateCountdownUI(): void {
    if (!this.statusText) return;
    var displayNum = Math.ceil(this._countdownRemaining);
    this.statusText.text = displayNum > 0 ? displayNum.toString() : 'GO!';
  }

  private updateTimerUI(): void {
    if (!this.timerText) return;
    var elapsed = this.elapsedMs;
    var totalSec = Math.floor(elapsed / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    var ms = Math.floor((elapsed % 1000) / 10);
    this.timerText.text = this.pad2(min) + ':' + this.pad2(sec) + '.' + this.pad2(ms);
  }

  private updateStationProgressUI(): void {
    if (!this.stationInfoText) return;
    var pct = Math.min(100, (this._stationHoldElapsed / this.stationHoldTime) * 100);
    var barLen = 10;
    var filled = Math.round((pct / 100) * barLen);
    // Use simple chars for progress since emoji may not render on Spectacles
    var bar = '';
    for (var i = 0; i < barLen; i++) {
      bar += i < filled ? '#' : '-';
    }
    this.stationInfoText.text = '[' + bar + '] ' + Math.floor(pct) + '%';
  }

  private showResults(totalMs: number): void {
    if (this.statusText) {
      this.statusText.text = 'FINISHED!';
    }
    if (this.timerText) {
      this.timerText.text = (totalMs / 1000).toFixed(1) + 's';
    }
    if (this.stationInfoText) {
      var fastIdx = this.findFastestSplit();
      var slowIdx = this.findSlowestSplit();
      var lines = '';
      for (var i = 0; i < this._splitStationNames.length; i++) {
        var dur = (this._splitDurations[i] / 1000).toFixed(1);
        var tag = i === fastIdx ? ' *FAST*' : i === slowIdx ? ' *SLOW*' : '';
        lines += this._splitStationNames[i] + ': ' + dur + 's' + tag + '\n';
      }
      this.stationInfoText.text = lines;
    }
  }

  // ── Utility ───────────────────────────────────────────────────────────

  private pad2(n: number): string {
    return n < 10 ? '0' + n : '' + n;
  }

  private findFastestSplit(): number {
    var idx = 0;
    var best = Infinity;
    for (var i = 0; i < this._splitDurations.length; i++) {
      if (this._splitDurations[i] < best) {
        best = this._splitDurations[i];
        idx = i;
      }
    }
    return idx;
  }

  private findSlowestSplit(): number {
    var idx = 0;
    var worst = 0;
    for (var i = 0; i < this._splitDurations.length; i++) {
      if (this._splitDurations[i] > worst) {
        worst = this._splitDurations[i];
        idx = i;
      }
    }
    return idx;
  }
}
