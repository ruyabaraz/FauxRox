// ============================================================================
// RunArrowGuide.ts — Directional Arrows During Run Segments
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Spawns ground arrows pointing toward the next station during RUN state.
// Arrows are flat on the ground, pointing in the direction of travel.
// ============================================================================

@component
export class RunArrowGuide extends BaseScriptComponent {

  // ── Inputs ─────────────────────────────────────────────────────────────────

  @input camera: SceneObject;

  /** Arrow prefab - should be flat (X rotation -90°), pointing +Z or -Z */
  @input arrowPrefab: ObjectPrefab;

  /** Distance between arrows in cm */
  @input arrowSpacing: number = 250;  // 2.5 meters

  /** How far ahead to spawn arrows (cm) */
  @input spawnAheadDistance: number = 1000;  // 10 meters

  /** Maximum number of arrows at once */
  @input maxArrows: number = 5;

  /** Arrow height above floor (cm) */
  @input arrowHeight: number = 5;  // Slightly above ground

  /** Floor Y position (set by calibration) */
  @input floorY: number = 0;

  @input debugPrint: boolean = true;

  // ── State ──────────────────────────────────────────────────────────────────

  private _isActive: boolean = false;
  private _targetPosition: vec3 = null;
  private _arrows: SceneObject[] = [];
  private _camTransform: Transform = null;
  private _lastSpawnPos: vec3 = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onAwake(): void {
    if (!this.camera) {
      print('[RunArrowGuide] ERROR: Camera not assigned!');
      return;
    }
    this._camTransform = this.camera.getTransform();

    this.createEvent('UpdateEvent').bind(() => {
      this.onUpdate();
    });

    this.log('Initialized');
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Start showing arrows toward a target position
   * @param targetPos World position of the station/target
   * @param floorY Floor height for arrow placement
   */
  startGuide(targetPos: vec3, floorY: number): void {
    this._targetPosition = targetPos;
    this.floorY = floorY;
    this._isActive = true;
    this._lastSpawnPos = null;

    // Clear any existing arrows
    this.clearArrows();

    // Spawn initial arrows
    this.spawnArrowsAhead();

    this.log('Guide started toward (' + targetPos.x.toFixed(0) + ', ' + targetPos.z.toFixed(0) + ')');
  }

  /**
   * Stop showing arrows and clean up
   */
  stopGuide(): void {
    this._isActive = false;
    this._targetPosition = null;
    this.clearArrows();
    this.log('Guide stopped');
  }

  /**
   * Check if guide is currently active
   */
  isActive(): boolean {
    return this._isActive;
  }

  /**
   * Update floor Y (called when floor calibration changes)
   */
  setFloorY(y: number): void {
    this.floorY = y;
  }

  // ── Update Loop ────────────────────────────────────────────────────────────

  private onUpdate(): void {
    if (!this._isActive || !this._targetPosition) return;
    if (!this._camTransform) return;

    var playerPos = this._camTransform.getWorldPosition();

    // Remove arrows that player has passed
    this.removePassedArrows(playerPos);

    // Spawn new arrows ahead if needed
    this.spawnArrowsAhead();
  }

  // ── Arrow Management ───────────────────────────────────────────────────────

  private spawnArrowsAhead(): void {
    if (!this.arrowPrefab) {
      this.log('No arrow prefab assigned!');
      return;
    }

    var playerPos = this._camTransform.getWorldPosition();
    var playerGroundPos = new vec3(playerPos.x, this.floorY, playerPos.z);
    var targetGroundPos = new vec3(this._targetPosition.x, this.floorY, this._targetPosition.z);

    // Direction from player to target (flat)
    var toTarget = new vec3(
      targetGroundPos.x - playerGroundPos.x,
      0,
      targetGroundPos.z - playerGroundPos.z
    );
    var distanceToTarget = toTarget.length;

    if (distanceToTarget < 50) {
      // Too close to target, don't spawn
      return;
    }

    var direction = toTarget.normalize();

    // Determine starting point for spawning
    var startDist = this.arrowSpacing;
    if (this._lastSpawnPos !== null) {
      // Continue from last spawn position
      var lastToPlayer = new vec3(
        playerGroundPos.x - this._lastSpawnPos.x,
        0,
        playerGroundPos.z - this._lastSpawnPos.z
      );
      var distFromLast = lastToPlayer.length;

      // If player moved past last spawn point, start from player
      if (distFromLast > this.arrowSpacing * 0.5) {
        startDist = this.arrowSpacing;
      } else {
        // Calculate where next arrow should be
        startDist = this.arrowSpacing - distFromLast;
      }
    }

    // Spawn arrows up to maxArrows and within spawnAheadDistance
    var spawnCount = 0;
    var currentDist = startDist;

    while (this._arrows.length < this.maxArrows &&
           currentDist < this.spawnAheadDistance &&
           currentDist < distanceToTarget - 100) {  // Don't spawn too close to target

      var arrowPos = new vec3(
        playerGroundPos.x + direction.x * currentDist,
        this.floorY + this.arrowHeight,
        playerGroundPos.z + direction.z * currentDist
      );

      this.spawnArrow(arrowPos, direction);
      this._lastSpawnPos = arrowPos;

      currentDist += this.arrowSpacing;
      spawnCount++;
    }

    if (spawnCount > 0) {
      this.log('Spawned ' + spawnCount + ' arrows, total: ' + this._arrows.length);
    }
  }

  private spawnArrow(position: vec3, direction: vec3): void {
    var arrow = this.arrowPrefab.instantiate(null);

    // Position arrow
    arrow.getTransform().setWorldPosition(position);

    // Rotate arrow to point in direction (flat on ground)
    // First create rotation pointing in direction
    var forwardRot = quat.lookAt(direction, vec3.up());

    // Then rotate -90 on X to lay flat on ground (arrow pointing forward)
    var flatRot = quat.fromEulerAngles(-90 * MathUtils.DegToRad, 0, 0);
    var finalRot = forwardRot.multiply(flatRot);

    arrow.getTransform().setWorldRotation(finalRot);

    this._arrows.push(arrow);

    this.log('Arrow spawned at Y=' + position.y.toFixed(1) + ', pos=(' + position.x.toFixed(0) + ',' + position.z.toFixed(0) + ')');
  }

  private removePassedArrows(playerPos: vec3): void {
    if (!this._targetPosition) return;

    var playerGroundPos = new vec3(playerPos.x, 0, playerPos.z);
    var toTarget = new vec3(
      this._targetPosition.x - playerPos.x,
      0,
      this._targetPosition.z - playerPos.z
    ).normalize();

    // Remove arrows that are behind the player (in direction opposite to target)
    var toRemove: number[] = [];

    for (var i = 0; i < this._arrows.length; i++) {
      var arrow = this._arrows[i];
      var arrowPos = arrow.getTransform().getWorldPosition();

      // Vector from player to arrow
      var toArrow = new vec3(
        arrowPos.x - playerPos.x,
        0,
        arrowPos.z - playerPos.z
      );

      // Dot product: negative means arrow is behind player
      var dot = toArrow.x * toTarget.x + toArrow.z * toTarget.z;

      // If arrow is behind player (negative dot) or very close
      if (dot < -50) {  // 50cm behind
        toRemove.push(i);
      }
    }

    // Remove from end to preserve indices
    for (var j = toRemove.length - 1; j >= 0; j--) {
      var idx = toRemove[j];
      this._arrows[idx].destroy();
      this._arrows.splice(idx, 1);
    }

    if (toRemove.length > 0) {
      this.log('Removed ' + toRemove.length + ' passed arrows');
    }
  }

  private clearArrows(): void {
    for (var i = 0; i < this._arrows.length; i++) {
      if (this._arrows[i]) {
        this._arrows[i].destroy();
      }
    }
    this._arrows = [];
    this._lastSpawnPos = null;
    this.log('Cleared all arrows');
  }

  // ── Debug ──────────────────────────────────────────────────────────────────

  private log(msg: string): void {
    if (this.debugPrint) {
      print('[RunArrowGuide] ' + msg);
    }
  }
}
