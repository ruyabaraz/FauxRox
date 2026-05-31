// ============================================================================
// StartTrigger.ts — HYROX MIRAGE UI Controller
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Manages the two-phase UX:
//   Phase 1: "Place Course" button visible → starts surface placement
//   Phase 2: "Start Race" button visible → starts countdown
//
// Attach to SceneObject "UIController".
// ============================================================================

@component
export class StartTrigger extends BaseScriptComponent {

  /** Drag CourseRoot SceneObject here */
  @input courseManagerScript: ScriptComponent;

  /** Drag RaceController SceneObject here */
  @input raceStateMachineScript: ScriptComponent;

  /** The "Place Course" button SceneObject (SIK Interactable) */
  @input placeCourseButton: SceneObject;

  /** The "Start Race" button SceneObject (SIK Interactable) */
  @input startRaceButton: SceneObject;

  /** Optional: "Reset" button (shown after finish) */
  @input @allowUndefined resetButton: SceneObject;

  private cm(): any { return this.courseManagerScript as any; }
  private rsm(): any { return this.raceStateMachineScript as any; }

  onAwake(): void {
    // Initial state: show Place button, hide Start and Reset
    if (this.placeCourseButton) this.placeCourseButton.enabled = true;
    if (this.startRaceButton) this.startRaceButton.enabled = false;
    if (this.resetButton) this.resetButton.enabled = false;

    // Poll state to update button visibility
    this.createEvent('UpdateEvent').bind(this.updateButtonVisibility.bind(this));

    // Editor fallback: tap cycles through actions
    this.createEvent('TouchStartEvent').bind(() => {
      this.onEditorTap();
    });

    print('[StartTrigger] Ready — Place Course button active');
  }

  // ── Public methods (wire to SIK Interactable onTriggerEnd) ────────────

  /**
   * Called when user pinches the "Place Course" button.
   * Wire this to the Interactable's onTriggerEnd event in Inspector,
   * or call from Behavior script.
   */
  onPlaceCoursePressed(): void {
    var course = this.cm();
    if (!course) return;
    if (course.isCoursePlaced || course.isPlacementActive) return;

    print('[StartTrigger] Place Course pressed — starting surface calibration');
    course.startPlacement();
  }

  /**
   * Called when user pinches the "Start Race" button.
   */
  onStartRacePressed(): void {
    var race = this.rsm();
    var course = this.cm();
    if (!race || !course) return;
    if (!course.isCoursePlaced) return;
    if (race.state !== 'IDLE') return;

    print('[StartTrigger] Start Race pressed');
    race.startRace();
  }

  /**
   * Called when user pinches the "Reset" button (after finish).
   */
  onResetPressed(): void {
    var race = this.rsm();
    var course = this.cm();
    if (!race || !course) return;

    race.resetRace();
    course.resetCourse();
    print('[StartTrigger] Reset — ready for new placement');
  }

  // ── Button Visibility Logic ───────────────────────────────────────────

  private updateButtonVisibility(): void {
    var course = this.cm();
    var race = this.rsm();
    if (!course || !race) return;

    var state = race.state;

    // Place Course button: visible only when not placed and not placing
    if (this.placeCourseButton) {
      this.placeCourseButton.enabled = !course.isCoursePlaced && !course.isPlacementActive;
    }

    // Start Race button: visible only when course placed and race idle
    if (this.startRaceButton) {
      this.startRaceButton.enabled = course.isCoursePlaced && state === 'IDLE';
    }

    // Reset button: visible only after finish
    if (this.resetButton) {
      this.resetButton.enabled = state === 'FINISHED';
    }
  }

  // ── Editor Tap Fallback ───────────────────────────────────────────────

  private onEditorTap(): void {
    var course = this.cm();
    var race = this.rsm();
    if (!course || !race) return;

    var state = race.state;

    if (state === 'FINISHED') {
      this.onResetPressed();
      return;
    }

    if (!course.isCoursePlaced && !course.isPlacementActive) {
      this.onPlaceCoursePressed();
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
