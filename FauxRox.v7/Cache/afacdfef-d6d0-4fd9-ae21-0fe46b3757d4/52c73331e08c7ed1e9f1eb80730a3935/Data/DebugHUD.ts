// ============================================================================
// DebugHUD.ts — FauxRox Debug Overlay (HR Edition)
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Temporary debug overlay showing race state, progress, HR, and hand tracking
// Remove or disable for production builds
// ============================================================================

import { RaceStateMachine } from './RaceStateMachine';
import { HandZoneDetector, ZoneState } from './HandZoneDetector';
import { CourseManager } from './CourseManager';
import { HeartRateTracker, HRConnectionState } from './HeartRateTracker';

@component
export class DebugHUD extends BaseScriptComponent {

  // ── Inputs ─────────────────────────────────────────────────────────────────

  @input debugText: Text;

  @input raceStateMachine: RaceStateMachine;
  @input handZoneDetector: HandZoneDetector;
  @input courseManager: CourseManager;
  @input @allowUndefined heartRateTracker: HeartRateTracker;

  /** Enable/disable debug overlay */
  @input enabled: boolean = true;

  /** Update interval in seconds (lower = more responsive but more expensive) */
  @input updateInterval: number = 0.1;

  // ── State ──────────────────────────────────────────────────────────────────

  private _lastUpdate: number = 0;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onAwake(): void {
    this.createEvent('UpdateEvent').bind(() => {
      this.onUpdate();
    });

    print('[DebugHUD] Initialized (HR Edition)');
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  private onUpdate(): void {
    if (!this.enabled || !this.debugText) return;

    // Throttle updates
    var now = getTime();
    if (now - this._lastUpdate < this.updateInterval) return;
    this._lastUpdate = now;

    this.updateDebugText();
  }

  private updateDebugText(): void {
    var lines: string[] = [];
    lines.push('=== DEBUG HUD ===');

    // Race State Machine info
    if (this.raceStateMachine) {
      var rsm = this.raceStateMachine as any;  // Access private/internal fields

      lines.push('');
      lines.push('-- RACE STATE --');
      lines.push('State: ' + (rsm._state || rsm.state || 'N/A'));
      // Show user-friendly station number (index 1 = Station 1, etc. START=0 doesn't count)
      var stationIdx = rsm._currentStationIndex !== undefined ? rsm._currentStationIndex : -1;
      var stationDisplay = stationIdx <= 0 ? 'START' : stationIdx.toString();
      lines.push('Station: ' + stationDisplay);

      // Run info
      var runTarget = rsm._runTarget !== undefined ? rsm._runTarget : 0;
      var runDist = rsm._runDistance !== undefined ? rsm._runDistance : 0;
      lines.push('Run: ' + runDist.toFixed(1) + 'm / ' + runTarget.toFixed(0) + 'm');

      // Station progress
      var progress = rsm._stationProgress !== undefined ? rsm._stationProgress : 0;
      var requirement = rsm._stationRequirement !== undefined ? rsm._stationRequirement : 0;
      lines.push('Progress: ' + progress.toFixed(1) + ' / ' + requirement);

      // Current config name
      if (rsm._currentConfig) {
        lines.push('Config: ' + rsm._currentConfig.name + ' (' + rsm._currentConfig.mode + ')');
      }
    } else {
      lines.push('');
      lines.push('RaceStateMachine: NOT LINKED');
    }

    // Hand Zone Detector info
    if (this.handZoneDetector) {
      lines.push('');
      lines.push('-- HAND ZONE --');
      lines.push('Zone State: ' + this.handZoneDetector.getState());
      lines.push('Reps: ' + this.handZoneDetector.getRepCount());

      var handsValid = this.handZoneDetector.areHandsValid();
      lines.push('Hands Valid: ' + (handsValid ? 'YES' : 'NO'));

      var targetDist = this.handZoneDetector.getTargetDistance();
      if (targetDist >= 0) {
        lines.push('Target Dist: ' + targetDist.toFixed(1) + 'cm');
      } else {
        lines.push('Target Dist: --');
      }

      lines.push('Anchored: ' + (this.handZoneDetector.isStationAnchored() ? 'YES (station)' : 'NO (camera)'));
    } else {
      lines.push('');
      lines.push('HandZoneDetector: NOT LINKED');
    }

    // Course Manager info
    if (this.courseManager) {
      lines.push('');
      lines.push('-- COURSE --');
      lines.push('Ready: ' + (this.courseManager.isReady ? 'YES' : 'NO'));
      lines.push('Stations: ' + this.courseManager.stationCount);
      var activeIdx = this.courseManager.getActiveStationIndex();
      lines.push('Active: ' + (activeIdx >= 0 ? activeIdx : 'none'));
    }

    // Heart Rate Monitor Status
    if (this.heartRateTracker) {
      lines.push('');
      lines.push('-- HEART RATE --');

      var hrState = this.heartRateTracker.connectionState;
      var hrIcon = '';
      switch (hrState) {
        case HRConnectionState.CONNECTED:
          hrIcon = '[OK]';
          break;
        case HRConnectionState.SCANNING:
          hrIcon = '[...]';
          break;
        case HRConnectionState.CONNECTING:
          hrIcon = '[~]';
          break;
        case HRConnectionState.DISCONNECTED:
          hrIcon = '[X]';
          break;
        case HRConnectionState.ERROR:
          hrIcon = '[!]';
          break;
        default:
          hrIcon = '[?]';
      }
      lines.push('Status: ' + hrIcon + ' ' + hrState);

      if (this.heartRateTracker.isConnected) {
        lines.push('Device: ' + this.heartRateTracker.deviceName);
        lines.push('BPM: ' + this.heartRateTracker.currentBPM);
        lines.push('Zone: ' + this.heartRateTracker.getZoneName(this.heartRateTracker.currentZone));
        lines.push('Avg: ' + this.heartRateTracker.avgBPM + ' | Peak: ' + this.heartRateTracker.peakBPM);
      }
    } else {
      lines.push('');
      lines.push('HeartRateTracker: NOT LINKED');
    }

    // Timestamp
    lines.push('');
    lines.push('t=' + getTime().toFixed(1) + 's');

    this.debugText.text = lines.join('\n');
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Toggle debug HUD visibility */
  toggle(): void {
    this.enabled = !this.enabled;
    if (!this.enabled && this.debugText) {
      this.debugText.text = '';
    }
    print('[DebugHUD] ' + (this.enabled ? 'Enabled' : 'Disabled'));
  }
}
