// ============================================================================
// WristMenu.ts — Wrist-mounted menu for race control
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Provides Pause, Resume, Stop controls during race.
// Attach to wrist-tracked SceneObject.
// ============================================================================

import { CapsuleButton } from 'SpectaclesUIKit.lspkg/Scripts/Components/Button/CapsuleButton';
import { AICoach } from './AICoach';

@component
export class WristMenu extends BaseScriptComponent {

  // ── References ──────────────────────────────────────────────────────────────

  @input raceStateMachineScript: ScriptComponent;

  /** AI Coach for voice queries */
  @input @allowUndefined aiCoach: AICoach;

  /** Pause button - visible when race is RUNNING or STATION */
  @input @allowUndefined pauseButton: CapsuleButton;
  @input @allowUndefined pauseButtonObject: SceneObject;

  /** Resume button - visible when race is PAUSED */
  @input @allowUndefined resumeButton: CapsuleButton;
  @input @allowUndefined resumeButtonObject: SceneObject;

  /** Stop button - visible when race is active (RUNNING, STATION, or PAUSED) */
  @input @allowUndefined stopButton: CapsuleButton;
  @input @allowUndefined stopButtonObject: SceneObject;

  /** Ask Coach button - voice query to AI */
  @input @allowUndefined askCoachButton: CapsuleButton;
  @input @allowUndefined askCoachButtonObject: SceneObject;

  /** Entire menu container - hidden when race is IDLE or FINISHED */
  @input @allowUndefined menuContainer: SceneObject;

  @input debugPrint: boolean = true;

  // ── Internal ────────────────────────────────────────────────────────────────

  private rsm(): any { return this.raceStateMachineScript as any; }

  onAwake(): void {
    this.log('WristMenu initialized');

    // Hide menu initially
    if (this.menuContainer) {
      this.menuContainer.enabled = false;
    }

    // Bind buttons after UIKit initializes
    this.createEvent('OnStartEvent').bind(() => {
      this.bindButtons();
    });

    // Update visibility based on race state
    this.createEvent('UpdateEvent').bind(() => {
      this.updateVisibility();
    });
  }

  private bindButtons(): void {
    // Pause button
    if (this.pauseButton) {
      try {
        this.pauseButton.onTriggerUp.add(() => {
          this.onPausePressed();
        });
        this.log('Pause button bound');
      } catch (e) {
        this.log('Could not bind pause button: ' + e);
      }
    }

    // Resume button
    if (this.resumeButton) {
      try {
        this.resumeButton.onTriggerUp.add(() => {
          this.onResumePressed();
        });
        this.log('Resume button bound');
      } catch (e) {
        this.log('Could not bind resume button: ' + e);
      }
    }

    // Stop button
    if (this.stopButton) {
      try {
        this.stopButton.onTriggerUp.add(() => {
          this.onStopPressed();
        });
        this.log('Stop button bound');
      } catch (e) {
        this.log('Could not bind stop button: ' + e);
      }
    }

    // Ask Coach button
    if (this.askCoachButton) {
      try {
        this.askCoachButton.onTriggerUp.add(() => {
          this.onAskCoachPressed();
        });
        this.log('Ask Coach button bound');
      } catch (e) {
        this.log('Could not bind ask coach button: ' + e);
      }
    }
  }

  // ── Button Handlers ─────────────────────────────────────────────────────────

  private onPausePressed(): void {
    var race = this.rsm();
    if (!race) return;

    this.log('Pause pressed');
    race.togglePause();
  }

  private onResumePressed(): void {
    var race = this.rsm();
    if (!race) return;

    this.log('Resume pressed');
    race.togglePause();
  }

  private onStopPressed(): void {
    var race = this.rsm();
    if (!race) return;

    this.log('Stop pressed');
    race.stopRace();
  }

  private onAskCoachPressed(): void {
    if (!this.aiCoach) {
      this.log('AI Coach not connected');
      return;
    }

    this.log('Ask Coach pressed');
    this.aiCoach.startListening();
  }

  // ── Visibility ──────────────────────────────────────────────────────────────

  private updateVisibility(): void {
    var race = this.rsm();
    if (!race) return;

    var state = race.state;

    // Menu visible only during active race
    var menuVisible = (state === 'RUNNING' || state === 'APPROACHING_STATION' || state === 'STATION' || state === 'PAUSED');
    if (this.menuContainer) {
      this.menuContainer.enabled = menuVisible;
    }

    if (!menuVisible) return;

    // Pause button: visible when running, approaching, or at station
    var showPause = (state === 'RUNNING' || state === 'APPROACHING_STATION' || state === 'STATION');
    if (this.pauseButtonObject) {
      this.pauseButtonObject.enabled = showPause;
    }

    // Resume button: visible when paused
    var showResume = (state === 'PAUSED');
    if (this.resumeButtonObject) {
      this.resumeButtonObject.enabled = showResume;
    }

    // Stop button: always visible during active race
    if (this.stopButtonObject) {
      this.stopButtonObject.enabled = true;
    }

    // Ask Coach button: always visible during active race
    if (this.askCoachButtonObject) {
      this.askCoachButtonObject.enabled = true;
    }
  }

  // ── Debug ───────────────────────────────────────────────────────────────────

  private log(msg: string): void {
    if (this.debugPrint) {
      print('[WristMenu] ' + msg);
    }
  }
}
