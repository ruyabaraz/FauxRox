// ============================================================================
// FaceCamera.ts — Billboard + Smooth Follow
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Makes object face camera AND follow user's view
// Position is set in scene - this just maintains relative position
// ============================================================================

@component
export class FaceCamera extends BaseScriptComponent {

  @input enableFollow: boolean = true;
  @input followSpeed: number = 3.0;
  @input deadzoneDegrees: number = 30;

  private transform: Transform;
  private camera: Camera;
  private cameraTransform: Transform;

  // Relative offset from camera (captured at start)
  private relativeOffset: vec3;
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

    // Capture initial relative position (in camera's local space)
    const camPos = this.cameraTransform.getWorldPosition();
    const myPos = this.transform.getWorldPosition();
    const camInverse = this.cameraTransform.getInvertedWorldTransform();
    this.relativeOffset = camInverse.multiplyPoint(myPos);

    this.targetPosition = myPos;
    this.isInitialized = true;
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

  private onUpdate(): void {
    if (!this.isInitialized || !this.camera) return;

    if (this.enableFollow) {
      this.updateFollow();
    }
  }

  private updateFollow(): void {
    const currentPos = this.transform.getWorldPosition();

    // Calculate ideal position based on camera's current transform
    const camWorldTransform = this.cameraTransform.getWorldTransform();
    const idealPos = camWorldTransform.multiplyPoint(this.relativeOffset);

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

  private faceCamera(): void {
    const cameraPos = this.cameraTransform.getWorldPosition();
    const myPos = this.transform.getWorldPosition();
    let direction = cameraPos.sub(myPos);

    if (direction.length < 0.001) return;

    const rotation = quat.lookAt(direction.normalize(), vec3.up());
    this.transform.setWorldRotation(rotation);
  }
}
