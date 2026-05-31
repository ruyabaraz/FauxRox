// ============================================================================
// StartTrigger.ts — HYROX MIRAGE Race Start / Reset Controller
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Course placement is handled by Example.ts (SurfacePlacement package).
// This script manages:
//   - Start Race button (visible after course placed)
//   - Reset button (visible after race finished)
//   - Pause toggle during race
//
// Attach to SceneObject "StartTrigger".
// ============================================================================

@component
export class StartTrigger extends BaseScriptComponent {

  @input courseManagerScript: ScriptComponent;
  @input raceStateMachineScript: ScriptComponent;

  /** "Start Race" button — SIK Interactable, shown after course placed */
  @input startRaceButton: SceneObject;

  /** "Reset" button — SIK Interactable, shown after finish */
  @input @allowUndefined resetButton: SceneObject;

  /** Example.ts ScriptComponent — for reset/re-placement */
  @input @allowUndefined exampleScript: ScriptComponent;

  private cm(): any { return this.courseManagerScript as any; }
  private rsm(): any { return this.raceStateMachineScript as any; }
  private ex(): any { return this.exampleScript as any; }

  onAwake(): void {
    if (this.startRaceButton) this.startRaceButton.enabled = false;
    if (this.resetButton) this.resetButton.enabled = false;

    this.createEvent('UpdateEvent').bind(this.updateButtons.bind(this));

    // Editor tap fallback
    this.createEvent('TouchStartEvent').bind(() => {
      this.onEditorTap();
    });

    print('[StartTrigger] Ready — waiting for course placement');
  }

  // ── Wire these to SIK Interactable onTriggerEnd ───────────────────────

  onStartRacePressed(): void {
    var race = this.rsm();
    var course = this.cm();
    if (!race || !course) return;
    if (!course.isCoursePlaced || race.state !== 'IDLE') return;

    print('[StartTrigger] Starting race!');
    race.startRace();
  }

  onResetPressed(): void {
    var race = this.rsm();
    if (!race) return;

    race.resetRace();

    // Re-trigger placement via Example.ts
    var example = this.ex();
    if (example) {
      example.resetPlacement();
    }

    print('[StartTrigger] Reset — restarting placement');
  }

  onPausePressed(): void {
    var race = this.rsm();
    if (!race) return;
    race.togglePause();
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
      this.onPausePressed();
      return;
    }
  }
}
