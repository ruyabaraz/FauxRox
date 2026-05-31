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
// CourseManager.ts — HYROX MIRAGE Course Placement
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Attach to SceneObject "CourseRoot".
// Prefabs instantiate to scene root (null parent) to avoid scale inheritance.
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
            this.startLinePrefab = this.startLinePrefab;
            this.gatePrefab = this.gatePrefab;
            this.burpeePrefab = this.burpeePrefab;
            this.lungePrefab = this.lungePrefab;
            this.wallBallPrefab = this.wallBallPrefab;
            this.finishPrefab = this.finishPrefab;
            this.highlightMaterial = this.highlightMaterial;
            this.completedMaterial = this.completedMaterial;
            this.courseScale = this.courseScale;
            /** Scale multiplier for all station prefabs.
             *  If prefabs appear half-size on Spectacles, set this to 2.0.
             *  Default Box mesh in LS has extent -0.5 to 0.5, so a Box with
             *  scale (5, 150, 5) = 5cm x 150cm x 5cm. If your prefabs look
             *  half-size, the mesh might use unit size differently. */
            this.prefabScaleMultiplier = this.prefabScaleMultiplier;
            // ── Public Data ───────────────────────────────────────────────────────
            this.stationNames = [];
            this.stationPositions = [];
            this.stationDistanceLabels = [];
            this.stationObjects = [];
            this.stationCompleted = [];
            this.isCoursePlaced = false;
            this.stationCount = 0;
            // ── Course Config (distances in cm) ───────────────────────────────────
            this._courseConfig = [
                { name: 'START', type: 'START_LINE', fwd: 0, lat: 0 },
                { name: 'Gate Run 1', type: 'GATE_RUN', fwd: 400, lat: 0 },
                { name: 'Burpee Jumps', type: 'BURPEE_JUMP', fwd: 350, lat: 50 },
                { name: 'Gate Run 2', type: 'GATE_RUN', fwd: 400, lat: 0 },
                { name: 'Lunge Corridor', type: 'LUNGE_CORRIDOR', fwd: 300, lat: -50 },
                { name: 'Wall Ball', type: 'WALL_BALL', fwd: 350, lat: 0 },
                { name: 'FINISH', type: 'FINISH_TUNNEL', fwd: 400, lat: 0 },
            ];
        }
        __initialize() {
            super.__initialize();
            this.startLinePrefab = this.startLinePrefab;
            this.gatePrefab = this.gatePrefab;
            this.burpeePrefab = this.burpeePrefab;
            this.lungePrefab = this.lungePrefab;
            this.wallBallPrefab = this.wallBallPrefab;
            this.finishPrefab = this.finishPrefab;
            this.highlightMaterial = this.highlightMaterial;
            this.completedMaterial = this.completedMaterial;
            this.courseScale = this.courseScale;
            /** Scale multiplier for all station prefabs.
             *  If prefabs appear half-size on Spectacles, set this to 2.0.
             *  Default Box mesh in LS has extent -0.5 to 0.5, so a Box with
             *  scale (5, 150, 5) = 5cm x 150cm x 5cm. If your prefabs look
             *  half-size, the mesh might use unit size differently. */
            this.prefabScaleMultiplier = this.prefabScaleMultiplier;
            // ── Public Data ───────────────────────────────────────────────────────
            this.stationNames = [];
            this.stationPositions = [];
            this.stationDistanceLabels = [];
            this.stationObjects = [];
            this.stationCompleted = [];
            this.isCoursePlaced = false;
            this.stationCount = 0;
            // ── Course Config (distances in cm) ───────────────────────────────────
            this._courseConfig = [
                { name: 'START', type: 'START_LINE', fwd: 0, lat: 0 },
                { name: 'Gate Run 1', type: 'GATE_RUN', fwd: 400, lat: 0 },
                { name: 'Burpee Jumps', type: 'BURPEE_JUMP', fwd: 350, lat: 50 },
                { name: 'Gate Run 2', type: 'GATE_RUN', fwd: 400, lat: 0 },
                { name: 'Lunge Corridor', type: 'LUNGE_CORRIDOR', fwd: 300, lat: -50 },
                { name: 'Wall Ball', type: 'WALL_BALL', fwd: 350, lat: 0 },
                { name: 'FINISH', type: 'FINISH_TUNNEL', fwd: 400, lat: 0 },
            ];
        }
        onAwake() {
            // Debug: verify CourseRoot scale
            var s = this.sceneObject.getTransform().getWorldScale();
            print('[CourseManager] Init — CourseRoot worldScale=('
                + s.x.toFixed(2) + ',' + s.y.toFixed(2) + ',' + s.z.toFixed(2) + ')');
            print('[CourseManager] ' + this._courseConfig.length + ' stations, courseScale=' + this.courseScale);
        }
        // ── Public API ────────────────────────────────────────────────────────
        placeCourseAt(pos, rot) {
            if (this.isCoursePlaced) {
                print('[CourseManager] Already placed. resetCourse() first.');
                return;
            }
            print('[CourseManager] placeCourseAt pos=('
                + pos.x.toFixed(1) + ',' + pos.y.toFixed(1) + ',' + pos.z.toFixed(1) + ')');
            // Forward direction from placement rotation
            // Horizontal.ts: quat.lookAt(worldCameraForward, vec3.up())
            // In Lens Studio, vec3.forward() = (0,0,-1) which is OPPOSITE to lookAt direction.
            // So we use vec3.back() = (0,0,1) to get the actual facing direction.
            var rawForward = rot.multiplyVec3(vec3.back());
            var forwardDir = new vec3(rawForward.x, 0, rawForward.z);
            // Safety: if length ~0, fallback
            if (forwardDir.length < 0.01) {
                forwardDir = new vec3(0, 0, 1);
                print('[CourseManager] WARNING: forward near zero, using default');
            }
            forwardDir = forwardDir.normalize();
            var lateralDir = new vec3(-forwardDir.z, 0, forwardDir.x);
            print('[CourseManager] forwardDir=(' + forwardDir.x.toFixed(2) + ','
                + forwardDir.y.toFixed(2) + ',' + forwardDir.z.toFixed(2) + ')');
            this.layoutStations(pos, forwardDir, lateralDir);
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
        layoutStations(origin, forwardDir, lateralDir) {
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
                // Instantiate to scene root (null) to avoid parent scale inheritance
                var obj = prefab.instantiate(null);
                obj.getTransform().setWorldPosition(currentPos);
                obj.getTransform().setWorldRotation(quat.lookAt(forwardDir, vec3.up()));
                // Apply scale multiplier if prefabs are too small
                if (this.prefabScaleMultiplier !== 1.0) {
                    var curScale = obj.getTransform().getLocalScale();
                    obj.getTransform().setLocalScale(curScale.uniformScale(this.prefabScaleMultiplier));
                }
                // Debug: log every station's world scale and position
                var ws = obj.getTransform().getWorldScale();
                print('[CourseManager] Station ' + i + ' (' + cfg.name + ')'
                    + ' worldScale=(' + ws.x.toFixed(2) + ',' + ws.y.toFixed(2) + ',' + ws.z.toFixed(2) + ')'
                    + ' pos=(' + currentPos.x.toFixed(0) + ',' + currentPos.y.toFixed(0) + ',' + currentPos.z.toFixed(0) + ')');
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
                print('[CourseManager] ' + i + ': ' + cfg.name
                    + ' at Y=' + currentPos.y.toFixed(1));
            }
            this.stationCount = this.stationNames.length;
            this.isCoursePlaced = true;
            if (this.highlightMaterial && this.stationObjects.length > 0) {
                this.applyMaterial(this.stationObjects[0], this.highlightMaterial);
            }
            print('[CourseManager] Course placed — ' + this.stationCount + ' stations');
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
                if (rmv)
                    rmv.mainMaterial = mat;
            }
            var rootRmv = obj.getComponent('Component.RenderMeshVisual');
            if (rootRmv)
                rootRmv.mainMaterial = mat;
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