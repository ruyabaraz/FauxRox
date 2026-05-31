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
exports.OnboardingUI = void 0;
var __selfType = requireType("./OnboardingUI");
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
let OnboardingUI = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var OnboardingUI = _classThis = class extends _classSuper {
        constructor() {
            super();
            // ── References ──────────────────────────────────────────────────────────
            this.profileManager = this.profileManager;
            /** Frame - parent container for entire Onboarding UI */
            this.frame = this.frame;
            /** Main panel containing all UI elements */
            this.mainPanel = this.mainPanel;
            // ── Welcome ─────────────────────────────────────────────────────────────
            this.welcomeText = this.welcomeText;
            // ── Name Input ──────────────────────────────────────────────────────────
            this.nameInputField = this.nameInputField;
            // ── Birth Year ──────────────────────────────────────────────────────────
            this.birthYearText = this.birthYearText;
            this.yearMinusButton = this.yearMinusButton;
            this.yearPlusButton = this.yearPlusButton;
            // ── Fitness Level ───────────────────────────────────────────────────────
            this.beginnerButton = this.beginnerButton;
            this.intermediateButton = this.intermediateButton;
            this.advancedButton = this.advancedButton;
            // ── Goal ────────────────────────────────────────────────────────────────
            this.finishStrongButton = this.finishStrongButton;
            this.beatPBButton = this.beatPBButton;
            this.maxEffortButton = this.maxEffortButton;
            this.pacingButton = this.pacingButton;
            // ── Actions ─────────────────────────────────────────────────────────────
            this.confirmButton = this.confirmButton;
            this.guestButton = this.guestButton;
            // ── Settings ────────────────────────────────────────────────────────────
            this.debugPrint = this.debugPrint;
            this.defaultBirthYear = this.defaultBirthYear;
            // ── State ───────────────────────────────────────────────────────────────
            this._isVisible = false;
            this._displayName = 'Athlete';
            this._birthYear = 1990;
            this._fitnessLevel = 'regular';
            this._goal = 'finish_strong';
            this.onCompleteCallback = null;
        }
        __initialize() {
            super.__initialize();
            // ── References ──────────────────────────────────────────────────────────
            this.profileManager = this.profileManager;
            /** Frame - parent container for entire Onboarding UI */
            this.frame = this.frame;
            /** Main panel containing all UI elements */
            this.mainPanel = this.mainPanel;
            // ── Welcome ─────────────────────────────────────────────────────────────
            this.welcomeText = this.welcomeText;
            // ── Name Input ──────────────────────────────────────────────────────────
            this.nameInputField = this.nameInputField;
            // ── Birth Year ──────────────────────────────────────────────────────────
            this.birthYearText = this.birthYearText;
            this.yearMinusButton = this.yearMinusButton;
            this.yearPlusButton = this.yearPlusButton;
            // ── Fitness Level ───────────────────────────────────────────────────────
            this.beginnerButton = this.beginnerButton;
            this.intermediateButton = this.intermediateButton;
            this.advancedButton = this.advancedButton;
            // ── Goal ────────────────────────────────────────────────────────────────
            this.finishStrongButton = this.finishStrongButton;
            this.beatPBButton = this.beatPBButton;
            this.maxEffortButton = this.maxEffortButton;
            this.pacingButton = this.pacingButton;
            // ── Actions ─────────────────────────────────────────────────────────────
            this.confirmButton = this.confirmButton;
            this.guestButton = this.guestButton;
            // ── Settings ────────────────────────────────────────────────────────────
            this.debugPrint = this.debugPrint;
            this.defaultBirthYear = this.defaultBirthYear;
            // ── State ───────────────────────────────────────────────────────────────
            this._isVisible = false;
            this._displayName = 'Athlete';
            this._birthYear = 1990;
            this._fitnessLevel = 'regular';
            this._goal = 'finish_strong';
            this.onCompleteCallback = null;
        }
        // ── Lifecycle ───────────────────────────────────────────────────────────
        onAwake() {
            this._birthYear = this.defaultBirthYear;
            // Hide immediately
            if (this.frame)
                this.frame.enabled = false;
            if (this.mainPanel)
                this.mainPanel.enabled = false;
            this.log('Initialized');
            // Setup buttons after SIK initializes
            this.createEvent('OnStartEvent').bind(() => {
                this.setupButtons();
            });
        }
        setupButtons() {
            // Bind name input text change
            this.bindNameInput();
            // Year controls
            this.bindButton(this.yearMinusButton, () => this.onYearMinus());
            this.bindButton(this.yearPlusButton, () => this.onYearPlus());
            // Fitness level (mutually exclusive)
            this.bindButton(this.beginnerButton, () => this.selectFitness('beginner'));
            this.bindButton(this.intermediateButton, () => this.selectFitness('regular'));
            this.bindButton(this.advancedButton, () => this.selectFitness('athlete'));
            // Goal (mutually exclusive)
            this.bindButton(this.finishStrongButton, () => this.selectGoal('finish_strong'));
            this.bindButton(this.beatPBButton, () => this.selectGoal('beat_pb'));
            this.bindButton(this.maxEffortButton, () => this.selectGoal('max_effort'));
            this.bindButton(this.pacingButton, () => this.selectGoal('pacing'));
            // Actions
            this.bindButton(this.confirmButton, () => this.onConfirm());
            this.bindButton(this.guestButton, () => this.onGuest());
            this.log('Buttons bound');
        }
        bindButton(btn, callback) {
            if (!btn)
                return;
            var b = btn;
            if (b.onTriggerUp && b.onTriggerUp.add) {
                b.onTriggerUp.add(callback);
            }
            else if (b.onButtonPinched && b.onButtonPinched.add) {
                b.onButtonPinched.add(callback);
            }
        }
        bindNameInput() {
            if (!this.nameInputField)
                return;
            var field = this.nameInputField;
            // Try different TextInputField event APIs
            if (field.onTextChanged && field.onTextChanged.add) {
                field.onTextChanged.add((newText) => {
                    this.updateWelcomeText(newText);
                });
                this.log('Name input bound via onTextChanged');
            }
            else if (field.onValueChanged && field.onValueChanged.add) {
                field.onValueChanged.add((newText) => {
                    this.updateWelcomeText(newText);
                });
                this.log('Name input bound via onValueChanged');
            }
        }
        updateWelcomeText(name) {
            if (!this.welcomeText)
                return;
            var displayName = (name && name.length > 0) ? name : 'Athlete';
            this.welcomeText.text = 'Welcome, ' + displayName;
        }
        // ── Public API ──────────────────────────────────────────────────────────
        show(snapUserName, onComplete) {
            this.onCompleteCallback = onComplete;
            // Load existing profile values if available, otherwise use defaults
            if (this.profileManager && this.profileManager.hasProfile()) {
                var existing = this.profileManager.getProfile();
                this._displayName = existing.displayName || snapUserName || 'Athlete';
                this._birthYear = existing.birthYear || this.defaultBirthYear;
                this._fitnessLevel = existing.fitnessLevel || 'regular';
                this._goal = existing.goal || 'finish_strong';
                this.log('Loaded existing profile values');
            }
            else {
                // First time - use defaults
                if (snapUserName && snapUserName.length > 0) {
                    this._displayName = snapUserName;
                }
                this._birthYear = this.defaultBirthYear;
                this._fitnessLevel = 'regular';
                this._goal = 'finish_strong';
            }
            // Show UI
            if (this.frame)
                this.frame.enabled = true;
            if (this.mainPanel)
                this.mainPanel.enabled = true;
            this._isVisible = true;
            this.updateUI();
            this.log('Showing onboarding for: ' + this._displayName);
        }
        hide() {
            if (this.frame)
                this.frame.enabled = false;
            if (this.mainPanel)
                this.mainPanel.enabled = false;
            this._isVisible = false;
        }
        get isVisible() {
            return this._isVisible;
        }
        // ── UI Updates ──────────────────────────────────────────────────────────
        updateUI() {
            if (this.birthYearText) {
                this.birthYearText.text = this._birthYear.toString();
            }
            // Name is handled by TextInputField directly
            if (this.nameInputField && this._displayName) {
                var field = this.nameInputField;
                if (field.text !== undefined) {
                    field.text = this._displayName;
                }
            }
            // Update button selection visuals
            this.updateFitnessButtonVisuals();
            this.updateGoalButtonVisuals();
        }
        /**
         * Get name from TextInputField
         */
        getNameFromInput() {
            if (this.nameInputField) {
                var field = this.nameInputField;
                if (field.text && field.text.length > 0) {
                    return field.text;
                }
            }
            return this._displayName || 'Athlete';
        }
        // ── Year Controls ───────────────────────────────────────────────────────
        onYearMinus() {
            this._birthYear = Math.max(1920, this._birthYear - 1);
            this.updateUI();
        }
        onYearPlus() {
            this._birthYear = Math.min(2015, this._birthYear + 1);
            this.updateUI();
        }
        // ── Selection ───────────────────────────────────────────────────────────
        selectFitness(level) {
            this._fitnessLevel = level;
            this.log('Fitness: ' + level);
            this.updateFitnessButtonVisuals();
        }
        selectGoal(goal) {
            this._goal = goal;
            this.log('Goal: ' + goal);
            this.updateGoalButtonVisuals();
        }
        // ── Button Visual Feedback ─────────────────────────────────────────────
        updateFitnessButtonVisuals() {
            this.setButtonSelected(this.beginnerButton, this._fitnessLevel === 'beginner');
            this.setButtonSelected(this.intermediateButton, this._fitnessLevel === 'regular');
            this.setButtonSelected(this.advancedButton, this._fitnessLevel === 'athlete');
        }
        updateGoalButtonVisuals() {
            this.setButtonSelected(this.finishStrongButton, this._goal === 'finish_strong');
            this.setButtonSelected(this.beatPBButton, this._goal === 'beat_pb');
            this.setButtonSelected(this.maxEffortButton, this._goal === 'max_effort');
            this.setButtonSelected(this.pacingButton, this._goal === 'pacing');
        }
        setButtonSelected(btn, selected) {
            if (!btn)
                return;
            var b = btn;
            // Try different SpectaclesUIKit APIs for selection state
            if (b.isSelected !== undefined) {
                b.isSelected = selected;
            }
            else if (b.selected !== undefined) {
                b.selected = selected;
            }
            else if (b.setSelected) {
                b.setSelected(selected);
            }
            // Fallback: try to change button icon/color via renderMeshVisual
            if (b.renderMeshVisual && b.renderMeshVisual.mainMaterial) {
                var mat = b.renderMeshVisual.mainMaterial;
                if (selected) {
                    mat.mainPass.baseColor = new vec4(0.3, 0.8, 0.3, 1.0); // Green highlight
                }
                else {
                    mat.mainPass.baseColor = new vec4(1.0, 1.0, 1.0, 1.0); // White default
                }
            }
        }
        // ── Actions ─────────────────────────────────────────────────────────────
        onConfirm() {
            var name = this.getNameFromInput();
            this.log('Confirmed: ' + name + ', ' + this._birthYear + ', ' + this._fitnessLevel + ', ' + this._goal);
            if (this.profileManager) {
                var profile = this.profileManager.createProfile(name, this._birthYear, this._fitnessLevel, this._goal, false, null);
                this.hide();
                if (this.onCompleteCallback) {
                    this.onCompleteCallback(profile);
                }
            }
        }
        onGuest() {
            this.log('Continue as guest');
            if (this.profileManager) {
                var profile = this.profileManager.createGuestProfile();
                this.hide();
                if (this.onCompleteCallback) {
                    this.onCompleteCallback(profile);
                }
            }
        }
        // ── Debug ───────────────────────────────────────────────────────────────
        log(msg) {
            if (this.debugPrint) {
                print('[OnboardingUI] ' + msg);
            }
        }
    };
    __setFunctionName(_classThis, "OnboardingUI");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        OnboardingUI = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return OnboardingUI = _classThis;
})();
exports.OnboardingUI = OnboardingUI;
//# sourceMappingURL=OnboardingUI.js.map