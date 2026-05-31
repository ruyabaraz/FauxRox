// ============================================================================
// SmoothFollow.ts — Standalone Smooth Follow + Billboard
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Based on SpectaclesUIKit Frame's SmoothFollow behavior
// Keeps object in user's view and faces them
// ============================================================================

@component
export class SmoothFollow extends BaseScriptComponent {

  @input translationTime: number = 0.45;
  @input rotationTime: number = 0.55;

  private camera: Camera;
  private cameraTransform: Transform;
  private transform: Transform;

  private target: vec3;
  private velocity: vec3;
  private omega: number;
  private heading: number;
  private initialRot: quat;

  private minDistance: number = 25;
  private maxDistance: number = 110;
  private minElevation: number = -40;
  private maxElevation: number = 40;

  onAwake(): void {
    this.transform = this.getSceneObject().getTransform();

    // Initialize when object becomes enabled (not at start)
    this.createEvent('OnEnableEvent').bind(() => {
      this.initialize();
    });

    this.createEvent('UpdateEvent').bind(() => {
      this.onUpdate();
    });
  }

  private isInitialized: boolean = false;

  private initialize(): void {
    // Find camera if not found yet
    if (!this.camera) {
      this.camera = this.findCamera();
      if (!this.camera) {
        print('[SmoothFollow] WARNING: Camera not found');
        return;
      }
      this.cameraTransform = this.camera.getSceneObject().getTransform();
    }

    // Reset state each time enabled
    this.target = vec3.zero();
    this.velocity = vec3.zero();
    this.omega = 0;
    this.initialRot = this.transform.getLocalRotation();
    this.heading = this.getCameraHeading();

    this.clampPosition();
    this.isInitialized = true;

    const pos = this.transform.getWorldPosition();
    print('[SmoothFollow] Initialized at: ' + pos.x.toFixed(1) + ', ' + pos.y.toFixed(1) + ', ' + pos.z.toFixed(1));
  }

  private findCamera(): Camera {
    for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
      const found = this.searchCamera(global.scene.getRootObject(i));
      if (found) return found;
    }
    return null;
  }

  private searchCamera(obj: SceneObject): Camera {
    const cam = obj.getComponent('Component.Camera') as Camera;
    if (cam) return cam;
    for (let i = 0; i < obj.getChildrenCount(); i++) {
      const found = this.searchCamera(obj.getChild(i));
      if (found) return found;
    }
    return null;
  }

  private clampPosition(): void {
    const worldPos = this.transform.getWorldPosition();
    this.target = this.cartesianToCylindrical(this.worldToBody(worldPos));
    this.target.z = this.clamp(this.target.z, this.minDistance, this.maxDistance);
    this.target.y = this.clamp(this.target.y, this.minElevation, this.maxElevation);
    this.velocity = vec3.zero();
    this.omega = 0;
  }

  private onUpdate(): void {
    if (!this.camera) return;

    const worldPos = this.transform.getWorldPosition();
    const pos = this.cartesianToCylindrical(this.worldToBody(worldPos));

    this.target.y = this.clamp(pos.y, this.minElevation, this.maxElevation);

    const dt = getDeltaTime();

    const [newX, newVelX] = this.smoothDamp(pos.x, this.target.x, this.velocity.x, this.translationTime, dt);
    const [newY, newVelY] = this.smoothDamp(pos.y, this.target.y, this.velocity.y, this.translationTime, dt);
    const [newZ, newVelZ] = this.smoothDamp(pos.z, this.target.z, this.velocity.z, this.translationTime, dt);

    pos.x = newX; this.velocity.x = newVelX;
    pos.y = newY; this.velocity.y = newVelY;
    pos.z = newZ; this.velocity.z = newVelZ;

    this.transform.setWorldPosition(this.bodyToWorld(this.cylindricalToCartesian(pos)));

    const [newHeading, newOmega] = this.smoothDampAngle(
      this.heading, this.getCameraHeading(), this.omega, this.rotationTime, dt
    );
    this.heading = newHeading;
    this.omega = newOmega;

    // Billboard - face the camera
    const camPos = this.cameraTransform.getWorldPosition();
    const myPos = this.transform.getWorldPosition();
    const lookDir = camPos.sub(myPos).normalize();
    const rot = quat.lookAt(lookDir, vec3.up()).multiply(this.initialRot);
    this.transform.setWorldRotation(rot);
  }

  // Coordinate transforms
  private cartesianToCylindrical(v: vec3): vec3 {
    return new vec3(Math.atan2(-v.x, -v.z), v.y, Math.sqrt(v.x * v.x + v.z * v.z));
  }

  private cylindricalToCartesian(v: vec3): vec3 {
    return new vec3(v.z * -Math.sin(v.x), v.y, v.z * -Math.cos(v.x));
  }

  private worldToBody(v: vec3): vec3 {
    const camPos = this.cameraTransform.getWorldPosition();
    return quat.angleAxis(-this.getCameraHeading(), vec3.up()).multiplyVec3(v.sub(camPos));
  }

  private bodyToWorld(v: vec3): vec3 {
    const camPos = this.cameraTransform.getWorldPosition();
    return quat.angleAxis(this.getCameraHeading(), vec3.up()).multiplyVec3(v).add(camPos);
  }

  private getCameraHeading(): number {
    const forward = this.cameraTransform.forward;
    return Math.atan2(forward.x, forward.z);
  }

  // Utilities
  private clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }

  private smoothDamp(current: number, target: number, velocity: number, smoothTime: number, dt: number): [number, number] {
    const omega = 2 / smoothTime;
    const x = omega * dt;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = current - target;
    const temp = (velocity + omega * change) * dt;
    const newVelocity = (velocity - omega * temp) * exp;
    const newValue = target + (change + temp) * exp;
    return [newValue, newVelocity];
  }

  private smoothDampAngle(current: number, target: number, velocity: number, smoothTime: number, dt: number): [number, number] {
    let delta = target - current;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    return this.smoothDamp(current, current + delta, velocity, smoothTime, dt);
  }
}
