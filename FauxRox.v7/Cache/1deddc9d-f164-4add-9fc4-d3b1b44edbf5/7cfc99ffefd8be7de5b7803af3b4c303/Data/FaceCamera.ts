// ============================================================================
// FaceCamera.ts — Simple billboard effect
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Makes object always face the camera (user)
// No dependencies on any kit
// ============================================================================

@component
export class FaceCamera extends BaseScriptComponent {

  @input rotateX: boolean = true;
  @input rotateY: boolean = true;

  private transform: Transform;
  private camera: Camera;

  onAwake(): void {
    this.transform = this.getSceneObject().getTransform();

    // Find the main camera
    this.camera = this.findCamera();

    if (!this.camera) {
      print('[FaceCamera] WARNING: Camera not found');
      return;
    }

    this.createEvent('UpdateEvent').bind(() => {
      this.faceCamera();
    });
  }

  private findCamera(): Camera {
    // Try to get camera from scene
    const cameraObject = global.scene.getRootObjectsCount() > 0
      ? this.findCameraInHierarchy(global.scene.getRootObject(0))
      : null;

    return cameraObject;
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

  private faceCamera(): void {
    if (!this.camera) return;

    const cameraPos = this.camera.getSceneObject().getTransform().getWorldPosition();
    const myPos = this.transform.getWorldPosition();

    // Direction from object to camera
    let direction = cameraPos.sub(myPos);

    // Zero out axes we don't want to rotate on
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
