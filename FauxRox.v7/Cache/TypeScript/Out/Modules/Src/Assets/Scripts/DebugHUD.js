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
exports.DebugHUD = void 0;
var __selfType = requireType("./DebugHUD");
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
const HeartRateTracker_1 = require("./HeartRateTracker");
let DebugHUD = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var DebugHUD = _classThis = class extends _classSuper {
        constructor() {
            super();
            // ── Inputs ─────────────────────────────────────────────────────────────────
            this.debugText = this.debugText;
            this.raceStateMachine = this.raceStateMachine;
            this.handZoneDetector = this.handZoneDetector;
            this.courseManager = this.courseManager;
            this.heartRateTracker = this.heartRateTracker;
            /** Enable/disable debug overlay */
            this.enabled = this.enabled;
            /** Update interval in seconds (lower = more responsive but more expensive) */
            this.updateInterval = this.updateInterval;
            // ── State ──────────────────────────────────────────────────────────────────
            this._lastUpdate = 0;
        }
        __initialize() {
            super.__initialize();
            // ── Inputs ─────────────────────────────────────────────────────────────────
            this.debugText = this.debugText;
            this.raceStateMachine = this.raceStateMachine;
            this.handZoneDetector = this.handZoneDetector;
            this.courseManager = this.courseManager;
            this.heartRateTracker = this.heartRateTracker;
            /** Enable/disable debug overlay */
            this.enabled = this.enabled;
            /** Update interval in seconds (lower = more responsive but more expensive) */
            this.updateInterval = this.updateInterval;
            // ── State ──────────────────────────────────────────────────────────────────
            this._lastUpdate = 0;
        }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        onAwake() {
            this.createEvent('UpdateEvent').bind(() => {
                this.onUpdate();
            });
            print('[DebugHUD] Initialized (HR Edition)');
        }
        // ── Update ─────────────────────────────────────────────────────────────────
        onUpdate() {
            if (!this.enabled || !this.debugText)
                return;
            // Throttle updates
            var now = getTime();
            if (now - this._lastUpdate < this.updateInterval)
                return;
            this._lastUpdate = now;
            this.updateDebugText();
        }
        updateDebugText() {
            var lines = [];
            lines.push('=== DEBUG HUD ===');
            // Race State Machine info
            if (this.raceStateMachine) {
                var rsm = this.raceStateMachine; // Access private/internal fields
                lines.push('');
                lines.push('-- RACE STATE --');
                lines.push('State: ' + (rsm._state || rsm.state || 'N/A'));
                // Show user-friendly station number (index 1 = Station 1, etc. START=0 doesn't count)
                var stationIdx = rsm._currentStationIndex !== undefined ? rsm._currentStationIndex : -1;
                var stationDisplay = stationIdx <= 0 ? 'START' : stationIdx.toString();
                lines.push('Station: ' + stationDisplay);
                // Run info
                var runTarget = rsm._runTarget !== undefined ? rsm._runTarget : 0;
                var runDist = rsm._runDistance !== undefined ? rsm._runDistance : 0;
                lines.push('Run: ' + runDist.toFixed(1) + 'm / ' + runTarget.toFixed(0) + 'm');
                // Station progress
                var progress = rsm._stationProgress !== undefined ? rsm._stationProgress : 0;
                var requirement = rsm._stationRequirement !== undefined ? rsm._stationRequirement : 0;
                lines.push('Progress: ' + progress.toFixed(1) + ' / ' + requirement);
                // Current config name
                if (rsm._currentConfig) {
                    lines.push('Config: ' + rsm._currentConfig.name + ' (' + rsm._currentConfig.mode + ')');
                }
            }
            else {
                lines.push('');
                lines.push('RaceStateMachine: NOT LINKED');
            }
            // Hand Zone Detector info
            if (this.handZoneDetector) {
                lines.push('');
                lines.push('-- HAND ZONE --');
                lines.push('Zone State: ' + this.handZoneDetector.getState());
                lines.push('Reps: ' + this.handZoneDetector.getRepCount());
                var handsValid = this.handZoneDetector.areHandsValid();
                lines.push('Hands Valid: ' + (handsValid ? 'YES' : 'NO'));
                var targetDist = this.handZoneDetector.getTargetDistance();
                if (targetDist >= 0) {
                    lines.push('Target Dist: ' + targetDist.toFixed(1) + 'cm');
                }
                else {
                    lines.push('Target Dist: --');
                }
                lines.push('Anchored: ' + (this.handZoneDetector.isStationAnchored() ? 'YES (station)' : 'NO (camera)'));
            }
            else {
                lines.push('');
                lines.push('HandZoneDetector: NOT LINKED');
            }
            // Course Manager info
            if (this.courseManager) {
                lines.push('');
                lines.push('-- COURSE --');
                lines.push('Ready: ' + (this.courseManager.isReady ? 'YES' : 'NO'));
                lines.push('Stations: ' + this.courseManager.stationCount);
                var activeIdx = this.courseManager.getActiveStationIndex();
                lines.push('Active: ' + (activeIdx >= 0 ? activeIdx : 'none'));
            }
            // Heart Rate Monitor Status
            if (this.heartRateTracker) {
                lines.push('');
                lines.push('-- HEART RATE --');
                var hrState = this.heartRateTracker.connectionState;
                var hrIcon = '';
                switch (hrState) {
                    case HeartRateTracker_1.HRConnectionState.CONNECTED:
                        hrIcon = '[OK]';
                        break;
                    case HeartRateTracker_1.HRConnectionState.SCANNING:
                        hrIcon = '[...]';
                        break;
                    case HeartRateTracker_1.HRConnectionState.CONNECTING:
                        hrIcon = '[~]';
                        break;
                    case HeartRateTracker_1.HRConnectionState.DISCONNECTED:
                        hrIcon = '[X]';
                        break;
                    case HeartRateTracker_1.HRConnectionState.ERROR:
                        hrIcon = '[!]';
                        break;
                    default:
                        hrIcon = '[?]';
                }
                lines.push('Status: ' + hrIcon + ' ' + hrState);
                if (this.heartRateTracker.isConnected) {
                    lines.push('Device: ' + this.heartRateTracker.deviceName);
                    lines.push('BPM: ' + this.heartRateTracker.currentBPM);
                    lines.push('Zone: ' + this.heartRateTracker.getZoneName(this.heartRateTracker.currentZone));
                    lines.push('Avg: ' + this.heartRateTracker.avgBPM + ' | Peak: ' + this.heartRateTracker.peakBPM);
                }
            }
            else {
                lines.push('');
                lines.push('HeartRateTracker: NOT LINKED');
            }
            // Timestamp
            lines.push('');
            lines.push('t=' + getTime().toFixed(1) + 's');
            this.debugText.text = lines.join('\n');
        }
        // ── Public API ─────────────────────────────────────────────────────────────
        /** Toggle debug HUD visibility */
        toggle() {
            this.enabled = !this.enabled;
            if (!this.enabled && this.debugText) {
                this.debugText.text = '';
            }
            print('[DebugHUD] ' + (this.enabled ? 'Enabled' : 'Disabled'));
        }
    };
    __setFunctionName(_classThis, "DebugHUD");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        DebugHUD = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return DebugHUD = _classThis;
})();
exports.DebugHUD = DebugHUD;
//# sourceMappingURL=DebugHUD.js.map