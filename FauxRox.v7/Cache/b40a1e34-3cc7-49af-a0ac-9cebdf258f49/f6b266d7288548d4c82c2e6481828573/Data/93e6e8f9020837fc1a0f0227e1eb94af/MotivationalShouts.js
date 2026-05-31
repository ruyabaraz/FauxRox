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
exports.MotivationalShouts = void 0;
var __selfType = requireType("./MotivationalShouts");
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
let MotivationalShouts = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var MotivationalShouts = _classThis = class extends _classSuper {
        constructor() {
            super();
            // ── References ────────────────────────────────────────────────────────────
            this.raceStateMachine = this.raceStateMachine;
            this.aiCoach = this.aiCoach;
            this.heartRateTracker = this.heartRateTracker;
            this.cloudManager = this.cloudManager;
            // ── Settings ──────────────────────────────────────────────────────────────
            this.enabled = this.enabled;
            this.minShoutInterval = this.minShoutInterval;
            this.debugPrint = this.debugPrint;
            this.lastShoutTime = 0;
            this.lastState = 'IDLE';
            this.lastStationIndex = -1;
            this.lastHRZone = HeartRateTracker_1.HRZone.ZONE_1;
            this.cachedPBTime = 0;
            this.cachedPBSplits = [];
            this.lastPBCheckTime = 0;
            this.pbCheckInterval = 20.0;
        }
        __initialize() {
            super.__initialize();
            // ── References ────────────────────────────────────────────────────────────
            this.raceStateMachine = this.raceStateMachine;
            this.aiCoach = this.aiCoach;
            this.heartRateTracker = this.heartRateTracker;
            this.cloudManager = this.cloudManager;
            // ── Settings ──────────────────────────────────────────────────────────────
            this.enabled = this.enabled;
            this.minShoutInterval = this.minShoutInterval;
            this.debugPrint = this.debugPrint;
            this.lastShoutTime = 0;
            this.lastState = 'IDLE';
            this.lastStationIndex = -1;
            this.lastHRZone = HeartRateTracker_1.HRZone.ZONE_1;
            this.cachedPBTime = 0;
            this.cachedPBSplits = [];
            this.lastPBCheckTime = 0;
            this.pbCheckInterval = 20.0;
        }
        // ── Lifecycle ─────────────────────────────────────────────────────────────
        onAwake() {
            this.log('MotivationalShouts initialized');
            this.createEvent('OnStartEvent').bind(() => {
                this.fetchCachedPB();
            });
            this.createEvent('UpdateEvent').bind(() => {
                this.onUpdate();
            });
        }
        // ── Cached PB ─────────────────────────────────────────────────────────────
        async fetchCachedPB() {
            if (!this.cloudManager)
                return;
            try {
                const pb = await this.cloudManager.getPersonalBest();
                if (pb) {
                    this.cachedPBTime = pb.totalTime;
                    this.cachedPBSplits = pb.splits || [];
                    this.log('Cached PB: ' + (pb.totalTime / 1000).toFixed(1) + 's');
                }
            }
            catch (e) {
                this.log('Failed to fetch PB: ' + e);
            }
        }
        // ── Update Loop ───────────────────────────────────────────────────────────
        onUpdate() {
            if (!this.enabled)
                return;
            if (!this.raceStateMachine)
                return;
            // Get current state
            const rsm = this.raceStateMachine;
            const currentState = rsm.state || 'IDLE';
            const currentStation = rsm.currentStationIndex || 0;
            // Detect state changes
            if (currentState !== this.lastState) {
                this.onStateChange(this.lastState, currentState, currentStation);
                this.lastState = currentState;
            }
            // Detect station changes (within RUNNING or STATION)
            if (currentStation !== this.lastStationIndex) {
                if (this.lastStationIndex >= 0 && currentStation > this.lastStationIndex) {
                    this.onStationComplete(this.lastStationIndex, currentStation);
                }
                this.lastStationIndex = currentStation;
            }
            // Check HR zone changes
            if (this.heartRateTracker && this.heartRateTracker.isConnected) {
                const currentZone = this.heartRateTracker.currentZone;
                if (currentZone !== this.lastHRZone) {
                    this.onHRZoneChange(this.lastHRZone, currentZone);
                    this.lastHRZone = currentZone;
                }
            }
            // Check PB comparison periodically
            if ((currentState === 'RUNNING' || currentState === 'STATION') && this.cachedPBTime > 0) {
                this.checkPBComparison(rsm);
            }
        }
        // ── Event Handlers ────────────────────────────────────────────────────────
        onStateChange(from, to, stationIndex) {
            this.log('State: ' + from + ' → ' + to);
            // Race started
            if (from === 'COUNTDOWN' && to === 'RUNNING') {
                this.shout("The athlete just started their HYROX race. Pump them up!");
            }
            // Race finished
            if (to === 'FINISHED' && from !== 'IDLE') {
                this.shout("The athlete just FINISHED their entire HYROX race! Celebrate with them!");
            }
        }
        onStationComplete(fromStation, toStation) {
            this.log('Station complete: ' + fromStation + ' → ' + toStation);
            // Don't shout for START station (index 0)
            if (fromStation === 0)
                return;
            const totalStations = 9;
            const completed = fromStation;
            const remaining = totalStations - toStation;
            if (!this.canShout())
                return;
            // Halfway point
            if (completed === 4) {
                this.shout("Athlete just hit the HALFWAY point - 4 stations done, 4 to go!");
                return;
            }
            // Last station before finish
            if (remaining === 1) {
                this.shout("This is the FINAL station! One more and they're done!");
                return;
            }
            // Regular station complete
            this.shout("Athlete completed station " + completed + " of 8. " + remaining + " stations remaining.");
        }
        onHRZoneChange(from, to) {
            this.log('HR Zone: ' + from + ' → ' + to);
            if (!this.canShout())
                return;
            // Entering zone 5 (max effort)
            if (to === HeartRateTracker_1.HRZone.ZONE_5 && from < HeartRateTracker_1.HRZone.ZONE_5) {
                this.shout("Heart rate just hit ZONE 5 - maximum effort! They're giving everything!");
            }
            // Entering zone 4
            else if (to === HeartRateTracker_1.HRZone.ZONE_4 && from < HeartRateTracker_1.HRZone.ZONE_4) {
                this.shout("Heart rate entered zone 4 - high intensity. Encourage them to push through!");
            }
            // Dropping to zone 1 (needs push)
            else if (to === HeartRateTracker_1.HRZone.ZONE_1 && from > HeartRateTracker_1.HRZone.ZONE_2) {
                this.shout("Heart rate dropped to zone 1 - they need to pick up the pace!");
            }
        }
        checkPBComparison(rsm) {
            const now = getTime();
            if (now - this.lastPBCheckTime < this.pbCheckInterval)
                return;
            this.lastPBCheckTime = now;
            if (!this.canShout())
                return;
            const currentTime = rsm.elapsedMs || 0;
            const currentStation = rsm.currentStationIndex || 0;
            // Find corresponding PB split time
            let pbTimeAtStation = 0;
            for (let i = 0; i < currentStation && i < this.cachedPBSplits.length; i++) {
                pbTimeAtStation += this.cachedPBSplits[i].duration;
            }
            if (pbTimeAtStation <= 0)
                return;
            const diff = currentTime - pbTimeAtStation;
            // Ahead of PB by more than 5 seconds
            if (diff < -5000) {
                const ahead = Math.round(Math.abs(diff) / 1000);
                this.shout("Athlete is " + ahead + " seconds AHEAD of their personal best! They're on fire!");
            }
            // Behind PB by more than 15 seconds
            else if (diff > 15000) {
                const behind = Math.round(diff / 1000);
                this.shout("Athlete is " + behind + " seconds behind their PB. Motivate them to push harder!");
            }
        }
        // ── Voice Output ──────────────────────────────────────────────────────────
        canShout() {
            const now = getTime();
            return (now - this.lastShoutTime) >= this.minShoutInterval;
        }
        shout(message) {
            if (!this.aiCoach) {
                this.log('AICoach not connected');
                return;
            }
            this.log('SHOUT: ' + message);
            this.lastShoutTime = getTime();
            // Use AICoach to speak
            this.aiCoach.speakShout(message);
        }
        // ── Debug ─────────────────────────────────────────────────────────────────
        log(msg) {
            if (this.debugPrint) {
                print('[MotivationalShouts] ' + msg);
            }
        }
    };
    __setFunctionName(_classThis, "MotivationalShouts");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MotivationalShouts = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MotivationalShouts = _classThis;
})();
exports.MotivationalShouts = MotivationalShouts;
//# sourceMappingURL=MotivationalShouts.js.map