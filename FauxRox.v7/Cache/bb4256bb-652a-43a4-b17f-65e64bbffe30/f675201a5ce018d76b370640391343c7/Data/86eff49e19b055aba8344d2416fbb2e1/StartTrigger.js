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
// StartTrigger.ts — HYROX MIRAGE Race Start / Reset Controller
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Course placement is handled by Example.ts (SurfacePlacement package).
// This script manages:
//   - Start Race button (visible after course placed)
//   - Reset button (visible after race finished)
//   - Pause toggle during race
//
// Attach to SceneObject "StartTrigger".
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
            this.courseManagerScript = this.courseManagerScript;
            this.raceStateMachineScript = this.raceStateMachineScript;
            /** "Start Race" button — SIK Interactable, shown after course placed */
            this.startRaceButton = this.startRaceButton;
            /** "Reset" button — SIK Interactable, shown after finish */
            this.resetButton = this.resetButton;
            /** Example.ts ScriptComponent — for reset/re-placement */
            this.exampleScript = this.exampleScript;
        }
        __initialize() {
            super.__initialize();
            this.courseManagerScript = this.courseManagerScript;
            this.raceStateMachineScript = this.raceStateMachineScript;
            /** "Start Race" button — SIK Interactable, shown after course placed */
            this.startRaceButton = this.startRaceButton;
            /** "Reset" button — SIK Interactable, shown after finish */
            this.resetButton = this.resetButton;
            /** Example.ts ScriptComponent — for reset/re-placement */
            this.exampleScript = this.exampleScript;
        }
        cm() { return this.courseManagerScript; }
        rsm() { return this.raceStateMachineScript; }
        ex() { return this.exampleScript; }
        onAwake() {
            if (this.startRaceButton)
                this.startRaceButton.enabled = false;
            if (this.resetButton)
                this.resetButton.enabled = false;
            this.createEvent('UpdateEvent').bind(this.updateButtons.bind(this));
            // Editor tap fallback
            this.createEvent('TouchStartEvent').bind(() => {
                this.onEditorTap();
            });
            print('[StartTrigger] Ready — waiting for course placement');
        }
        // ── Wire these to SIK Interactable onTriggerEnd ───────────────────────
        onStartRacePressed() {
            var race = this.rsm();
            var course = this.cm();
            if (!race || !course)
                return;
            if (!course.isCoursePlaced || race.state !== 'IDLE')
                return;
            print('[StartTrigger] Starting race!');
            race.startRace();
        }
        onResetPressed() {
            var race = this.rsm();
            if (!race)
                return;
            race.resetRace();
            // Re-trigger placement via Example.ts
            var example = this.ex();
            if (example) {
                example.resetPlacement();
            }
            print('[StartTrigger] Reset — restarting placement');
        }
        onPausePressed() {
            var race = this.rsm();
            if (!race)
                return;
            race.togglePause();
        }
        // ── Button Visibility ─────────────────────────────────────────────────
        updateButtons() {
            var course = this.cm();
            var race = this.rsm();
            if (!course || !race)
                return;
            var state = race.state;
            if (this.startRaceButton) {
                this.startRaceButton.enabled = course.isCoursePlaced && state === 'IDLE';
            }
            if (this.resetButton) {
                this.resetButton.enabled = state === 'FINISHED';
            }
        }
        // ── Editor Tap ────────────────────────────────────────────────────────
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
            if (course.isCoursePlaced && state === 'IDLE') {
                this.onStartRacePressed();
                return;
            }
            if (state === 'RUNNING' || state === 'STATION' || state === 'PAUSED') {
                this.onPausePressed();
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