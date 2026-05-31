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
// FaceCamera.ts — Billboard + Smooth Follow
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Makes object face camera AND follow user's view
// Position is set in scene - this just maintains relative position
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
            this.enableFollow = this.enableFollow;
            this.followSpeed = this.followSpeed;
            this.deadzoneDegrees = this.deadzoneDegrees;
            this.isInitialized = false;
        }
        __initialize() {
            super.__initialize();
            this.enableFollow = this.enableFollow;
            this.followSpeed = this.followSpeed;
            this.deadzoneDegrees = this.deadzoneDegrees;
            this.isInitialized = false;
        }
        onAwake() {
            this.transform = this.getSceneObject().getTransform();
            this.createEvent('OnStartEvent').bind(() => {
                this.initialize();
            });
            this.createEvent('UpdateEvent').bind(() => {
                this.onUpdate();
            });
        }
        initialize() {
            this.camera = this.findCamera();
            if (!this.camera) {
                print('[FaceCamera] WARNING: Camera not found');
                return;
            }
            this.cameraTransform = this.camera.getSceneObject().getTransform();
            // Capture initial relative position (in camera's local space)
            const camPos = this.cameraTransform.getWorldPosition();
            const myPos = this.transform.getWorldPosition();
            const camInverse = this.cameraTransform.getInvertedWorldTransform();
            this.relativeOffset = camInverse.multiplyPoint(myPos);
            this.targetPosition = myPos;
            this.isInitialized = true;
        }
        findCamera() {
            for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
                const found = this.findCameraInHierarchy(global.scene.getRootObject(i));
                if (found)
                    return found;
            }
            return null;
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
        onUpdate() {
            if (!this.isInitialized || !this.camera)
                return;
            if (this.enableFollow) {
                this.updateFollow();
            }
        }
        updateFollow() {
            const currentPos = this.transform.getWorldPosition();
            // Calculate ideal position based on camera's current transform
            const camWorldTransform = this.cameraTransform.getWorldTransform();
            const idealPos = camWorldTransform.multiplyPoint(this.relativeOffset);
            // Check deadzone
            const camPos = this.cameraTransform.getWorldPosition();
            const toCurrentDir = currentPos.sub(camPos).normalize();
            const toIdealDir = idealPos.sub(camPos).normalize();
            const angleDiff = Math.acos(Math.min(1, Math.max(-1, toCurrentDir.dot(toIdealDir)))) * (180 / Math.PI);
            if (angleDiff > this.deadzoneDegrees) {
                this.targetPosition = idealPos;
            }
            // Smooth lerp
            const dt = getDeltaTime();
            const lerpFactor = 1 - Math.exp(-this.followSpeed * dt);
            const newPos = vec3.lerp(currentPos, this.targetPosition, lerpFactor);
            this.transform.setWorldPosition(newPos);
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