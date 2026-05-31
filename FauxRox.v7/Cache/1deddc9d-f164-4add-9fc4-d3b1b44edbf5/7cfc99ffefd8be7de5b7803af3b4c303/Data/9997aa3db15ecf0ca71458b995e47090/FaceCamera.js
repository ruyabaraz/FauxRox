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
exports.FaceCamera = void 0;
var __selfType = requireType("./FaceCamera");
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
// FaceCamera.ts — Simple billboard effect
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Makes object always face the camera (user)
// No dependencies on any kit
// ============================================================================
let FaceCamera = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var FaceCamera = _classThis = class extends _classSuper {
        constructor() {
            super();
            this.rotateX = this.rotateX;
            this.rotateY = this.rotateY;
        }
        __initialize() {
            super.__initialize();
            this.rotateX = this.rotateX;
            this.rotateY = this.rotateY;
        }
        onAwake() {
            this.transform = this.getSceneObject().getTransform();
            // Find the main camera
            this.camera = this.findCamera();
            if (!this.camera) {
                print('[FaceCamera] WARNING: Camera not found');
                return;
            }
            this.createEvent('UpdateEvent').bind(() => {
                this.faceCamera();
            });
        }
        findCamera() {
            // Try to get camera from scene
            const cameraObject = global.scene.getRootObjectsCount() > 0
                ? this.findCameraInHierarchy(global.scene.getRootObject(0))
                : null;
            return cameraObject;
        }
        findCameraInHierarchy(obj) {
            const cam = obj.getComponent('Component.Camera');
            if (cam)
                return cam;
            for (let i = 0; i < obj.getChildrenCount(); i++) {
                const found = this.findCameraInHierarchy(obj.getChild(i));
                if (found)
                    return found;
            }
            return null;
        }
        faceCamera() {
            if (!this.camera)
                return;
            const cameraPos = this.camera.getSceneObject().getTransform().getWorldPosition();
            const myPos = this.transform.getWorldPosition();
            // Direction from object to camera
            let direction = cameraPos.sub(myPos);
            // Zero out axes we don't want to rotate on
            if (!this.rotateX) {
                direction.y = 0;
            }
            if (direction.length < 0.001)
                return;
            direction = direction.normalize();
            // Create rotation looking at camera
            const rotation = quat.lookAt(direction, vec3.up());
            this.transform.setWorldRotation(rotation);
        }
    };
    __setFunctionName(_classThis, "FaceCamera");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        FaceCamera = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return FaceCamera = _classThis;
})();
exports.FaceCamera = FaceCamera;
//# sourceMappingURL=FaceCamera.js.map