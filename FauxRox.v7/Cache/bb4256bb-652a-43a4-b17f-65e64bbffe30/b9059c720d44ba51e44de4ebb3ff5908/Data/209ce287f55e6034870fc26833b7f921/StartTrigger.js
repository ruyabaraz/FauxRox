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
// StartTrigger.ts — HYROX MIRAGE Race Start / Pause / Reset
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Course placement is handled by CourseSetup.ts + GroundCalibration.ts
//
// This script detects pinch directly from HandInputData —
// no SIK Interactable/Collider needed on buttons.
// Works on both Spectacles (hand pinch) and Editor (tap).
//
// Attach to SceneObject "StartTrigger".
// ============================================================================
const SIK_1 = require("SpectaclesInteractionKit.lspkg/SIK");
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
            /** CourseSetup ScriptComponent — for reset/re-placement */
            this.courseSetupScript = this.courseSetupScript;
            /** Optional status text to show current state hint */
            this.hintText = this.hintText;
            this._pinchBound = false;
        }
        __initialize() {
            super.__initialize();
            this.courseManagerScript = this.courseManagerScript;
            this.raceStateMachineScript = this.raceStateMachineScript;
            /** CourseSetup ScriptComponent — for reset/re-placement */
            this.courseSetupScript = this.courseSetupScript;
            /** Optional status text to show current state hint */
            this.hintText = this.hintText;
            this._pinchBound = false;
        }
        cm() { return this.courseManagerScript; }
        rsm() { return this.raceStateMachineScript; }
        setup() { return this.courseSetupScript; }
        onAwake() {
            // Bind hand pinch after SIK initializes
            this.createEvent('OnStartEvent').bind(() => {
                this.bindPinch();
            });
            // Editor tap fallback
            this.createEvent('TouchStartEvent').bind(() => {
                this.handleAction();
            });
            this.createEvent('UpdateEvent').bind(this.updateHint.bind(this));
            print('[StartTrigger] Ready');
        }
        // ── Direct Hand Pinch Detection ───────────────────────────────────────
        bindPinch() {
            try {
                var handInputData = SIK_1.SIK.HandInputData;
                var rightHand = handInputData.getHand('right');
                rightHand.onPinchDown.add(() => {
                    this.handleAction();
                });
                var leftHand = handInputData.getHand('left');
                leftHand.onPinchDown.add(() => {
                    this.handleAction();
                });
                this._pinchBound = true;
                print('[StartTrigger] Hand pinch detection bound (left + right)');
            }
            catch (e) {
                print('[StartTrigger] Could not bind hand pinch: ' + e);
            }
        }
        // ── State-Based Action ────────────────────────────────────────────────
        handleAction() {
            var course = this.cm();
            var race = this.rsm();
            if (!course || !race)
                return;
            var state = race.state;
            // Don't handle pinch if placement is still in progress
            // (SurfacePlacement handles its own pinch)
            if (!course.isCoursePlaced) {
                return;
            }
            if (state === 'IDLE') {
                print('[StartTrigger] → startRace');
                race.startRace();
                return;
            }
            if (state === 'RUNNING' || state === 'STATION') {
                // DISABLED: Pinch during gameplay was causing accidental pauses
                // TODO: Implement double-pinch or hold-pinch for pause
                // print('[StartTrigger] → pause');
                // race.togglePause();
                return;
            }
            if (state === 'PAUSED') {
                print('[StartTrigger] → resume');
                race.togglePause();
                return;
            }
            if (state === 'FINISHED') {
                print('[StartTrigger] → reset');
                race.resetRace();
                // RaceStateMachine.resetRace() already respawns START line
                return;
            }
        }
        // ── Hint Text ─────────────────────────────────────────────────────────
        updateHint() {
            if (!this.hintText)
                return;
            var course = this.cm();
            var race = this.rsm();
            if (!course || !race)
                return;
            if (!course.isCoursePlaced) {
                this.hintText.text = 'Look at floor to calibrate';
                return;
            }
            var state = race.state;
            switch (state) {
                case 'IDLE':
                    this.hintText.text = 'Pinch to Start Race';
                    break;
                case 'COUNTDOWN':
                    this.hintText.text = '';
                    break;
                case 'RUNNING':
                case 'STATION':
                    this.hintText.text = ''; // Timer UI is enough
                    break;
                case 'PAUSED':
                    this.hintText.text = 'Pinch to Resume';
                    break;
                case 'FINISHED':
                    this.hintText.text = 'Pinch to Reset';
                    break;
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