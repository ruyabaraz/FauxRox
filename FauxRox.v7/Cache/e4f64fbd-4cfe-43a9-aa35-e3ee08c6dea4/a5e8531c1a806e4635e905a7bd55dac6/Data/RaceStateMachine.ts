// ============================================================================
// RaceStateMachine.ts — HYROX MIRAGE Core Game Loop
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Attach to "RaceController" SceneObject.
// ============================================================================

enum RaceState {
  IDLE        = 'IDLE',
  COUNTDOWN   = 'COUNTDOWN',
  RUNNING     = 'RUNNING',
  STATION     = 'STATION',
  PAUSED      = 'PAUSED',
  FINISHED    = 'FINISHED',
}

@component
export class RaceStateMachine extends BaseScriptComponent {

  @input courseManagerScript: ScriptComponent;
  @input proximityDetectorScript: ScriptComponent;
  @input statusText: Text;
  @input timerText: Text;
  @input stationInfoText: Text;
  @input @allowUndefined finishTunnelVfx: SceneObject;
  @input countdownSeconds: number = 3;
  @input stationHoldTime: number = 5.0;

  private cm(): any { return this.courseManagerScript as any; }
  private pd(): any { return this.proximityDetectorScript as any; }

  private _state: RaceState = RaceState.IDLE;
  private _raceStartTime: number = 0;
  private _stationArrivalTime: number = 0;
  private _currentStationIndex: number = -1;
  private _countdownRemaining: number = 0;
  private _stationHoldElapsed: number = 0;
  private _isInsideStation: boolean = false;
  private _pausedFromState: RaceState = RaceState.RUNNING;
  private _splitNames: string[] = [];
  private _splitDurations: number[] = [];

  get state(): string { return this._state; }
  get currentStationIndex(): number { return this._currentStationIndex; }
  get elapsedMs(): number {
    if (this._raceStartTime === 0) return 0;
    return (getTime() * 1000) - this._raceStartTime;
  }

  onAwake(): void {
    this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));

    var detector = this.pd();
    if (detector) {
      detector.onStationEnter = (index: number, name: string, dist: number) => {
        this.handleStationEnter(index, name);
      };
      detector.onStationExit = (index: number, name: string, dist: number) => {
        this.handleStationExit(index, name);
      };
    }

    this.setUIIdle();
    print('[RaceStateMachine] Init — IDLE');
  }

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

    this._splitNames = [];
    this._splitDurations = [];
    this._currentStationIndex = 0;
    this._stationHoldElapsed = 0;
    this._isInsideStation = false;
    this._countdownRemaining = this.countdownSeconds;

    var detector = this.pd();
    if (detector) {
      detector.refreshStations();
      detector.setActiveStation(0);
    }

    this._state = RaceState.COUNTDOWN;
    print('[RaceStateMachine] Countdown');
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
    this._state = RaceState.IDLE;
    this._raceStartTime = 0;
    this._currentStationIndex = -1;
    this._splitNames = [];
    this._splitDurations = [];
    this._stationHoldElapsed = 0;
    this._isInsideStation = false;
    if (this.finishTunnelVfx) this.finishTunnelVfx.enabled = false;
    this.setUIIdle();
    print('[RaceStateMachine] Reset');
  }

  private onUpdate(): void {
    var dt = getDeltaTime();

    if (this._state === RaceState.COUNTDOWN) {
      this._countdownRemaining -= dt;
      if (this.statusText) {
        var num = Math.ceil(this._countdownRemaining);
        this.statusText.text = num > 0 ? num.toString() : 'GO!';
      }
      if (this._countdownRemaining <= 0) {
        this._raceStartTime = getTime() * 1000;
        this._state = RaceState.RUNNING;
        this.updateRunningUI();
        print('[RaceStateMachine] GO!');
      }
      return;
    }

    if (this._state === RaceState.RUNNING) {
      this.updateTimerUI();
      return;
    }

    if (this._state === RaceState.STATION) {
      this.updateTimerUI();
      if (this._isInsideStation) {
        this._stationHoldElapsed += dt;
        this.updateProgressUI();
        if (this._stationHoldElapsed >= this.stationHoldTime) {
          this.completeCurrentStation();
        }
      }
      return;
    }
  }

  private handleStationEnter(index: number, name: string): void {
    if (this._state !== RaceState.RUNNING) return;
    if (index !== this._currentStationIndex) return;

    this._isInsideStation = true;
    this._stationHoldElapsed = 0;
    this._stationArrivalTime = getTime() * 1000;

    var course = this.cm();
    if (course && index === course.stationCount - 1 && this.finishTunnelVfx) {
      this.finishTunnelVfx.enabled = true;
    }

    this._state = RaceState.STATION;
    if (this.statusText && course) {
      this.statusText.text = course.stationNames[index] || 'STATION';
    }
    print('[RaceStateMachine] Entered ' + index + ': ' + name);
  }

  private handleStationExit(index: number, name: string): void {
    if (this._state !== RaceState.STATION) return;
    if (index !== this._currentStationIndex) return;

    this._isInsideStation = false;
    this._stationHoldElapsed = 0;
    this._state = RaceState.RUNNING;
    this.updateRunningUI();
    print('[RaceStateMachine] Exited ' + index + ' early');
  }

  private completeCurrentStation(): void {
    var now = getTime() * 1000;
    var course = this.cm();
    var name = course ? course.stationNames[this._currentStationIndex] : 'Station';
    var duration = now - this._stationArrivalTime;

    this._splitNames.push(name);
    this._splitDurations.push(duration);

    print('[RaceStateMachine] ' + this._currentStationIndex + ' done — '
      + (duration / 1000).toFixed(1) + 's');

    this._currentStationIndex++;
    this._isInsideStation = false;
    this._stationHoldElapsed = 0;

    if (course && this._currentStationIndex >= course.stationCount) {
      this.finishRace();
    } else {
      if (course) course.highlightStation(this._currentStationIndex);
      var detector = this.pd();
      if (detector) detector.setActiveStation(this._currentStationIndex);
      this._state = RaceState.RUNNING;
      this.updateRunningUI();
    }
  }

  private finishRace(): void {
    var totalMs = (getTime() * 1000) - this._raceStartTime;
    this._state = RaceState.FINISHED;

    if (this.statusText) this.statusText.text = 'FINISHED!';
    if (this.timerText) this.timerText.text = (totalMs / 1000).toFixed(1) + 's';

    if (this.stationInfoText) {
      var fastIdx = 0; var slowIdx = 0;
      var best = Infinity; var worst = 0;
      for (var i = 0; i < this._splitDurations.length; i++) {
        if (this._splitDurations[i] < best) { best = this._splitDurations[i]; fastIdx = i; }
        if (this._splitDurations[i] > worst) { worst = this._splitDurations[i]; slowIdx = i; }
      }
      var lines = '';
      for (var j = 0; j < this._splitNames.length; j++) {
        var dur = (this._splitDurations[j] / 1000).toFixed(1);
        var tag = j === fastIdx ? ' *FAST*' : j === slowIdx ? ' *SLOW*' : '';
        lines += this._splitNames[j] + ': ' + dur + 's' + tag + '\n';
      }
      this.stationInfoText.text = lines;
    }
    print('[RaceStateMachine] FINISHED ' + (totalMs / 1000).toFixed(1) + 's');
  }

  private setUIIdle(): void {
    if (this.statusText) this.statusText.text = 'HYROX MIRAGE';
    if (this.stationInfoText) this.stationInfoText.text = '';
    if (this.timerText) this.timerText.text = '00:00';
  }

  private updateRunningUI(): void {
    if (this.statusText) this.statusText.text = 'RUN';
    var course = this.cm();
    if (this.stationInfoText && course) {
      var nextName = course.stationNames[this._currentStationIndex] || '';
      var nextDist = course.stationDistanceLabels[this._currentStationIndex] || '';
      this.stationInfoText.text = 'Next: ' + nextName + ' (' + nextDist + ')';
    }
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

  private updateProgressUI(): void {
    if (!this.stationInfoText) return;
    var pct = Math.min(100, (this._stationHoldElapsed / this.stationHoldTime) * 100);
    var barLen = 10;
    var filled = Math.round((pct / 100) * barLen);
    var bar = '';
    for (var i = 0; i < barLen; i++) { bar += i < filled ? '#' : '-'; }
    this.stationInfoText.text = '[' + bar + '] ' + Math.floor(pct) + '%';
  }

  private pad2(n: number): string {
    return n < 10 ? '0' + n : '' + n;
  }
}
