// ============================================================================
// MotivationalShouts.ts — AI Motivational Shouts for HYROX
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Automatic voice motivational messages based on:
// - Station completion
// - HR zone changes
// - PB comparison (cached, no cloud latency)
// Uses AICoach's Gemini Live for voice output
// ============================================================================

import { RaceStateMachine } from './RaceStateMachine';
import { HeartRateTracker, HRZone } from './HeartRateTracker';
import { CloudManager } from './CloudManager';
import { AICoach } from './AICoach';

@component
export class MotivationalShouts extends BaseScriptComponent {

  // ── References ────────────────────────────────────────────────────────────

  @ui.separator
  @ui.label('Motivational Shouts System')
  @ui.separator

  @input raceStateMachine: RaceStateMachine;
  @input aiCoach: AICoach;
  @input @allowUndefined heartRateTracker: HeartRateTracker;
  @input @allowUndefined cloudManager: CloudManager;

  // ── Settings ──────────────────────────────────────────────────────────────

  @ui.separator
  @ui.group_start('Settings')
  @input enabled: boolean = true;
  @input minShoutInterval: number = 15.0;
  @input debugPrint: boolean = true;
  @ui.group_end

  // ── State ─────────────────────────────────────────────────────────────────

  private lastShoutTime: number = 0;
  private lastState: string = 'IDLE';
  private lastStationIndex: number = -1;
  private lastHRZone: HRZone = HRZone.ZONE_1;
  private cachedPBTime: number = 0;
  private cachedPBSplits: { name: string; duration: number }[] = [];

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onAwake(): void {
    this.log('MotivationalShouts initialized');

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

    // Check PB comparison periodically
    if ((currentState === 'RUNNING' || currentState === 'STATION') && this.cachedPBTime > 0) {
      this.checkPBComparison(rsm);
    }
  }

  // ── Event Handlers ────────────────────────────────────────────────────────

  private onStateChange(from: string, to: string, stationIndex: number): void {
    this.log('State: ' + from + ' → ' + to);

    // Race started
    if (from === 'COUNTDOWN' && to === 'RUNNING') {
      this.shout("Let's go! You got this!");
    }

    // Race finished
    if (to === 'FINISHED' && from !== 'IDLE') {
      this.shout("Amazing! You finished!");
    }
  }

  private onStationComplete(fromStation: number, toStation: number): void {
    this.log('Station complete: ' + fromStation + ' → ' + toStation);

    // Don't shout for START station (index 0)
    if (fromStation === 0) return;

    const totalStations = 9;
    const completed = fromStation;
    const remaining = totalStations - toStation;

    if (!this.canShout()) return;

    // Halfway point
    if (completed === 4) {
      this.shout("Halfway there! Keep pushing!");
      return;
    }

    // Last station before finish
    if (remaining === 1) {
      this.shout("Last one! Give it everything!");
      return;
    }

    // Regular station complete
    this.shout(completed + " down, " + remaining + " to go!");
  }

  private onHRZoneChange(from: HRZone, to: HRZone): void {
    this.log('HR Zone: ' + from + ' → ' + to);

    if (!this.canShout()) return;

    // Entering zone 5 (max effort)
    if (to === HRZone.ZONE_5 && from < HRZone.ZONE_5) {
      this.shout("Max effort! You're on fire!");
    }
    // Entering zone 4
    else if (to === HRZone.ZONE_4 && from < HRZone.ZONE_4) {
      this.shout("Push through the burn!");
    }
    // Dropping to zone 1 (needs push)
    else if (to === HRZone.ZONE_1 && from > HRZone.ZONE_2) {
      this.shout("Pick up the pace!");
    }
  }

  private lastPBCheckTime: number = 0;
  private pbCheckInterval: number = 20.0;

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
      const ahead = Math.round(Math.abs(diff) / 1000);
      this.shout("You're " + ahead + " seconds ahead of your best!");
    }
    // Behind PB by more than 15 seconds
    else if (diff > 15000) {
      this.shout("Push harder to beat your record!");
    }
  }

  // ── Voice Output ──────────────────────────────────────────────────────────

  private canShout(): boolean {
    const now = getTime();
    return (now - this.lastShoutTime) >= this.minShoutInterval;
  }

  private shout(message: string): void {
    if (!this.aiCoach) {
      this.log('AICoach not connected');
      return;
    }

    this.log('SHOUT: ' + message);
    this.lastShoutTime = getTime();

    // Use AICoach to speak
    (this.aiCoach as any).speakShout(message);
  }

  // ── Debug ─────────────────────────────────────────────────────────────────

  private log(msg: string): void {
    if (this.debugPrint) {
      print('[MotivationalShouts] ' + msg);
    }
  }
}
