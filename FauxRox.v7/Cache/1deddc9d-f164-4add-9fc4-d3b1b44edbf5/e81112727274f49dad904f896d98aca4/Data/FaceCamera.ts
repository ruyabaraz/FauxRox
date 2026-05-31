// ============================================================================
// FaceCamera.ts — Billboard + Smooth Follow
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Makes object face camera AND follow user's view
// No dependencies on any kit
// ============================================================================

@component
export class FaceCamera extends BaseScriptComponent {

  @ui.separator
  @ui.label('Rotation')
  @input rotateX: boolean = true;
  @input rotateY: boolean = true;

  @ui.separator
  @ui.label('Follow')
  @input enableFollow: boolean = true;
  @input followDistance: number = 60;      // cm from camera
  @input followSpeed: number = 3.0;        // lerp speed
  @input verticalOffset: number = -15;     // cm below eye level
  @input horizontalOffset: number = -20;   // cm to the left (negative = left)

  @ui.separator
  @ui.label('Deadzone')
  @input deadzoneDegrees: number = 30;     // don't move if within this angle

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
      print('[FaceCamera] WARNING: Camera not found');
      return;
    }

    this.cameraTransform = this.camera.getSceneObject().getTransform();

    // Set initial position in front of camera
    if (this.enableFollow) {
      this.targetPosition = this.calculateTargetPosition();
      this.transform.setWorldPosition(this.targetPosition);
    }

    this.isInitialized = true;
    print('[FaceCamera] Initialized');
  }

  private findCamera(): Camera {
    // Search all root objects for a camera
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

  private onUpdate(): void {
    if (!this.isInitialized || !this.camera) return;

    if (this.enableFollow) {
      this.updateFollow();
    }

    this.faceCamera();
  }

  private calculateTargetPosition(): vec3 {
    const camPos = this.cameraTransform.getWorldPosition();
    const camForward = this.cameraTransform.forward;
    const camRight = this.cameraTransform.right;
    const camUp = this.cameraTransform.up;

    // Position in front of camera with offsets
    let targetPos = camPos
      .add(camForward.uniformScale(this.followDistance))
      .add(camUp.uniformScale(this.verticalOffset))
      .add(camRight.uniformScale(this.horizontalOffset));

    return targetPos;
  }

  private updateFollow(): void {
    const currentPos = this.transform.getWorldPosition();
    const idealPos = this.calculateTargetPosition();

    // Check if outside deadzone
    const camPos = this.cameraTransform.getWorldPosition();
    const toCurrentDir = currentPos.sub(camPos).normalize();
    const toIdealDir = idealPos.sub(camPos).normalize();

    const angleDiff = Math.acos(Math.min(1, Math.max(-1, toCurrentDir.dot(toIdealDir)))) * (180 / Math.PI);

    if (angleDiff > this.deadzoneDegrees) {
      // Outside deadzone - smoothly move toward target
      this.targetPosition = idealPos;
    }

    // Smooth lerp to target
    const dt = getDeltaTime();
    const lerpFactor = 1 - Math.exp(-this.followSpeed * dt);
    const newPos = vec3.lerp(currentPos, this.targetPosition, lerpFactor);

    this.transform.setWorldPosition(newPos);
  }

  private faceCamera(): void {
    const cameraPos = this.cameraTransform.getWorldPosition();
    const myPos = this.transform.getWorldPosition();

    // Direction from object to camera
    let direction = cameraPos.sub(myPos);

    // Zero out Y if we don't want X rotation (pitch)
    if (!this.rotateX) {
      direction.y = 0;
    }

    if (direction.length < 0.001) return;

    direction = direction.normalize();

    // Create rotation looking at camera
    const rotation = quat.lookAt(direction, vec3.up());
    this.transform.setWorldRotation(rotation);
  }
}
