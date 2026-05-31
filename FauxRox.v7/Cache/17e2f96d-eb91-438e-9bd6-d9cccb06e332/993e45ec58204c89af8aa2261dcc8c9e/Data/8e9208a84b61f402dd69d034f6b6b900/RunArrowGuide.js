"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunArrowGuide = void 0;
var __selfType = requireType("./RunArrowGuide");
function component(target) {
    target.getTypeName = function () { return __selfType; };
    if (target.prototype.hasOwnProperty("getTypeName"))
        return;
    Object.defineProperty(target.prototype, "getTypeName", {
        value: function () { return __selfType; },
        configurable: true,
        writable: true
    });
}
// ============================================================================
// RunArrowGuide.ts — Directional Arrows During Run Segments
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Spawns ground arrows pointing toward the next station during RUN state.
// Arrows are flat on the ground, pointing in the direction of travel.
// ============================================================================
let RunArrowGuide = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var RunArrowGuide = _classThis = class extends _classSuper {
        constructor() {
            super();
            // ── Inputs ─────────────────────────────────────────────────────────────────
            this.camera = this.camera;
            /** Arrow prefab - should be flat (X rotation -90°), pointing +Z or -Z */
            this.arrowPrefab = this.arrowPrefab;
            /** Distance between arrows in cm */
            this.arrowSpacing = this.arrowSpacing; // 2.5 meters
            /** How far ahead to spawn arrows (cm) */
            this.spawnAheadDistance = this.spawnAheadDistance; // 10 meters
            /** Maximum number of arrows at once */
            this.maxArrows = this.maxArrows;
            /** Arrow height offset from camera (cm) - negative = below camera */
            this.arrowHeightOffset = this.arrowHeightOffset; // 80cm below camera = waist level
            this.debugPrint = this.debugPrint;
            // ── State ──────────────────────────────────────────────────────────────────
            this._isActive = false;
            this._targetPosition = null;
            this._arrows = [];
            this._camTransform = null;
            this._lastSpawnPos = null;
        }
        __initialize() {
            super.__initialize();
            // ── Inputs ─────────────────────────────────────────────────────────────────
            this.camera = this.camera;
            /** Arrow prefab - should be flat (X rotation -90°), pointing +Z or -Z */
            this.arrowPrefab = this.arrowPrefab;
            /** Distance between arrows in cm */
            this.arrowSpacing = this.arrowSpacing; // 2.5 meters
            /** How far ahead to spawn arrows (cm) */
            this.spawnAheadDistance = this.spawnAheadDistance; // 10 meters
            /** Maximum number of arrows at once */
            this.maxArrows = this.maxArrows;
            /** Arrow height offset from camera (cm) - negative = below camera */
            this.arrowHeightOffset = this.arrowHeightOffset; // 80cm below camera = waist level
            this.debugPrint = this.debugPrint;
            // ── State ──────────────────────────────────────────────────────────────────
            this._isActive = false;
            this._targetPosition = null;
            this._arrows = [];
            this._camTransform = null;
            this._lastSpawnPos = null;
        }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        onAwake() {
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
         */
        startGuide(targetPos) {
            this._targetPosition = targetPos;
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
        stopGuide() {
            this._isActive = false;
            this._targetPosition = null;
            this.clearArrows();
            this.log('Guide stopped');
        }
        /**
         * Check if guide is currently active
         */
        isActive() {
            return this._isActive;
        }
        // ── Update Loop ────────────────────────────────────────────────────────────
        onUpdate() {
            if (!this._isActive || !this._targetPosition)
                return;
            if (!this._camTransform)
                return;
            var playerPos = this._camTransform.getWorldPosition();
            // Remove arrows that player has passed
            this.removePassedArrows(playerPos);
            // Spawn new arrows ahead if needed
            this.spawnArrowsAhead();
        }
        // ── Arrow Management ───────────────────────────────────────────────────────
        spawnArrowsAhead() {
            if (!this.arrowPrefab) {
                this.log('No arrow prefab assigned!');
                return;
            }
            var playerPos = this._camTransform.getWorldPosition();
            // Arrow Y = camera Y + offset (negative offset = below camera)
            var arrowY = playerPos.y + this.arrowHeightOffset;
            var playerGroundPos = new vec3(playerPos.x, arrowY, playerPos.z);
            var targetGroundPos = new vec3(this._targetPosition.x, arrowY, this._targetPosition.z);
            // Direction from player to target (flat)
            var toTarget = new vec3(targetGroundPos.x - playerGroundPos.x, 0, targetGroundPos.z - playerGroundPos.z);
            var distanceToTarget = toTarget.length;
            if (distanceToTarget < 50) {
                // Too close to target, don't spawn
                return;
            }
            var direction = toTarget.normalize();
            // Determine starting point for spawning (first arrow closer)
            var startDist = 100; // First arrow 1m ahead
            if (this._lastSpawnPos !== null) {
                // Continue from last spawn position
                var lastToPlayer = new vec3(playerGroundPos.x - this._lastSpawnPos.x, 0, playerGroundPos.z - this._lastSpawnPos.z);
                var distFromLast = lastToPlayer.length;
                // If player moved past last spawn point, start from player
                if (distFromLast > this.arrowSpacing * 0.5) {
                    startDist = this.arrowSpacing;
                }
                else {
                    // Calculate where next arrow should be
                    startDist = this.arrowSpacing - distFromLast;
                }
            }
            // Spawn arrows up to maxArrows and within spawnAheadDistance
            var spawnCount = 0;
            var currentDist = startDist;
            while (this._arrows.length < this.maxArrows &&
                currentDist < this.spawnAheadDistance &&
                currentDist < distanceToTarget - 100) { // Don't spawn too close to target
                var arrowPos = new vec3(playerGroundPos.x + direction.x * currentDist, arrowY, playerGroundPos.z + direction.z * currentDist);
                this.spawnArrow(arrowPos, direction);
                this._lastSpawnPos = arrowPos;
                currentDist += this.arrowSpacing;
                spawnCount++;
            }
            if (spawnCount > 0) {
                this.log('Spawned ' + spawnCount + ' arrows, total: ' + this._arrows.length);
            }
        }
        spawnArrow(position, direction) {
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
        removePassedArrows(playerPos) {
            if (!this._targetPosition)
                return;
            var playerGroundPos = new vec3(playerPos.x, 0, playerPos.z);
            var toTarget = new vec3(this._targetPosition.x - playerPos.x, 0, this._targetPosition.z - playerPos.z).normalize();
            // Remove arrows that are behind the player (in direction opposite to target)
            var toRemove = [];
            for (var i = 0; i < this._arrows.length; i++) {
                var arrow = this._arrows[i];
                var arrowPos = arrow.getTransform().getWorldPosition();
                // Vector from player to arrow
                var toArrow = new vec3(arrowPos.x - playerPos.x, 0, arrowPos.z - playerPos.z);
                // Dot product: negative means arrow is behind player
                var dot = toArrow.x * toTarget.x + toArrow.z * toTarget.z;
                // If arrow is behind player (negative dot) or very close
                if (dot < -50) { // 50cm behind
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
        clearArrows() {
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
        log(msg) {
            if (this.debugPrint) {
                print('[RunArrowGuide] ' + msg);
            }
        }
    };
    __setFunctionName(_classThis, "RunArrowGuide");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        RunArrowGuide = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return RunArrowGuide = _classThis;
})();
exports.RunArrowGuide = RunArrowGuide;
//# sourceMappingURL=RunArrowGuide.js.map