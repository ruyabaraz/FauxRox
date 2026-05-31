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
exports.RaceStateMachine = void 0;
var __selfType = requireType("./RaceStateMachine");
function component(target) { target.getTypeName = function () { return __selfType; }; }
// ============================================================================
// RaceStateMachine.ts — HYROX MIRAGE Core Game Loop
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
var RaceState;
(function (RaceState) {
    RaceState["IDLE"] = "IDLE";
    RaceState["COUNTDOWN"] = "COUNTDOWN";
    RaceState["RUNNING"] = "RUNNING";
    RaceState["STATION"] = "STATION";
    RaceState["PAUSED"] = "PAUSED";
    RaceState["FINISHED"] = "FINISHED";
})(RaceState || (RaceState = {}));
let RaceStateMachine = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var RaceStateMachine = _classThis = class extends _classSuper {
        constructor() {
            super();
            /** Drag CourseRoot SceneObject here */
            this.courseManagerScript = this.courseManagerScript;
            /** Drag RaceController SceneObject here (self — picks up ProximityDetector) */
            this.proximityDetectorScript = this.proximityDetectorScript;
            this.statusText = this.statusText;
            this.timerText = this.timerText;
            this.stationInfoText = this.stationInfoText;
            this.finishTunnelVfx = this.finishTunnelVfx;
            this.countdownSeconds = this.countdownSeconds;
            this.stationHoldTime = this.stationHoldTime;
            // Internal state
            this._state = RaceState.IDLE;
            this._raceStartTime = 0;
            this._stationArrivalTime = 0;
            this._currentStationIndex = -1;
            this._countdownRemaining = 0;
            this._stationHoldElapsed = 0;
            this._isInsideStation = false;
            this._pausedFromState = RaceState.RUNNING;
            this._splitNames = [];
            this._splitDurations = [];
        }
        __initialize() {
            super.__initialize();
            /** Drag CourseRoot SceneObject here */
            this.courseManagerScript = this.courseManagerScript;
            /** Drag RaceController SceneObject here (self — picks up ProximityDetector) */
            this.proximityDetectorScript = this.proximityDetectorScript;
            this.statusText = this.statusText;
            this.timerText = this.timerText;
            this.stationInfoText = this.stationInfoText;
            this.finishTunnelVfx = this.finishTunnelVfx;
            this.countdownSeconds = this.countdownSeconds;
            this.stationHoldTime = this.stationHoldTime;
            // Internal state
            this._state = RaceState.IDLE;
            this._raceStartTime = 0;
            this._stationArrivalTime = 0;
            this._currentStationIndex = -1;
            this._countdownRemaining = 0;
            this._stationHoldElapsed = 0;
            this._isInsideStation = false;
            this._pausedFromState = RaceState.RUNNING;
            this._splitNames = [];
            this._splitDurations = [];
        }
        // Runtime accessors
        cm() { return this.courseManagerScript; }
        pd() { return this.proximityDetectorScript; }
        get state() { return this._state; }
        get currentStationIndex() { return this._currentStationIndex; }
        get elapsedMs() {
            if (this._raceStartTime === 0)
                return 0;
            return (getTime() * 1000) - this._raceStartTime;
        }
        onAwake() {
            this.createEvent('UpdateEvent').bind(this.onUpdate.bind(this));
            var detector = this.pd();
            if (detector) {
                detector.onStationEnter = (index, name, dist) => {
                    this.handleStationEnter(index, name);
                };
                detector.onStationExit = (index, name, dist) => {
                    this.handleStationExit(index, name);
                };
            }
            this.setUIIdle();
            print('[RaceStateMachine] Init — IDLE');
        }
        // ── Public API ────────────────────────────────────────────────────────
        startRace() {
            if (this._state !== RaceState.IDLE && this._state !== RaceState.FINISHED) {
                print('[RaceStateMachine] Cannot start from ' + this._state);
                return;
            }
            var course = this.cm();
            if (!course || course.stationCount === 0) {
                print('[RaceStateMachine] ERROR: No stations!');
                return;
            }
            this._splitNames = [];
            this._splitDurations = [];
            this._currentStationIndex = 0;
            this._stationHoldElapsed = 0;
            this._isInsideStation = false;
            this._countdownRemaining = this.countdownSeconds;
            var detector = this.pd();
            if (detector) {
                detector.refreshStations();
                detector.setActiveStation(0);
            }
            this._state = RaceState.COUNTDOWN;
            print('[RaceStateMachine] Countdown');
        }
        togglePause() {
            if (this._state === RaceState.RUNNING || this._state === RaceState.STATION) {
                this._pausedFromState = this._state;
                this._state = RaceState.PAUSED;
                if (this.statusText)
                    this.statusText.text = 'PAUSED\nPinch to Resume';
            }
            else if (this._state === RaceState.PAUSED) {
                this._state = this._pausedFromState;
            }
        }
        resetRace() {
            this._state = RaceState.IDLE;
            this._raceStartTime = 0;
            this._currentStationIndex = -1;
            this._splitNames = [];
            this._splitDurations = [];
            this._stationHoldElapsed = 0;
            this._isInsideStation = false;
            if (this.finishTunnelVfx)
                this.finishTunnelVfx.enabled = false;
            this.setUIIdle();
            print('[RaceStateMachine] Reset');
        }
        // ── Per-Frame ─────────────────────────────────────────────────────────
        onUpdate() {
            var dt = getDeltaTime();
            if (this._state === RaceState.COUNTDOWN) {
                this._countdownRemaining -= dt;
                if (this.statusText) {
                    var num = Math.ceil(this._countdownRemaining);
                    this.statusText.text = num > 0 ? num.toString() : 'GO!';
                }
                if (this._countdownRemaining <= 0) {
                    this._raceStartTime = getTime() * 1000;
                    this._state = RaceState.RUNNING;
                    this.updateRunningUI();
                    print('[RaceStateMachine] GO!');
                }
                return;
            }
            if (this._state === RaceState.RUNNING) {
                this.updateTimerUI();
                return;
            }
            if (this._state === RaceState.STATION) {
                this.updateTimerUI();
                if (this._isInsideStation) {
                    this._stationHoldElapsed += dt;
                    this.updateProgressUI();
                    if (this._stationHoldElapsed >= this.stationHoldTime) {
                        this.completeCurrentStation();
                    }
                }
                return;
            }
        }
        // ── Proximity Callbacks ───────────────────────────────────────────────
        handleStationEnter(index, name) {
            if (this._state !== RaceState.RUNNING)
                return;
            if (index !== this._currentStationIndex)
                return;
            this._isInsideStation = true;
            this._stationHoldElapsed = 0;
            this._stationArrivalTime = getTime() * 1000;
            var course = this.cm();
            if (course && index === course.stationCount - 1 && this.finishTunnelVfx) {
                this.finishTunnelVfx.enabled = true;
            }
            this._state = RaceState.STATION;
            if (this.statusText && course) {
                this.statusText.text = course.stationNames[index] || 'STATION';
            }
            print('[RaceStateMachine] Entered ' + index + ': ' + name);
        }
        handleStationExit(index, name) {
            if (this._state !== RaceState.STATION)
                return;
            if (index !== this._currentStationIndex)
                return;
            this._isInsideStation = false;
            this._stationHoldElapsed = 0;
            this._state = RaceState.RUNNING;
            this.updateRunningUI();
            print('[RaceStateMachine] Exited ' + index + ' early');
        }
        completeCurrentStation() {
            var now = getTime() * 1000;
            var course = this.cm();
            var name = course ? course.stationNames[this._currentStationIndex] : 'Station';
            var duration = now - this._stationArrivalTime;
            this._splitNames.push(name);
            this._splitDurations.push(duration);
            print('[RaceStateMachine] ' + this._currentStationIndex + ' done — '
                + (duration / 1000).toFixed(1) + 's');
            this._currentStationIndex++;
            this._isInsideStation = false;
            this._stationHoldElapsed = 0;
            if (course && this._currentStationIndex >= course.stationCount) {
                this.finishRace();
            }
            else {
                if (course)
                    course.highlightStation(this._currentStationIndex);
                var detector = this.pd();
                if (detector)
                    detector.setActiveStation(this._currentStationIndex);
                this._state = RaceState.RUNNING;
                this.updateRunningUI();
            }
        }
        finishRace() {
            var totalMs = (getTime() * 1000) - this._raceStartTime;
            this._state = RaceState.FINISHED;
            if (this.statusText)
                this.statusText.text = 'FINISHED!';
            if (this.timerText)
                this.timerText.text = (totalMs / 1000).toFixed(1) + 's';
            if (this.stationInfoText) {
                var fastIdx = 0;
                var slowIdx = 0;
                var best = Infinity;
                var worst = 0;
                for (var i = 0; i < this._splitDurations.length; i++) {
                    if (this._splitDurations[i] < best) {
                        best = this._splitDurations[i];
                        fastIdx = i;
                    }
                    if (this._splitDurations[i] > worst) {
                        worst = this._splitDurations[i];
                        slowIdx = i;
                    }
                }
                var lines = '';
                for (var j = 0; j < this._splitNames.length; j++) {
                    var dur = (this._splitDurations[j] / 1000).toFixed(1);
                    var tag = j === fastIdx ? ' *FAST*' : j === slowIdx ? ' *SLOW*' : '';
                    lines += this._splitNames[j] + ': ' + dur + 's' + tag + '\n';
                }
                this.stationInfoText.text = lines;
            }
            print('[RaceStateMachine] FINISHED ' + (totalMs / 1000).toFixed(1) + 's');
        }
        // ── UI ────────────────────────────────────────────────────────────────
        setUIIdle() {
            if (this.statusText)
                this.statusText.text = 'HYROX MIRAGE\nPinch to Start';
            if (this.stationInfoText)
                this.stationInfoText.text = '';
            if (this.timerText)
                this.timerText.text = '00:00';
        }
        updateRunningUI() {
            if (this.statusText)
                this.statusText.text = 'RUN';
            var course = this.cm();
            if (this.stationInfoText && course) {
                var nextName = course.stationNames[this._currentStationIndex] || '';
                var nextDist = course.stationDistanceLabels[this._currentStationIndex] || '';
                this.stationInfoText.text = 'Next: ' + nextName + ' (' + nextDist + ')';
            }
        }
        updateTimerUI() {
            if (!this.timerText)
                return;
            var elapsed = this.elapsedMs;
            var totalSec = Math.floor(elapsed / 1000);
            var min = Math.floor(totalSec / 60);
            var sec = totalSec % 60;
            var ms = Math.floor((elapsed % 1000) / 10);
            this.timerText.text = this.pad2(min) + ':' + this.pad2(sec) + '.' + this.pad2(ms);
        }
        updateProgressUI() {
            if (!this.stationInfoText)
                return;
            var pct = Math.min(100, (this._stationHoldElapsed / this.stationHoldTime) * 100);
            var barLen = 10;
            var filled = Math.round((pct / 100) * barLen);
            var bar = '';
            for (var i = 0; i < barLen; i++) {
                bar += i < filled ? '#' : '-';
            }
            this.stationInfoText.text = '[' + bar + '] ' + Math.floor(pct) + '%';
        }
        pad2(n) {
            return n < 10 ? '0' + n : '' + n;
        }
    };
    __setFunctionName(_classThis, "RaceStateMachine");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        RaceStateMachine = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return RaceStateMachine = _classThis;
})();
exports.RaceStateMachine = RaceStateMachine;
//# sourceMappingURL=RaceStateMachine.js.map