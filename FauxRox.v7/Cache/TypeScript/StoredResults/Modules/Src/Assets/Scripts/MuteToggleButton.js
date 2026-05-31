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
exports.MuteToggleButton = void 0;
var __selfType = requireType("./MuteToggleButton");
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
let MuteToggleButton = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var MuteToggleButton = _classThis = class extends _classSuper {
        constructor() {
            super();
            this.aiCoach = this.aiCoach;
            // Single image that will swap textures
            this.speakerIcon = this.speakerIcon;
            this.speakerOnTexture = this.speakerOnTexture; // Speaker with sound waves (unmuted)
            this.speakerOffTexture = this.speakerOffTexture; // Speaker with X/line (muted)
            this.roundButton = null;
            this.initialized = false;
        }
        __initialize() {
            super.__initialize();
            this.aiCoach = this.aiCoach;
            // Single image that will swap textures
            this.speakerIcon = this.speakerIcon;
            this.speakerOnTexture = this.speakerOnTexture; // Speaker with sound waves (unmuted)
            this.speakerOffTexture = this.speakerOffTexture; // Speaker with X/line (muted)
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
                print('[MuteToggleButton] Connected to RoundButton');
            }
            else {
                print('[MuteToggleButton] WARNING: RoundButton not found on this object');
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
            // Initial state: NOT muted (audio on), show speaker ON icon
            print('[MuteToggleButton] Initializing - audio ON by default');
            this.setIconTexture(false); // false = not muted = show speakerOn
        }
        onButtonPressed() {
            if (!this.aiCoach) {
                print('[MuteToggleButton] AICoach not connected');
                return;
            }
            // Toggle mute
            this.aiCoach.toggleMute();
            // Get new state and update icon
            const isMuted = this.aiCoach.isMuted;
            this.setIconTexture(isMuted);
            print('[MuteToggleButton] Mute: ' + (isMuted ? 'ON (silent)' : 'OFF (audio)'));
        }
        setIconTexture(isMuted) {
            if (!this.speakerIcon) {
                print('[MuteToggleButton] ERROR: speakerIcon not assigned');
                return;
            }
            // When muted: show OFF icon (speaker with X)
            // When not muted: show ON icon (speaker with waves)
            const texture = isMuted ? this.speakerOffTexture : this.speakerOnTexture;
            if (!texture) {
                print('[MuteToggleButton] ERROR: ' + (isMuted ? 'speakerOffTexture' : 'speakerOnTexture') + ' not assigned');
                return;
            }
            // Swap the texture on the Image component
            this.speakerIcon.mainPass.baseTex = texture;
            print('[MuteToggleButton] Icon texture set to: ' + (isMuted ? 'MUTED (off)' : 'UNMUTED (on)'));
        }
    };
    __setFunctionName(_classThis, "MuteToggleButton");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MuteToggleButton = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MuteToggleButton = _classThis;
})();
exports.MuteToggleButton = MuteToggleButton;
//# sourceMappingURL=MuteToggleButton.js.map