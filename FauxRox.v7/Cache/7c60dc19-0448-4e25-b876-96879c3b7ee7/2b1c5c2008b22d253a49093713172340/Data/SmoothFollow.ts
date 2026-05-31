// ============================================================================
// SmoothFollow.ts — Smooth Follow for UI elements
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Keeps object in user's view at a fixed position
// No dependencies on any kit
// ============================================================================

@component
export class SmoothFollow extends BaseScriptComponent {

  @ui.separator
  @ui.label('Position in View (cm)')
  @input distance: number = 50;        // forward from camera
  @input horizontal: number = -15;     // left/right (negative = left)
  @input vertical: number = -10;       // up/down (negative = down)

  @ui.separator
  @ui.label('Behavior')
  @input followSpeed: number = 3.0;
  @input deadzoneDegrees: number = 25;

  private transform: Transform;
  private camera: Camera;
  private cameraTransform: Transform;
  private targetPosition: vec3;
  private isInitialized: boolean = false;

  onAwake(): void {
    this.transform = this.getSceneObject().getTransform();

    this.createEvent('OnStartEvent').bind(() => {
      this.initialize();
    });

    this.createEvent('UpdateEvent').bind(() => {
      this.onUpdate();
    });
  }

  private initialize(): void {
    this.camera = this.findCamera();

    if (!this.camera) {
      print('[SmoothFollow] WARNING: Camera not found');
      return;
    }

    this.cameraTransform = this.camera.getSceneObject().getTransform();

    // Set initial position
    this.targetPosition = this.calculateTargetPosition();
    this.transform.setWorldPosition(this.targetPosition);

    this.isInitialized = true;
    print('[SmoothFollow] Initialized');
  }

  private findCamera(): Camera {
    for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
      const found = this.findCameraInHierarchy(global.scene.getRootObject(i));
      if (found) return found;
    }
    return null;
  }

  private findCameraInHierarchy(obj: SceneObject): Camera {
    const cam = obj.getComponent('Component.Camera') as Camera;
    if (cam) return cam;

    for (let i = 0; i < obj.getChildrenCount(); i++) {
      const found = this.findCameraInHierarchy(obj.getChild(i));
      if (found) return found;
    }
    return null;
  }

  private calculateTargetPosition(): vec3 {
    const camPos = this.cameraTransform.getWorldPosition();
    const camForward = this.cameraTransform.forward;
    const camRight = this.cameraTransform.right;
    const camUp = this.cameraTransform.up;

    return camPos
      .add(camForward.uniformScale(this.distance))
      .add(camRight.uniformScale(this.horizontal))
      .add(camUp.uniformScale(this.vertical));
  }

  private onUpdate(): void {
    if (!this.isInitialized || !this.camera) return;

    const currentPos = this.transform.getWorldPosition();
    const idealPos = this.calculateTargetPosition();

    // Check deadzone
    const camPos = this.cameraTransform.getWorldPosition();
    const toCurrentDir = currentPos.sub(camPos).normalize();
    const toIdealDir = idealPos.sub(camPos).normalize();
    const angleDiff = Math.acos(Math.min(1, Math.max(-1, toCurrentDir.dot(toIdealDir)))) * (180 / Math.PI);

    if (angleDiff > this.deadzoneDegrees) {
      this.targetPosition = idealPos;
    }

    // Smooth lerp
    const dt = getDeltaTime();
    const lerpFactor = 1 - Math.exp(-this.followSpeed * dt);
    const newPos = vec3.lerp(currentPos, this.targetPosition, lerpFactor);

    this.transform.setWorldPosition(newPos);
  }
}
