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
exports.SmoothFollow = void 0;
var __selfType = requireType("./SmoothFollow");
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
// SmoothFollow.ts — Standalone Smooth Follow + Billboard
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Based on SpectaclesUIKit Frame's SmoothFollow behavior
// Keeps object in user's view and faces them
// ============================================================================
let SmoothFollow = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var SmoothFollow = _classThis = class extends _classSuper {
        constructor() {
            super();
            this.translationTime = this.translationTime;
            this.rotationTime = this.rotationTime;
            this.minDistance = 25;
            this.maxDistance = 110;
            this.minElevation = -40;
            this.maxElevation = 40;
        }
        __initialize() {
            super.__initialize();
            this.translationTime = this.translationTime;
            this.rotationTime = this.rotationTime;
            this.minDistance = 25;
            this.maxDistance = 110;
            this.minElevation = -40;
            this.maxElevation = 40;
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
                print('[SmoothFollow] WARNING: Camera not found');
                return;
            }
            this.cameraTransform = this.camera.getSceneObject().getTransform();
            this.target = vec3.zero();
            this.velocity = vec3.zero();
            this.omega = 0;
            this.initialRot = this.transform.getLocalRotation();
            this.heading = this.getCameraHeading();
            this.clampPosition();
            print('[SmoothFollow] Initialized');
        }
        findCamera() {
            for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
                const found = this.searchCamera(global.scene.getRootObject(i));
                if (found)
                    return found;
            }
            return null;
        }
        searchCamera(obj) {
            const cam = obj.getComponent('Component.Camera');
            if (cam)
                return cam;
            for (let i = 0; i < obj.getChildrenCount(); i++) {
                const found = this.searchCamera(obj.getChild(i));
                if (found)
                    return found;
            }
            return null;
        }
        clampPosition() {
            const worldPos = this.transform.getWorldPosition();
            this.target = this.cartesianToCylindrical(this.worldToBody(worldPos));
            this.target.z = this.clamp(this.target.z, this.minDistance, this.maxDistance);
            this.target.y = this.clamp(this.target.y, this.minElevation, this.maxElevation);
            this.velocity = vec3.zero();
            this.omega = 0;
        }
        onUpdate() {
            if (!this.camera)
                return;
            const worldPos = this.transform.getWorldPosition();
            const pos = this.cartesianToCylindrical(this.worldToBody(worldPos));
            this.target.y = this.clamp(pos.y, this.minElevation, this.maxElevation);
            const dt = getDeltaTime();
            const [newX, newVelX] = this.smoothDamp(pos.x, this.target.x, this.velocity.x, this.translationTime, dt);
            const [newY, newVelY] = this.smoothDamp(pos.y, this.target.y, this.velocity.y, this.translationTime, dt);
            const [newZ, newVelZ] = this.smoothDamp(pos.z, this.target.z, this.velocity.z, this.translationTime, dt);
            pos.x = newX;
            this.velocity.x = newVelX;
            pos.y = newY;
            this.velocity.y = newVelY;
            pos.z = newZ;
            this.velocity.z = newVelZ;
            this.transform.setWorldPosition(this.bodyToWorld(this.cylindricalToCartesian(pos)));
            const [newHeading, newOmega] = this.smoothDampAngle(this.heading, this.getCameraHeading(), this.omega, this.rotationTime, dt);
            this.heading = newHeading;
            this.omega = newOmega;
            // Billboard - face the camera
            const camPos = this.cameraTransform.getWorldPosition();
            const myPos = this.transform.getWorldPosition();
            const lookDir = camPos.sub(myPos).normalize();
            const rot = quat.lookAt(lookDir, vec3.up()).multiply(this.initialRot);
            this.transform.setWorldRotation(rot);
        }
        // Coordinate transforms
        cartesianToCylindrical(v) {
            return new vec3(Math.atan2(-v.x, -v.z), v.y, Math.sqrt(v.x * v.x + v.z * v.z));
        }
        cylindricalToCartesian(v) {
            return new vec3(v.z * -Math.sin(v.x), v.y, v.z * -Math.cos(v.x));
        }
        worldToBody(v) {
            const camPos = this.cameraTransform.getWorldPosition();
            return quat.angleAxis(-this.getCameraHeading(), vec3.up()).multiplyVec3(v.sub(camPos));
        }
        bodyToWorld(v) {
            const camPos = this.cameraTransform.getWorldPosition();
            return quat.angleAxis(this.getCameraHeading(), vec3.up()).multiplyVec3(v).add(camPos);
        }
        getCameraHeading() {
            const forward = this.cameraTransform.forward;
            return Math.atan2(forward.x, forward.z);
        }
        // Utilities
        clamp(val, min, max) {
            return Math.max(min, Math.min(max, val));
        }
        smoothDamp(current, target, velocity, smoothTime, dt) {
            const omega = 2 / smoothTime;
            const x = omega * dt;
            const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
            const change = current - target;
            const temp = (velocity + omega * change) * dt;
            const newVelocity = (velocity - omega * temp) * exp;
            const newValue = target + (change + temp) * exp;
            return [newValue, newVelocity];
        }
        smoothDampAngle(current, target, velocity, smoothTime, dt) {
            let delta = target - current;
            while (delta > Math.PI)
                delta -= 2 * Math.PI;
            while (delta < -Math.PI)
                delta += 2 * Math.PI;
            return this.smoothDamp(current, current + delta, velocity, smoothTime, dt);
        }
    };
    __setFunctionName(_classThis, "SmoothFollow");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        SmoothFollow = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return SmoothFollow = _classThis;
})();
exports.SmoothFollow = SmoothFollow;
//# sourceMappingURL=SmoothFollow.js.map