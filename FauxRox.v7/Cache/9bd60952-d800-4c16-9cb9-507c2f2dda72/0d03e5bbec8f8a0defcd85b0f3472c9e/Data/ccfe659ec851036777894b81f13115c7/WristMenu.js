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
exports.WristMenu = void 0;
var __selfType = requireType("./WristMenu");
function component(target) { target.getTypeName = function () { return __selfType; }; }
let WristMenu = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var WristMenu = _classThis = class extends _classSuper {
        constructor() {
            super();
            // ── References ──────────────────────────────────────────────────────────────
            this.raceStateMachineScript = this.raceStateMachineScript;
            /** Pause button - visible when race is RUNNING or STATION */
            this.pauseButton = this.pauseButton;
            this.pauseButtonObject = this.pauseButtonObject;
            /** Resume button - visible when race is PAUSED */
            this.resumeButton = this.resumeButton;
            this.resumeButtonObject = this.resumeButtonObject;
            /** Stop button - visible when race is active (RUNNING, STATION, or PAUSED) */
            this.stopButton = this.stopButton;
            this.stopButtonObject = this.stopButtonObject;
            /** Entire menu container - hidden when race is IDLE or FINISHED */
            this.menuContainer = this.menuContainer;
            this.debugPrint = this.debugPrint;
        }
        __initialize() {
            super.__initialize();
            // ── References ──────────────────────────────────────────────────────────────
            this.raceStateMachineScript = this.raceStateMachineScript;
            /** Pause button - visible when race is RUNNING or STATION */
            this.pauseButton = this.pauseButton;
            this.pauseButtonObject = this.pauseButtonObject;
            /** Resume button - visible when race is PAUSED */
            this.resumeButton = this.resumeButton;
            this.resumeButtonObject = this.resumeButtonObject;
            /** Stop button - visible when race is active (RUNNING, STATION, or PAUSED) */
            this.stopButton = this.stopButton;
            this.stopButtonObject = this.stopButtonObject;
            /** Entire menu container - hidden when race is IDLE or FINISHED */
            this.menuContainer = this.menuContainer;
            this.debugPrint = this.debugPrint;
        }
        // ── Internal ────────────────────────────────────────────────────────────────
        rsm() { return this.raceStateMachineScript; }
        onAwake() {
            this.log('WristMenu initialized');
            // Hide menu initially
            if (this.menuContainer) {
                this.menuContainer.enabled = false;
            }
            // Bind buttons after UIKit initializes
            this.createEvent('OnStartEvent').bind(() => {
                this.bindButtons();
            });
            // Update visibility based on race state
            this.createEvent('UpdateEvent').bind(() => {
                this.updateVisibility();
            });
        }
        bindButtons() {
            // Pause button
            if (this.pauseButton) {
                try {
                    this.pauseButton.onTriggerUp.add(() => {
                        this.onPausePressed();
                    });
                    this.log('Pause button bound');
                }
                catch (e) {
                    this.log('Could not bind pause button: ' + e);
                }
            }
            // Resume button
            if (this.resumeButton) {
                try {
                    this.resumeButton.onTriggerUp.add(() => {
                        this.onResumePressed();
                    });
                    this.log('Resume button bound');
                }
                catch (e) {
                    this.log('Could not bind resume button: ' + e);
                }
            }
            // Stop button
            if (this.stopButton) {
                try {
                    this.stopButton.onTriggerUp.add(() => {
                        this.onStopPressed();
                    });
                    this.log('Stop button bound');
                }
                catch (e) {
                    this.log('Could not bind stop button: ' + e);
                }
            }
        }
        // ── Button Handlers ─────────────────────────────────────────────────────────
        onPausePressed() {
            var race = this.rsm();
            if (!race)
                return;
            this.log('Pause pressed');
            race.togglePause();
        }
        onResumePressed() {
            var race = this.rsm();
            if (!race)
                return;
            this.log('Resume pressed');
            race.togglePause();
        }
        onStopPressed() {
            var race = this.rsm();
            if (!race)
                return;
            this.log('Stop pressed');
            race.stopRace();
        }
        // ── Visibility ──────────────────────────────────────────────────────────────
        updateVisibility() {
            var race = this.rsm();
            if (!race)
                return;
            var state = race.state;
            // Menu visible only during active race
            var menuVisible = (state === 'RUNNING' || state === 'STATION' || state === 'PAUSED');
            if (this.menuContainer) {
                this.menuContainer.enabled = menuVisible;
            }
            if (!menuVisible)
                return;
            // Pause button: visible when running or at station
            var showPause = (state === 'RUNNING' || state === 'STATION');
            if (this.pauseButtonObject) {
                this.pauseButtonObject.enabled = showPause;
            }
            // Resume button: visible when paused
            var showResume = (state === 'PAUSED');
            if (this.resumeButtonObject) {
                this.resumeButtonObject.enabled = showResume;
            }
            // Stop button: always visible during active race
            if (this.stopButtonObject) {
                this.stopButtonObject.enabled = true;
            }
        }
        // ── Debug ───────────────────────────────────────────────────────────────────
        log(msg) {
            if (this.debugPrint) {
                print('[WristMenu] ' + msg);
            }
        }
    };
    __setFunctionName(_classThis, "WristMenu");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        WristMenu = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return WristMenu = _classThis;
})();
exports.WristMenu = WristMenu;
//# sourceMappingURL=WristMenu.js.map