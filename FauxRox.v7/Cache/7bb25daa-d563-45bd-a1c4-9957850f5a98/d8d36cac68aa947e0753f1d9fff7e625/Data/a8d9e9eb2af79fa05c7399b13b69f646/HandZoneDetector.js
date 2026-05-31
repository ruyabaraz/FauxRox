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
exports.HandZoneDetector = exports.ZoneState = void 0;
var __selfType = requireType("./HandZoneDetector");
function component(target) { target.getTypeName = function () { return __selfType; }; }
// ============================================================================
// HandZoneDetector.ts — HYROX MIRAGE Hand Zone Detection
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Tracks hand positions and detects when hands enter target zones
// Used for Target Press, Overhead Pull Gates, Power Row Gates
// ============================================================================
const SIK_1 = require("SpectaclesInteractionKit.lspkg/SIK");
const CourseManager_1 = require("./CourseManager");
// Zone hit state machine
var ZoneState;
(function (ZoneState) {
    ZoneState["WAITING"] = "WAITING";
    ZoneState["READY"] = "READY";
    ZoneState["MOVING"] = "MOVING";
    ZoneState["HIT"] = "HIT";
    ZoneState["COOLDOWN"] = "COOLDOWN";
})(ZoneState || (exports.ZoneState = ZoneState = {}));
let HandZoneDetector = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var HandZoneDetector = _classThis = class extends _classSuper {
        constructor() {
            super();
            // ── Inputs ─────────────────────────────────────────────────────────────────
            this.camera = this.camera;
            /** Target zone visual (spawned per station) */
            this.targetZonePrefab = this.targetZonePrefab;
            /** VFX for zone hit */
            this.hitVfxPrefab = this.hitVfxPrefab;
            /** Height offset for target zone (cm above camera) */
            this.targetHeightOffset = this.targetHeightOffset; // Lowered from 40 - easier to reach
            /** Ready zone height range (cm relative to camera) */
            this.readyZoneMinY = this.readyZoneMinY;
            this.readyZoneMaxY = this.readyZoneMaxY;
            /** Target zone radius (cm) */
            this.targetZoneRadius = this.targetZoneRadius;
            /** Cooldown time after hit (seconds) */
            this.hitCooldown = this.hitCooldown;
            this.debugPrint = this.debugPrint;
            // ── State ──────────────────────────────────────────────────────────────────
            this.camTransform = null;
            this.leftHand = null;
            this.rightHand = null;
            this.handInputData = null;
            this._state = ZoneState.WAITING;
            this._motionType = CourseManager_1.MotionType.OVERHEAD_REACH;
            this._repCount = 0;
            this._isActive = false;
            this._cooldownTimer = 0;
            // Target zone object
            this._targetZoneObj = null;
            this._targetPosition = vec3.zero();
            this._stationAnchor = null; // Station world position for anchored targeting
            // Callbacks
            this._onRepCallback = null;
            this._onStateChangeCallback = null;
        }
        __initialize() {
            super.__initialize();
            // ── Inputs ─────────────────────────────────────────────────────────────────
            this.camera = this.camera;
            /** Target zone visual (spawned per station) */
            this.targetZonePrefab = this.targetZonePrefab;
            /** VFX for zone hit */
            this.hitVfxPrefab = this.hitVfxPrefab;
            /** Height offset for target zone (cm above camera) */
            this.targetHeightOffset = this.targetHeightOffset; // Lowered from 40 - easier to reach
            /** Ready zone height range (cm relative to camera) */
            this.readyZoneMinY = this.readyZoneMinY;
            this.readyZoneMaxY = this.readyZoneMaxY;
            /** Target zone radius (cm) */
            this.targetZoneRadius = this.targetZoneRadius;
            /** Cooldown time after hit (seconds) */
            this.hitCooldown = this.hitCooldown;
            this.debugPrint = this.debugPrint;
            // ── State ──────────────────────────────────────────────────────────────────
            this.camTransform = null;
            this.leftHand = null;
            this.rightHand = null;
            this.handInputData = null;
            this._state = ZoneState.WAITING;
            this._motionType = CourseManager_1.MotionType.OVERHEAD_REACH;
            this._repCount = 0;
            this._isActive = false;
            this._cooldownTimer = 0;
            // Target zone object
            this._targetZoneObj = null;
            this._targetPosition = vec3.zero();
            this._stationAnchor = null; // Station world position for anchored targeting
            // Callbacks
            this._onRepCallback = null;
            this._onStateChangeCallback = null;
        }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        onAwake() {
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
        initHandTracking() {
            try {
                this.handInputData = SIK_1.SIK.HandInputData;
                this.leftHand = this.handInputData.getHand('left');
                this.rightHand = this.handInputData.getHand('right');
                print('[HandZoneDetector] Hand tracking initialized');
            }
            catch (e) {
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
        startDetection(motionType, onRep, onStateChange, stationWorldPos) {
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
        stopDetection() {
            this._isActive = false;
            this.destroyTargetZone();
            this.log('Detection stopped. Total reps: ' + this._repCount);
            return this._repCount;
        }
        /**
         * Get current rep count
         */
        getRepCount() {
            return this._repCount;
        }
        /**
         * Get current state
         */
        getState() {
            return this._state;
        }
        /**
         * Get target distance from hands (average of both hands to target)
         */
        getTargetDistance() {
            var hands = this.getHandPositions();
            if (!hands.valid)
                return -1;
            var leftDist = hands.leftPos.distance(this._targetPosition);
            var rightDist = hands.rightPos.distance(this._targetPosition);
            return (leftDist + rightDist) / 2;
        }
        /**
         * Check if hands are being tracked
         */
        areHandsValid() {
            return this.getHandPositions().valid;
        }
        /**
         * Is station-anchored mode active?
         */
        isStationAnchored() {
            return this._stationAnchor !== null;
        }
        // ── Target Zone Management ─────────────────────────────────────────────────
        spawnTargetZone() {
            this.destroyTargetZone();
            if (!this.targetZonePrefab) {
                this.log('No target zone prefab assigned');
                return;
            }
            this._targetZoneObj = this.targetZonePrefab.instantiate(null);
            this.updateTargetPosition();
        }
        destroyTargetZone() {
            if (this._targetZoneObj) {
                this._targetZoneObj.destroy();
                this._targetZoneObj = null;
            }
        }
        updateTargetPosition() {
            if (!this._targetZoneObj || !this.camTransform)
                return;
            // If station-anchored, position relative to station
            // Otherwise, position relative to camera (legacy/fallback mode)
            if (this._stationAnchor) {
                this.updateTargetPositionStationAnchored();
            }
            else {
                this.updateTargetPositionCameraRelative();
            }
            this._targetZoneObj.getTransform().setWorldPosition(this._targetPosition);
        }
        /** Station-anchored: Target is fixed relative to station position */
        updateTargetPositionStationAnchored() {
            var stationPos = this._stationAnchor;
            var camPos = this.camTransform.getWorldPosition();
            // Direction from station to player (for facing)
            var toPlayer = new vec3(camPos.x - stationPos.x, 0, camPos.z - stationPos.z).normalize();
            // Position target based on motion type, anchored at station
            switch (this._motionType) {
                case CourseManager_1.MotionType.OVERHEAD_REACH:
                case CourseManager_1.MotionType.OVERHEAD_PULL:
                    // Target above station, at player's height + offset
                    this._targetPosition = new vec3(stationPos.x + toPlayer.x * 50, // 50cm toward player from station
                    camPos.y + this.targetHeightOffset, // Above player's head
                    stationPos.z + toPlayer.z * 50);
                    break;
                case CourseManager_1.MotionType.FORWARD_PUSH:
                    // Target at station position, chest height
                    this._targetPosition = new vec3(stationPos.x, camPos.y - 10, stationPos.z);
                    break;
                case CourseManager_1.MotionType.BACKWARD_PULL:
                    // Target between player and station
                    this._targetPosition = new vec3(stationPos.x + toPlayer.x * 60, camPos.y - 15, stationPos.z + toPlayer.z * 60);
                    break;
            }
        }
        /** Camera-relative: Target follows camera (legacy mode for testing) */
        updateTargetPositionCameraRelative() {
            var camPos = this.camTransform.getWorldPosition();
            var camForward = this.camTransform.forward;
            // Position target based on motion type
            switch (this._motionType) {
                case CourseManager_1.MotionType.OVERHEAD_REACH:
                case CourseManager_1.MotionType.OVERHEAD_PULL:
                    // Target above and slightly in front
                    this._targetPosition = new vec3(camPos.x + camForward.x * 30, camPos.y + this.targetHeightOffset, camPos.z + camForward.z * 30);
                    break;
                case CourseManager_1.MotionType.FORWARD_PUSH:
                    // Target in front at chest height
                    this._targetPosition = new vec3(camPos.x + camForward.x * 80, camPos.y - 10, camPos.z + camForward.z * 80);
                    break;
                case CourseManager_1.MotionType.BACKWARD_PULL:
                    // Target in front (pull toward body)
                    this._targetPosition = new vec3(camPos.x + camForward.x * 60, camPos.y - 15, camPos.z + camForward.z * 60);
                    break;
            }
        }
        // ── Update Loop ────────────────────────────────────────────────────────────
        onUpdate() {
            if (!this._isActive)
                return;
            // Update target position only if NOT station-anchored
            // Station-anchored targets stay fixed in world space
            if (!this._stationAnchor) {
                this.updateTargetPosition();
            }
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
            if (!hands.valid)
                return;
            var camPos = this.camTransform.getWorldPosition();
            // Check zones based on motion type
            switch (this._motionType) {
                case CourseManager_1.MotionType.OVERHEAD_REACH:
                    this.processOverheadReach(hands, camPos);
                    break;
                case CourseManager_1.MotionType.OVERHEAD_PULL:
                    this.processOverheadPull(hands, camPos);
                    break;
                case CourseManager_1.MotionType.FORWARD_PUSH:
                case CourseManager_1.MotionType.BACKWARD_PULL:
                    this.processHorizontalMotion(hands, camPos);
                    break;
            }
        }
        // ── Motion Processing ──────────────────────────────────────────────────────
        processOverheadReach(hands, camPos) {
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
                    }
                    else if (inReadyZone) {
                        // Went back down without hitting - reset
                        this.setState(ZoneState.READY);
                    }
                    break;
            }
        }
        processOverheadPull(hands, camPos) {
            var leftY = hands.leftY - camPos.y;
            var rightY = hands.rightY - camPos.y;
            var avgY = (leftY + rightY) / 2;
            // For pull: ready zone is UP (hands raised), target is DOWN (hands pulled down)
            // HARDCODED thresholds - wrists at face level when arms raised = around -10cm from camera
            var readyThreshold = -15; // Hands 15cm below camera (raised to face level) = READY
            var targetThreshold = -35; // Hands 35cm below camera (pulled down to chest) = HIT
            var inReadyZone = avgY >= readyThreshold;
            var inTargetZone = avgY <= targetThreshold;
            // Debug log every ~30 frames
            if (Math.random() < 0.03) {
                this.log('OVERHEAD_PULL: avgY=' + avgY.toFixed(0) + 'cm, ready>' + readyThreshold + ', target<' + targetThreshold + ', state=' + this._state);
            }
            switch (this._state) {
                case ZoneState.WAITING:
                    if (inReadyZone) {
                        this.setState(ZoneState.READY);
                        this.log('Hands UP - ready! avgY=' + avgY.toFixed(0));
                    }
                    break;
                case ZoneState.READY:
                    if (!inReadyZone && avgY < readyThreshold) {
                        this.setState(ZoneState.MOVING);
                    }
                    break;
                case ZoneState.MOVING:
                    if (inTargetZone) {
                        this.onTargetHit();
                    }
                    else if (inReadyZone) {
                        this.setState(ZoneState.READY);
                    }
                    break;
            }
        }
        processHorizontalMotion(hands, camPos) {
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
        onTargetHit() {
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
        spawnHitVfx() {
            if (!this.hitVfxPrefab)
                return;
            var vfx = this.hitVfxPrefab.instantiate(null);
            vfx.getTransform().setWorldPosition(this._targetPosition);
            // Auto-destroy VFX after 1 second
            var destroyEvent = this.createEvent('DelayedCallbackEvent');
            destroyEvent.bind(() => {
                if (vfx)
                    vfx.destroy();
            });
            destroyEvent.reset(1.0);
        }
        // ── Helpers ────────────────────────────────────────────────────────────────
        isInTargetZone(handPos) {
            var dist = handPos.distance(this._targetPosition);
            return dist <= this.targetZoneRadius;
        }
        getHandPositions() {
            var result = {
                valid: false,
                leftPos: vec3.zero(),
                rightPos: vec3.zero(),
                leftY: 0,
                rightY: 0
            };
            if (!this.leftHand || !this.rightHand)
                return result;
            try {
                // Get wrist or palm position
                var leftWrist = this.leftHand.wrist;
                var rightWrist = this.rightHand.wrist;
                if (!leftWrist || !rightWrist)
                    return result;
                result.leftPos = leftWrist.position;
                result.rightPos = rightWrist.position;
                result.leftY = result.leftPos.y;
                result.rightY = result.rightPos.y;
                result.valid = true;
            }
            catch (e) {
                // Hand tracking temporarily unavailable
            }
            return result;
        }
        setState(newState) {
            if (this._state === newState)
                return;
            this._state = newState;
            if (this._onStateChangeCallback) {
                this._onStateChangeCallback(newState);
            }
            this.log('State: ' + newState);
        }
        log(msg) {
            if (this.debugPrint) {
                print('[HandZoneDetector] ' + msg);
            }
        }
    };
    __setFunctionName(_classThis, "HandZoneDetector");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        HandZoneDetector = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return HandZoneDetector = _classThis;
})();
exports.HandZoneDetector = HandZoneDetector;
//# sourceMappingURL=HandZoneDetector.js.map