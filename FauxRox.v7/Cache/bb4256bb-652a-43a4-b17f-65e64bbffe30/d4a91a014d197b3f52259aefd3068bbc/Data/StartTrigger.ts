// ============================================================================
// StartTrigger.ts — HYROX MIRAGE Race Start / Reset
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Course placement handled by Example.ts (SurfacePlacement package).
// This script manages Start Race + Reset buttons.
//
// SPECTACLES PINCH FIX:
// Instead of relying on external Interactable wiring, this script
// finds the Interactable components on the button objects and
// subscribes to their events directly in code.
//
// Attach to SceneObject "StartTrigger".
// ============================================================================

import { SIK } from 'SpectaclesInteractionKit.lspkg/SIK';
import { Interactable } from 'SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable';

@component
export class StartTrigger extends BaseScriptComponent {

  @input courseManagerScript: ScriptComponent;
  @input raceStateMachineScript: ScriptComponent;

  /** Button SceneObjects — must have Interactable + Collider components */
  @input startRaceButton: SceneObject;
  @input @allowUndefined resetButton: SceneObject;

  /** Example.ts ScriptComponent — for reset/re-placement */
  @input @allowUndefined exampleScript: ScriptComponent;

  private cm(): any { return this.courseManagerScript as any; }
  private rsm(): any { return this.raceStateMachineScript as any; }
  private ex(): any { return this.exampleScript as any; }

  onAwake(): void {
    if (this.startRaceButton) this.startRaceButton.enabled = false;
    if (this.resetButton) this.resetButton.enabled = false;

    // Bind Interactable events after SIK initializes
    this.createEvent('OnStartEvent').bind(() => {
      this.bindButtons();
    });

    this.createEvent('UpdateEvent').bind(this.updateButtons.bind(this));

    // Editor tap fallback
    this.createEvent('TouchStartEvent').bind(() => {
      this.onEditorTap();
    });

    print('[StartTrigger] Ready');
  }

  // ── Bind SIK Interactable Events (works on Spectacles) ───────────────

  private bindButtons(): void {
    // Start Race button
    if (this.startRaceButton) {
      try {
        var startInteractable = SIK.InteractionManager.getInteractableBySceneObject(
          this.startRaceButton
        );
        if (startInteractable) {
          startInteractable.onTriggerEnd.add(() => {
            this.onStartRacePressed();
          });
          print('[StartTrigger] Start Race button bound to Interactable');
        }
      } catch (e) {
        print('[StartTrigger] Could not bind Start Race Interactable: ' + e);
      }
    }

    // Reset button
    if (this.resetButton) {
      try {
        var resetInteractable = SIK.InteractionManager.getInteractableBySceneObject(
          this.resetButton
        );
        if (resetInteractable) {
          resetInteractable.onTriggerEnd.add(() => {
            this.onResetPressed();
          });
          print('[StartTrigger] Reset button bound to Interactable');
        }
      } catch (e) {
        print('[StartTrigger] Could not bind Reset Interactable: ' + e);
      }
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────

  private onStartRacePressed(): void {
    var race = this.rsm();
    var course = this.cm();
    if (!race || !course) return;
    if (!course.isCoursePlaced || race.state !== 'IDLE') return;

    print('[StartTrigger] Starting race!');
    race.startRace();
  }

  private onResetPressed(): void {
    var race = this.rsm();
    if (!race) return;

    race.resetRace();

    var example = this.ex();
    if (example) {
      example.resetPlacement();
    }

    print('[StartTrigger] Reset — restarting placement');
  }

  // ── Button Visibility ─────────────────────────────────────────────────

  private updateButtons(): void {
    var course = this.cm();
    var race = this.rsm();
    if (!course || !race) return;

    var state = race.state;

    if (this.startRaceButton) {
      this.startRaceButton.enabled = course.isCoursePlaced && state === 'IDLE';
    }

    if (this.resetButton) {
      this.resetButton.enabled = state === 'FINISHED';
    }
  }

  // ── Editor Tap ────────────────────────────────────────────────────────

  private onEditorTap(): void {
    var course = this.cm();
    var race = this.rsm();
    if (!course || !race) return;

    var state = race.state;

    if (state === 'FINISHED') {
      this.onResetPressed();
      return;
    }

    if (course.isCoursePlaced && state === 'IDLE') {
      this.onStartRacePressed();
      return;
    }

    if (state === 'RUNNING' || state === 'STATION' || state === 'PAUSED') {
      race.togglePause();
      return;
    }
  }
}
