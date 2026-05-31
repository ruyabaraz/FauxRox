// ============================================================================
// RaceStateMachine.ts — HYROX MIRAGE Core Game Loop
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Attach this script to an empty SceneObject called "RaceController".
// Wire up the @input references in the Inspector after scene setup.
// ============================================================================

import { ProximityDetector, StationProximityEvent } from './ProximityDetector';
import { CourseManager, StationData } from './CourseManager';

// ── Race States ─────────────────────────────────────────────────────────────

export enum RaceState {
  IDLE        = 'IDLE',         // Course placed, waiting to start
  COUNTDOWN   = 'COUNTDOWN',    // 3-2-1 countdown
  RUNNING     = 'RUNNING',      // Active race, moving between stations
  STATION     = 'STATION',      // At a station, performing exercise
  PAUSED      = 'PAUSED',       // Race paused (hand gesture or voice)
  FINISHED    = 'FINISHED',     // All stations complete, showing results
}

// ── Split Time Record ───────────────────────────────────────────────────────

export interface SplitTime {
  stationIndex: number;
  stationName: string;
  arrivalTime: number;      // ms since race start
  completionTime: number;   // ms since race start
  durationMs: number;       // time spent at this station
}

// ── Race Result ─────────────────────────────────────────────────────────────

export interface RaceResult {
  totalTimeMs: number;
  splits: SplitTime[];
  stationsCompleted: number;
  stationsTotal: number;
  averageSplitMs: number;
  fastestSplitIndex: number;
  slowestSplitIndex: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

@component
export class RaceStateMachine extends BaseScriptComponent {

  // ── Inspector Inputs ────────────────────────────────────────────────────

  /** Reference to CourseManager component on CourseRoot */
  @input
  courseManager: CourseManager;

  /** Reference to ProximityDetector component on RaceController */
  @input
  proximityDetector: ProximityDetector;

  /** Text component for countdown / status display (head-locked UI) */
  @input
  statusText: Text;

  /** Text component for elapsed race time */
  @input
  timerText: Text;

  /** Text component for current station info / instructions */
  @input
  stationInfoText: Text;

  /** SceneObject for the finish tunnel VFX (enabled on last station) */
  @input
  @allowUndefined
  finishTunnelVfx: SceneObject;

  /** Countdown duration in seconds (default 3) */
  @input
  countdownSeconds: number = 3;

  /** Time (seconds) user must stay near a station to "complete" it.
   *  Simulates exercise duration for the prototype. */
  @input
  stationHoldTime: number = 5.0;

  // ── Internal State ──────────────────────────────────────────────────────

  private _state: RaceState = RaceState.IDLE;
  private _raceStartTime: number = 0;
  private _stationArrivalTime: number = 0;
  private _currentStationIndex: number = -1;
  private _splits: SplitTime[] = [];
  private _countdownRemaining: number = 0;
  private _stationHoldElapsed: number = 0;
  private _isInsideStation: boolean = false;
  private _updateEvent: SceneEvent;
  private _stations: StationData[] = [];

  // ── Public Getters ──────────────────────────────────────────────────────

  get state(): RaceState { return this._state; }
  get currentStationIndex(): number { return this._currentStationIndex; }
  get elapsedMs(): number {
    if (this._raceStartTime === 0) return 0;
    return (getTime() * 1000) - this._raceStartTime;
  }
  get splits(): ReadonlyArray<SplitTime> { return this._splits; }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  onAwake(): void {
    // Subscribe to per-frame update
    this._updateEvent = this.createEvent('UpdateEvent');
    this._updateEvent.bind(this.onUpdate.bind(this));

    // Subscribe to proximity events from ProximityDetector
    if (this.proximityDetector) {
      this.proximityDetector.onStationEnter = this.handleStationEnter.bind(this);
      this.proximityDetector.onStationExit = this.handleStationExit.bind(this);
    }

    this.setUIState(RaceState.IDLE);
    print('[RaceStateMachine] Initialized — state: IDLE');
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Call this to start the race. Typically triggered by a hand-pinch
   * on a "START" UI button or voice command.
   */
  startRace(): void {
    if (this._state !== RaceState.IDLE && this._state !== RaceState.FINISHED) {
      print('[RaceStateMachine] Cannot start: current state is ' + this._state);
      return;
    }

    // Grab station list from CourseManager
    if (this.courseManager) {
      this._stations = this.courseManager.getStations();
    }
    if (this._stations.length === 0) {
      print('[RaceStateMachine] ERROR: No stations from CourseManager!');
      return;
    }

    this._splits = [];
    this._currentStationIndex = 0;
    this._stationHoldElapsed = 0;
    this._isInsideStation = false;
    this._countdownRemaining = this.countdownSeconds;

    this.transitionTo(RaceState.COUNTDOWN);
    print('[RaceStateMachine] Countdown started');
  }

  /**
   * Pause / resume toggle. Can be wired to a pinch-hold gesture.
   */
  togglePause(): void {
    if (this._state === RaceState.RUNNING || this._state === RaceState.STATION) {
      this._pausedFromState = this._state;
      this.transitionTo(RaceState.PAUSED);
    } else if (this._state === RaceState.PAUSED) {
      this.transitionTo(this._pausedFromState);
    }
  }
  private _pausedFromState: RaceState = RaceState.RUNNING;

  /**
   * Full reset back to IDLE. Resets timer, splits, station index.
   */
  resetRace(): void {
    this._state = RaceState.IDLE;
    this._raceStartTime = 0;
    this._currentStationIndex = -1;
    this._splits = [];
    this._stationHoldElapsed = 0;
    this._isInsideStation = false;

    if (this.finishTunnelVfx) {
      this.finishTunnelVfx.enabled = false;
    }

    this.setUIState(RaceState.IDLE);
    print('[RaceStateMachine] Race reset to IDLE');
  }

  // ── Per-Frame Update ──────────────────────────────────────────────────

  private onUpdate(): void {
    const dt = getDeltaTime();

    switch (this._state) {

      case RaceState.COUNTDOWN:
        this._countdownRemaining -= dt;
        this.updateCountdownUI();
        if (this._countdownRemaining <= 0) {
          this._raceStartTime = getTime() * 1000;
          this.transitionTo(RaceState.RUNNING);
          print('[RaceStateMachine] GO! Race started.');
        }
        break;

      case RaceState.RUNNING:
        this.updateTimerUI();
        // ProximityDetector handles enter/exit callbacks
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
        // Timer frozen, show pause UI
        break;

      case RaceState.FINISHED:
        // Static results screen
        break;

      case RaceState.IDLE:
        // Waiting for startRace()
        break;
    }
  }

  // ── Proximity Callbacks ───────────────────────────────────────────────

  private handleStationEnter(event: StationProximityEvent): void {
    // Only react if we're RUNNING and this is the NEXT station
    if (this._state !== RaceState.RUNNING) return;
    if (event.stationIndex !== this._currentStationIndex) return;

    print('[RaceStateMachine] Entered station ' + event.stationIndex + ': ' + event.stationName);

    this._isInsideStation = true;
    this._stationHoldElapsed = 0;
    this._stationArrivalTime = getTime() * 1000;

    // Check if this is the last station → show finish tunnel
    if (event.stationIndex === this._stations.length - 1 && this.finishTunnelVfx) {
      this.finishTunnelVfx.enabled = true;
    }

    this.transitionTo(RaceState.STATION);
  }

  private handleStationExit(event: StationProximityEvent): void {
    if (this._state !== RaceState.STATION) return;
    if (event.stationIndex !== this._currentStationIndex) return;

    // User walked away before completing the hold — reset hold timer
    print('[RaceStateMachine] Exited station ' + event.stationIndex + ' before completion');
    this._isInsideStation = false;
    this._stationHoldElapsed = 0;

    // Go back to RUNNING — they need to re-enter
    this.transitionTo(RaceState.RUNNING);
  }

  // ── Station Completion ────────────────────────────────────────────────

  private completeCurrentStation(): void {
    const now = getTime() * 1000;
    const station = this._stations[this._currentStationIndex];

    const split: SplitTime = {
      stationIndex: this._currentStationIndex,
      stationName: station.name,
      arrivalTime: this._stationArrivalTime - this._raceStartTime,
      completionTime: now - this._raceStartTime,
      durationMs: now - this._stationArrivalTime,
    };
    this._splits.push(split);

    print('[RaceStateMachine] Station ' + split.stationIndex
      + ' complete — split: ' + (split.durationMs / 1000).toFixed(1) + 's');

    // Advance to next station or finish
    this._currentStationIndex++;
    this._isInsideStation = false;
    this._stationHoldElapsed = 0;

    if (this._currentStationIndex >= this._stations.length) {
      this.finishRace();
    } else {
      // Tell CourseManager to highlight next station
      if (this.courseManager) {
        this.courseManager.highlightStation(this._currentStationIndex);
      }
      this.transitionTo(RaceState.RUNNING);
    }
  }

  private finishRace(): void {
    const totalMs = (getTime() * 1000) - this._raceStartTime;

    const result: RaceResult = {
      totalTimeMs: totalMs,
      splits: this._splits,
      stationsCompleted: this._splits.length,
      stationsTotal: this._stations.length,
      averageSplitMs: totalMs / this._splits.length,
      fastestSplitIndex: this.findFastestSplit(),
      slowestSplitIndex: this.findSlowestSplit(),
    };

    this.transitionTo(RaceState.FINISHED);
    this.showResults(result);

    print('[RaceStateMachine] FINISHED! Total: '
      + (totalMs / 1000).toFixed(1) + 's across '
      + result.stationsCompleted + ' stations');
  }

  // ── State Transition ──────────────────────────────────────────────────

  private transitionTo(newState: RaceState): void {
    const prev = this._state;
    this._state = newState;
    this.setUIState(newState);
    print('[RaceStateMachine] ' + prev + ' → ' + newState);
  }

  // ── UI Helpers ────────────────────────────────────────────────────────

  private setUIState(state: RaceState): void {
    if (!this.statusText) return;

    switch (state) {
      case RaceState.IDLE:
        this.statusText.text = 'HYROX MIRAGE\nPinch to Start';
        if (this.stationInfoText) this.stationInfoText.text = '';
        if (this.timerText) this.timerText.text = '00:00';
        break;
      case RaceState.COUNTDOWN:
        // Updated per-frame in updateCountdownUI
        break;
      case RaceState.RUNNING:
        const nextStation = this._stations[this._currentStationIndex];
        this.statusText.text = 'RUN →';
        if (this.stationInfoText && nextStation) {
          this.stationInfoText.text = 'Next: ' + nextStation.name
            + ' (' + nextStation.distanceLabel + ')';
        }
        break;
      case RaceState.STATION:
        const curStation = this._stations[this._currentStationIndex];
        this.statusText.text = curStation ? curStation.name : 'STATION';
        break;
      case RaceState.PAUSED:
        this.statusText.text = 'PAUSED\nPinch to Resume';
        break;
      case RaceState.FINISHED:
        // showResults handles this
        break;
    }
  }

  private updateCountdownUI(): void {
    if (!this.statusText) return;
    const displayNum = Math.ceil(this._countdownRemaining);
    if (displayNum > 0) {
      this.statusText.text = displayNum.toString();
    } else {
      this.statusText.text = 'GO!';
    }
  }

  private updateTimerUI(): void {
    if (!this.timerText) return;
    const elapsed = this.elapsedMs;
    const totalSec = Math.floor(elapsed / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const ms = Math.floor((elapsed % 1000) / 10);
    this.timerText.text = this.pad2(min) + ':' + this.pad2(sec) + '.' + this.pad2(ms);
  }

  private updateStationProgressUI(): void {
    if (!this.stationInfoText) return;
    const pct = Math.min(100, (this._stationHoldElapsed / this.stationHoldTime) * 100);
    const barLen = 10;
    const filled = Math.round((pct / 100) * barLen);
    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
    this.stationInfoText.text = bar + ' ' + Math.floor(pct) + '%';
  }

  private showResults(result: RaceResult): void {
    if (this.statusText) {
      this.statusText.text = '🏁 FINISHED!';
    }
    if (this.timerText) {
      const sec = (result.totalTimeMs / 1000).toFixed(1);
      this.timerText.text = sec + 's TOTAL';
    }
    if (this.stationInfoText) {
      let lines = '';
      for (let i = 0; i < result.splits.length; i++) {
        const s = result.splits[i];
        const dur = (s.durationMs / 1000).toFixed(1);
        const tag = i === result.fastestSplitIndex ? ' ⚡'
                  : i === result.slowestSplitIndex ? ' 🐢'
                  : '';
        lines += s.stationName + ': ' + dur + 's' + tag + '\n';
      }
      this.stationInfoText.text = lines;
    }
  }

  // ── Utility ───────────────────────────────────────────────────────────

  private pad2(n: number): string {
    return n < 10 ? '0' + n : '' + n;
  }

  private findFastestSplit(): number {
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < this._splits.length; i++) {
      if (this._splits[i].durationMs < best) {
        best = this._splits[i].durationMs;
        idx = i;
      }
    }
    return idx;
  }

  private findSlowestSplit(): number {
    let idx = 0;
    let worst = 0;
    for (let i = 0; i < this._splits.length; i++) {
      if (this._splits[i].durationMs > worst) {
        worst = this._splits[i].durationMs;
        idx = i;
      }
    }
    return idx;
  }
}
