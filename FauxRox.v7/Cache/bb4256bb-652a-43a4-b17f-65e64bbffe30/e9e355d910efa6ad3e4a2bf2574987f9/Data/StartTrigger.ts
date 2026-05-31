// ============================================================================
// StartTrigger.ts — HYROX MIRAGE Race Start Button
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// This is the "Start Race" button — a SIK Interactable.
// It only appears AFTER the course is placed.
// Course placement is handled by CourseManager (hand ray + pinch).
//
// SETUP: Use a SIK PinchButton or Interactable prefab.
// This script listens for pinch on its own SceneObject.
//
// Attach to a SceneObject called "StartButton" with a
// SIK Interactable component or just use TouchStartEvent for Editor.
// ============================================================================

import { SIK } from 'SpectaclesInteractionKit.lspkg/SIK';
import {
  InteractorInputType,
} from 'SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor';

@component
export class StartTrigger extends BaseScriptComponent {

  /** Drag CourseRoot SceneObject here */
  @input courseManagerScript: ScriptComponent;

  /** Drag RaceController SceneObject here */
  @input raceStateMachineScript: ScriptComponent;

  /** The visual button object — hidden until course is placed */
  @input @allowUndefined buttonVisual: SceneObject;

  private cm(): any { return this.courseManagerScript as any; }
  private rsm(): any { return this.raceStateMachineScript as any; }

  onAwake(): void {
    // Hide button initially — course not placed yet
    if (this.buttonVisual) this.buttonVisual.enabled = false;

    // Check every frame if course is placed → show button
    this.createEvent('UpdateEvent').bind(() => {
      var course = this.cm();
      var race = this.rsm();
      if (!course || !race) return;

      if (this.buttonVisual) {
        // Show button when course placed and race not yet started
        this.buttonVisual.enabled = course.isCoursePlaced && race.state === 'IDLE';
      }
    });

    // ── Trigger: tap in Editor, pinch on Spectacles ──
    // For Spectacles, wire this to a SIK PinchButton's onButtonPinched.
    // For Editor testing, use tap:
    this.createEvent('TouchStartEvent').bind(() => {
      this.onStartPressed();
    });

    // SIK interactor pinch on this object
    this.createEvent('OnStartEvent').bind(() => {
      try {
        var interactors = SIK.InteractionManager.getInteractorsByType(
          InteractorInputType.All
        );
        for (var i = 0; i < interactors.length; i++) {
          interactors[i].onTriggerEnd.add(() => {
            this.onStartPressed();
          });
        }
      } catch (e) {
        print('[StartTrigger] SIK fallback: ' + e);
      }
    });

    print('[StartTrigger] Ready — waiting for course placement');
  }

  private onStartPressed(): void {
    var course = this.cm();
    var race = this.rsm();
    if (!course || !race) return;

    var state = race.state;

    if (state === 'FINISHED') {
      // Reset for new run
      race.resetRace();
      course.resetCourse();
      print('[StartTrigger] Reset — point and pinch to place new course');
      return;
    }

    if (!course.isCoursePlaced) {
      print('[StartTrigger] Course not placed yet — point at ground and pinch');
      return;
    }

    if (state === 'IDLE') {
      print('[StartTrigger] Starting race!');
      race.startRace();
      return;
    }

    if (state === 'RUNNING' || state === 'STATION' || state === 'PAUSED') {
      race.togglePause();
      return;
    }
  }
}
  