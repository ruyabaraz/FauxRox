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
exports.ProximityDetector = void 0;
var __selfType = requireType("./ProximityDetector");
function component(target) { target.getTypeName = function () { return __selfType; }; }
// ============================================================================
// ProximityDetector.ts — FauxRox Station Proximity Detection
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Attach to "RaceController" SceneObject.
// ============================================================================
let ProximityDetector = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var ProximityDetector = _classThis = class extends _classSuper {
        constructor() {
            super();
            this.cameraObject = this.cameraObject;
            this.courseManagerScript = this.courseManagerScript;
            this.enterRadius = this.enterRadius;
            this.exitRadius = this.exitRadius;
            this.checkOnlyActiveStation = this.checkOnlyActiveStation;
            // Callbacks — set by RaceStateMachine at runtime
            this.onStationEnter = null;
            this.onStationExit = null;
            this._insideFlags = [];
            this._activeStationIndex = 0;
            this._stationCount = 0;
        }
        __initialize() {
            super.__initialize();
            this.cameraObject = this.cameraObject;
            this.courseManagerScript = this.courseManagerScript;
            this.enterRadius = this.enterRadius;
            this.exitRadius = this.exitRadius;
            this.checkOnlyActiveStation = this.checkOnlyActiveStation;
            // Callbacks — set by RaceStateMachine at runtime
            this.onStationEnter = null;
            this.onStationExit = null;
            this._insideFlags = [];
            this._activeStationIndex = 0;
            this._stationCount = 0;
        }
        onAwake() {
            if (!this.cameraObject) {
                print('[ProximityDetector] ERROR: cameraObject not assigned!');
                return;
            }
            this._cameraTransform = this.cameraObject.getTransform();
            this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));
            print('[ProximityDetector] Init — enter=' + this.enterRadius + ' exit=' + this.exitRadius);
        }
        getCM() {
            return this.courseManagerScript;
        }
        refreshStations() {
            var cm = this.getCM();
            if (!cm)
                return;
            this._stationCount = cm.stationCount || 0;
            this._insideFlags = [];
            for (var i = 0; i < this._stationCount; i++) {
                this._insideFlags.push(false);
            }
            this._activeStationIndex = 0;
            print('[ProximityDetector] Refreshed — ' + this._stationCount + ' stations');
        }
        setActiveStation(index) {
            this._activeStationIndex = index;
        }
        getDistanceToStation(index) {
            if (index < 0 || index >= this._stationCount)
                return Infinity;
            var userPos = this._cameraTransform.getWorldPosition();
            var cm = this.getCM();
            return this.horizontalDistance(userPos, cm.stationPositions[index]);
        }
        onUpdate() {
            if (!this._cameraTransform || this._stationCount === 0)
                return;
            var userPos = this._cameraTransform.getWorldPosition();
            if (this.checkOnlyActiveStation) {
                if (this._activeStationIndex < this._stationCount) {
                    this.checkStation(this._activeStationIndex, userPos);
                }
            }
            else {
                for (var i = 0; i < this._stationCount; i++) {
                    this.checkStation(i, userPos);
                }
            }
        }
        checkStation(index, userPos) {
            var cm = this.getCM();
            var stationPos = cm.stationPositions[index];
            if (!stationPos)
                return;
            var dist = this.horizontalDistance(userPos, stationPos);
            var wasInside = this._insideFlags[index] || false;
            if (!wasInside && dist <= this.enterRadius) {
                this._insideFlags[index] = true;
                var enterName = cm.stationNames[index];
                print('[ProximityDetector] ENTER ' + index + ' (' + enterName + ') d=' + dist.toFixed(0));
                if (this.onStationEnter) {
                    this.onStationEnter(index, enterName, dist);
                }
            }
            else if (wasInside && dist > this.exitRadius) {
                this._insideFlags[index] = false;
                var exitName = cm.stationNames[index];
                print('[ProximityDetector] EXIT ' + index + ' (' + exitName + ') d=' + dist.toFixed(0));
                if (this.onStationExit) {
                    this.onStationExit(index, exitName, dist);
                }
            }
        }
        horizontalDistance(a, b) {
            var dx = a.x - b.x;
            var dz = a.z - b.z;
            return Math.sqrt(dx * dx + dz * dz);
        }
    };
    __setFunctionName(_classThis, "ProximityDetector");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ProximityDetector = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ProximityDetector = _classThis;
})();
exports.ProximityDetector = ProximityDetector;
//# sourceMappingURL=ProximityDetector.js.map