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
exports.StartTrigger = void 0;
var __selfType = requireType("./StartTrigger");
function component(target) { target.getTypeName = function () { return __selfType; }; }
// ============================================================================
// StartTrigger.ts — HYROX MIRAGE Start/Place Trigger
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Attach to a SceneObject called "StartTrigger".
//
// HOW IT WORKS:
//   - Uses SIK HandInteractor pinch events on Spectacles
//   - Uses TouchStartEvent as fallback (tap in Editor preview)
//   - First trigger → places course
//   - Second trigger → starts race
//   - After finish → resets and places new course
// ============================================================================
const SIK_1 = require("SpectaclesInteractionKit.lspkg/SIK");
const Interactor_1 = require("SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor");
let StartTrigger = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var StartTrigger = _classThis = class extends _classSuper {
        constructor() {
            super();
            /** Drag CourseRoot here */
            this.courseManagerScript = this.courseManagerScript;
            /** Drag RaceController here */
            this.raceStateMachineScript = this.raceStateMachineScript;
            /** Drag RaceController here (for ProximityDetector) */
            this.proximityDetectorScript = this.proximityDetectorScript;
        }
        __initialize() {
            super.__initialize();
            /** Drag CourseRoot here */
            this.courseManagerScript = this.courseManagerScript;
            /** Drag RaceController here */
            this.raceStateMachineScript = this.raceStateMachineScript;
            /** Drag RaceController here (for ProximityDetector) */
            this.proximityDetectorScript = this.proximityDetectorScript;
        }
        cm() { return this.courseManagerScript; }
        rsm() { return this.raceStateMachineScript; }
        pd() { return this.proximityDetectorScript; }
        onAwake() {
            // ── SIK Pinch Detection ──
            // Get all hand interactors and listen for pinch end (trigger end)
            this.createEvent('OnStartEvent').bind(() => {
                try {
                    var interactors = SIK_1.SIK.InteractionManager.getInteractorsByType(Interactor_1.InteractorInputType.All);
                    for (var i = 0; i < interactors.length; i++) {
                        interactors[i].onTriggerEnd.add(() => {
                            this.onTrigger();
                        });
                    }
                    print('[StartTrigger] SIK pinch detection active');
                }
                catch (e) {
                    print('[StartTrigger] SIK not available: ' + e);
                }
            });
            // ── Editor Fallback: Tap/Touch ──
            this.createEvent('TouchStartEvent').bind(() => {
                this.onTrigger();
            });
            print('[StartTrigger] Ready — pinch or tap to place course');
        }
        onTrigger() {
            var course = this.cm();
            var race = this.rsm();
            if (!course || !race) {
                print('[StartTrigger] ERROR: courseManager or raceStateMachine not wired!');
                return;
            }
            var raceState = race.state;
            // After finish → reset everything for a new run
            if (raceState === 'FINISHED') {
                race.resetRace();
                course.resetCourse();
                print('[StartTrigger] Reset complete — pinch to place new course');
                return;
            }
            // If course not placed → place it
            if (!course.isCoursePlaced) {
                print('[StartTrigger] Placing course...');
                course.placeCourse();
                return;
            }
            // If idle (course placed but race not started) → start race
            if (raceState === 'IDLE') {
                print('[StartTrigger] Starting race...');
                race.startRace();
                return;
            }
            // If running or at station → toggle pause
            if (raceState === 'RUNNING' || raceState === 'STATION') {
                race.togglePause();
                return;
            }
            // If paused → resume
            if (raceState === 'PAUSED') {
                race.togglePause();
                return;
            }
        }
    };
    __setFunctionName(_classThis, "StartTrigger");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        StartTrigger = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return StartTrigger = _classThis;
})();
exports.StartTrigger = StartTrigger;
//# sourceMappingURL=StartTrigger.js.map