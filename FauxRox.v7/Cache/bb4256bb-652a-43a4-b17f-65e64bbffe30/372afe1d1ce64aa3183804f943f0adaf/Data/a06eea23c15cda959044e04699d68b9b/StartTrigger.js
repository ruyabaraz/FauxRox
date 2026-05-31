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
// StartTrigger.ts — HYROX MIRAGE UI Controller
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Manages the two-phase UX:
//   Phase 1: "Place Course" button visible → starts surface placement
//   Phase 2: "Start Race" button visible → starts countdown
//
// Attach to SceneObject "UIController".
// ============================================================================
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
            /** The "Place Course" button SceneObject (SIK Interactable) */
            this.placeCourseButton = this.placeCourseButton;
            /** The "Start Race" button SceneObject (SIK Interactable) */
            this.startRaceButton = this.startRaceButton;
            /** Optional: "Reset" button (shown after finish) */
            this.resetButton = this.resetButton;
        }
        __initialize() {
            super.__initialize();
            /** Drag CourseRoot SceneObject here */
            this.courseManagerScript = this.courseManagerScript;
            /** Drag RaceController SceneObject here */
            this.raceStateMachineScript = this.raceStateMachineScript;
            /** The "Place Course" button SceneObject (SIK Interactable) */
            this.placeCourseButton = this.placeCourseButton;
            /** The "Start Race" button SceneObject (SIK Interactable) */
            this.startRaceButton = this.startRaceButton;
            /** Optional: "Reset" button (shown after finish) */
            this.resetButton = this.resetButton;
        }
        cm() { return this.courseManagerScript; }
        rsm() { return this.raceStateMachineScript; }
        onAwake() {
            // Initial state: show Place button, hide Start and Reset
            if (this.placeCourseButton)
                this.placeCourseButton.enabled = true;
            if (this.startRaceButton)
                this.startRaceButton.enabled = false;
            if (this.resetButton)
                this.resetButton.enabled = false;
            // Poll state to update button visibility
            this.createEvent('UpdateEvent').bind(this.updateButtonVisibility.bind(this));
            // Editor fallback: tap cycles through actions
            this.createEvent('TouchStartEvent').bind(() => {
                this.onEditorTap();
            });
            print('[StartTrigger] Ready — Place Course button active');
        }
        // ── Public methods (wire to SIK Interactable onTriggerEnd) ────────────
        /**
         * Called when user pinches the "Place Course" button.
         * Wire this to the Interactable's onTriggerEnd event in Inspector,
         * or call from Behavior script.
         */
        onPlaceCoursePressed() {
            var course = this.cm();
            if (!course)
                return;
            if (course.isCoursePlaced || course.isPlacementActive)
                return;
            print('[StartTrigger] Place Course pressed — starting surface calibration');
            course.startPlacement();
        }
        /**
         * Called when user pinches the "Start Race" button.
         */
        onStartRacePressed() {
            var race = this.rsm();
            var course = this.cm();
            if (!race || !course)
                return;
            if (!course.isCoursePlaced)
                return;
            if (race.state !== 'IDLE')
                return;
            print('[StartTrigger] Start Race pressed');
            race.startRace();
        }
        /**
         * Called when user pinches the "Reset" button (after finish).
         */
        onResetPressed() {
            var race = this.rsm();
            var course = this.cm();
            if (!race || !course)
                return;
            race.resetRace();
            course.resetCourse();
            print('[StartTrigger] Reset — ready for new placement');
        }
        // ── Button Visibility Logic ───────────────────────────────────────────
        updateButtonVisibility() {
            var course = this.cm();
            var race = this.rsm();
            if (!course || !race)
                return;
            var state = race.state;
            // Place Course button: visible only when not placed and not placing
            if (this.placeCourseButton) {
                this.placeCourseButton.enabled = !course.isCoursePlaced && !course.isPlacementActive;
            }
            // Start Race button: visible only when course placed and race idle
            if (this.startRaceButton) {
                this.startRaceButton.enabled = course.isCoursePlaced && state === 'IDLE';
            }
            // Reset button: visible only after finish
            if (this.resetButton) {
                this.resetButton.enabled = state === 'FINISHED';
            }
        }
        // ── Editor Tap Fallback ───────────────────────────────────────────────
        onEditorTap() {
            var course = this.cm();
            var race = this.rsm();
            if (!course || !race)
                return;
            var state = race.state;
            if (state === 'FINISHED') {
                this.onResetPressed();
                return;
            }
            if (!course.isCoursePlaced && !course.isPlacementActive) {
                this.onPlaceCoursePressed();
                return;
            }
            if (course.isCoursePlaced && state === 'IDLE') {
                this.onStartRacePressed();
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