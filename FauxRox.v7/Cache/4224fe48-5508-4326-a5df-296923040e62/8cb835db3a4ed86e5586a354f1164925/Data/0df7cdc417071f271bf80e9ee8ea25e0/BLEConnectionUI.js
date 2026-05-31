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
exports.BLEConnectionUI = exports.BLEUIState = void 0;
var __selfType = requireType("./BLEConnectionUI");
function component(target) { target.getTypeName = function () { return __selfType; }; }
// BLEConnectionUI.ts — Dialog for HR monitor connection flow
// Flow: Prompt (Yes/No) → Scanning → Device List → Connect
const HeartRateTracker_1 = require("./HeartRateTracker");
var BLEUIState;
(function (BLEUIState) {
    BLEUIState["HIDDEN"] = "HIDDEN";
    BLEUIState["PROMPT"] = "PROMPT";
    BLEUIState["SCANNING"] = "SCANNING";
    BLEUIState["DEVICE_LIST"] = "DEVICE_LIST";
    BLEUIState["CONNECTING"] = "CONNECTING";
    BLEUIState["CONNECTED"] = "CONNECTED";
    BLEUIState["DISABLED"] = "DISABLED";
})(BLEUIState || (exports.BLEUIState = BLEUIState = {}));
let BLEConnectionUI = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var BLEConnectionUI = _classThis = class extends _classSuper {
        constructor() {
            super();
            // ── Dialog Panel (Yes/No Prompt) ────────────────────────────────────────────
            this.promptPanel = this.promptPanel;
            this.yesButton = this.yesButton;
            this.noButton = this.noButton;
            // ── Scanning Panel ──────────────────────────────────────────────────────────
            this.scanningPanel = this.scanningPanel;
            this.scanningText = this.scanningText;
            // ── Device List Panel ───────────────────────────────────────────────────────
            this.deviceListPanel = this.deviceListPanel;
            this.deviceButtonsContainer = this.deviceButtonsContainer;
            this.deviceButtonPrefab = this.deviceButtonPrefab;
            this.rescanButton = this.rescanButton;
            // ── References ──────────────────────────────────────────────────────────────
            this.heartRateTracker = this.heartRateTracker;
            this.heartRateHUD = this.heartRateHUD;
            /** Skip button - allows user to skip BLE and continue */
            this.skipButton = this.skipButton;
            this.debugPrint = this.debugPrint;
            // ── Internal State ──────────────────────────────────────────────────────────
            this.onCompleteCallback = null;
            this._state = BLEUIState.HIDDEN;
            this.deviceButtons = [];
            this.connectionRetries = 0;
            this.MAX_RETRIES = 3;
            this.connectionListenerRegistered = false;
        }
        __initialize() {
            super.__initialize();
            // ── Dialog Panel (Yes/No Prompt) ────────────────────────────────────────────
            this.promptPanel = this.promptPanel;
            this.yesButton = this.yesButton;
            this.noButton = this.noButton;
            // ── Scanning Panel ──────────────────────────────────────────────────────────
            this.scanningPanel = this.scanningPanel;
            this.scanningText = this.scanningText;
            // ── Device List Panel ───────────────────────────────────────────────────────
            this.deviceListPanel = this.deviceListPanel;
            this.deviceButtonsContainer = this.deviceButtonsContainer;
            this.deviceButtonPrefab = this.deviceButtonPrefab;
            this.rescanButton = this.rescanButton;
            // ── References ──────────────────────────────────────────────────────────────
            this.heartRateTracker = this.heartRateTracker;
            this.heartRateHUD = this.heartRateHUD;
            /** Skip button - allows user to skip BLE and continue */
            this.skipButton = this.skipButton;
            this.debugPrint = this.debugPrint;
            // ── Internal State ──────────────────────────────────────────────────────────
            this.onCompleteCallback = null;
            this._state = BLEUIState.HIDDEN;
            this.deviceButtons = [];
            this.connectionRetries = 0;
            this.MAX_RETRIES = 3;
            this.connectionListenerRegistered = false;
        }
        onAwake() {
            // CRITICAL: Disable panels IMMEDIATELY before any UI kit initialization
            // This prevents ScrollWindow from initializing before scroller is created
            if (this.deviceListPanel)
                this.deviceListPanel.enabled = false;
            if (this.scanningPanel)
                this.scanningPanel.enabled = false;
            if (this.promptPanel)
                this.promptPanel.enabled = false;
            this.log('BLEConnectionUI initialized');
            this.hideAll();
            // Delay button setup to OnStartEvent - SIK components need time to initialize
            this.createEvent('OnStartEvent').bind(() => {
                this.setupButtonCallbacks();
            });
        }
        setupButtonCallbacks() {
            this.log('Setting up button callbacks...');
            // Yes button
            if (this.yesButton) {
                var yes = this.yesButton;
                this.log('Yes button found, onTriggerUp: ' + (yes.onTriggerUp ? 'exists' : 'undefined'));
                if (yes.onTriggerUp && yes.onTriggerUp.add) {
                    yes.onTriggerUp.add(() => this.onYesPressed());
                    this.log('Yes button callback bound');
                }
                else if (yes.onButtonPinched) {
                    // Alternative: some buttons use onButtonPinched
                    yes.onButtonPinched.add(() => this.onYesPressed());
                    this.log('Yes button callback bound (onButtonPinched)');
                }
            }
            else {
                this.log('WARNING: yesButton not linked');
            }
            // No button
            if (this.noButton) {
                var no = this.noButton;
                this.log('No button found, onTriggerUp: ' + (no.onTriggerUp ? 'exists' : 'undefined'));
                if (no.onTriggerUp && no.onTriggerUp.add) {
                    no.onTriggerUp.add(() => this.onNoPressed());
                    this.log('No button callback bound');
                }
                else if (no.onButtonPinched) {
                    no.onButtonPinched.add(() => this.onNoPressed());
                    this.log('No button callback bound (onButtonPinched)');
                }
            }
            else {
                this.log('WARNING: noButton not linked');
            }
            // Rescan button
            if (this.rescanButton) {
                var rescan = this.rescanButton;
                if (rescan.onTriggerUp && rescan.onTriggerUp.add) {
                    rescan.onTriggerUp.add(() => this.startScanning());
                    this.log('Rescan button callback bound');
                }
                else if (rescan.onButtonPinched) {
                    rescan.onButtonPinched.add(() => this.startScanning());
                }
            }
            // Skip button - allows skipping BLE connection
            if (this.skipButton) {
                var skip = this.skipButton;
                if (skip.onTriggerUp && skip.onTriggerUp.add) {
                    skip.onTriggerUp.add(() => this.onSkipPressed());
                    this.log('Skip button callback bound');
                }
                else if (skip.onButtonPinched) {
                    skip.onButtonPinched.add(() => this.onSkipPressed());
                }
            }
            // Register connection state listener ONCE
            this.registerConnectionListener();
        }
        registerConnectionListener() {
            if (this.connectionListenerRegistered)
                return;
            this.heartRateTracker.onConnectionStateChange((state, msg) => {
                this.handleConnectionStateChange(state, msg);
            });
            this.connectionListenerRegistered = true;
            this.log('Connection listener registered');
        }
        handleConnectionStateChange(state, msg) {
            if (this._state !== BLEUIState.CONNECTING)
                return;
            if (state === HeartRateTracker_1.HRConnectionState.CONNECTED) {
                this.log('Connected successfully');
                this.connectionRetries = 0;
                this.setState(BLEUIState.CONNECTED);
                if (this.onCompleteCallback) {
                    this.onCompleteCallback(true);
                }
            }
            else if (state === HeartRateTracker_1.HRConnectionState.ERROR) {
                this.connectionRetries++;
                this.log('Connection failed (attempt ' + this.connectionRetries + '/' + this.MAX_RETRIES + '): ' + msg);
                if (this.connectionRetries >= this.MAX_RETRIES) {
                    this.log('Max retries reached - skipping HR');
                    // Auto-skip after max retries
                    this.onSkipPressed();
                    return;
                }
                else {
                    // Go back to device list for retry
                    this.setState(BLEUIState.DEVICE_LIST);
                }
            }
        }
        onSkipPressed() {
            this.log('User pressed SKIP - continuing without HR');
            // Disable HR HUD
            if (this.heartRateHUD) {
                this.heartRateHUD.enabled = false;
            }
            this.setState(BLEUIState.DISABLED);
            if (this.onCompleteCallback) {
                this.onCompleteCallback(false);
            }
        }
        // ── Public API ──────────────────────────────────────────────────────────────
        show(onComplete) {
            this.log('Showing BLE connection dialog');
            this.onCompleteCallback = onComplete;
            this.setState(BLEUIState.PROMPT);
        }
        hide() {
            this.setState(BLEUIState.HIDDEN);
        }
        get state() {
            return this._state;
        }
        // ── State Management ────────────────────────────────────────────────────────
        setState(state) {
            this._state = state;
            this.log('State: ' + state);
            this.hideAll();
            switch (state) {
                case BLEUIState.PROMPT:
                    if (this.promptPanel)
                        this.promptPanel.enabled = true;
                    break;
                case BLEUIState.SCANNING:
                    if (this.scanningPanel) {
                        this.scanningPanel.enabled = true;
                        if (this.scanningText) {
                            this.scanningText.text = 'Scanning for HR monitors...';
                        }
                    }
                    break;
                case BLEUIState.DEVICE_LIST:
                    if (this.deviceListPanel) {
                        this.deviceListPanel.enabled = true;
                        this.populateDeviceList();
                    }
                    break;
                case BLEUIState.CONNECTING:
                    if (this.scanningPanel) {
                        this.scanningPanel.enabled = true;
                        if (this.scanningText) {
                            this.scanningText.text = 'Connecting...';
                        }
                    }
                    break;
                case BLEUIState.CONNECTED:
                case BLEUIState.DISABLED:
                case BLEUIState.HIDDEN:
                    // All panels hidden
                    break;
            }
        }
        hideAll() {
            if (this.promptPanel)
                this.promptPanel.enabled = false;
            if (this.scanningPanel)
                this.scanningPanel.enabled = false;
            if (this.deviceListPanel)
                this.deviceListPanel.enabled = false;
        }
        // ── Button Handlers ─────────────────────────────────────────────────────────
        onYesPressed() {
            this.log('User pressed YES - starting scan');
            this.startScanning();
        }
        onNoPressed() {
            this.log('User pressed NO - disabling HR');
            // Disable entire HR HUD
            if (this.heartRateHUD) {
                this.heartRateHUD.enabled = false;
            }
            this.setState(BLEUIState.DISABLED);
            if (this.onCompleteCallback) {
                this.onCompleteCallback(false);
            }
        }
        // ── Scanning ────────────────────────────────────────────────────────────────
        startScanning() {
            this.setState(BLEUIState.SCANNING);
            this.connectionRetries = 0; // Reset retry counter
            // Set callback for when scan completes
            this.heartRateTracker.setScanCompleteCallback(() => {
                this.onScanComplete();
            });
            // Start the scan
            this.heartRateTracker.startScan();
        }
        onScanComplete() {
            var devices = this.heartRateTracker.getFoundDevices();
            this.log('Scan complete. Found ' + devices.length + ' devices');
            if (devices.length === 0) {
                // No devices found
                this.setState(BLEUIState.SCANNING);
                if (this.scanningText) {
                    this.scanningText.text = 'No HR monitors found.\nPinch to rescan.';
                }
            }
            else {
                this.setState(BLEUIState.DEVICE_LIST);
            }
        }
        // ── Device List ─────────────────────────────────────────────────────────────
        populateDeviceList() {
            this.clearDeviceButtons();
            var devices = this.heartRateTracker.getFoundDevices();
            this.log('Populating device list: ' + devices.length + ' devices');
            if (!this.deviceButtonPrefab || !this.deviceButtonsContainer) {
                this.log('WARNING: deviceButtonPrefab or deviceButtonsContainer not set');
                // Fallback: if no prefab, auto-connect to first device
                if (devices.length > 0) {
                    this.onDeviceSelected(devices[0].address);
                }
                return;
            }
            for (var i = 0; i < devices.length; i++) {
                var device = devices[i];
                var btn = this.deviceButtonPrefab.instantiate(this.deviceButtonsContainer);
                btn.enabled = true;
                // Set button text if Text component exists
                var textComp = btn.getComponent('Text');
                if (textComp) {
                    textComp.text = device.name;
                }
                // Look for text in children
                for (var c = 0; c < btn.getChildrenCount(); c++) {
                    var child = btn.getChild(c);
                    var childText = child.getComponent('Text');
                    if (childText) {
                        childText.text = device.name;
                        break;
                    }
                }
                // Set button callback
                var buttonComp = btn.getComponent('ScriptComponent');
                if (buttonComp && buttonComp.onTriggerUp) {
                    var address = device.address;
                    buttonComp.onTriggerUp.add(() => this.onDeviceSelected(address));
                }
                this.deviceButtons.push(btn);
            }
        }
        clearDeviceButtons() {
            for (var i = 0; i < this.deviceButtons.length; i++) {
                var btn = this.deviceButtons[i];
                if (!isNull(btn)) {
                    // Disable before destroy to prevent hover callbacks
                    btn.enabled = false;
                    btn.destroy();
                }
            }
            this.deviceButtons = [];
        }
        onDeviceSelected(address) {
            this.log('Device selected');
            this.setState(BLEUIState.CONNECTING);
            // Connection state is handled by handleConnectionStateChange (registered once)
            // Initiate connection
            this.heartRateTracker.connectToDeviceByAddress(address);
        }
        // ── Logging ─────────────────────────────────────────────────────────────────
        log(msg) {
            if (this.debugPrint) {
                print('[BLEConnectionUI] ' + msg);
            }
        }
    };
    __setFunctionName(_classThis, "BLEConnectionUI");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        BLEConnectionUI = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return BLEConnectionUI = _classThis;
})();
exports.BLEConnectionUI = BLEConnectionUI;
//# sourceMappingURL=BLEConnectionUI.js.map