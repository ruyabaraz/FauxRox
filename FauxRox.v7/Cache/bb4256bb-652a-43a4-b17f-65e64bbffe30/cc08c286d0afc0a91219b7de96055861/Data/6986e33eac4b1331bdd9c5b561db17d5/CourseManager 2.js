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
exports.CourseManager = void 0;
var __selfType = requireType("./CourseManager 2");
function component(target) { target.getTypeName = function () { return __selfType; }; }
// ============================================================================
// CourseManager.ts — HYROX MIRAGE Course Placement via World Query
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Attach to SceneObject "CourseRoot".
// No import/export — Lens Studio resolves @component classes globally.
// Other scripts reference this via @input CourseManager in Inspector.
// ============================================================================
const WorldQueryModule = require('LensStudio:WorldQueryModule');
// ── Course Layout Config ────────────────────────────────────────────────────
var StationType;
(function (StationType) {
    StationType["START_LINE"] = "START_LINE";
    StationType["GATE_RUN"] = "GATE_RUN";
    StationType["BURPEE_JUMP"] = "BURPEE_JUMP";
    StationType["LUNGE_CORR"] = "LUNGE_CORRIDOR";
    StationType["WALL_BALL"] = "WALL_BALL";
    StationType["FINISH_TUNNEL"] = "FINISH_TUNNEL";
})(StationType || (StationType = {}));
const DEFAULT_COURSE = [
    { name: 'START', type: StationType.START_LINE, forwardOffset: 0, lateralOffset: 0 },
    { name: 'Gate Run 1', type: StationType.GATE_RUN, forwardOffset: 400, lateralOffset: 0 },
    { name: 'Burpee Jumps', type: StationType.BURPEE_JUMP, forwardOffset: 350, lateralOffset: 50 },
    { name: 'Gate Run 2', type: StationType.GATE_RUN, forwardOffset: 400, lateralOffset: 0 },
    { name: 'Lunge Corridor', type: StationType.LUNGE_CORR, forwardOffset: 300, lateralOffset: -50 },
    { name: 'Wall Ball', type: StationType.WALL_BALL, forwardOffset: 350, lateralOffset: 0 },
    { name: 'FINISH', type: StationType.FINISH_TUNNEL, forwardOffset: 400, lateralOffset: 0 },
];
// ============================================================================
let CourseManager = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var CourseManager = _classThis = class extends _classSuper {
        constructor() {
            super();
            // ── Inspector Inputs ────────────────────────────────────────────────────
            this.cameraObject = this.cameraObject;
            this.startLinePrefab = this.startLinePrefab;
            this.gatePrefab = this.gatePrefab;
            this.burpeePrefab = this.burpeePrefab;
            this.lungePrefab = this.lungePrefab;
            this.wallBallPrefab = this.wallBallPrefab;
            this.finishPrefab = this.finishPrefab;
            this.highlightMaterial = this.highlightMaterial;
            this.completedMaterial = this.completedMaterial;
            this.useWorldQueryFilter = this.useWorldQueryFilter;
            this.courseScale = this.courseScale;
            // ── Public Station Data ─────────────────────────────────────────────────
            // Accessed directly by RaceStateMachine and ProximityDetector
            // via their @input courseManager reference.
            this.stationNames = [];
            this.stationPositions = [];
            this.stationDistanceLabels = [];
            this.stationObjects = [];
            this.stationCompleted = [];
            // ── Internal ────────────────────────────────────────────────────────────
            this._hitTestSession = null;
            this._coursePlaced = false;
        }
        __initialize() {
            super.__initialize();
            // ── Inspector Inputs ────────────────────────────────────────────────────
            this.cameraObject = this.cameraObject;
            this.startLinePrefab = this.startLinePrefab;
            this.gatePrefab = this.gatePrefab;
            this.burpeePrefab = this.burpeePrefab;
            this.lungePrefab = this.lungePrefab;
            this.wallBallPrefab = this.wallBallPrefab;
            this.finishPrefab = this.finishPrefab;
            this.highlightMaterial = this.highlightMaterial;
            this.completedMaterial = this.completedMaterial;
            this.useWorldQueryFilter = this.useWorldQueryFilter;
            this.courseScale = this.courseScale;
            // ── Public Station Data ─────────────────────────────────────────────────
            // Accessed directly by RaceStateMachine and ProximityDetector
            // via their @input courseManager reference.
            this.stationNames = [];
            this.stationPositions = [];
            this.stationDistanceLabels = [];
            this.stationObjects = [];
            this.stationCompleted = [];
            // ── Internal ────────────────────────────────────────────────────────────
            this._hitTestSession = null;
            this._coursePlaced = false;
        }
        get isCoursePlaced() { return this._coursePlaced; }
        get stationCount() { return this.stationNames.length; }
        // ── Lifecycle ─────────────────────────────────────────────────────────
        onAwake() {
            if (this.cameraObject) {
                this._cameraTransform = this.cameraObject.getTransform();
            }
            this._hitTestSession = WorldQueryModule.createHitTestSessionWithOptions({
                filter: this.useWorldQueryFilter,
            });
            print('[CourseManager] Init — ' + DEFAULT_COURSE.length + ' stations, scale=' + this.courseScale);
        }
        // ── Public API ────────────────────────────────────────────────────────
        placeCourse() {
            if (this._coursePlaced) {
                print('[CourseManager] Already placed. resetCourse() first.');
                return;
            }
            if (!this._cameraTransform) {
                print('[CourseManager] ERROR: cameraObject not set!');
                return;
            }
            var camPos = this._cameraTransform.getWorldPosition();
            var camForward = this._cameraTransform.forward;
            var rayDir = new vec3(camForward.x, -0.5, camForward.z).normalize();
            this._hitTestSession.hitTest(camPos, rayDir, (hitResult) => {
                if (hitResult === null) {
                    print('[CourseManager] No surface — fallback placement.');
                    this.placeCourseAtFallback(camPos, camForward);
                    return;
                }
                this.placeCourseAtHit(hitResult.position, camForward);
            });
        }
        highlightStation(index) {
            for (var i = 0; i < this.stationObjects.length; i++) {
                if (i < index && this.completedMaterial) {
                    this.applyMaterial(this.stationObjects[i], this.completedMaterial);
                    this.stationCompleted[i] = true;
                }
                else if (i === index && this.highlightMaterial) {
                    this.applyMaterial(this.stationObjects[i], this.highlightMaterial);
                }
            }
        }
        resetCourse() {
            for (var i = 0; i < this.stationObjects.length; i++) {
                if (this.stationObjects[i]) {
                    this.stationObjects[i].destroy();
                }
            }
            this.stationNames = [];
            this.stationPositions = [];
            this.stationDistanceLabels = [];
            this.stationObjects = [];
            this.stationCompleted = [];
            this._coursePlaced = false;
            print('[CourseManager] Course reset');
        }
        // ── Placement ─────────────────────────────────────────────────────────
        placeCourseAtHit(hitPos, camForward) {
            print('[CourseManager] Surface at (' + hitPos.x.toFixed(0) + ','
                + hitPos.y.toFixed(0) + ',' + hitPos.z.toFixed(0) + ')');
            var courseDir = new vec3(camForward.x, 0, camForward.z).normalize();
            var courseLateral = new vec3(-courseDir.z, 0, courseDir.x);
            this.layoutStations(hitPos, courseDir, courseLateral);
        }
        placeCourseAtFallback(camPos, camForward) {
            var groundY = camPos.y - 150;
            var groundPos = new vec3(camPos.x, groundY, camPos.z);
            var courseDir = new vec3(camForward.x, 0, camForward.z).normalize();
            var courseLateral = new vec3(-courseDir.z, 0, courseDir.x);
            print('[CourseManager] Fallback ground Y=' + groundY.toFixed(0));
            this.layoutStations(groundPos, courseDir, courseLateral);
        }
        layoutStations(origin, forwardDir, lateralDir) {
            var currentPos = new vec3(origin.x, origin.y, origin.z);
            for (var i = 0; i < DEFAULT_COURSE.length; i++) {
                var config = DEFAULT_COURSE[i];
                var fwd = config.forwardOffset * this.courseScale;
                var lat = config.lateralOffset * this.courseScale;
                currentPos = new vec3(currentPos.x + forwardDir.x * fwd + lateralDir.x * lat, currentPos.y, currentPos.z + forwardDir.z * fwd + lateralDir.z * lat);
                var prefab = this.getPrefabForType(config.type);
                if (!prefab) {
                    print('[CourseManager] WARNING: No prefab for ' + config.type);
                    continue;
                }
                var stationObj = prefab.instantiate(this.sceneObject);
                stationObj.getTransform().setWorldPosition(currentPos);
                var lookRot = quat.lookAt(forwardDir, vec3.up());
                stationObj.getTransform().setWorldRotation(lookRot);
                var distLabel = '';
                if (i < DEFAULT_COURSE.length - 1) {
                    var nextFwd = DEFAULT_COURSE[i + 1].forwardOffset * this.courseScale;
                    distLabel = (nextFwd / 100).toFixed(0) + 'm ahead';
                }
                else {
                    distLabel = 'FINAL';
                }
                this.stationNames.push(config.name);
                this.stationPositions.push(new vec3(currentPos.x, currentPos.y, currentPos.z));
                this.stationDistanceLabels.push(distLabel);
                this.stationObjects.push(stationObj);
                this.stationCompleted.push(false);
                print('[CourseManager] Placed ' + i + ': ' + config.name);
            }
            this._coursePlaced = true;
            if (this.highlightMaterial && this.stationObjects.length > 0) {
                this.applyMaterial(this.stationObjects[0], this.highlightMaterial);
            }
            print('[CourseManager] Course placed! ' + this.stationNames.length + ' stations');
        }
        // ── Helpers ───────────────────────────────────────────────────────────
        getPrefabForType(type) {
            switch (type) {
                case StationType.START_LINE: return this.startLinePrefab;
                case StationType.GATE_RUN: return this.gatePrefab;
                case StationType.BURPEE_JUMP: return this.burpeePrefab;
                case StationType.LUNGE_CORR: return this.lungePrefab;
                case StationType.WALL_BALL: return this.wallBallPrefab;
                case StationType.FINISH_TUNNEL: return this.finishPrefab;
                default: return this.gatePrefab;
            }
        }
        applyMaterial(obj, mat) {
            var childCount = obj.getChildrenCount();
            for (var i = 0; i < childCount; i++) {
                var rmv = obj.getChild(i).getComponent('Component.RenderMeshVisual');
                if (rmv) {
                    rmv.mainMaterial = mat;
                }
            }
            var rootRmv = obj.getComponent('Component.RenderMeshVisual');
            if (rootRmv) {
                rootRmv.mainMaterial = mat;
            }
        }
    };
    __setFunctionName(_classThis, "CourseManager");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CourseManager = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CourseManager = _classThis;
})();
exports.CourseManager = CourseManager;
//# sourceMappingURL=CourseManager%202.js.map