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
function component(target) {
    target.getTypeName = function () { return __selfType; };
    if (target.prototype.hasOwnProperty("getTypeName"))
        return;
    Object.defineProperty(target.prototype, "getTypeName", {
        value: function () { return __selfType; },
        configurable: true,
        writable: true
    });
}
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
            /** Start button CapsuleButton component from SpectaclesUIKit */
            this.startButton = this.startButton;
            /** Pause/Resume toggle button */
            this.pauseButton = this.pauseButton;
            /** Pause button parent SceneObject - to show/hide */
            this.pauseButtonObject = this.pauseButtonObject;
            /** MicButton parent - enabled when race starts */
            this.micButton = this.micButton;
            /** SpeakerButton parent - enabled when race starts (same as micButton) */
            this.speakerButton = this.speakerButton;
        }
        __initialize() {
            super.__initialize();
            this.courseManagerScript = this.courseManagerScript;
            this.raceStateMachineScript = this.raceStateMachineScript;
            /** CourseSetup ScriptComponent — for reset/re-placement */
            this.courseSetupScript = this.courseSetupScript;
            /** Optional status text to show current state hint */
            this.hintText = this.hintText;
            /** Start button CapsuleButton component from SpectaclesUIKit */
            this.startButton = this.startButton;
            /** Pause/Resume toggle button */
            this.pauseButton = this.pauseButton;
            /** Pause button parent SceneObject - to show/hide */
            this.pauseButtonObject = this.pauseButtonObject;
            /** MicButton parent - enabled when race starts */
            this.micButton = this.micButton;
            /** SpeakerButton parent - enabled when race starts (same as micButton) */
            this.speakerButton = this.speakerButton;
        }
        cm() { return this.courseManagerScript; }
        rsm() { return this.raceStateMachineScript; }
        setup() { return this.courseSetupScript; }
        onAwake() {
            // Bind button interaction after UIKit initializes
            this.createEvent('OnStartEvent').bind(() => {
                this.bindButtonInteraction();
            });
            this.createEvent('UpdateEvent').bind(() => {
                this.updateHint();
            });
            print('[StartTrigger] Ready');
        }
        // ── Button Binding ──────────────────────────────────────────────────────
        bindButtonInteraction() {
            // Bind start button
            if (this.startButton) {
                try {
                    this.startButton.onTriggerUp.add(() => {
                        this.onStartButtonPressed();
                    });
                    print('[StartTrigger] Start button bound');
                }
                catch (e) {
                    print('[StartTrigger] Could not bind start button: ' + e);
                }
            }
            else {
                print('[StartTrigger] WARNING: No startButton assigned');
            }
            // Bind pause button
            if (this.pauseButton) {
                try {
                    this.pauseButton.onTriggerUp.add(() => {
                        this.onPauseButtonPressed();
                    });
                    print('[StartTrigger] Pause button bound');
                }
                catch (e) {
                    print('[StartTrigger] Could not bind pause button: ' + e);
                }
            }
            // Hide pause button initially
            if (this.pauseButtonObject) {
                this.pauseButtonObject.enabled = false;
            }
            // Hide mic button initially
            if (this.micButton) {
                this.micButton.enabled = false;
                print('[StartTrigger] MicButton hidden initially');
            }
        }
        // ── Start Button ────────────────────────────────────────────────────────
        onStartButtonPressed() {
            var course = this.cm();
            var race = this.rsm();
            if (!course || !race)
                return;
            var state = race.state;
            // Don't handle if placement is still in progress
            if (!course.isCoursePlaced) {
                return;
            }
            if (state === 'IDLE') {
                print('[StartTrigger] → startRace');
                race.startRace();
                // Show mic button when race starts
                if (this.micButton) {
                    this.micButton.enabled = true;
                    print('[StartTrigger] MicButton enabled');
                }
                return;
            }
            if (state === 'FINISHED') {
                print('[StartTrigger] → reset');
                race.resetRace();
                // Hide mic button on reset
                if (this.micButton) {
                    this.micButton.enabled = false;
                    print('[StartTrigger] MicButton hidden on reset');
                }
                return;
            }
        }
        // ── Pause Button ────────────────────────────────────────────────────────
        onPauseButtonPressed() {
            var race = this.rsm();
            if (!race)
                return;
            var state = race.state;
            if (state === 'RUNNING' || state === 'STATION' || state === 'PAUSED') {
                print('[StartTrigger] → togglePause');
                race.togglePause();
            }
        }
        // ── UI Updates ──────────────────────────────────────────────────────────
        updateHint() {
            var course = this.cm();
            var race = this.rsm();
            if (!course || !race)
                return;
            var state = race.state;
            // Update hint text
            if (this.hintText) {
                var setup = this.setup();
                var startButtonReady = setup && setup.startButtonObject && setup.startButtonObject.enabled;
                if (!course.isCoursePlaced) {
                    this.hintText.text = 'Look at floor to calibrate';
                }
                else if (!startButtonReady) {
                    // Start button not ready yet - don't overwrite wrist menu hint
                    // (intentionally empty - CourseSetup is showing wrist menu message)
                }
                else {
                    switch (state) {
                        case 'IDLE':
                            this.hintText.text = 'Pinch Button to Start';
                            break;
                        case 'COUNTDOWN':
                        case 'RUNNING':
                        case 'STATION':
                        case 'PAUSED':
                            this.hintText.text = '';
                            break;
                        case 'FINISHED':
                            this.hintText.text = 'Pinch to Reset';
                            break;
                    }
                }
            }
            // Show/hide pause button based on state
            if (this.pauseButtonObject) {
                var showPause = (state === 'RUNNING' || state === 'STATION' || state === 'PAUSED');
                this.pauseButtonObject.enabled = showPause;
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