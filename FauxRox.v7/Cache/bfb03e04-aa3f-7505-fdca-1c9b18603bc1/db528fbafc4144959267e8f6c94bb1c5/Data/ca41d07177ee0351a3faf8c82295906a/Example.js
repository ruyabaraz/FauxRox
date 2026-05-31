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
exports.Example = void 0;
var __selfType = requireType("./Example");
function component(target) { target.getTypeName = function () { return __selfType; }; }
// ============================================================================
// Example.ts — SurfacePlacement → CourseManager Bridge
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// This is the SurfacePlacement package's Example.ts, modified to call
// CourseManager.placeCourseAt() when surface placement is confirmed.
//
// Attach to "Example Surface" SceneObject (same as original).
// Add courseManagerScript input → drag CourseRoot here.
// ============================================================================
const PlacementSettings_1 = require("./Scripts/PlacementSettings");
const SurfacePlacementController_1 = require("./Scripts/SurfacePlacementController");
let Example = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var Example = _classThis = class extends _classSuper {
        constructor() {
            super();
            this.objectVisuals = this.objectVisuals;
            this.placementSettingMode = this.placementSettingMode; // Default to Horizontal for HYROX
            this.autoStart = this.autoStart;
            /** Drag CourseRoot SceneObject here */
            this.courseManagerScript = this.courseManagerScript;
            this.transform = null;
            this.surfacePlacement = SurfacePlacementController_1.SurfacePlacementController.getInstance();
        }
        __initialize() {
            super.__initialize();
            this.objectVisuals = this.objectVisuals;
            this.placementSettingMode = this.placementSettingMode; // Default to Horizontal for HYROX
            this.autoStart = this.autoStart;
            /** Drag CourseRoot SceneObject here */
            this.courseManagerScript = this.courseManagerScript;
            this.transform = null;
            this.surfacePlacement = SurfacePlacementController_1.SurfacePlacementController.getInstance();
        }
        getCM() {
            return this.courseManagerScript;
        }
        onAwake() {
            this.transform = this.getSceneObject().getTransform();
            this.createEvent("OnStartEvent").bind(this.onStart.bind(this));
        }
        onStart() {
            if (this.objectVisuals) {
                this.objectVisuals.enabled = false;
            }
            if (this.autoStart) {
                this.startPlacement();
            }
        }
        startPlacement() {
            if (this.objectVisuals) {
                this.objectVisuals.enabled = false;
            }
            let placementSettings;
            switch (this.placementSettingMode) {
                case 0: // Near Surface
                    placementSettings = new PlacementSettings_1.PlacementSettings(PlacementSettings_1.PlacementMode.NEAR_SURFACE, true, new vec3(10, 10, 0), this.onSliderUpdated.bind(this));
                    break;
                case 1: // Horizontal
                    placementSettings = new PlacementSettings_1.PlacementSettings(PlacementSettings_1.PlacementMode.HORIZONTAL);
                    break;
                case 2: // Vertical
                    placementSettings = new PlacementSettings_1.PlacementSettings(PlacementSettings_1.PlacementMode.VERTICAL);
                    break;
                default:
                    placementSettings = new PlacementSettings_1.PlacementSettings(PlacementSettings_1.PlacementMode.HORIZONTAL);
            }
            this.surfacePlacement.startSurfacePlacement(placementSettings, (pos, rot) => {
                this.onSurfaceDetected(pos, rot);
            });
        }
        resetPlacement() {
            this.surfacePlacement.stopSurfacePlacement();
            // Also reset CourseManager
            var cm = this.getCM();
            if (cm && cm.isCoursePlaced) {
                cm.resetCourse();
            }
            this.startPlacement();
        }
        onSliderUpdated(pos) {
            this.transform.setWorldPosition(pos);
        }
        onSurfaceDetected(pos, rot) {
            // Show visuals if any
            if (this.objectVisuals) {
                this.objectVisuals.enabled = true;
            }
            this.transform.setWorldPosition(pos);
            this.transform.setWorldRotation(rot);
            // ── HYROX MIRAGE: Place course at confirmed surface point ──
            var cm = this.getCM();
            if (cm) {
                cm.placeCourseAt(pos, rot);
                print('[Example] Surface detected → CourseManager.placeCourseAt() called');
            }
            else {
                print('[Example] WARNING: courseManagerScript not assigned!');
            }
        }
    };
    __setFunctionName(_classThis, "Example");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Example = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Example = _classThis;
})();
exports.Example = Example;
//# sourceMappingURL=Example.js.map