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
exports.CourseSetup = void 0;
var __selfType = requireType("./CourseSetup");
function component(target) { target.getTypeName = function () { return __selfType; }; }
let CourseSetup = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var CourseSetup = _classThis = class extends _classSuper {
        constructor() {
            super();
            // ── References ───────────────────────────────────────────────────────────
            this.groundCalibration = this.groundCalibration;
            this.courseManagerScript = this.courseManagerScript;
            this.calibrationVisual = this.calibrationVisual;
            this.statusText = this.statusText;
            this.instructionText = this.instructionText;
            /** Start button - enabled after floor calibration */
            this.startButtonObject = this.startButtonObject;
            // ── State ────────────────────────────────────────────────────────────────
            this._isCalibrated = false;
            this._floorY = 0;
        }
        __initialize() {
            super.__initialize();
            // ── References ───────────────────────────────────────────────────────────
            this.groundCalibration = this.groundCalibration;
            this.courseManagerScript = this.courseManagerScript;
            this.calibrationVisual = this.calibrationVisual;
            this.statusText = this.statusText;
            this.instructionText = this.instructionText;
            /** Start button - enabled after floor calibration */
            this.startButtonObject = this.startButtonObject;
            // ── State ────────────────────────────────────────────────────────────────
            this._isCalibrated = false;
            this._floorY = 0;
        }
        // ── Lifecycle ────────────────────────────────────────────────────────────
        onAwake() {
            print("[CourseSetup] Initialized (Dynamic Mode)");
            // Hide start button until calibration is complete
            if (this.startButtonObject) {
                this.startButtonObject.enabled = false;
            }
            if (!this.groundCalibration) {
                print("[CourseSetup] ERROR: GroundCalibration not assigned!");
                return;
            }
            // Calibration will be started by RaceStateMachine after BLE flow completes
            print("[CourseSetup] Waiting for RaceStateMachine to trigger calibration");
        }
        // ── Public API ───────────────────────────────────────────────────────────
        /**
         * Start ground calibration process
         */
        startCalibration() {
            if (this._isCalibrated) {
                print("[CourseSetup] Already calibrated.");
                return;
            }
            this.showInstruction("Look at the floor and hold still");
            this.groundCalibration.startCalibration((pos, rot, progress) => this.onCalibrating(pos, rot, progress), (pos, rot) => this.onCalibrated(pos, rot));
        }
        /**
         * Re-calibrate ground
         */
        recalibrate() {
            this._isCalibrated = false;
            this._floorY = 0;
            print("[CourseSetup] Recalibrating...");
            this.startCalibration();
        }
        /**
         * Check if calibration is complete
         */
        get isCalibrated() {
            return this._isCalibrated;
        }
        /**
         * Get calibrated floor Y position
         */
        get floorY() {
            return this._floorY;
        }
        /**
         * Get player's current ground position (uses calibrated floor height)
         */
        getPlayerGroundPosition() {
            return this.groundCalibration.getPlayerGroundPosition();
        }
        // ── Calibration Callbacks ────────────────────────────────────────────────
        onCalibrating(pos, rot, progress) {
            // Update visual indicator position
            if (this.calibrationVisual) {
                this.calibrationVisual.enabled = true;
                this.calibrationVisual.getTransform().setWorldPosition(pos);
                this.calibrationVisual.getTransform().setWorldRotation(rot);
            }
            // Update status text
            var pct = Math.round(progress * 100);
            this.showStatus("Detecting floor: " + pct + "%");
            if (progress > 0.5) {
                this.showInstruction("Hold steady...");
            }
        }
        onCalibrated(pos, rot) {
            print("[CourseSetup] Ground calibrated at Y=" + pos.y.toFixed(1));
            // Hide calibration visual
            if (this.calibrationVisual) {
                this.calibrationVisual.enabled = false;
            }
            // Store floor height
            this._floorY = pos.y;
            this._isCalibrated = true;
            // Set floor height in CourseManager
            var cm = this.getCourseManager();
            if (cm && typeof cm.setFloorHeight === 'function') {
                cm.setFloorHeight(this._floorY);
            }
            // Spawn START line in front of player
            this.spawnStartLine(pos, rot);
            this.showStatus("READY!");
            this.showInstruction("Wrist menu lets you pause, resume, or stop anytime.");
            // Enable start button after 3 seconds (let user read wrist menu hint first)
            var delayEvent = this.createEvent('DelayedCallbackEvent');
            delayEvent.bind(() => {
                this.showInstruction("Pinch Button to Start.");
                if (this.startButtonObject) {
                    this.startButtonObject.enabled = true;
                }
            });
            delayEvent.reset(3.0);
            print("[CourseSetup] Calibration complete");
            print("[CourseSetup] Floor Y: " + this._floorY.toFixed(1));
            print("[CourseSetup] Floor offset: " + this.groundCalibration.floorOffset.toFixed(1) + "cm");
        }
        spawnStartLine(floorPos, rot) {
            var cm = this.getCourseManager();
            if (!cm)
                return;
            // Get player look direction from calibration rotation
            // Use vec3.back() because camera looks down -Z axis
            var lookDir = rot.multiplyVec3(vec3.back());
            var flatForward = new vec3(lookDir.x, 0, lookDir.z).normalize();
            // Spawn START at calibrated position (in front of where player looked)
            cm.spawnStationInFrontOfPlayer(0, floorPos, flatForward);
            print("[CourseSetup] START line spawned");
        }
        // ── Helpers ──────────────────────────────────────────────────────────────
        getCourseManager() {
            return this.courseManagerScript;
        }
        showStatus(msg) {
            if (this.statusText) {
                this.statusText.text = msg;
            }
        }
        showInstruction(msg) {
            if (this.instructionText) {
                this.instructionText.text = msg;
            }
        }
    };
    __setFunctionName(_classThis, "CourseSetup");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CourseSetup = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CourseSetup = _classThis;
})();
exports.CourseSetup = CourseSetup;
//# sourceMappingURL=CourseSetup.js.map