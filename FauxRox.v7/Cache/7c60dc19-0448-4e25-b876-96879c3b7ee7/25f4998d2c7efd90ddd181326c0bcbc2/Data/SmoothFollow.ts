// ============================================================================
// SmoothFollow.ts — Simple Follow + Billboard
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================

@component
export class SmoothFollow extends BaseScriptComponent {

  @input followSpeed: number = 5.0;

  private transform: Transform;
  private camera: Camera;
  private cameraTransform: Transform;
  private localOffset: vec3;  // offset in camera's local space
  private isReady: boolean = false;

  onAwake(): void {
    this.transform = this.getSceneObject().getTransform();

    this.createEvent('OnEnableEvent').bind(() => {
      this.setup();
    });

    this.createEvent('UpdateEvent').bind(() => {
      if (this.isReady) this.update();
    });
  }

  private setup(): void {
    if (!this.camera) {
      this.camera = this.findCamera();
      if (!this.camera) return;
      this.cameraTransform = this.camera.getSceneObject().getTransform();
    }

    // Capture current position as offset from camera
    const camMatrix = this.cameraTransform.getInvertedWorldTransform();
    this.localOffset = camMatrix.multiplyPoint(this.transform.getWorldPosition());

    this.isReady = true;
    print('[SmoothFollow] Ready. Offset: ' + this.localOffset.x.toFixed(1) + ', ' + this.localOffset.y.toFixed(1) + ', ' + this.localOffset.z.toFixed(1));
  }

  private update(): void {
    // Target position = camera position + offset in camera space
    const targetPos = this.cameraTransform.getWorldTransform().multiplyPoint(this.localOffset);

    // Smooth lerp
    const currentPos = this.transform.getWorldPosition();
    const newPos = vec3.lerp(currentPos, targetPos, this.followSpeed * getDeltaTime());
    this.transform.setWorldPosition(newPos);

    // Face camera
    const lookDir = this.cameraTransform.getWorldPosition().sub(newPos);
    if (lookDir.length > 0.01) {
      this.transform.setWorldRotation(quat.lookAt(lookDir.normalize(), vec3.up()));
    }
  }

  private findCamera(): Camera {
    for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
      const c = this.searchCamera(global.scene.getRootObject(i));
      if (c) return c;
    }
    return null;
  }

  private searchCamera(obj: SceneObject): Camera {
    const cam = obj.getComponent('Component.Camera') as Camera;
    if (cam) return cam;
    for (let i = 0; i < obj.getChildrenCount(); i++) {
      const c = this.searchCamera(obj.getChild(i));
      if (c) return c;
    }
    return null;
  }
}
