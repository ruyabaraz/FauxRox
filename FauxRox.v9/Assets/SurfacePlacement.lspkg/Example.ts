// ============================================================================
// Example.ts — SurfacePlacement → CourseManager Bridge
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// This is the SurfacePlacement package's Example.ts, modified to call
// CourseManager.placeCourseAt() when surface placement is confirmed.
//
// Attach to "Example Surface" SceneObject (same as original).
// Add courseManagerScript input → drag CourseRoot here.
// ============================================================================

import { PlacementMode, PlacementSettings } from "./Scripts/PlacementSettings";
import { SurfacePlacementController } from "./Scripts/SurfacePlacementController";

@component
export class Example extends BaseScriptComponent {
  @input
  @allowUndefined
  objectVisuals: SceneObject;

  @input("int")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Near Surface", 0),
      new ComboBoxItem("Horizontal", 1),
      new ComboBoxItem("Vertical", 2),
    ])
  )
  placementSettingMode: number = 1; // Default to Horizontal for HYROX

  @input
  autoStart: boolean = true;

  /** Drag CourseRoot SceneObject here */
  @input
  courseManagerScript: ScriptComponent;

  private transform: Transform = null;

  private surfacePlacement: SurfacePlacementController =
    SurfacePlacementController.getInstance();

  private getCM(): any {
    return this.courseManagerScript as any;
  }

  onAwake() {
    this.transform = this.getSceneObject().getTransform();
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this));
  }

  private onStart() {
    if (this.objectVisuals) {
      this.objectVisuals.enabled = false;
    }

    if (this.autoStart) {
      this.startPlacement();
    }
  }

  startPlacement() {
    if (this.objectVisuals) {
      this.objectVisuals.enabled = false;
    }

    let placementSettings: PlacementSettings;
    switch (this.placementSettingMode) {
      case 0: // Near Surface
        placementSettings = new PlacementSettings(
          PlacementMode.NEAR_SURFACE,
          true,
          new vec3(10, 10, 0),
          this.onSliderUpdated.bind(this)
        );
        break;
      case 1: // Horizontal
        placementSettings = new PlacementSettings(PlacementMode.HORIZONTAL);
        break;
      case 2: // Vertical
        placementSettings = new PlacementSettings(PlacementMode.VERTICAL);
        break;
      default:
        placementSettings = new PlacementSettings(PlacementMode.HORIZONTAL);
    }

    this.surfacePlacement.startSurfacePlacement(
      placementSettings,
      (pos, rot) => {
        this.onSurfaceDetected(pos, rot);
      }
    );
  }

  resetPlacement() {
    this.surfacePlacement.stopSurfacePlacement();

    // Also reset CourseManager
    var cm = this.getCM();
    if (cm && cm.isCoursePlaced) {
      cm.resetCourse();
    }

    this.startPlacement();
  }

  private onSliderUpdated(pos: vec3) {
    this.transform.setWorldPosition(pos);
  }

  private onSurfaceDetected(pos: vec3, rot: quat) {
    // Show visuals if any
    if (this.objectVisuals) {
      this.objectVisuals.enabled = true;
    }
    this.transform.setWorldPosition(pos);
    this.transform.setWorldRotation(rot);

    // ── HYROX MIRAGE: Place course at confirmed surface point ──
    var cm = this.getCM();
    if (cm) {
      cm.placeCourseAt(pos, rot);
      print('[Example] Surface detected → CourseManager.placeCourseAt() called');
    } else {
      print('[Example] WARNING: courseManagerScript not assigned!');
    }
  }
}
