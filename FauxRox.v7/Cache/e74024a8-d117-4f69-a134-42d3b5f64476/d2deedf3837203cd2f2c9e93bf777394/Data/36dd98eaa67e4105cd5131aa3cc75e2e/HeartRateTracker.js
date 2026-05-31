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
exports.HeartRateTracker = exports.HRZone = exports.HRConnectionState = void 0;
var __selfType = requireType("./HeartRateTracker");
function component(target) { target.getTypeName = function () { return __selfType; }; }
// ============================================================================
// HeartRateTracker.ts — BLE Heart Rate Monitor Integration
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Based on working BLE Playground pattern
// ============================================================================
const HR_SERVICE_UUID = "0x180D";
const HR_CHAR_UUID = "0x2A37";
var HRConnectionState;
(function (HRConnectionState) {
    HRConnectionState["DISCONNECTED"] = "DISCONNECTED";
    HRConnectionState["SCANNING"] = "SCANNING";
    HRConnectionState["CONNECTING"] = "CONNECTING";
    HRConnectionState["CONNECTED"] = "CONNECTED";
    HRConnectionState["ERROR"] = "ERROR";
})(HRConnectionState || (exports.HRConnectionState = HRConnectionState = {}));
var HRZone;
(function (HRZone) {
    HRZone[HRZone["ZONE_1"] = 1] = "ZONE_1";
    HRZone[HRZone["ZONE_2"] = 2] = "ZONE_2";
    HRZone[HRZone["ZONE_3"] = 3] = "ZONE_3";
    HRZone[HRZone["ZONE_4"] = 4] = "ZONE_4";
    HRZone[HRZone["ZONE_5"] = 5] = "ZONE_5";
})(HRZone || (exports.HRZone = HRZone = {}));
let HeartRateTracker = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var HeartRateTracker = _classThis = class extends _classSuper {
        constructor() {
            super();
            this.bluetoothModule = this.bluetoothModule;
            this.maxHeartRate = this.maxHeartRate;
            this.scanTimeout = this.scanTimeout;
            this.debugPrint = this.debugPrint;
            // BLE scan objects - initialized as class properties (key fix!)
            this.scanFilter = new Bluetooth.ScanFilter();
            this.scanSettings = new Bluetooth.ScanSettings();
            this.bluetoothGatt = null;
            this.hrService = null;
            this.hrCharacteristic = null;
            this._connectionState = HRConnectionState.DISCONNECTED;
            this._currentBPM = 0;
            this._currentZone = HRZone.ZONE_1;
            this._deviceName = '';
            this._isScanning = false;
            this._sessionStartTime = 0;
            this._bpmReadings = [];
            this._peakBPM = 0;
            this._avgBPM = 0;
            this.onBPMUpdateCallback = null;
            this.onConnectionStateChangeCallback = null;
            // Simulated HR for editor
            this.simulatedBPM = 75;
        }
        __initialize() {
            super.__initialize();
            this.bluetoothModule = this.bluetoothModule;
            this.maxHeartRate = this.maxHeartRate;
            this.scanTimeout = this.scanTimeout;
            this.debugPrint = this.debugPrint;
            // BLE scan objects - initialized as class properties (key fix!)
            this.scanFilter = new Bluetooth.ScanFilter();
            this.scanSettings = new Bluetooth.ScanSettings();
            this.bluetoothGatt = null;
            this.hrService = null;
            this.hrCharacteristic = null;
            this._connectionState = HRConnectionState.DISCONNECTED;
            this._currentBPM = 0;
            this._currentZone = HRZone.ZONE_1;
            this._deviceName = '';
            this._isScanning = false;
            this._sessionStartTime = 0;
            this._bpmReadings = [];
            this._peakBPM = 0;
            this._avgBPM = 0;
            this.onBPMUpdateCallback = null;
            this.onConnectionStateChangeCallback = null;
            // Simulated HR for editor
            this.simulatedBPM = 75;
        }
        get connectionState() { return this._connectionState; }
        get currentBPM() { return this._currentBPM; }
        get currentZone() { return this._currentZone; }
        get deviceName() { return this._deviceName; }
        get peakBPM() { return this._peakBPM; }
        get avgBPM() { return this._avgBPM; }
        get isConnected() { return this._connectionState === HRConnectionState.CONNECTED; }
        onAwake() {
            // Configure scan settings
            this.scanSettings.uniqueDevices = true;
            this.scanSettings.timeoutSeconds = this.scanTimeout;
            // No service filter - scan for all devices
            this.log('HeartRateTracker initialized');
            this.setConnectionState(HRConnectionState.DISCONNECTED, 'Ready');
        }
        startScan() {
            if (this._isScanning) {
                this.log('Already scanning');
                return;
            }
            // Editor mode - simulate
            if (global.deviceInfoSystem.isEditor()) {
                this.log('Editor mode - simulating HR');
                this.setConnectionState(HRConnectionState.CONNECTED, 'Simulated');
                this._deviceName = 'Simulated HR';
                this.startSimulatedHR();
                return;
            }
            if (!this.bluetoothModule) {
                this.log('ERROR: Bluetooth module not linked');
                this.setConnectionState(HRConnectionState.ERROR, 'No Bluetooth');
                return;
            }
            this._isScanning = true;
            this.setConnectionState(HRConnectionState.SCANNING, 'Scanning...');
            this.log('Starting BLE scan...');
            this.bluetoothModule
                .startScan([this.scanFilter], this.scanSettings, (result) => this.onScanResult(result))
                .then((result) => {
                this.log('Scan completed: ' + (result ? result.deviceName : 'none'));
                this._isScanning = false;
            })
                .catch((error) => {
                this.log('Scan ended: ' + error);
                this._isScanning = false;
                if (this._connectionState !== HRConnectionState.CONNECTED) {
                    this.setConnectionState(HRConnectionState.ERROR, 'No device found');
                }
            });
        }
        stopScan() {
            if (this._isScanning && this.bluetoothModule) {
                this.bluetoothModule.stopScan();
                this._isScanning = false;
                this.setConnectionState(HRConnectionState.DISCONNECTED, 'Scan stopped');
            }
        }
        onScanResult(result) {
            if (!result)
                return false;
            var name = result.deviceName || '';
            this.log('Found: ' + name);
            // Check if HR device
            var upper = name.toUpperCase();
            var isHR = upper.indexOf('ECHO') >= 0 ||
                upper.indexOf('HEART') >= 0 ||
                upper.indexOf('HR') >= 0 ||
                upper.indexOf('POLAR') >= 0 ||
                upper.indexOf('GARMIN') >= 0 ||
                upper.indexOf('WAHOO') >= 0;
            if (isHR || name.length > 0) {
                // Try connecting to any named device (HR service will validate)
                this.log('Connecting to: ' + name);
                this._deviceName = name;
                this.connectToDevice(result);
                return true;
            }
            return false;
        }
        connectToDevice(result) {
            this.setConnectionState(HRConnectionState.CONNECTING, 'Connecting...');
            this.bluetoothModule
                .connectGatt(result.deviceAddress)
                .then((gatt) => {
                this.bluetoothGatt = gatt;
                this.log('GATT connected');
                this.setupHRService();
            })
                .catch((error) => {
                this.log('Connection error: ' + error);
                this.setConnectionState(HRConnectionState.ERROR, 'Connection failed');
            });
        }
        setupHRService() {
            try {
                this.hrService = this.bluetoothGatt.getService(HR_SERVICE_UUID);
                if (!this.hrService) {
                    this.log('HR service not found on device');
                    this.setConnectionState(HRConnectionState.ERROR, 'Not HR device');
                    return;
                }
                this.hrCharacteristic = this.hrService.getCharacteristic(HR_CHAR_UUID);
                if (!this.hrCharacteristic) {
                    this.log('HR characteristic not found');
                    this.setConnectionState(HRConnectionState.ERROR, 'HR char missing');
                    return;
                }
                this.log('HR service found, registering notifications...');
                this.registerNotifications();
            }
            catch (e) {
                this.log('ERROR: ' + e);
                this.setConnectionState(HRConnectionState.ERROR, 'Service error');
            }
        }
        registerNotifications() {
            this.hrCharacteristic
                .registerNotifications((val) => this.onHRNotification(val))
                .then(() => {
                this.log('HR notifications registered');
                this.setConnectionState(HRConnectionState.CONNECTED, this._deviceName);
            })
                .catch((error) => {
                this.log('Notification error: ' + error);
                this.setConnectionState(HRConnectionState.ERROR, 'Notification failed');
            });
        }
        onHRNotification(val) {
            if (!val || val.length < 2)
                return;
            var flags = val[0];
            var bpm;
            if ((flags & 0x01) === 0) {
                bpm = val[1];
            }
            else {
                bpm = val[1] | (val[2] << 8);
            }
            if (bpm < 30 || bpm > 220)
                return;
            this.processBPM(bpm);
        }
        processBPM(bpm) {
            this._currentBPM = bpm;
            this._currentZone = this.calculateZone(bpm);
            if (this._sessionStartTime > 0) {
                this._bpmReadings.push(bpm);
                if (bpm > this._peakBPM)
                    this._peakBPM = bpm;
                this.calculateAvg();
            }
            if (this.onBPMUpdateCallback) {
                this.onBPMUpdateCallback(bpm, this._currentZone);
            }
        }
        calculateZone(bpm) {
            var pct = (bpm / this.maxHeartRate) * 100;
            if (pct < 60)
                return HRZone.ZONE_1;
            if (pct < 70)
                return HRZone.ZONE_2;
            if (pct < 80)
                return HRZone.ZONE_3;
            if (pct < 90)
                return HRZone.ZONE_4;
            return HRZone.ZONE_5;
        }
        calculateAvg() {
            if (this._bpmReadings.length === 0)
                return;
            var sum = 0;
            for (var i = 0; i < this._bpmReadings.length; i++) {
                sum += this._bpmReadings[i];
            }
            this._avgBPM = Math.round(sum / this._bpmReadings.length);
        }
        // Simulated HR for editor
        startSimulatedHR() {
            this.createEvent('UpdateEvent').bind(() => {
                this.simulatedBPM += (Math.random() - 0.4) * 2;
                if (this.simulatedBPM > 170)
                    this.simulatedBPM = 170;
                if (this.simulatedBPM < 60)
                    this.simulatedBPM = 60;
                this.processBPM(Math.round(this.simulatedBPM));
            });
        }
        // Public API
        startSession() {
            this._sessionStartTime = getTime();
            this._bpmReadings = [];
            this._peakBPM = 0;
            this._avgBPM = 0;
        }
        endSession() {
            return { avgBPM: this._avgBPM, peakBPM: this._peakBPM };
        }
        onBPMUpdate(callback) {
            this.onBPMUpdateCallback = callback;
        }
        onConnectionStateChange(callback) {
            this.onConnectionStateChangeCallback = callback;
            callback(this._connectionState, '');
        }
        getZoneName(zone) {
            switch (zone) {
                case HRZone.ZONE_1: return 'WARM UP';
                case HRZone.ZONE_2: return 'FAT BURN';
                case HRZone.ZONE_3: return 'CARDIO';
                case HRZone.ZONE_4: return 'THRESHOLD';
                case HRZone.ZONE_5: return 'PEAK';
                default: return '';
            }
        }
        setConnectionState(state, message) {
            this._connectionState = state;
            this.log('State: ' + state + ' - ' + message);
            if (this.onConnectionStateChangeCallback) {
                this.onConnectionStateChangeCallback(state, message);
            }
        }
        log(msg) {
            if (this.debugPrint) {
                print('[HeartRateTracker] ' + msg);
            }
        }
    };
    __setFunctionName(_classThis, "HeartRateTracker");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        HeartRateTracker = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return HeartRateTracker = _classThis;
})();
exports.HeartRateTracker = HeartRateTracker;
//# sourceMappingURL=HeartRateTracker.js.map