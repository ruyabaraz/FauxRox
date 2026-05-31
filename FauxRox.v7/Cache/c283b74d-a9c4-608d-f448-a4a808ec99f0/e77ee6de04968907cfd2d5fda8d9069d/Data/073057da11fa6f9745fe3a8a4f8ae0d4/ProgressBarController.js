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
let ProgressBarController = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var ProgressBarController = _classThis = class extends _classSuper {
        constructor() {
            super();
            this.pointer = this.pointer;
            this.textComponent = this.textComponent;
            this.Mats = this.Mats;
            this.BarMat = this.BarMat;
            /** Bar Image - ScreenTransform üzerinden anchors.right değiştireceğiz */
            this.barImage = this.barImage;
            this.initialProgress = this.initialProgress;
            this.globalOpacity = this.globalOpacity;
            this.startPosScreenTransform = this.startPosScreenTransform;
            this.endPosScreenTransform = this.endPosScreenTransform;
        }
        __initialize() {
            super.__initialize();
            this.pointer = this.pointer;
            this.textComponent = this.textComponent;
            this.Mats = this.Mats;
            this.BarMat = this.BarMat;
            /** Bar Image - ScreenTransform üzerinden anchors.right değiştireceğiz */
            this.barImage = this.barImage;
            this.initialProgress = this.initialProgress;
            this.globalOpacity = this.globalOpacity;
            this.startPosScreenTransform = this.startPosScreenTransform;
            this.endPosScreenTransform = this.endPosScreenTransform;
        }
        onAwake() {
            this.pointerScreenTransform = this.pointer.getComponent("Component.ScreenTransform");
            if (!this.pointerScreenTransform) {
                throw new Error("Pointer is required to have screen transform");
            }
            this.startPos = this.startPosScreenTransform.anchors.getCenter();
            this.endPos = this.endPosScreenTransform.anchors.getCenter();
            // Get ScreenTransform from bar image and save original bounds
            if (this.barImage) {
                this.barScreenTransform = this.barImage.getComponent("Component.ScreenTransform");
                if (this.barScreenTransform) {
                    this.barLeftAnchor = this.barScreenTransform.anchors.left;
                    this.barRightAnchor = this.barScreenTransform.anchors.right;
                    print('[ProgressBar] Bar bounds: left=' + this.barLeftAnchor.toFixed(3) + ' right=' + this.barRightAnchor.toFixed(3));
                }
                else {
                    print('[ProgressBar] ERROR: barImage has no ScreenTransform!');
                }
            }
            this.setProgress(this.initialProgress);
        }
        setProgress(newProgress) {
            // Clamp progress 0-1
            newProgress = Math.max(0, Math.min(1, newProgress));
            // Update pointer position
            const newPointerPosition = MathUtils.remap(newProgress, 0, 1, this.startPos.x, this.endPos.x);
            this.pointerScreenTransform.anchors.setCenter(new vec2(newPointerPosition, this.startPos.y));
            // Update bar fill using anchors.right
            // Progress 0 → right = left (empty)
            // Progress 1 → right = originalRight (full)
            if (this.barScreenTransform) {
                const newRight = this.barLeftAnchor + (newProgress * (this.barRightAnchor - this.barLeftAnchor));
                this.barScreenTransform.anchors.right = newRight;
            }
            // Update text
            if (this.textComponent) {
                this.textComponent.text = Math.floor(newProgress * 100) + "%";
            }
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