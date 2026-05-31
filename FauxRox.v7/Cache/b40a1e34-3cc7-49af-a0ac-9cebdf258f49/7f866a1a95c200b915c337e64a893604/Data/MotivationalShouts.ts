// ============================================================================
// MotivationalShouts.ts — AI Motivational Shouts for HYROX
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Automatic motivational messages based on:
// - Station completion
// - HR zone changes
// - PB comparison (cached, no cloud latency)
// - Time-based encouragement
// ============================================================================

import { RaceStateMachine } from './RaceStateMachine';
import { HeartRateTracker, HRZone } from './HeartRateTracker';
import { CloudManager } from './CloudManager';

@component
export class MotivationalShouts extends BaseScriptComponent {

  // ── References ────────────────────────────────────────────────────────────

  @ui.separator
  @ui.label('Motivational Shouts System')
  @ui.separator

  @input raceStateMachine: RaceStateMachine;
  @input @allowUndefined heartRateTracker: HeartRateTracker;
  @input @allowUndefined cloudManager: CloudManager;

  // ── UI ────────────────────────────────────────────────────────────────────

  @ui.separator
  @ui.group_start('Display')
  @input shoutText: Text;
  @input shoutDuration: number = 2.5;
  @ui.group_end

  // ── Settings ──────────────────────────────────────────────────────────────

  @ui.separator
  @ui.group_start('Settings')
  @input enabled: boolean = true;
  @input minShoutInterval: number = 8.0;
  @input debugPrint: boolean = true;
  @ui.group_end

  // ── State ─────────────────────────────────────────────────────────────────

  private lastShoutTime: number = 0;
  private lastState: string = 'IDLE';
  private lastStationIndex: number = -1;
  private lastHRZone: HRZone = HRZone.ZONE_1;
  private shoutHideTime: number = 0;
  private cachedPBTime: number = 0;
  private cachedPBSplits: { name: string; duration: number }[] = [];

  // ── Templates ─────────────────────────────────────────────────────────────

  private stationCompleteShouts: string[] = [
    "CRUSHED IT!",
    "BEAST MODE!",
    "UNSTOPPABLE!",
    "LET'S GO!",
    "NAILED IT!",
    "KEEP PUSHING!",
  ];

  private hrZone4Shouts: string[] = [
    "FEELING THE BURN!",
    "PUSH THROUGH!",
    "YOU GOT THIS!",
    "STAY STRONG!",
  ];

  private hrZone5Shouts: string[] = [
    "MAX EFFORT!",
    "ALL OUT!",
    "FINISH STRONG!",
    "DIG DEEP!",
  ];

  private hrZone1Shouts: string[] = [
    "PICK IT UP!",
    "LET'S MOVE!",
    "TIME TO PUSH!",
  ];

  private pbAheadShouts: string[] = [
    "AHEAD OF PB!",
    "NEW RECORD PACE!",
    "BEATING YOUR BEST!",
  ];

  private pbBehindShouts: string[] = [
    "PUSH FOR PB!",
    "YOU CAN CATCH IT!",
  ];

  private halfwayShouts: string[] = [
    "HALFWAY THERE!",
    "SECOND HALF!",
    "DOWNHILL FROM HERE!",
  ];

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onAwake(): void {
    this.log('MotivationalShouts initialized');

    if (this.shoutText) {
      this.shoutText.text = '';
    }

    this.createEvent('OnStartEvent').bind(() => {
      this.fetchCachedPB();
    });

    this.createEvent('UpdateEvent').bind(() => {
      this.onUpdate();
    });
  }

  // ── Cached PB ─────────────────────────────────────────────────────────────

  private async fetchCachedPB(): Promise<void> {
    if (!this.cloudManager) return;

    try {
      const pb = await this.cloudManager.getPersonalBest();
      if (pb) {
        this.cachedPBTime = pb.totalTime;
        this.cachedPBSplits = pb.splits || [];
        this.log('Cached PB: ' + (pb.totalTime / 1000).toFixed(1) + 's');
      }
    } catch (e) {
      this.log('Failed to fetch PB: ' + e);
    }
  }

  // ── Update Loop ───────────────────────────────────────────────────────────

  private onUpdate(): void {
    if (!this.enabled) return;
    if (!this.raceStateMachine) return;

    const now = getTime();

    // Hide shout after duration
    if (this.shoutHideTime > 0 && now >= this.shoutHideTime) {
      this.hideShout();
    }

    // Get current state
    const rsm = this.raceStateMachine as any;
    const currentState = rsm.state || 'IDLE';
    const currentStation = rsm.currentStationIndex || 0;

    // Detect state changes
    if (currentState !== this.lastState) {
      this.onStateChange(this.lastState, currentState, currentStation);
      this.lastState = currentState;
    }

    // Detect station changes (within RUNNING or STATION)
    if (currentStation !== this.lastStationIndex) {
      if (this.lastStationIndex >= 0 && currentStation > this.lastStationIndex) {
        this.onStationComplete(this.lastStationIndex, currentStation);
      }
      this.lastStationIndex = currentStation;
    }

    // Check HR zone changes
    if (this.heartRateTracker && this.heartRateTracker.isConnected) {
      const currentZone = this.heartRateTracker.currentZone;
      if (currentZone !== this.lastHRZone) {
        this.onHRZoneChange(this.lastHRZone, currentZone);
        this.lastHRZone = currentZone;
      }
    }

    // Check PB comparison periodically (every ~10 seconds during race)
    if ((currentState === 'RUNNING' || currentState === 'STATION') && this.cachedPBTime > 0) {
      this.checkPBComparison(rsm);
    }
  }

  // ── Event Handlers ────────────────────────────────────────────────────────

  private onStateChange(from: string, to: string, stationIndex: number): void {
    this.log('State: ' + from + ' → ' + to);

    // Race started
    if (from === 'COUNTDOWN' && to === 'RUNNING') {
      this.showShout("LET'S GO!");
    }

    // Race finished
    if (to === 'FINISHED' && from !== 'IDLE') {
      this.showShout("FINISHED!");
    }
  }

  private onStationComplete(fromStation: number, toStation: number): void {
    this.log('Station complete: ' + fromStation + ' → ' + toStation);

    // Don't shout for START station (index 0)
    if (fromStation === 0) return;

    const totalStations = 9; // Including FINISH
    const completed = fromStation;
    const remaining = totalStations - toStation;

    // Halfway point
    if (completed === 4) {
      this.showShout(this.randomShout(this.halfwayShouts));
      return;
    }

    // Station complete shout with progress
    if (this.canShout()) {
      const progressShout = completed + ' DOWN, ' + remaining + ' TO GO!';

      // 50% chance to show progress, 50% to show motivational
      if (Math.random() < 0.5) {
        this.showShout(progressShout);
      } else {
        this.showShout(this.randomShout(this.stationCompleteShouts));
      }
    }
  }

  private onHRZoneChange(from: HRZone, to: HRZone): void {
    this.log('HR Zone: ' + from + ' → ' + to);

    if (!this.canShout()) return;

    // Entering high zones
    if (to === HRZone.ZONE_5 && from < HRZone.ZONE_5) {
      this.showShout(this.randomShout(this.hrZone5Shouts));
    } else if (to === HRZone.ZONE_4 && from < HRZone.ZONE_4) {
      this.showShout(this.randomShout(this.hrZone4Shouts));
    }
    // Dropping to low zone (needs push)
    else if (to === HRZone.ZONE_1 && from > HRZone.ZONE_2) {
      this.showShout(this.randomShout(this.hrZone1Shouts));
    }
  }

  private lastPBCheckTime: number = 0;
  private pbCheckInterval: number = 15.0; // Check every 15 seconds

  private checkPBComparison(rsm: any): void {
    const now = getTime();
    if (now - this.lastPBCheckTime < this.pbCheckInterval) return;
    this.lastPBCheckTime = now;

    if (!this.canShout()) return;

    const currentTime = rsm.elapsedMs || 0;
    const currentStation = rsm.currentStationIndex || 0;

    // Find corresponding PB split time
    let pbTimeAtStation = 0;
    for (let i = 0; i < currentStation && i < this.cachedPBSplits.length; i++) {
      pbTimeAtStation += this.cachedPBSplits[i].duration;
    }

    if (pbTimeAtStation <= 0) return;

    const diff = currentTime - pbTimeAtStation;

    // Ahead of PB by more than 5 seconds
    if (diff < -5000) {
      this.showShout(this.randomShout(this.pbAheadShouts));
    }
    // Behind PB by more than 10 seconds
    else if (diff > 10000) {
      this.showShout(this.randomShout(this.pbBehindShouts));
    }
  }

  // ── Shout Display ─────────────────────────────────────────────────────────

  private canShout(): boolean {
    const now = getTime();
    return (now - this.lastShoutTime) >= this.minShoutInterval;
  }

  private showShout(message: string): void {
    if (!this.shoutText) return;

    this.log('SHOUT: ' + message);
    this.shoutText.text = message;
    this.lastShoutTime = getTime();
    this.shoutHideTime = getTime() + this.shoutDuration;
  }

  private hideShout(): void {
    if (this.shoutText) {
      this.shoutText.text = '';
    }
    this.shoutHideTime = 0;
  }

  private randomShout(array: string[]): string {
    return array[Math.floor(Math.random() * array.length)];
  }

  // ── Debug ─────────────────────────────────────────────────────────────────

  private log(msg: string): void {
    if (this.debugPrint) {
      print('[MotivationalShouts] ' + msg);
    }
  }
}
