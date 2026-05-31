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
// StartTrigger.ts — HYROX MIRAGE Race Start Button
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// This is the "Start Race" button — a SIK Interactable.
// It only appears AFTER the course is placed.
// Course placement is handled by CourseManager (hand ray + pinch).
//
// SETUP: Use a SIK PinchButton or Interactable prefab.
// This script listens for pinch on its own SceneObject.
//
// Attach to a SceneObject called "StartButton" with a
// SIK Interactable component or just use TouchStartEvent for Editor.
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
            /** Drag CourseRoot SceneObject here */
            this.courseManagerScript = this.courseManagerScript;
            /** Drag RaceController SceneObject here */
            this.raceStateMachineScript = this.raceStateMachineScript;
            /** The visual button object — hidden until course is placed */
            this.buttonVisual = this.buttonVisual;
        }
        __initialize() {
            super.__initialize();
            /** Drag CourseRoot SceneObject here */
            this.courseManagerScript = this.courseManagerScript;
            /** Drag RaceController SceneObject here */
            this.raceStateMachineScript = this.raceStateMachineScript;
            /** The visual button object — hidden until course is placed */
            this.buttonVisual = this.buttonVisual;
        }
        cm() { return this.courseManagerScript; }
        rsm() { return this.raceStateMachineScript; }
        onAwake() {
            // Hide button initially — course not placed yet
            if (this.buttonVisual)
                this.buttonVisual.enabled = false;
            // Check every frame if course is placed → show button
            this.createEvent('UpdateEvent').bind(() => {
                var course = this.cm();
                var race = this.rsm();
                if (!course || !race)
                    return;
                if (this.buttonVisual) {
                    // Show button when course placed and race not yet started
                    this.buttonVisual.enabled = course.isCoursePlaced && race.state === 'IDLE';
                }
            });
            // ── Trigger: tap in Editor, pinch on Spectacles ──
            // For Spectacles, wire this to a SIK PinchButton's onButtonPinched.
            // For Editor testing, use tap:
            this.createEvent('TouchStartEvent').bind(() => {
                this.onStartPressed();
            });
            // SIK interactor pinch on this object
            this.createEvent('OnStartEvent').bind(() => {
                try {
                    var interactors = SIK_1.SIK.InteractionManager.getInteractorsByType(Interactor_1.InteractorInputType.All);
                    for (var i = 0; i < interactors.length; i++) {
                        interactors[i].onTriggerEnd.add(() => {
                            this.onStartPressed();
                        });
                    }
                }
                catch (e) {
                    print('[StartTrigger] SIK fallback: ' + e);
                }
            });
            print('[StartTrigger] Ready — waiting for course placement');
        }
        onStartPressed() {
            var course = this.cm();
            var race = this.rsm();
            if (!course || !race)
                return;
            var state = race.state;
            if (state === 'FINISHED') {
                // Reset for new run
                race.resetRace();
                course.resetCourse();
                print('[StartTrigger] Reset — point and pinch to place new course');
                return;
            }
            if (!course.isCoursePlaced) {
                print('[StartTrigger] Course not placed yet — point at ground and pinch');
                return;
            }
            if (state === 'IDLE') {
                print('[StartTrigger] Starting race!');
                race.startRace();
                return;
            }
            if (state === 'RUNNING' || state === 'STATION' || state === 'PAUSED') {
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