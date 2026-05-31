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
var __selfType = requireType("./CourseManager");
function component(target) { target.getTypeName = function () { return __selfType; }; }
// ============================================================================
// CourseManager.ts — HYROX MIRAGE Course Placement via World Query
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Attach to SceneObject "CourseRoot".
// Other scripts reference this via @input as Component.ScriptComponent,
// then access public properties/methods at runtime.
// ============================================================================
const WorldQueryModule = require('LensStudio:WorldQueryModule');
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
            // ── Public Data (accessed by other scripts at runtime) ──────────────────
            this.stationNames = [];
            this.stationPositions = [];
            this.stationDistanceLabels = [];
            this.stationObjects = [];
            this.stationCompleted = [];
            this.isCoursePlaced = false;
            this.stationCount = 0;
            // ── Course Config ─────────────────────────────────────────────────────
            this._courseConfig = [
                { name: 'START', type: 'START_LINE', fwd: 0, lat: 0 },
                { name: 'Gate Run 1', type: 'GATE_RUN', fwd: 400, lat: 0 },
                { name: 'Burpee Jumps', type: 'BURPEE_JUMP', fwd: 350, lat: 50 },
                { name: 'Gate Run 2', type: 'GATE_RUN', fwd: 400, lat: 0 },
                { name: 'Lunge Corridor', type: 'LUNGE_CORRIDOR', fwd: 300, lat: -50 },
                { name: 'Wall Ball', type: 'WALL_BALL', fwd: 350, lat: 0 },
                { name: 'FINISH', type: 'FINISH_TUNNEL', fwd: 400, lat: 0 },
            ];
            // ── Internal ────────────────────────────────────────────────────────────
            this._hitTestSession = null;
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
            // ── Public Data (accessed by other scripts at runtime) ──────────────────
            this.stationNames = [];
            this.stationPositions = [];
            this.stationDistanceLabels = [];
            this.stationObjects = [];
            this.stationCompleted = [];
            this.isCoursePlaced = false;
            this.stationCount = 0;
            // ── Course Config ─────────────────────────────────────────────────────
            this._courseConfig = [
                { name: 'START', type: 'START_LINE', fwd: 0, lat: 0 },
                { name: 'Gate Run 1', type: 'GATE_RUN', fwd: 400, lat: 0 },
                { name: 'Burpee Jumps', type: 'BURPEE_JUMP', fwd: 350, lat: 50 },
                { name: 'Gate Run 2', type: 'GATE_RUN', fwd: 400, lat: 0 },
                { name: 'Lunge Corridor', type: 'LUNGE_CORRIDOR', fwd: 300, lat: -50 },
                { name: 'Wall Ball', type: 'WALL_BALL', fwd: 350, lat: 0 },
                { name: 'FINISH', type: 'FINISH_TUNNEL', fwd: 400, lat: 0 },
            ];
            // ── Internal ────────────────────────────────────────────────────────────
            this._hitTestSession = null;
        }
        // ── Lifecycle ─────────────────────────────────────────────────────────
        onAwake() {
            if (this.cameraObject) {
                this._cameraTransform = this.cameraObject.getTransform();
            }
            // World Query only works on Spectacles device, not in Editor preview
            try {
                this._hitTestSession = WorldQueryModule.createHitTestSessionWithOptions({
                    filter: this.useWorldQueryFilter,
                });
                print('[CourseManager] Init — World Query active');
            }
            catch (e) {
                this._hitTestSession = null;
                print('[CourseManager] Init — World Query unavailable (Editor mode), will use fallback placement');
            }
            print('[CourseManager] ' + this._courseConfig.length + ' stations, scale=' + this.courseScale);
        }
        // ── Public Methods ────────────────────────────────────────────────────
        placeCourse() {
            if (this.isCoursePlaced) {
                print('[CourseManager] Already placed. resetCourse() first.');
                return;
            }
            if (!this._cameraTransform) {
                print('[CourseManager] ERROR: cameraObject not set!');
                return;
            }
            var camPos = this._cameraTransform.getWorldPosition();
            var camFwd = this._cameraTransform.forward;
            // If World Query unavailable (Editor), go straight to fallback
            if (!this._hitTestSession) {
                print('[CourseManager] No World Query — using fallback placement.');
                var groundY = camPos.y - 150;
                this.layoutStations(new vec3(camPos.x, groundY, camPos.z), camFwd);
                return;
            }
            var rayDir = new vec3(camFwd.x, -0.5, camFwd.z).normalize();
            this._hitTestSession.hitTest(camPos, rayDir, (hitResult) => {
                if (hitResult === null) {
                    print('[CourseManager] No surface — fallback.');
                    var fallbackY = camPos.y - 150;
                    this.layoutStations(new vec3(camPos.x, fallbackY, camPos.z), camFwd);
                }
                else {
                    print('[CourseManager] Surface hit at Y=' + hitResult.position.y.toFixed(0));
                    this.layoutStations(hitResult.position, camFwd);
                }
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
            this.isCoursePlaced = false;
            this.stationCount = 0;
            print('[CourseManager] Course reset');
        }
        // ── Layout ────────────────────────────────────────────────────────────
        layoutStations(origin, camForward) {
            var forwardDir = new vec3(camForward.x, 0, camForward.z).normalize();
            var lateralDir = new vec3(-forwardDir.z, 0, forwardDir.x);
            var currentPos = new vec3(origin.x, origin.y, origin.z);
            for (var i = 0; i < this._courseConfig.length; i++) {
                var cfg = this._courseConfig[i];
                var fwd = cfg.fwd * this.courseScale;
                var lat = cfg.lat * this.courseScale;
                currentPos = new vec3(currentPos.x + forwardDir.x * fwd + lateralDir.x * lat, currentPos.y, currentPos.z + forwardDir.z * fwd + lateralDir.z * lat);
                var prefab = this.getPrefab(cfg.type);
                if (!prefab) {
                    print('[CourseManager] No prefab for ' + cfg.type);
                    continue;
                }
                var obj = prefab.instantiate(this.sceneObject);
                obj.getTransform().setWorldPosition(currentPos);
                obj.getTransform().setWorldRotation(quat.lookAt(forwardDir, vec3.up()));
                var distLabel = '';
                if (i < this._courseConfig.length - 1) {
                    distLabel = (this._courseConfig[i + 1].fwd * this.courseScale / 100).toFixed(0) + 'm';
                }
                else {
                    distLabel = 'FINAL';
                }
                this.stationNames.push(cfg.name);
                this.stationPositions.push(new vec3(currentPos.x, currentPos.y, currentPos.z));
                this.stationDistanceLabels.push(distLabel);
                this.stationObjects.push(obj);
                this.stationCompleted.push(false);
                print('[CourseManager] ' + i + ': ' + cfg.name + ' placed');
            }
            this.stationCount = this.stationNames.length;
            this.isCoursePlaced = true;
            if (this.highlightMaterial && this.stationObjects.length > 0) {
                this.applyMaterial(this.stationObjects[0], this.highlightMaterial);
            }
            print('[CourseManager] Done — ' + this.stationCount + ' stations');
        }
        // ── Helpers ───────────────────────────────────────────────────────────
        getPrefab(type) {
            switch (type) {
                case 'START_LINE': return this.startLinePrefab;
                case 'GATE_RUN': return this.gatePrefab;
                case 'BURPEE_JUMP': return this.burpeePrefab;
                case 'LUNGE_CORRIDOR': return this.lungePrefab;
                case 'WALL_BALL': return this.wallBallPrefab;
                case 'FINISH_TUNNEL': return this.finishPrefab;
                default: return this.gatePrefab;
            }
        }
        applyMaterial(obj, mat) {
            var count = obj.getChildrenCount();
            for (var i = 0; i < count; i++) {
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
//# sourceMappingURL=CourseManager.js.map