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

  /** MicButton parent - enabled when race starts */
  @input @allowUndefined micButton: SceneObject;

  /** SpeakerButton parent - enabled when race starts (same as micButton) */
  @input @allowUndefined speakerButton: SceneObject;

  private cm(): any { return this.courseManagerScript as any; }
  private rsm(): any { return this.raceStateMachineScript as any; }
  private setup(): any { return this.courseSetupScript as any; }

  onAwake(): void {
    // Bind button interaction after UIKit initializes
    this.createEvent('OnStartEvent').bind(() => {
      this.bindButtonInteraction();
    });

    this.createEvent('UpdateEvent').bind(() => {
      this.updateHint();
    });

    print('[StartTrigger] Ready');
  }

  // ── Button Binding ──────────────────────────────────────────────────────

  private bindButtonInteraction(): void {
    // Bind start button
    if (this.startButton) {
      try {
        this.startButton.onTriggerUp.add(() => {
          this.onStartButtonPressed();
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
          this.onPauseButtonPressed();
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

    // Hide mic button initially
    if (this.micButton) {
      this.micButton.enabled = false;
    }

    // Hide speaker button initially
    if (this.speakerButton) {
      this.speakerButton.enabled = false;
    }

    print('[StartTrigger] Mic/Speaker buttons hidden initially');
  }

  // ── Start Button ────────────────────────────────────────────────────────

  private onStartButtonPressed(): void {
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

      // Show mic and speaker buttons when race starts
      if (this.micButton) {
        this.micButton.enabled = true;
      }
      if (this.speakerButton) {
        this.speakerButton.enabled = true;
      }
      return;
    }

    if (state === 'FINISHED') {
      print('[StartTrigger] → reset');
      race.resetRace();

      // Hide mic and speaker buttons on reset
      if (this.micButton) {
        this.micButton.enabled = false;
      }
      if (this.speakerButton) {
        this.speakerButton.enabled = false;
      }
      return;
    }
  }

  // ── Pause Button ────────────────────────────────────────────────────────

  private onPauseButtonPressed(): void {
    var race = this.rsm();
    if (!race) return;

    var state = race.state;

    if (state === 'RUNNING' || state === 'STATION' || state === 'PAUSED') {
      print('[StartTrigger] → togglePause');
      race.togglePause();
    }
  }

  // ── UI Updates ──────────────────────────────────────────────────────────

  private updateHint(): void {
    var course = this.cm();
    var race = this.rsm();
    if (!course || !race) return;

    var state = race.state;

    // Update hint text
    if (this.hintText) {
      var setup = this.setup();
      var startButtonReady = setup && setup.startButtonObject && setup.startButtonObject.enabled;

      if (!course.isCoursePlaced) {
        this.hintText.text = 'Look at floor to calibrate';
      } else if (!startButtonReady) {
        // Start button not ready yet - don't overwrite wrist menu hint
        // (intentionally empty - CourseSetup is showing wrist menu message)
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
