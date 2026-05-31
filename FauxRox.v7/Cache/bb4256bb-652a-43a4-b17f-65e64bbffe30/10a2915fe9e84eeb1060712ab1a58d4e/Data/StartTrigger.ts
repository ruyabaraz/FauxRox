// ============================================================================
// StartTrigger.ts — FauxRox Race Start / Pause / Reset
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Course placement is handled by CourseSetup.ts + GroundCalibration.ts
//
// Uses SIK Interactable for button interaction.
// Attach to SceneObject "StartTrigger".
// ============================================================================

import { SIK } from 'SpectaclesInteractionKit.lspkg/SIK';
import { Interactable } from 'SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable';

@component
export class StartTrigger extends BaseScriptComponent {

  @input courseManagerScript: ScriptComponent;
  @input raceStateMachineScript: ScriptComponent;

  /** CourseSetup ScriptComponent — for reset/re-placement */
  @input @allowUndefined courseSetupScript: ScriptComponent;

  /** Optional status text to show current state hint */
  @input @allowUndefined hintText: Text;

  /** Start button with Interactable component */
  @input @allowUndefined startButton: SceneObject;

  private cm(): any { return this.courseManagerScript as any; }
  private rsm(): any { return this.raceStateMachineScript as any; }
  private setup(): any { return this.courseSetupScript as any; }

  private _interactable: Interactable = null;

  onAwake(): void {
    // Bind button interaction after SIK initializes
    this.createEvent('OnStartEvent').bind(() => {
      this.bindButtonInteraction();
    });

    // Editor tap fallback
    this.createEvent('TouchStartEvent').bind(() => {
      this.handleAction();
    });

    this.createEvent('UpdateEvent').bind(this.updateHint.bind(this));

    print('[StartTrigger] Ready');
  }

  // ── Button Interaction via SIK Interactable ───────────────────────────

  private bindButtonInteraction(): void {
    if (!this.startButton) {
      print('[StartTrigger] WARNING: No startButton assigned, button pinch will not work');
      return;
    }

    try {
      this._interactable = this.startButton.getComponent(Interactable.getTypeName());

      if (!this._interactable) {
        print('[StartTrigger] WARNING: No Interactable component on startButton');
        return;
      }

      this._interactable.onTriggerEnd.add(() => {
        this.handleAction();
      });

      print('[StartTrigger] Button interaction bound via Interactable');
    } catch (e) {
      print('[StartTrigger] Could not bind button interaction: ' + e);
    }
  }

  // ── State-Based Action ────────────────────────────────────────────────

  private handleAction(): void {
    var course = this.cm();
    var race = this.rsm();
    if (!course || !race) return;

    var state = race.state;

    // Don't handle pinch if placement is still in progress
    // (SurfacePlacement handles its own pinch)
    if (!course.isCoursePlaced) {
      return;
    }

    if (state === 'IDLE') {
      print('[StartTrigger] → startRace');
      race.startRace();
      return;
    }

    if (state === 'RUNNING' || state === 'STATION') {
      // DISABLED: Pinch during gameplay was causing accidental pauses
      // TODO: Implement double-pinch or hold-pinch for pause
      // print('[StartTrigger] → pause');
      // race.togglePause();
      return;
    }

    if (state === 'PAUSED') {
      print('[StartTrigger] → resume');
      race.togglePause();
      return;
    }

    if (state === 'FINISHED') {
      print('[StartTrigger] → reset');
      race.resetRace();
      // RaceStateMachine.resetRace() already respawns START line
      return;
    }
  }

  // ── Hint Text ─────────────────────────────────────────────────────────

  private updateHint(): void {
    if (!this.hintText) return;

    var course = this.cm();
    var race = this.rsm();
    if (!course || !race) return;

    if (!course.isCoursePlaced) {
      this.hintText.text = 'Look at floor to calibrate';
      return;
    }

    var state = race.state;
    switch (state) {
      case 'IDLE':
        this.hintText.text = 'Pinch to Start Race';
        break;
      case 'COUNTDOWN':
        this.hintText.text = '';
        break;
      case 'RUNNING':
      case 'STATION':
        this.hintText.text = '';  // Timer UI is enough
        break;
      case 'PAUSED':
        this.hintText.text = 'Pinch to Resume';
        break;
      case 'FINISHED':
        this.hintText.text = 'Pinch to Reset';
        break;
    }
  }
}
