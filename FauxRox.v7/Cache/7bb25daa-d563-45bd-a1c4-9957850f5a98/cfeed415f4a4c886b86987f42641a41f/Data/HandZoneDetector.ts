// ============================================================================
// HandZoneDetector.ts — HYROX MIRAGE Hand Zone Detection
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Tracks hand positions and detects when hands enter target zones
// Used for Target Press, Overhead Pull Gates, Power Row Gates
// ============================================================================

import { SIK } from 'SpectaclesInteractionKit.lspkg/SIK';
import { MotionType } from './CourseManager';

// Zone hit state machine
export enum ZoneState {
  WAITING = 'WAITING',       // Waiting for hands to enter ready zone
  READY = 'READY',           // Hands in ready zone, waiting for movement
  MOVING = 'MOVING',         // Hands moving toward target
  HIT = 'HIT',               // Hands hit target zone
  COOLDOWN = 'COOLDOWN',     // Waiting for hands to return to ready
}

@component
export class HandZoneDetector extends BaseScriptComponent {

  // ── Inputs ─────────────────────────────────────────────────────────────────

  @input camera: SceneObject;

  /** Target zone visual (spawned per station) */
  @input @allowUndefined targetZonePrefab: ObjectPrefab;

  /** VFX for zone hit */
  @input @allowUndefined hitVfxPrefab: ObjectPrefab;

  /** Height offset for target zone (cm above camera) */
  @input targetHeightOffset: number = 40;

  /** Ready zone height range (cm relative to camera) */
  @input readyZoneMinY: number = -30;
  @input readyZoneMaxY: number = 10;

  /** Target zone radius (cm) */
  @input targetZoneRadius: number = 25;

  /** Cooldown time after hit (seconds) */
  @input hitCooldown: number = 0.3;

  @input debugPrint: boolean = true;

  // ── State ──────────────────────────────────────────────────────────────────

  private camTransform: Transform = null;
  private leftHand: any = null;
  private rightHand: any = null;
  private handInputData: any = null;

  private _state: ZoneState = ZoneState.WAITING;
  private _motionType: MotionType = MotionType.OVERHEAD_REACH;
  private _repCount: number = 0;
  private _isActive: boolean = false;
  private _cooldownTimer: number = 0;

  // Target zone object
  private _targetZoneObj: SceneObject = null;
  private _targetPosition: vec3 = vec3.zero();
  private _stationAnchor: vec3 = null;  // Station world position for anchored targeting

  // Callbacks
  private _onRepCallback: (repCount: number) => void = null;
  private _onStateChangeCallback: (state: ZoneState) => void = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onAwake(): void {
    if (!this.camera) {
      print('[HandZoneDetector] ERROR: Camera not assigned!');
      return;
    }
    this.camTransform = this.camera.getTransform();

    // Initialize hand tracking
    this.createEvent('OnStartEvent').bind(() => {
      this.initHandTracking();
    });

    this.createEvent('UpdateEvent').bind(() => {
      this.onUpdate();
    });

    print('[HandZoneDetector] Initialized');
  }

  private initHandTracking(): void {
    try {
      this.handInputData = SIK.HandInputData;
      this.leftHand = this.handInputData.getHand('left');
      this.rightHand = this.handInputData.getHand('right');
      print('[HandZoneDetector] Hand tracking initialized');
    } catch (e) {
      print('[HandZoneDetector] ERROR initializing hand tracking: ' + e);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Start zone detection for a station
   * @param motionType - The type of motion to detect
   * @param onRep - Callback when a rep is completed
   * @param onStateChange - Optional callback for state changes
   * @param stationWorldPos - Optional station world position for station-relative targeting
   */
  startDetection(
    motionType: MotionType,
    onRep: (repCount: number) => void,
    onStateChange?: (state: ZoneState) => void,
    stationWorldPos?: vec3
  ): void {
    this._motionType = motionType;
    this._onRepCallback = onRep;
    this._onStateChangeCallback = onStateChange;
    this._repCount = 0;
    this._state = ZoneState.WAITING;
    this._isActive = true;
    this._cooldownTimer = 0;

    // Store station position for station-relative targeting
    this._stationAnchor = stationWorldPos || null;

    // Spawn target zone visual (positioned once, not every frame)
    this.spawnTargetZone();

    this.log('Detection started: ' + motionType + (this._stationAnchor ? ' (station-anchored)' : ' (camera-follow)'));
  }

  /**
   * Stop zone detection
   */
  stopDetection(): number {
    this._isActive = false;
    this.destroyTargetZone();
    this.log('Detection stopped. Total reps: ' + this._repCount);
    return this._repCount;
  }

  /**
   * Get current rep count
   */
  getRepCount(): number {
    return this._repCount;
  }

  /**
   * Get current state
   */
  getState(): ZoneState {
    return this._state;
  }

  // ── Target Zone Management ─────────────────────────────────────────────────

  private spawnTargetZone(): void {
    this.destroyTargetZone();

    if (!this.targetZonePrefab) {
      this.log('No target zone prefab assigned');
      return;
    }

    this._targetZoneObj = this.targetZonePrefab.instantiate(null);
    this.updateTargetPosition();
  }

  private destroyTargetZone(): void {
    if (this._targetZoneObj) {
      this._targetZoneObj.destroy();
      this._targetZoneObj = null;
    }
  }

  private updateTargetPosition(): void {
    if (!this._targetZoneObj || !this.camTransform) return;

    var camPos = this.camTransform.getWorldPosition();
    var camForward = this.camTransform.forward;

    // Position target based on motion type
    switch (this._motionType) {
      case MotionType.OVERHEAD_REACH:
      case MotionType.OVERHEAD_PULL:
        // Target above and slightly in front
        this._targetPosition = new vec3(
          camPos.x + camForward.x * 30,
          camPos.y + this.targetHeightOffset,
          camPos.z + camForward.z * 30
        );
        break;

      case MotionType.FORWARD_PUSH:
        // Target in front at chest height
        this._targetPosition = new vec3(
          camPos.x + camForward.x * 80,
          camPos.y - 10,
          camPos.z + camForward.z * 80
        );
        break;

      case MotionType.BACKWARD_PULL:
        // Target in front (pull toward body)
        this._targetPosition = new vec3(
          camPos.x + camForward.x * 60,
          camPos.y - 15,
          camPos.z + camForward.z * 60
        );
        break;
    }

    this._targetZoneObj.getTransform().setWorldPosition(this._targetPosition);
  }

  // ── Update Loop ────────────────────────────────────────────────────────────

  private onUpdate(): void {
    if (!this._isActive) return;

    // Update target position to follow camera
    this.updateTargetPosition();

    // Handle cooldown
    if (this._state === ZoneState.COOLDOWN) {
      this._cooldownTimer -= getDeltaTime();
      if (this._cooldownTimer <= 0) {
        this.setState(ZoneState.WAITING);
      }
      return;
    }

    // Get hand positions
    var hands = this.getHandPositions();
    if (!hands.valid) return;

    var camPos = this.camTransform.getWorldPosition();

    // Check zones based on motion type
    switch (this._motionType) {
      case MotionType.OVERHEAD_REACH:
        this.processOverheadReach(hands, camPos);
        break;

      case MotionType.OVERHEAD_PULL:
        this.processOverheadPull(hands, camPos);
        break;

      case MotionType.FORWARD_PUSH:
      case MotionType.BACKWARD_PULL:
        this.processHorizontalMotion(hands, camPos);
        break;
    }
  }

  // ── Motion Processing ──────────────────────────────────────────────────────

  private processOverheadReach(hands: HandPositions, camPos: vec3): void {
    var leftY = hands.leftY - camPos.y;
    var rightY = hands.rightY - camPos.y;
    var avgY = (leftY + rightY) / 2;

    // Check if both hands are in ready zone (low position)
    var inReadyZone = avgY >= this.readyZoneMinY && avgY <= this.readyZoneMaxY;

    // Check if both hands hit target zone
    var leftInTarget = this.isInTargetZone(hands.leftPos);
    var rightInTarget = this.isInTargetZone(hands.rightPos);
    var hitTarget = leftInTarget && rightInTarget;

    switch (this._state) {
      case ZoneState.WAITING:
        if (inReadyZone) {
          this.setState(ZoneState.READY);
        }
        break;

      case ZoneState.READY:
        if (!inReadyZone && avgY > this.readyZoneMaxY) {
          this.setState(ZoneState.MOVING);
        }
        break;

      case ZoneState.MOVING:
        if (hitTarget) {
          this.onTargetHit();
        } else if (inReadyZone) {
          // Went back down without hitting - reset
          this.setState(ZoneState.READY);
        }
        break;
    }
  }

  private processOverheadPull(hands: HandPositions, camPos: vec3): void {
    var leftY = hands.leftY - camPos.y;
    var rightY = hands.rightY - camPos.y;
    var avgY = (leftY + rightY) / 2;

    // For pull: ready zone is UP, target is DOWN
    var inReadyZone = avgY >= this.targetHeightOffset - 10;
    var inTargetZone = avgY <= this.readyZoneMaxY;

    switch (this._state) {
      case ZoneState.WAITING:
        if (inReadyZone) {
          this.setState(ZoneState.READY);
        }
        break;

      case ZoneState.READY:
        if (!inReadyZone && avgY < this.targetHeightOffset - 10) {
          this.setState(ZoneState.MOVING);
        }
        break;

      case ZoneState.MOVING:
        if (inTargetZone) {
          this.onTargetHit();
        } else if (inReadyZone) {
          this.setState(ZoneState.READY);
        }
        break;
    }
  }

  private processHorizontalMotion(hands: HandPositions, camPos: vec3): void {
    var leftInTarget = this.isInTargetZone(hands.leftPos);
    var rightInTarget = this.isInTargetZone(hands.rightPos);
    var hitTarget = leftInTarget && rightInTarget;

    // Simple ready zone: hands near body
    var camForward = this.camTransform.forward;
    var handAvgX = (hands.leftPos.x + hands.rightPos.x) / 2;
    var handAvgZ = (hands.leftPos.z + hands.rightPos.z) / 2;
    var forwardDist = (handAvgX - camPos.x) * camForward.x + (handAvgZ - camPos.z) * camForward.z;
    var inReadyZone = forwardDist < 30;

    switch (this._state) {
      case ZoneState.WAITING:
      case ZoneState.READY:
        if (inReadyZone) {
          this.setState(ZoneState.READY);
        }
        if (hitTarget) {
          this.onTargetHit();
        }
        break;

      case ZoneState.MOVING:
        if (hitTarget) {
          this.onTargetHit();
        }
        break;
    }
  }

  // ── Target Hit ─────────────────────────────────────────────────────────────

  private onTargetHit(): void {
    this._repCount++;
    this.setState(ZoneState.HIT);

    // Spawn hit VFX
    this.spawnHitVfx();

    // Callback
    if (this._onRepCallback) {
      this._onRepCallback(this._repCount);
    }

    this.log('TARGET HIT! Rep: ' + this._repCount);

    // Start cooldown
    this._cooldownTimer = this.hitCooldown;
    this.setState(ZoneState.COOLDOWN);
  }

  private spawnHitVfx(): void {
    if (!this.hitVfxPrefab) return;

    var vfx = this.hitVfxPrefab.instantiate(null);
    vfx.getTransform().setWorldPosition(this._targetPosition);

    // Auto-destroy VFX after 1 second
    var destroyEvent = this.createEvent('DelayedCallbackEvent');
    destroyEvent.bind(() => {
      if (vfx) vfx.destroy();
    });
    (destroyEvent as DelayedCallbackEvent).reset(1.0);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private isInTargetZone(handPos: vec3): boolean {
    var dist = handPos.distance(this._targetPosition);
    return dist <= this.targetZoneRadius;
  }

  private getHandPositions(): HandPositions {
    var result: HandPositions = {
      valid: false,
      leftPos: vec3.zero(),
      rightPos: vec3.zero(),
      leftY: 0,
      rightY: 0
    };

    if (!this.leftHand || !this.rightHand) return result;

    try {
      // Get wrist or palm position
      var leftWrist = this.leftHand.wrist;
      var rightWrist = this.rightHand.wrist;

      if (!leftWrist || !rightWrist) return result;

      result.leftPos = leftWrist.position;
      result.rightPos = rightWrist.position;
      result.leftY = result.leftPos.y;
      result.rightY = result.rightPos.y;
      result.valid = true;
    } catch (e) {
      // Hand tracking temporarily unavailable
    }

    return result;
  }

  private setState(newState: ZoneState): void {
    if (this._state === newState) return;

    this._state = newState;

    if (this._onStateChangeCallback) {
      this._onStateChangeCallback(newState);
    }

    this.log('State: ' + newState);
  }

  private log(msg: string): void {
    if (this.debugPrint) {
      print('[HandZoneDetector] ' + msg);
    }
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface HandPositions {
  valid: boolean;
  leftPos: vec3;
  rightPos: vec3;
  leftY: number;
  rightY: number;
}
