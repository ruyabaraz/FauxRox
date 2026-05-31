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
exports.RepProgressRing = void 0;
var __selfType = requireType("./RepProgressRing");
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
// RepProgressRing.ts — Circular Progress Ring for Rep Counting
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Displays a circular progress ring with rep count in the center.
// Used for ZONE_HIT stations (SkiErg, Wallball, Power Row).
// ============================================================================
let RepProgressRing = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var RepProgressRing = _classThis = class extends _classSuper {
        constructor() {
            super();
            // ── References ────────────────────────────────────────────────────────────
            /** Ring mesh with progress material (ProgressRingMat shader) */
            this.ringMesh = this.ringMesh;
            /** Text showing current rep count */
            this.currentText = this.currentText;
            /** Text showing total (e.g., "/ 50") */
            this.totalText = this.totalText;
            // ── Settings ──────────────────────────────────────────────────────────────
            /** Ring fill color (shader: ringColor) */
            this.ringColor = this.ringColor;
            /** Animate progress changes */
            this.animateProgress = this.animateProgress;
            /** Animation duration in seconds */
            this.animationDuration = this.animationDuration;
            // ── State ─────────────────────────────────────────────────────────────────
            this._currentReps = 0;
            this._totalReps = 1;
            this._displayedProgress = 0;
            this._targetProgress = 0;
            this._isAnimating = false;
        }
        __initialize() {
            super.__initialize();
            // ── References ────────────────────────────────────────────────────────────
            /** Ring mesh with progress material (ProgressRingMat shader) */
            this.ringMesh = this.ringMesh;
            /** Text showing current rep count */
            this.currentText = this.currentText;
            /** Text showing total (e.g., "/ 50") */
            this.totalText = this.totalText;
            // ── Settings ──────────────────────────────────────────────────────────────
            /** Ring fill color (shader: ringColor) */
            this.ringColor = this.ringColor;
            /** Animate progress changes */
            this.animateProgress = this.animateProgress;
            /** Animation duration in seconds */
            this.animationDuration = this.animationDuration;
            // ── State ─────────────────────────────────────────────────────────────────
            this._currentReps = 0;
            this._totalReps = 1;
            this._displayedProgress = 0;
            this._targetProgress = 0;
            this._isAnimating = false;
        }
        // ── Lifecycle ─────────────────────────────────────────────────────────────
        onAwake() {
            // Initialize shader parameters
            if (this.ringMesh) {
                const pass = this.ringMesh.mainPass;
                pass.progress = 0;
                pass.ringColor = this.ringColor;
            }
            // Start hidden - disable all children
            this.setAllChildrenEnabled(false);
            this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));
            print('[RepProgressRing] Initialized');
        }
        onUpdate() {
            if (!this._isAnimating)
                return;
            // Animate towards target
            var diff = this._targetProgress - this._displayedProgress;
            var step = getDeltaTime() / this.animationDuration;
            if (Math.abs(diff) < step) {
                this._displayedProgress = this._targetProgress;
                this._isAnimating = false;
            }
            else {
                this._displayedProgress += Math.sign(diff) * step;
            }
            this.setRingProgress(this._displayedProgress);
        }
        // ── Public API ────────────────────────────────────────────────────────────
        /**
         * Show the progress ring and initialize with total reps
         */
        show(totalReps) {
            this._currentReps = 0;
            this._totalReps = Math.max(1, totalReps);
            this._displayedProgress = 0;
            this._targetProgress = 0;
            this._isAnimating = false;
            // Enable all children
            this.setAllChildrenEnabled(true);
            this.updateTexts();
            this.setRingProgress(0);
            print('[RepProgressRing] Shown - target: ' + totalReps + ' reps');
        }
        /**
         * Hide the progress ring
         */
        hide() {
            // Disable all children
            this.setAllChildrenEnabled(false);
            this._isAnimating = false;
            print('[RepProgressRing] Hidden');
        }
        /**
         * Enable/disable all children of this group
         */
        setAllChildrenEnabled(enabled) {
            // Parent group
            this.sceneObject.enabled = enabled;
            // Ring mesh
            if (this.ringMesh) {
                this.ringMesh.getSceneObject().enabled = enabled;
            }
            // Text objects
            if (this.currentText) {
                this.currentText.getSceneObject().enabled = enabled;
            }
            if (this.totalText) {
                this.totalText.getSceneObject().enabled = enabled;
            }
        }
        /**
         * Update the current rep count
         */
        setReps(current) {
            this._currentReps = current;
            this._targetProgress = Math.min(1, current / this._totalReps);
            print('[RepProgressRing] setReps: ' + current + '/' + this._totalReps + ' = ' + this._targetProgress.toFixed(2));
            this.updateTexts();
            // Always update immediately (animation unreliable when sceneObject was disabled)
            this._displayedProgress = this._targetProgress;
            this.setRingProgress(this._displayedProgress);
        }
        /**
         * Get current progress (0-1)
         */
        get progress() {
            return this._targetProgress;
        }
        /**
         * Check if ring is visible
         */
        get isVisible() {
            return this.sceneObject.enabled;
        }
        // ── Private Methods ───────────────────────────────────────────────────────
        updateTexts() {
            if (this.currentText) {
                this.currentText.text = this._currentReps.toString();
            }
            if (this.totalText) {
                this.totalText.text = '/ ' + this._totalReps.toString();
            }
        }
        setRingProgress(progress) {
            if (!this.ringMesh)
                return;
            const pass = this.ringMesh.mainPass;
            pass.progress = progress;
            pass.ringColor = this.ringColor;
        }
        /** Update ring color at runtime */
        setColor(color) {
            this.ringColor = color;
            if (this.ringMesh) {
                const pass = this.ringMesh.mainPass;
                pass.ringColor = color;
            }
        }
    };
    __setFunctionName(_classThis, "RepProgressRing");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        RepProgressRing = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return RepProgressRing = _classThis;
})();
exports.RepProgressRing = RepProgressRing;
//# sourceMappingURL=RepProgressRing.js.map