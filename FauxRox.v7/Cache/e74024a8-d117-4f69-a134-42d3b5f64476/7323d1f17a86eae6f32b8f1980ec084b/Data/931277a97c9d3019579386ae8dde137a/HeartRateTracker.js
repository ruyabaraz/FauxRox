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
// Connects to any Bluetooth LE Heart Rate Monitor (Decathlon, Polar, Garmin, etc.)
// Uses standard Bluetooth Heart Rate Service (0x180D)
// ============================================================================
// Standard Bluetooth Heart Rate Service UUIDs
const HR_SERVICE_UUID = "0x180D";
const HR_CHARACTERISTIC_UUID = "0x2A37";
// Connection states
var HRConnectionState;
(function (HRConnectionState) {
    HRConnectionState["DISCONNECTED"] = "DISCONNECTED";
    HRConnectionState["SCANNING"] = "SCANNING";
    HRConnectionState["CONNECTING"] = "CONNECTING";
    HRConnectionState["CONNECTED"] = "CONNECTED";
    HRConnectionState["ERROR"] = "ERROR";
})(HRConnectionState || (exports.HRConnectionState = HRConnectionState = {}));
// HR Zones based on max heart rate
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
            // ── Settings ───────────────────────────────────────────────────────────────
            /** Maximum heart rate for zone calculation (220 - age) */
            this.maxHeartRate = this.maxHeartRate;
            /** Scan timeout in seconds */
            this.scanTimeout = this.scanTimeout;
            /** Auto-connect to first HR monitor found */
            this.autoConnect = this.autoConnect;
            /** Enable debug logging */
            this.debugPrint = this.debugPrint;
            // ── State ──────────────────────────────────────────────────────────────────
            this.bluetoothModule = null;
            this.bluetoothGatt = null;
            this.hrService = null;
            this.hrCharacteristic = null;
            this._connectionState = HRConnectionState.DISCONNECTED;
            this._currentBPM = 0;
            this._currentZone = HRZone.ZONE_1;
            this._deviceName = '';
            // Stats tracking
            this._sessionStartTime = 0;
            this._bpmReadings = [];
            this._peakBPM = 0;
            this._avgBPM = 0;
            // Callbacks
            this.onBPMUpdateCallback = null;
            this.onConnectionStateChangeCallback = null;
            // ── Simulated HR (Editor Mode) ────────────────────────────────────────────
            this.simulatedHREvent = null;
            this.simulatedBPM = 75;
            this.simulatedDirection = 1;
        }
        __initialize() {
            super.__initialize();
            // ── Settings ───────────────────────────────────────────────────────────────
            /** Maximum heart rate for zone calculation (220 - age) */
            this.maxHeartRate = this.maxHeartRate;
            /** Scan timeout in seconds */
            this.scanTimeout = this.scanTimeout;
            /** Auto-connect to first HR monitor found */
            this.autoConnect = this.autoConnect;
            /** Enable debug logging */
            this.debugPrint = this.debugPrint;
            // ── State ──────────────────────────────────────────────────────────────────
            this.bluetoothModule = null;
            this.bluetoothGatt = null;
            this.hrService = null;
            this.hrCharacteristic = null;
            this._connectionState = HRConnectionState.DISCONNECTED;
            this._currentBPM = 0;
            this._currentZone = HRZone.ZONE_1;
            this._deviceName = '';
            // Stats tracking
            this._sessionStartTime = 0;
            this._bpmReadings = [];
            this._peakBPM = 0;
            this._avgBPM = 0;
            // Callbacks
            this.onBPMUpdateCallback = null;
            this.onConnectionStateChangeCallback = null;
            // ── Simulated HR (Editor Mode) ────────────────────────────────────────────
            this.simulatedHREvent = null;
            this.simulatedBPM = 75;
            this.simulatedDirection = 1;
        }
        // ── Public Getters ─────────────────────────────────────────────────────────
        get connectionState() { return this._connectionState; }
        get currentBPM() { return this._currentBPM; }
        get currentZone() { return this._currentZone; }
        get deviceName() { return this._deviceName; }
        get peakBPM() { return this._peakBPM; }
        get avgBPM() { return this._avgBPM; }
        get isConnected() { return this._connectionState === HRConnectionState.CONNECTED; }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        onAwake() {
            this.initBluetooth();
        }
        initBluetooth() {
            try {
                this.bluetoothModule = require("LensStudio:BluetoothCentralModule");
                this.log('Bluetooth module initialized');
                this.setConnectionState(HRConnectionState.DISCONNECTED, 'Ready to scan');
            }
            catch (e) {
                this.log('ERROR: Failed to initialize Bluetooth: ' + e);
                this.setConnectionState(HRConnectionState.ERROR, 'Bluetooth not available');
            }
        }
        // ── Public API ─────────────────────────────────────────────────────────────
        /**
         * Start scanning for HR monitors
         */
        startScan() {
            if (!this.bluetoothModule) {
                this.log('ERROR: Bluetooth module not available');
                this.setConnectionState(HRConnectionState.ERROR, 'Bluetooth not available');
                return;
            }
            if (this._connectionState === HRConnectionState.SCANNING) {
                this.log('Already scanning');
                return;
            }
            // Editor mode - simulate connection
            if (global.deviceInfoSystem.isEditor()) {
                this.log('Editor mode - simulating HR connection');
                this.setConnectionState(HRConnectionState.SCANNING, 'Scanning...');
                // Simulate finding device after 1 second
                var delayEvent = this.createEvent('DelayedCallbackEvent');
                delayEvent.bind(() => {
                    this._deviceName = 'Simulated HR Monitor';
                    this.setConnectionState(HRConnectionState.CONNECTED, 'Connected (Simulated)');
                    this.startSimulatedHR();
                });
                delayEvent.reset(1.0);
                return;
            }
            this.setConnectionState(HRConnectionState.SCANNING, 'Scanning for HR monitors...');
            this.log('Starting BLE scan for HR monitors...');
            // Scan filter for Heart Rate Service
            var filter = new Bluetooth.ScanFilter();
            filter.serviceUUID = HR_SERVICE_UUID;
            var settings = new Bluetooth.ScanSettings();
            settings.uniqueDevices = true;
            settings.timeoutSeconds = this.scanTimeout;
            this.bluetoothModule.startScan([filter], settings, (result) => this.onScanResult(result))
                .then((result) => {
                // Scan stopped via predicate returning true
                this.log('Scan completed with result: ' + (result ? result.deviceName : 'none'));
            })
                .catch((error) => {
                if (this._connectionState === HRConnectionState.CONNECTED) {
                    // Already connected, ignore scan timeout
                    return;
                }
                this.log('Scan error/timeout: ' + error);
                this.setConnectionState(HRConnectionState.ERROR, 'No HR monitor found');
            });
        }
        /**
         * Stop scanning
         */
        stopScan() {
            if (this.bluetoothModule && this._connectionState === HRConnectionState.SCANNING) {
                this.bluetoothModule.stopScan();
                this.setConnectionState(HRConnectionState.DISCONNECTED, 'Scan stopped');
            }
        }
        /**
         * Disconnect from current device
         */
        disconnect() {
            if (this.bluetoothGatt) {
                // Note: There's no explicit disconnect method in the API
                // Setting to null and letting GC handle it
                this.bluetoothGatt = null;
                this.hrService = null;
                this.hrCharacteristic = null;
            }
            this._deviceName = '';
            this._currentBPM = 0;
            this.setConnectionState(HRConnectionState.DISCONNECTED, 'Disconnected');
            this.log('Disconnected');
        }
        /**
         * Start tracking HR session (resets stats)
         */
        startSession() {
            this._sessionStartTime = getTime();
            this._bpmReadings = [];
            this._peakBPM = 0;
            this._avgBPM = 0;
            this.log('HR session started');
        }
        /**
         * End tracking session and calculate final stats
         */
        endSession() {
            this.calculateStats();
            this.log('HR session ended. Avg: ' + this._avgBPM + ' Peak: ' + this._peakBPM);
            return {
                avgBPM: this._avgBPM,
                peakBPM: this._peakBPM,
                readings: this._bpmReadings.slice()
            };
        }
        /**
         * Set callback for BPM updates
         */
        onBPMUpdate(callback) {
            this.onBPMUpdateCallback = callback;
        }
        /**
         * Set callback for connection state changes
         */
        onConnectionStateChange(callback) {
            this.onConnectionStateChangeCallback = callback;
            // Immediately call with current state
            if (callback) {
                callback(this._connectionState, this.getStateMessage());
            }
        }
        /**
         * Get zone name for display
         */
        getZoneName(zone) {
            switch (zone) {
                case HRZone.ZONE_1: return 'WARM UP';
                case HRZone.ZONE_2: return 'FAT BURN';
                case HRZone.ZONE_3: return 'CARDIO';
                case HRZone.ZONE_4: return 'THRESHOLD';
                case HRZone.ZONE_5: return 'PEAK';
                default: return 'UNKNOWN';
            }
        }
        /**
         * Get zone color for display (returns vec4 RGBA)
         */
        getZoneColor(zone) {
            switch (zone) {
                case HRZone.ZONE_1: return new vec4(0.5, 0.5, 0.5, 1); // Gray
                case HRZone.ZONE_2: return new vec4(0.2, 0.6, 1, 1); // Blue
                case HRZone.ZONE_3: return new vec4(0.2, 0.8, 0.2, 1); // Green
                case HRZone.ZONE_4: return new vec4(1, 0.8, 0, 1); // Yellow/Orange
                case HRZone.ZONE_5: return new vec4(1, 0.2, 0.2, 1); // Red
                default: return new vec4(1, 1, 1, 1);
            }
        }
        // ── Scan & Connection ─────────────────────────────────────────────────────
        onScanResult(result) {
            if (!result || !result.deviceName) {
                return false; // Continue scanning
            }
            this.log('Found device: ' + result.deviceName);
            this._deviceName = result.deviceName;
            if (this.autoConnect) {
                this.connectToDevice(result);
                return true; // Stop scanning
            }
            return false; // Continue scanning if not auto-connecting
        }
        connectToDevice(scanResult) {
            this.setConnectionState(HRConnectionState.CONNECTING, 'Connecting to ' + scanResult.deviceName + '...');
            this.log('Connecting to: ' + scanResult.deviceName);
            this.bluetoothModule.connectGatt(scanResult.deviceAddress)
                .then((gatt) => {
                this.bluetoothGatt = gatt;
                this.onGattConnected();
            })
                .catch((error) => {
                this.log('Connection error: ' + error);
                this.setConnectionState(HRConnectionState.ERROR, 'Connection failed');
            });
        }
        onGattConnected() {
            if (!this.bluetoothGatt) {
                this.setConnectionState(HRConnectionState.ERROR, 'GATT connection lost');
                return;
            }
            // Monitor connection state
            this.bluetoothGatt.onConnectionStateChangedEvent.add((event) => {
                if (event.state === Bluetooth.ConnectionState.Disconnected) {
                    this.log('Device disconnected');
                    this.setConnectionState(HRConnectionState.DISCONNECTED, 'Device disconnected');
                }
            });
            // Get HR service
            try {
                this.hrService = this.bluetoothGatt.getService(HR_SERVICE_UUID);
                if (!this.hrService) {
                    this.setConnectionState(HRConnectionState.ERROR, 'HR service not found');
                    return;
                }
                // Get HR characteristic
                this.hrCharacteristic = this.hrService.getCharacteristic(HR_CHARACTERISTIC_UUID);
                if (!this.hrCharacteristic) {
                    this.setConnectionState(HRConnectionState.ERROR, 'HR characteristic not found');
                    return;
                }
                // Register for notifications
                this.registerHRNotifications();
            }
            catch (e) {
                this.log('ERROR getting HR service: ' + e);
                this.setConnectionState(HRConnectionState.ERROR, 'Service discovery failed');
            }
        }
        registerHRNotifications() {
            this.hrCharacteristic.registerNotifications((value) => {
                this.onHRNotification(value);
            })
                .then(() => {
                this.log('HR notifications registered');
                this.setConnectionState(HRConnectionState.CONNECTED, 'Connected to ' + this._deviceName);
            })
                .catch((error) => {
                this.log('ERROR registering HR notifications: ' + error);
                this.setConnectionState(HRConnectionState.ERROR, 'Notification registration failed');
            });
        }
        onHRNotification(value) {
            if (!value || value.length < 2) {
                return;
            }
            // Parse heart rate value
            // First byte is flags, second byte (or two bytes if flag set) is HR value
            var flags = value[0];
            var bpm;
            if ((flags & 0x01) === 0) {
                // 8-bit HR value
                bpm = value[1];
            }
            else {
                // 16-bit HR value
                bpm = value[1] | (value[2] << 8);
            }
            // Validate BPM (reasonable range: 30-220)
            if (bpm < 30 || bpm > 220) {
                return;
            }
            this._currentBPM = bpm;
            this._currentZone = this.calculateZone(bpm);
            // Track for stats
            if (this._sessionStartTime > 0) {
                this._bpmReadings.push(bpm);
                if (bpm > this._peakBPM) {
                    this._peakBPM = bpm;
                }
                this.calculateStats();
            }
            // Notify callback
            if (this.onBPMUpdateCallback) {
                this.onBPMUpdateCallback(this._currentBPM, this._currentZone);
            }
        }
        // ── Zone Calculation ──────────────────────────────────────────────────────
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
        calculateStats() {
            if (this._bpmReadings.length === 0) {
                this._avgBPM = 0;
                return;
            }
            var sum = 0;
            for (var i = 0; i < this._bpmReadings.length; i++) {
                sum += this._bpmReadings[i];
            }
            this._avgBPM = Math.round(sum / this._bpmReadings.length);
        }
        startSimulatedHR() {
            this.simulatedHREvent = this.createEvent('UpdateEvent');
            this.simulatedHREvent.bind(() => this.updateSimulatedHR());
            this.log('Started simulated HR');
        }
        updateSimulatedHR() {
            // Simulate realistic HR changes
            var change = (Math.random() - 0.3) * 3; // Slight upward bias
            this.simulatedBPM += change;
            // Keep in reasonable range
            if (this.simulatedBPM > 180) {
                this.simulatedBPM = 180;
            }
            else if (this.simulatedBPM < 60) {
                this.simulatedBPM = 60;
            }
            var bpm = Math.round(this.simulatedBPM);
            this._currentBPM = bpm;
            this._currentZone = this.calculateZone(bpm);
            // Track for stats
            if (this._sessionStartTime > 0) {
                this._bpmReadings.push(bpm);
                if (bpm > this._peakBPM) {
                    this._peakBPM = bpm;
                }
                this.calculateStats();
            }
            // Notify callback
            if (this.onBPMUpdateCallback) {
                this.onBPMUpdateCallback(this._currentBPM, this._currentZone);
            }
        }
        // ── State Management ──────────────────────────────────────────────────────
        setConnectionState(state, message) {
            var changed = this._connectionState !== state;
            this._connectionState = state;
            if (changed) {
                this.log('State: ' + state + ' - ' + message);
                if (this.onConnectionStateChangeCallback) {
                    this.onConnectionStateChangeCallback(state, message);
                }
            }
        }
        getStateMessage() {
            switch (this._connectionState) {
                case HRConnectionState.DISCONNECTED: return 'Disconnected';
                case HRConnectionState.SCANNING: return 'Scanning...';
                case HRConnectionState.CONNECTING: return 'Connecting...';
                case HRConnectionState.CONNECTED: return 'Connected to ' + this._deviceName;
                case HRConnectionState.ERROR: return 'Error';
                default: return 'Unknown';
            }
        }
        // ── Logging ───────────────────────────────────────────────────────────────
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