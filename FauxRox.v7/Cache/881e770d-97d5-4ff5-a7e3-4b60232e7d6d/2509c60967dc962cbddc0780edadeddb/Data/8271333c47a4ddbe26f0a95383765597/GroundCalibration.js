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
exports.GroundCalibration = void 0;
var __selfType = requireType("./GroundCalibration");
function component(target) { target.getTypeName = function () { return __selfType; }; }
// ============================================================================
// GroundCalibration.ts — HYROX MIRAGE Ground Detection
// Based on Path Pioneer's SurfaceDetection approach
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Uses WorldQueryModule directly for ground detection with:
// - 30-frame stability window
// - Floor offset tracking (player height compensation)
// - Dual callback system (calibrating + calibrated)
// ============================================================================
let GroundCalibration = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var GroundCalibration = _classThis = class extends _classSuper {
        constructor() {
            super();
            this.camera = this.camera;
            this.visualIndicator = this.visualIndicator;
            this.progressText = this.progressText;
            // Detection parameters
            this.maxHitDistance = this.maxHitDistance;
            this.minHitDistance = this.minHitDistance;
            this.calibrationFrames = this.calibrationFrames;
            this.moveThreshold = this.moveThreshold;
            // Floor offset (player height tracking)
            this._floorOffsetFromCamera = -100;
            this._floorIsSet = false;
            // WorldQuery
            this.worldQueryModule = require("LensStudio:WorldQueryModule");
            this.hitTestSession = null;
            this.camTransform = null;
            // Calibration state
            this.isCalibrating = false;
            this.history = [];
            this.stableFrames = 0;
            this.desiredPosition = vec3.zero();
            this.desiredRotation = quat.quatIdentity();
            this.updateEvent = null;
            // Callbacks
            this.onCalibratingCallback = null;
            this.onCalibratedCallback = null;
        }
        __initialize() {
            super.__initialize();
            this.camera = this.camera;
            this.visualIndicator = this.visualIndicator;
            this.progressText = this.progressText;
            // Detection parameters
            this.maxHitDistance = this.maxHitDistance;
            this.minHitDistance = this.minHitDistance;
            this.calibrationFrames = this.calibrationFrames;
            this.moveThreshold = this.moveThreshold;
            // Floor offset (player height tracking)
            this._floorOffsetFromCamera = -100;
            this._floorIsSet = false;
            // WorldQuery
            this.worldQueryModule = require("LensStudio:WorldQueryModule");
            this.hitTestSession = null;
            this.camTransform = null;
            // Calibration state
            this.isCalibrating = false;
            this.history = [];
            this.stableFrames = 0;
            this.desiredPosition = vec3.zero();
            this.desiredRotation = quat.quatIdentity();
            this.updateEvent = null;
            // Callbacks
            this.onCalibratingCallback = null;
            this.onCalibratedCallback = null;
        }
        // ── Lifecycle ────────────────────────────────────────────────────────────
        onAwake() {
            if (!this.camera) {
                print("[GroundCalibration] ERROR: Camera not assigned!");
                return;
            }
            this.camTransform = this.camera.getTransform();
            // Initialize WorldQuery hit test session
            try {
                var options = HitTestSessionOptions.create();
                options.filter = true;
                this.hitTestSession = this.worldQueryModule.createHitTestSessionWithOptions(options);
                print("[GroundCalibration] WorldQuery session created");
            }
            catch (e) {
                print("[GroundCalibration] ERROR creating hit test session: " + e);
            }
            if (this.visualIndicator) {
                this.visualIndicator.enabled = false;
            }
        }
        // ── Public API ───────────────────────────────────────────────────────────
        /**
         * Start ground calibration process
         * @param onCalibrating Called each frame during calibration with progress (0-1)
         * @param onCalibrated Called once when calibration completes
         */
        startCalibration(onCalibrating, onCalibrated) {
            if (this.isCalibrating) {
                print("[GroundCalibration] Already calibrating, ignoring start request");
                return;
            }
            print("[GroundCalibration] Starting ground calibration...");
            this.isCalibrating = true;
            this.history = [];
            this.stableFrames = 0;
            this.onCalibratingCallback = onCalibrating;
            this.onCalibratedCallback = onCalibrated;
            // Show visual indicator
            if (this.visualIndicator) {
                this.visualIndicator.enabled = true;
            }
            // Start hit test session
            if (this.hitTestSession) {
                this.hitTestSession.start();
            }
            // Create update loop
            this.updateEvent = this.createEvent("UpdateEvent");
            this.updateEvent.bind(() => this.onUpdate());
        }
        /**
         * Stop calibration (cancel)
         */
        stopCalibration() {
            this.cleanup();
            print("[GroundCalibration] Calibration stopped");
        }
        /**
         * Get player's ground position based on current camera position and stored floor offset
         */
        getPlayerGroundPosition() {
            if (!this._floorIsSet) {
                print("[GroundCalibration] WARNING: Floor not calibrated yet, using default offset");
            }
            var camPos = this.camTransform.getWorldPosition();
            return new vec3(camPos.x, camPos.y + this._floorOffsetFromCamera, camPos.z);
        }
        /**
         * Check if floor has been calibrated
         */
        get isFloorCalibrated() {
            return this._floorIsSet;
        }
        /**
         * Get the floor offset from camera (negative value = floor is below camera)
         */
        get floorOffset() {
            return this._floorOffsetFromCamera;
        }
        // ── Update Loop ──────────────────────────────────────────────────────────
        onUpdate() {
            if (!this.isCalibrating || !this.hitTestSession)
                return;
            var camPos = this.camTransform.getWorldPosition();
            var camForward = this.camTransform.forward;
            // Bias ray slightly downward to find floor
            var rayDirection = new vec3(camForward.x, camForward.y + 0.15, camForward.z).normalize();
            // Ray from camera forward
            var rayStart = camPos.add(rayDirection.uniformScale(-this.minHitDistance));
            var rayEnd = camPos.add(rayDirection.uniformScale(-this.maxHitDistance));
            this.hitTestSession.hitTest(rayStart, rayEnd, (result) => {
                this.onHitTestResult(result);
            });
        }
        onHitTestResult(result) {
            var camPos = this.camTransform.getWorldPosition();
            if (result === null) {
                // No surface found - show default position
                this.updateVisualDefault();
                this.stableFrames = 0;
                this.history = [];
                this.updateProgress(0);
                return;
            }
            var hitPos = result.position;
            var hitNormal = result.normal;
            // Check if this is a horizontal surface (floor)
            var isHorizontal = hitNormal.y > 0.9;
            if (!isHorizontal) {
                // Not a floor surface
                this.updateVisualDefault();
                this.stableFrames = 0;
                this.history = [];
                this.updateProgress(0);
                return;
            }
            // Valid horizontal surface found
            this.desiredPosition = hitPos;
            // Calculate rotation facing camera
            var worldCameraForward = this.camTransform.right.cross(vec3.up()).normalize();
            this.desiredRotation = quat.lookAt(worldCameraForward, vec3.up());
            // Update visual indicator
            this.updateVisual(this.desiredPosition, this.desiredRotation);
            // Track stability
            this.history.push(hitPos);
            if (this.history.length > this.calibrationFrames) {
                this.history.shift();
            }
            // Check if position is stable (hasn't moved more than threshold)
            if (this.history.length >= 2) {
                var firstPos = this.history[0];
                var lastPos = this.history[this.history.length - 1];
                var movement = firstPos.distance(lastPos);
                if (movement < this.moveThreshold) {
                    this.stableFrames++;
                }
                else {
                    this.stableFrames = Math.max(0, this.stableFrames - 2);
                }
            }
            // Calculate progress
            var progress = Math.min(1, this.stableFrames / this.calibrationFrames);
            this.updateProgress(progress);
            // Call calibrating callback
            if (this.onCalibratingCallback) {
                this.onCalibratingCallback(this.desiredPosition, this.desiredRotation, progress);
            }
            // Check if calibration complete
            if (this.stableFrames >= this.calibrationFrames) {
                this.onCalibrationComplete();
            }
        }
        // ── Calibration Complete ─────────────────────────────────────────────────
        onCalibrationComplete() {
            print("[GroundCalibration] Calibration complete!");
            // Store floor offset from camera
            var camPos = this.camTransform.getWorldPosition();
            var floorY = this.desiredPosition.y;
            this._floorOffsetFromCamera = floorY - camPos.y;
            this._floorIsSet = true;
            print("[GroundCalibration] Floor offset: " + this._floorOffsetFromCamera.toFixed(1) + "cm");
            print("[GroundCalibration] Floor Y: " + floorY.toFixed(1) + ", Camera Y: " + camPos.y.toFixed(1));
            // Call completion callback
            if (this.onCalibratedCallback) {
                this.onCalibratedCallback(this.desiredPosition, this.desiredRotation);
            }
            this.cleanup();
        }
        // ── Visual Updates ───────────────────────────────────────────────────────
        updateVisual(pos, rot) {
            if (!this.visualIndicator)
                return;
            this.visualIndicator.enabled = true;
            this.visualIndicator.getTransform().setWorldPosition(pos);
            this.visualIndicator.getTransform().setWorldRotation(rot);
        }
        updateVisualDefault() {
            if (!this.visualIndicator)
                return;
            var camPos = this.camTransform.getWorldPosition();
            var forward = this.camTransform.forward;
            var defaultPos = camPos.add(forward.uniformScale(-200));
            defaultPos.y = camPos.y - 100; // Below camera
            this.visualIndicator.getTransform().setWorldPosition(defaultPos);
        }
        updateProgress(progress) {
            if (!this.progressText)
                return;
            var pct = Math.round(progress * 100);
            this.progressText.text = "Calibrating: " + pct + "%";
        }
        // ── Cleanup ──────────────────────────────────────────────────────────────
        cleanup() {
            this.isCalibrating = false;
            if (this.updateEvent) {
                this.removeEvent(this.updateEvent);
                this.updateEvent = null;
            }
            if (this.hitTestSession) {
                this.hitTestSession.stop();
            }
            if (this.visualIndicator) {
                this.visualIndicator.enabled = false;
            }
            if (this.progressText) {
                this.progressText.text = "";
            }
            this.onCalibratingCallback = null;
            this.onCalibratedCallback = null;
        }
    };
    __setFunctionName(_classThis, "GroundCalibration");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        GroundCalibration = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return GroundCalibration = _classThis;
})();
exports.GroundCalibration = GroundCalibration;
//# sourceMappingURL=GroundCalibration.js.map