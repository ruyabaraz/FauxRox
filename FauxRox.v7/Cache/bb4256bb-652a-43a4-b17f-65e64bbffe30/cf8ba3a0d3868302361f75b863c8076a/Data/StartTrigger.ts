// ============================================================================
// StartTrigger.ts — FauxRox Race Start / Pause / Reset
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Course placement is handled by CourseSetup.ts + GroundCalibration.ts
//
// Uses SpectaclesUIKit CapsuleButton for button interaction.
// Attach to SceneObject "StartTrigger".
// ============================================================================

import { CapsuleButton } from 'SpectaclesUIKit.lspkg/Scripts/Components/Button/CapsuleButton';

@component
export class StartTrigger extends BaseScriptComponent {

  @input courseManagerScript: ScriptComponent;
  @input raceStateMachineScript: ScriptComponent;

  /** CourseSetup ScriptComponent — for reset/re-placement */
  @input @allowUndefined courseSetupScript: ScriptComponent;

  /** Optional status text to show current state hint */
  @input @allowUndefined hintText: Text;

  /** Start button CapsuleButton component from SpectaclesUIKit */
  @input @allowUndefined startButton: CapsuleButton;

  /** Pause/Resume toggle button */
  @input @allowUndefined pauseButton: CapsuleButton;

  /** Pause button parent SceneObject - to show/hide */
  @input @allowUndefined pauseButtonObject: SceneObject;

  private cm(): any { return this.courseManagerScript as any; }
  private rsm(): any { return this.raceStateMachineScript as any; }
  private setup(): any { return this.courseSetupScript as any; }

  onAwake(): void {
    // Bind button interaction after UIKit initializes
    this.createEvent('OnStartEvent').bind(() => {
      this.bindButtonInteraction();
    });

    // Editor tap fallback - DISABLED on device, only works in Lens Studio preview
    // this.createEvent('TouchStartEvent').bind(() => {
    //   this.handleAction();
    // });

    this.createEvent('UpdateEvent').bind(this.updateHint.bind(this));

    print('[StartTrigger] Ready');
  }

  // ── Button Interaction via SpectaclesUIKit CapsuleButton ───────────────

  private bindButtonInteraction(): void {
    // Bind start button
    if (this.startButton) {
      try {
        this.startButton.onTriggerUp.add(() => {
          this.handleStartAction();
        });
        print('[StartTrigger] Start button bound');
      } catch (e) {
        print('[StartTrigger] Could not bind start button: ' + e);
      }
    } else {
      print('[StartTrigger] WARNING: No startButton assigned');
    }

    // Bind pause button
    if (this.pauseButton) {
      try {
        this.pauseButton.onTriggerUp.add(() => {
          this.handlePauseAction();
        });
        print('[StartTrigger] Pause button bound');
      } catch (e) {
        print('[StartTrigger] Could not bind pause button: ' + e);
      }
    }

    // Hide pause button initially
    if (this.pauseButtonObject) {
      this.pauseButtonObject.enabled = false;
    }
  }

  // ── Start Button Action ──────────────────────────────────────────────

  private handleStartAction(): void {
    var course = this.cm();
    var race = this.rsm();
    if (!course || !race) return;

    var state = race.state;

    // Don't handle if placement is still in progress
    if (!course.isCoursePlaced) {
      return;
    }

    if (state === 'IDLE') {
      print('[StartTrigger] → startRace');
      race.startRace();
      return;
    }

    if (state === 'FINISHED') {
      print('[StartTrigger] → reset');
      race.resetRace();
      return;
    }
  }

  // ── Pause Button Action ─────────────────────────────────────────────

  private handlePauseAction(): void {
    var race = this.rsm();
    if (!race) return;

    var state = race.state;

    if (state === 'RUNNING' || state === 'STATION' || state === 'PAUSED') {
      print('[StartTrigger] → togglePause');
      race.togglePause();
    }
  }

  // ── UI Updates ───────────────────────────────────────────────────────

  private updateHint(): void {
    var course = this.cm();
    var race = this.rsm();
    if (!course || !race) return;

    var state = race.state;

    // Update hint text
    if (this.hintText) {
      if (!course.isCoursePlaced) {
        this.hintText.text = 'Look at floor to calibrate';
      } else {
        switch (state) {
          case 'IDLE':
            this.hintText.text = 'Pinch Button to Start';
            break;
          case 'COUNTDOWN':
          case 'RUNNING':
          case 'STATION':
          case 'PAUSED':
            this.hintText.text = '';
            break;
          case 'FINISHED':
            this.hintText.text = 'Pinch to Reset';
            break;
        }
      }
    }

    // Show/hide pause button based on state
    if (this.pauseButtonObject) {
      var showPause = (state === 'RUNNING' || state === 'STATION' || state === 'PAUSED');
      this.pauseButtonObject.enabled = showPause;
    }
  }
}
