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
exports.CoachToggleButton = void 0;
var __selfType = requireType("./CoachToggleButton");
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
let CoachToggleButton = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var CoachToggleButton = _classThis = class extends _classSuper {
        constructor() {
            super();
            this.aiCoach = this.aiCoach;
            // Single image that will swap textures
            this.micIcon = this.micIcon;
            this.micOnTexture = this.micOnTexture; // Green mic texture
            this.micOffTexture = this.micOffTexture; // Grey mic texture
            // Mute button - only visible when coach is ON
            this.muteButton = this.muteButton;
            this.roundButton = null;
            this.initialized = false;
        }
        __initialize() {
            super.__initialize();
            this.aiCoach = this.aiCoach;
            // Single image that will swap textures
            this.micIcon = this.micIcon;
            this.micOnTexture = this.micOnTexture; // Green mic texture
            this.micOffTexture = this.micOffTexture; // Grey mic texture
            // Mute button - only visible when coach is ON
            this.muteButton = this.muteButton;
            this.roundButton = null;
            this.initialized = false;
        }
        onAwake() {
            // Find RoundButton on the same object
            const components = this.getSceneObject().getComponents('ScriptComponent');
            for (let i = 0; i < components.length; i++) {
                const comp = components[i];
                // Check if it's a RoundButton (has onTriggerUp event)
                if (comp.onTriggerUp && comp !== this) {
                    this.roundButton = comp;
                    break;
                }
            }
            if (this.roundButton) {
                this.roundButton.onTriggerUp.add(() => {
                    this.onButtonPressed();
                });
                print('[CoachToggleButton] Connected to RoundButton');
            }
            else {
                print('[CoachToggleButton] WARNING: RoundButton not found on this object');
            }
            // Initial state will be set when parent becomes enabled
            this.createEvent('OnStartEvent').bind(() => {
                this.initializeIcon();
            });
        }
        initializeIcon() {
            if (this.initialized)
                return;
            this.initialized = true;
            // Initial state: toggle is OFF, show grey mic, hide mute button
            print('[CoachToggleButton] Initializing - toggle OFF by default');
            this.setIconTexture(false);
            this.setMuteButtonVisible(false);
        }
        onButtonPressed() {
            if (!this.aiCoach) {
                print('[CoachToggleButton] AICoach not connected');
                return;
            }
            // Toggle the coach
            this.aiCoach.toggleCoach();
            // Get new state and update icon
            const isOn = this.aiCoach.isToggleOn;
            this.setIconTexture(isOn);
            this.setMuteButtonVisible(isOn);
            print('[CoachToggleButton] Toggle: ' + (isOn ? 'ON' : 'OFF'));
        }
        setIconTexture(isOn) {
            if (!this.micIcon) {
                print('[CoachToggleButton] ERROR: micIcon not assigned');
                return;
            }
            const texture = isOn ? this.micOnTexture : this.micOffTexture;
            if (!texture) {
                print('[CoachToggleButton] ERROR: ' + (isOn ? 'micOnTexture' : 'micOffTexture') + ' not assigned');
                return;
            }
            // Swap the texture on the Image component
            this.micIcon.mainPass.baseTex = texture;
            print('[CoachToggleButton] Icon texture set to: ' + (isOn ? 'ON (green)' : 'OFF (grey)'));
        }
        setMuteButtonVisible(visible) {
            if (!isNull(this.muteButton)) {
                this.muteButton.enabled = visible;
                print('[CoachToggleButton] Mute button: ' + (visible ? 'VISIBLE' : 'HIDDEN'));
            }
        }
    };
    __setFunctionName(_classThis, "CoachToggleButton");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CoachToggleButton = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CoachToggleButton = _classThis;
})();
exports.CoachToggleButton = CoachToggleButton;
//# sourceMappingURL=CoachToggleButton.js.map