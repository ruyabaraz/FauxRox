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
// For 3D headlock UI (camera child). Two fill modes:
// 1. SCALE mode: fillBar scales on X axis (no shader needed) ← RECOMMENDED
// 2. MATERIAL mode: shader with currentPosition parameter
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
            // ── Fill Mode ───────────────────────────────────────────────────────────
            this.fillBar = this.fillBar;
            /** OR: Material with 'currentPosition' float parameter */
            this.barMaterial = this.barMaterial;
            // ── Optional Elements ───────────────────────────────────────────────────
            this.pointer = this.pointer;
            /** Text showing percentage (e.g., "75%") */
            this.percentText = this.percentText;
            // ── Position Bounds (for pointer) ───────────────────────────────────────
            this.startMarker = this.startMarker;
            /** Empty object marking the right edge (100% position) */
            this.endMarker = this.endMarker;
            // ── Settings ─────────────────────────────────────────────────────────────
            this.initialProgress = this.initialProgress;
            /** Smoothly animate progress changes */
            this.smoothTransition = this.smoothTransition;
            /** Animation speed (higher = faster) */
            this.smoothSpeed = this.smoothSpeed;
            /** Minimum scale to prevent disappearing (0.001 - 0.1) */
            this.minFillScale = this.minFillScale;
            /** DEBUG: Auto-animate progress 0→100% for testing */
            this.debugAutoAnimate = this.debugAutoAnimate;
            this.startX = 0;
            this.endX = 0;
            this.pointerY = 0;
            this.pointerZ = 0;
            this.currentProgress = 0;
            this.targetProgress = 0;
            this.isInitialized = false;
            this._lastLoggedProgress = -1;
        }
        __initialize() {
            super.__initialize();
            // ── Fill Mode ───────────────────────────────────────────────────────────
            this.fillBar = this.fillBar;
            /** OR: Material with 'currentPosition' float parameter */
            this.barMaterial = this.barMaterial;
            // ── Optional Elements ───────────────────────────────────────────────────
            this.pointer = this.pointer;
            /** Text showing percentage (e.g., "75%") */
            this.percentText = this.percentText;
            // ── Position Bounds (for pointer) ───────────────────────────────────────
            this.startMarker = this.startMarker;
            /** Empty object marking the right edge (100% position) */
            this.endMarker = this.endMarker;
            // ── Settings ─────────────────────────────────────────────────────────────
            this.initialProgress = this.initialProgress;
            /** Smoothly animate progress changes */
            this.smoothTransition = this.smoothTransition;
            /** Animation speed (higher = faster) */
            this.smoothSpeed = this.smoothSpeed;
            /** Minimum scale to prevent disappearing (0.001 - 0.1) */
            this.minFillScale = this.minFillScale;
            /** DEBUG: Auto-animate progress 0→100% for testing */
            this.debugAutoAnimate = this.debugAutoAnimate;
            this.startX = 0;
            this.endX = 0;
            this.pointerY = 0;
            this.pointerZ = 0;
            this.currentProgress = 0;
            this.targetProgress = 0;
            this.isInitialized = false;
            this._lastLoggedProgress = -1;
        }
        // ── Lifecycle ────────────────────────────────────────────────────────────
        onAwake() {
            // Validate: need at least one fill method
            if (!this.fillBar && !this.barMaterial) {
                print('[ProgressBar] WARNING: No fillBar or barMaterial assigned. Only text/pointer will update.');
            }
            // Setup fillBar - MESH ONLY (use Plane mesh, not Image)
            if (this.fillBar) {
                this.fillTransform = this.fillBar.getTransform();
                this.fillOriginalScale = this.fillTransform.getLocalScale();
                this.fillOriginalPosition = this.fillTransform.getLocalPosition();
                print('[ProgressBar] MESH mode — original scale.x=' + this.fillOriginalScale.x.toFixed(3));
            }
            // Setup pointer
            if (this.pointer) {
                this.pointerTransform = this.pointer.getTransform();
                if (this.startMarker && this.endMarker) {
                    const startPos = this.startMarker.getTransform().getLocalPosition();
                    const endPos = this.endMarker.getTransform().getLocalPosition();
                    this.startX = startPos.x;
                    this.endX = endPos.x;
                    this.pointerY = startPos.y;
                    this.pointerZ = startPos.z;
                    print('[ProgressBar] Pointer range X: ' + this.startX.toFixed(2) + ' → ' + this.endX.toFixed(2));
                }
                else {
                    print('[ProgressBar] WARNING: Pointer assigned but no startMarker/endMarker');
                }
            }
            // Set initial progress
            this.currentProgress = this.initialProgress;
            this.targetProgress = this.initialProgress;
            this.applyProgress(this.initialProgress);
            this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));
            this.isInitialized = true;
            print('[ProgressBar] Initialized — initial: ' + (this.initialProgress * 100).toFixed(0) + '%');
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
        /**
         * Show/hide the entire progress bar
         */
        setVisible(visible) {
            this.getSceneObject().enabled = visible;
        }
        // ── Update Loop ──────────────────────────────────────────────────────────
        onUpdate() {
            if (!this.isInitialized)
                return;
            // DEBUG: Auto-animate for testing
            if (this.debugAutoAnimate) {
                const t = getTime() % 5; // 5 second cycle
                this.targetProgress = t / 5; // 0 → 1 over 5 seconds
            }
            if (!this.smoothTransition)
                return;
            if (Math.abs(this.currentProgress - this.targetProgress) < 0.001) {
                if (this.currentProgress !== this.targetProgress) {
                    this.currentProgress = this.targetProgress;
                    this.applyProgress(this.currentProgress);
                }
                return;
            }
            const dt = getDeltaTime();
            this.currentProgress = this.lerp(this.currentProgress, this.targetProgress, this.smoothSpeed * dt);
            this.applyProgress(this.currentProgress);
        }
        // ── Internal ─────────────────────────────────────────────────────────────
        applyProgress(progress) {
            // 1. Fill bar update (MESH mode - scale X and shift position to simulate left pivot)
            if (this.fillTransform && this.fillOriginalScale && this.fillOriginalPosition) {
                const scaleX = Math.max(this.minFillScale, progress);
                // Scale
                this.fillTransform.setLocalScale(new vec3(this.fillOriginalScale.x * scaleX, this.fillOriginalScale.y, this.fillOriginalScale.z));
                // Shift position to keep left edge fixed (pivot simulation)
                // When scale is 1, pos = original. When scale is 0.5, shift left by half the width
                const fullWidth = this.fillOriginalScale.x;
                const offset = (fullWidth * (1 - scaleX)) / 2;
                this.fillTransform.setLocalPosition(new vec3(this.fillOriginalPosition.x - offset, this.fillOriginalPosition.y, this.fillOriginalPosition.z));
                // Debug
                if (Math.abs(progress - this._lastLoggedProgress) > 0.1) {
                    print('[ProgressBar] ' + (progress * 100).toFixed(0) + '%');
                    this._lastLoggedProgress = progress;
                }
            }
            // 2. Material shader (if using Path Pioneer style shader)
            if (this.barMaterial && this.barMaterial.mainPass) {
                try {
                    this.barMaterial.mainPass.currentPosition = progress;
                }
                catch (e) {
                    // Shader doesn't have currentPosition parameter
                }
            }
            // 3. Move pointer along X axis
            if (this.pointerTransform && this.startMarker && this.endMarker) {
                const newX = this.remap(progress, 0, 1, this.startX, this.endX);
                this.pointerTransform.setLocalPosition(new vec3(newX, this.pointerY, this.pointerZ));
            }
            // 4. Update percentage text
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