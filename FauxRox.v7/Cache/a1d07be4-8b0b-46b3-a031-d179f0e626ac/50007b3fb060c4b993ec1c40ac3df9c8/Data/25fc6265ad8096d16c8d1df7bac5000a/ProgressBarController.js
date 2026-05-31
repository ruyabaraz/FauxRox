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
exports.ProgressBarController = void 0;
var __selfType = requireType("./ProgressBarController");
function component(target) { target.getTypeName = function () { return __selfType; }; }
// ============================================================================
// ProgressBarController.ts — Visual Progress Bar for Headlock UI
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Adapted from Path Pioneer for 3D headlock UI (camera child, not ortho/screen)
// Uses local X position for pointer movement and material shader for fill effect
// ============================================================================
let ProgressBarController = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var ProgressBarController = _classThis = class extends _classSuper {
        constructor() {
            super();
            // ── Bar Elements ─────────────────────────────────────────────────────────
            /** Pointer/indicator that slides along the bar */
            this.pointer = this.pointer;
            /** Text component showing percentage (e.g., "75%") */
            this.percentText = this.percentText;
            /** Material with 'currentPosition' float parameter for fill shader */
            this.barMaterial = this.barMaterial;
            // ── Position Bounds ──────────────────────────────────────────────────────
            /** Empty object marking the left edge (0% position) */
            this.startMarker = this.startMarker;
            /** Empty object marking the right edge (100% position) */
            this.endMarker = this.endMarker;
            // ── Settings ─────────────────────────────────────────────────────────────
            this.initialProgress = this.initialProgress;
            /** Smoothly animate progress changes */
            this.smoothTransition = this.smoothTransition;
            /** Animation speed (higher = faster) */
            this.smoothSpeed = this.smoothSpeed;
            this.startX = 0;
            this.endX = 0;
            this.startY = 0;
            this.startZ = 0;
            this.currentProgress = 0;
            this.targetProgress = 0;
        }
        __initialize() {
            super.__initialize();
            // ── Bar Elements ─────────────────────────────────────────────────────────
            /** Pointer/indicator that slides along the bar */
            this.pointer = this.pointer;
            /** Text component showing percentage (e.g., "75%") */
            this.percentText = this.percentText;
            /** Material with 'currentPosition' float parameter for fill shader */
            this.barMaterial = this.barMaterial;
            // ── Position Bounds ──────────────────────────────────────────────────────
            /** Empty object marking the left edge (0% position) */
            this.startMarker = this.startMarker;
            /** Empty object marking the right edge (100% position) */
            this.endMarker = this.endMarker;
            // ── Settings ─────────────────────────────────────────────────────────────
            this.initialProgress = this.initialProgress;
            /** Smoothly animate progress changes */
            this.smoothTransition = this.smoothTransition;
            /** Animation speed (higher = faster) */
            this.smoothSpeed = this.smoothSpeed;
            this.startX = 0;
            this.endX = 0;
            this.startY = 0;
            this.startZ = 0;
            this.currentProgress = 0;
            this.targetProgress = 0;
        }
        // ── Lifecycle ────────────────────────────────────────────────────────────
        onAwake() {
            if (!this.pointer) {
                print('[ProgressBar] ERROR: pointer not assigned');
                return;
            }
            if (!this.startMarker || !this.endMarker) {
                print('[ProgressBar] ERROR: startMarker and endMarker required');
                return;
            }
            this.pointerTransform = this.pointer.getTransform();
            // Get local X positions from markers
            const startPos = this.startMarker.getTransform().getLocalPosition();
            const endPos = this.endMarker.getTransform().getLocalPosition();
            this.startX = startPos.x;
            this.endX = endPos.x;
            this.startY = startPos.y;
            this.startZ = startPos.z;
            // Set initial progress
            this.currentProgress = this.initialProgress;
            this.targetProgress = this.initialProgress;
            this.applyProgress(this.initialProgress);
            if (this.smoothTransition) {
                this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));
            }
            print('[ProgressBar] Init — range X: ' + this.startX.toFixed(2) + ' → ' + this.endX.toFixed(2));
        }
        // ── Public API ───────────────────────────────────────────────────────────
        /**
         * Set progress value (0 to 1)
         */
        setProgress(progress) {
            this.targetProgress = Math.max(0, Math.min(1, progress));
            if (!this.smoothTransition) {
                this.currentProgress = this.targetProgress;
                this.applyProgress(this.currentProgress);
            }
        }
        /**
         * Get current displayed progress
         */
        getProgress() {
            return this.currentProgress;
        }
        /**
         * Reset to zero (instant, no animation)
         */
        reset() {
            this.currentProgress = 0;
            this.targetProgress = 0;
            this.applyProgress(0);
        }
        // ── Update Loop ──────────────────────────────────────────────────────────
        onUpdate() {
            if (!this.smoothTransition)
                return;
            if (Math.abs(this.currentProgress - this.targetProgress) < 0.001)
                return;
            const dt = getDeltaTime();
            this.currentProgress = this.lerp(this.currentProgress, this.targetProgress, this.smoothSpeed * dt);
            this.applyProgress(this.currentProgress);
        }
        // ── Internal ─────────────────────────────────────────────────────────────
        applyProgress(progress) {
            // Move pointer along X axis
            if (this.pointerTransform) {
                const newX = this.remap(progress, 0, 1, this.startX, this.endX);
                this.pointerTransform.setLocalPosition(new vec3(newX, this.startY, this.startZ));
            }
            // Update material shader parameter
            if (this.barMaterial && this.barMaterial.mainPass) {
                this.barMaterial.mainPass.currentPosition = progress;
            }
            // Update percentage text
            if (this.percentText) {
                this.percentText.text = Math.floor(progress * 100) + '%';
            }
        }
        remap(value, inMin, inMax, outMin, outMax) {
            return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
        }
        lerp(a, b, t) {
            return a + (b - a) * Math.min(1, t);
        }
    };
    __setFunctionName(_classThis, "ProgressBarController");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ProgressBarController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ProgressBarController = _classThis;
})();
exports.ProgressBarController = ProgressBarController;
//# sourceMappingURL=ProgressBarController.js.map