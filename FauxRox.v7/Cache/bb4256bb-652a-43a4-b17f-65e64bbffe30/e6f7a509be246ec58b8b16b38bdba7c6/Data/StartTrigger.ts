// ============================================================================
// StartTrigger.ts — HYROX MIRAGE Start/Place Trigger
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Attach to a SceneObject called "StartTrigger".
//
// HOW IT WORKS:
//   - Uses SIK HandInteractor pinch events on Spectacles
//   - Uses TouchStartEvent as fallback (tap in Editor preview)
//   - First trigger → places course
//   - Second trigger → starts race
//   - After finish → resets and places new course
// ============================================================================

import { SIK } from 'SpectaclesInteractionKit.lspkg/SIK';
import {
  InteractorInputType,
} from 'SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor';

@component
export class StartTrigger extends BaseScriptComponent {

  /** Drag CourseRoot here */
  @input courseManagerScript: ScriptComponent;

  /** Drag RaceController here */
  @input raceStateMachineScript: ScriptComponent;

  /** Drag RaceController here (for ProximityDetector) */
  @input proximityDetectorScript: ScriptComponent;

  private cm(): any { return this.courseManagerScript as any; }
  private rsm(): any { return this.raceStateMachineScript as any; }
  private pd(): any { return this.proximityDetectorScript as any; }

  onAwake(): void {
    // ── SIK Pinch Detection ──
    // Get all hand interactors and listen for pinch end (trigger end)
    this.createEvent('OnStartEvent').bind(() => {
      try {
        var interactors = SIK.InteractionManager.getInteractorsByType(
          InteractorInputType.All
        );
        for (var i = 0; i < interactors.length; i++) {
          interactors[i].onTriggerEnd.add(() => {
            this.onTrigger();
          });
        }
        print('[StartTrigger] SIK pinch detection active');
      } catch (e) {
        print('[StartTrigger] SIK not available: ' + e);
      }
    });

    // ── Editor Fallback: Tap/Touch ──
    this.createEvent('TouchStartEvent').bind(() => {
      this.onTrigger();
    });

    print('[StartTrigger] Ready — pinch or tap to place course');
  }

  private onTrigger(): void {
    var course = this.cm();
    var race = this.rsm();

    if (!course || !race) {
      print('[StartTrigger] ERROR: courseManager or raceStateMachine not wired!');
      return;
    }

    var raceState = race.state;

    // After finish → reset everything for a new run
    if (raceState === 'FINISHED') {
      race.resetRace();
      course.resetCourse();
      print('[StartTrigger] Reset complete — pinch to place new course');
      return;
    }

    // If course not placed → place it
    if (!course.isCoursePlaced) {
      print('[StartTrigger] Placing course...');
      course.placeCourse();
      return;
    }

    // If idle (course placed but race not started) → start race
    if (raceState === 'IDLE') {
      print('[StartTrigger] Starting race...');
      race.startRace();
      return;
    }

    // If running or at station → toggle pause
    if (raceState === 'RUNNING' || raceState === 'STATION') {
      race.togglePause();
      return;
    }

    // If paused → resume
    if (raceState === 'PAUSED') {
      race.togglePause();
      return;
    }
  }
}
