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
exports.OnboardingUI = exports.OnboardingState = void 0;
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
var OnboardingState;
(function (OnboardingState) {
    OnboardingState["HIDDEN"] = "HIDDEN";
    OnboardingState["WELCOME"] = "WELCOME";
    OnboardingState["BIRTH_YEAR"] = "BIRTH_YEAR";
    OnboardingState["FITNESS_LEVEL"] = "FITNESS_LEVEL";
    OnboardingState["GOAL"] = "GOAL";
    OnboardingState["CONFIRM"] = "CONFIRM";
    OnboardingState["COMPLETE"] = "COMPLETE";
})(OnboardingState || (exports.OnboardingState = OnboardingState = {}));
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
            /** Frame - parent container for entire Onboarding UI (has Frame.ts) */
            this.frame = this.frame;
            // ── Welcome Step ────────────────────────────────────────────────────────
            this.welcomePanel = this.welcomePanel;
            this.welcomeNameText = this.welcomeNameText;
            this.confirmNameButton = this.confirmNameButton;
            this.guestButton = this.guestButton;
            // ── Birth Year Step ─────────────────────────────────────────────────────
            this.birthYearPanel = this.birthYearPanel;
            this.birthYearText = this.birthYearText;
            this.yearMinusButton = this.yearMinusButton;
            this.yearPlusButton = this.yearPlusButton;
            this.decade70sButton = this.decade70sButton;
            this.decade80sButton = this.decade80sButton;
            this.decade90sButton = this.decade90sButton;
            this.decade00sButton = this.decade00sButton;
            this.birthYearNextButton = this.birthYearNextButton;
            this.birthYearSkipButton = this.birthYearSkipButton;
            // ── Fitness Level Step ──────────────────────────────────────────────────
            this.fitnessPanel = this.fitnessPanel;
            this.beginnerButton = this.beginnerButton;
            this.regularButton = this.regularButton;
            this.athleteButton = this.athleteButton;
            // ── Goal Step ───────────────────────────────────────────────────────────
            this.goalPanel = this.goalPanel;
            this.finishStrongButton = this.finishStrongButton;
            this.beatPBButton = this.beatPBButton;
            this.maxEffortButton = this.maxEffortButton;
            this.pacingButton = this.pacingButton;
            // ── Confirm Step ────────────────────────────────────────────────────────
            this.confirmPanel = this.confirmPanel;
            this.confirmSummaryText = this.confirmSummaryText;
            this.letsGoButton = this.letsGoButton;
            // ── Settings ────────────────────────────────────────────────────────────
            this.debugPrint = this.debugPrint;
            this.defaultBirthYear = this.defaultBirthYear;
            // ── State ───────────────────────────────────────────────────────────────
            this._state = OnboardingState.HIDDEN;
            // Collected data
            this._displayName = 'Athlete';
            this._birthYear = 1990;
            this._birthYearSkipped = false;
            this._fitnessLevel = 'regular';
            this._goal = 'finish_strong';
            this._isGuest = false;
            // ── Callback ────────────────────────────────────────────────────────────
            this.onCompleteCallback = null;
        }
        __initialize() {
            super.__initialize();
            // ── References ──────────────────────────────────────────────────────────
            this.profileManager = this.profileManager;
            /** Frame - parent container for entire Onboarding UI (has Frame.ts) */
            this.frame = this.frame;
            // ── Welcome Step ────────────────────────────────────────────────────────
            this.welcomePanel = this.welcomePanel;
            this.welcomeNameText = this.welcomeNameText;
            this.confirmNameButton = this.confirmNameButton;
            this.guestButton = this.guestButton;
            // ── Birth Year Step ─────────────────────────────────────────────────────
            this.birthYearPanel = this.birthYearPanel;
            this.birthYearText = this.birthYearText;
            this.yearMinusButton = this.yearMinusButton;
            this.yearPlusButton = this.yearPlusButton;
            this.decade70sButton = this.decade70sButton;
            this.decade80sButton = this.decade80sButton;
            this.decade90sButton = this.decade90sButton;
            this.decade00sButton = this.decade00sButton;
            this.birthYearNextButton = this.birthYearNextButton;
            this.birthYearSkipButton = this.birthYearSkipButton;
            // ── Fitness Level Step ──────────────────────────────────────────────────
            this.fitnessPanel = this.fitnessPanel;
            this.beginnerButton = this.beginnerButton;
            this.regularButton = this.regularButton;
            this.athleteButton = this.athleteButton;
            // ── Goal Step ───────────────────────────────────────────────────────────
            this.goalPanel = this.goalPanel;
            this.finishStrongButton = this.finishStrongButton;
            this.beatPBButton = this.beatPBButton;
            this.maxEffortButton = this.maxEffortButton;
            this.pacingButton = this.pacingButton;
            // ── Confirm Step ────────────────────────────────────────────────────────
            this.confirmPanel = this.confirmPanel;
            this.confirmSummaryText = this.confirmSummaryText;
            this.letsGoButton = this.letsGoButton;
            // ── Settings ────────────────────────────────────────────────────────────
            this.debugPrint = this.debugPrint;
            this.defaultBirthYear = this.defaultBirthYear;
            // ── State ───────────────────────────────────────────────────────────────
            this._state = OnboardingState.HIDDEN;
            // Collected data
            this._displayName = 'Athlete';
            this._birthYear = 1990;
            this._birthYearSkipped = false;
            this._fitnessLevel = 'regular';
            this._goal = 'finish_strong';
            this._isGuest = false;
            // ── Callback ────────────────────────────────────────────────────────────
            this.onCompleteCallback = null;
        }
        // ── Lifecycle ───────────────────────────────────────────────────────────
        onAwake() {
            this._birthYear = this.defaultBirthYear;
            // CRITICAL: Disable panels IMMEDIATELY before any UI kit initialization
            if (this.frame)
                this.frame.enabled = false;
            if (this.welcomePanel)
                this.welcomePanel.enabled = false;
            if (this.birthYearPanel)
                this.birthYearPanel.enabled = false;
            if (this.fitnessPanel)
                this.fitnessPanel.enabled = false;
            if (this.goalPanel)
                this.goalPanel.enabled = false;
            if (this.confirmPanel)
                this.confirmPanel.enabled = false;
            this.log('OnboardingUI initialized');
            this.hideAll();
            // Delay button setup to OnStartEvent - SIK components need time to initialize
            this.createEvent('OnStartEvent').bind(() => {
                this.setupButtonCallbacks();
            });
        }
        setupButtonCallbacks() {
            this.log('Setting up button callbacks...');
            // Welcome step
            this.bindButton(this.confirmNameButton, () => this.onConfirmName());
            this.bindButton(this.guestButton, () => this.onContinueAsGuest());
            // Birth year step
            this.bindButton(this.yearMinusButton, () => this.onYearMinus());
            this.bindButton(this.yearPlusButton, () => this.onYearPlus());
            this.bindButton(this.decade70sButton, () => this.onDecade(1970));
            this.bindButton(this.decade80sButton, () => this.onDecade(1980));
            this.bindButton(this.decade90sButton, () => this.onDecade(1990));
            this.bindButton(this.decade00sButton, () => this.onDecade(2000));
            this.bindButton(this.birthYearNextButton, () => this.onBirthYearNext());
            this.bindButton(this.birthYearSkipButton, () => this.onBirthYearSkip());
            // Fitness level step
            this.bindButton(this.beginnerButton, () => this.onSelectFitness('beginner'));
            this.bindButton(this.regularButton, () => this.onSelectFitness('regular'));
            this.bindButton(this.athleteButton, () => this.onSelectFitness('athlete'));
            // Goal step
            this.bindButton(this.finishStrongButton, () => this.onSelectGoal('finish_strong'));
            this.bindButton(this.beatPBButton, () => this.onSelectGoal('beat_pb'));
            this.bindButton(this.maxEffortButton, () => this.onSelectGoal('max_effort'));
            this.bindButton(this.pacingButton, () => this.onSelectGoal('pacing'));
            // Confirm step
            this.bindButton(this.letsGoButton, () => this.onLetsGo());
            this.log('All buttons bound');
        }
        bindButton(buttonComp, callback) {
            if (!buttonComp)
                return;
            var btn = buttonComp;
            if (btn.onTriggerUp && btn.onTriggerUp.add) {
                btn.onTriggerUp.add(callback);
                this.log('Button bound: ' + buttonComp.getSceneObject().name);
            }
            else if (btn.onButtonPinched && btn.onButtonPinched.add) {
                btn.onButtonPinched.add(callback);
                this.log('Button bound (onButtonPinched): ' + buttonComp.getSceneObject().name);
            }
        }
        // ── Public API ──────────────────────────────────────────────────────────
        /**
         * Show onboarding flow (start from welcome)
         */
        show(snapUserName, onComplete) {
            if (this._state !== OnboardingState.HIDDEN) {
                this.log('Already showing onboarding');
                return;
            }
            this.onCompleteCallback = onComplete;
            // Set display name from Snap user if provided
            if (snapUserName && snapUserName.length > 0) {
                this._displayName = snapUserName;
            }
            this.log('Starting onboarding for: ' + this._displayName);
            this.setState(OnboardingState.WELCOME);
        }
        /**
         * Hide onboarding (cancel or complete)
         */
        hide() {
            this.setState(OnboardingState.HIDDEN);
        }
        /**
         * Get current state
         */
        get state() {
            return this._state;
        }
        /**
         * Check if onboarding is visible
         */
        get isVisible() {
            return this._state !== OnboardingState.HIDDEN && this._state !== OnboardingState.COMPLETE;
        }
        // ── State Management ────────────────────────────────────────────────────
        setState(state) {
            this._state = state;
            this.log('State: ' + state);
            this.hideAll();
            switch (state) {
                case OnboardingState.WELCOME:
                    if (this.frame)
                        this.frame.enabled = true;
                    if (this.welcomePanel)
                        this.welcomePanel.enabled = true;
                    this.updateWelcomeUI();
                    break;
                case OnboardingState.BIRTH_YEAR:
                    if (this.birthYearPanel)
                        this.birthYearPanel.enabled = true;
                    this.updateBirthYearUI();
                    break;
                case OnboardingState.FITNESS_LEVEL:
                    if (this.fitnessPanel)
                        this.fitnessPanel.enabled = true;
                    break;
                case OnboardingState.GOAL:
                    if (this.goalPanel)
                        this.goalPanel.enabled = true;
                    break;
                case OnboardingState.CONFIRM:
                    if (this.confirmPanel)
                        this.confirmPanel.enabled = true;
                    this.updateConfirmUI();
                    break;
                case OnboardingState.COMPLETE:
                    this.completeOnboarding();
                    if (this.frame)
                        this.frame.enabled = false;
                    break;
                case OnboardingState.HIDDEN:
                    if (this.frame)
                        this.frame.enabled = false;
                    break;
            }
        }
        hideAll() {
            if (this.welcomePanel)
                this.welcomePanel.enabled = false;
            if (this.birthYearPanel)
                this.birthYearPanel.enabled = false;
            if (this.fitnessPanel)
                this.fitnessPanel.enabled = false;
            if (this.goalPanel)
                this.goalPanel.enabled = false;
            if (this.confirmPanel)
                this.confirmPanel.enabled = false;
        }
        // ── Welcome Step ────────────────────────────────────────────────────────
        updateWelcomeUI() {
            if (this.welcomeNameText) {
                this.welcomeNameText.text = "I'm " + this._displayName;
            }
        }
        onConfirmName() {
            this._isGuest = false;
            this.log('Name confirmed: ' + this._displayName);
            this.setState(OnboardingState.BIRTH_YEAR);
        }
        onContinueAsGuest() {
            this._isGuest = true;
            this._displayName = 'Guest';
            this.log('Continuing as guest');
            // Skip all personalization for guest
            this._birthYearSkipped = true;
            this._fitnessLevel = 'regular';
            this._goal = 'finish_strong';
            this.setState(OnboardingState.COMPLETE);
        }
        // ── Birth Year Step ─────────────────────────────────────────────────────
        updateBirthYearUI() {
            if (this.birthYearText) {
                this.birthYearText.text = this._birthYear.toString();
            }
        }
        onYearMinus() {
            this._birthYear = Math.max(1920, this._birthYear - 1);
            this.updateBirthYearUI();
        }
        onYearPlus() {
            this._birthYear = Math.min(2015, this._birthYear + 1);
            this.updateBirthYearUI();
        }
        onDecade(decade) {
            // Set to middle of decade
            this._birthYear = decade + 5;
            this.updateBirthYearUI();
        }
        onBirthYearNext() {
            this._birthYearSkipped = false;
            this.log('Birth year: ' + this._birthYear);
            this.setState(OnboardingState.FITNESS_LEVEL);
        }
        onBirthYearSkip() {
            this._birthYearSkipped = true;
            this.log('Birth year skipped');
            this.setState(OnboardingState.FITNESS_LEVEL);
        }
        // ── Fitness Level Step ──────────────────────────────────────────────────
        onSelectFitness(level) {
            this._fitnessLevel = level;
            this.log('Fitness level: ' + level);
            this.setState(OnboardingState.GOAL);
        }
        // ── Goal Step ───────────────────────────────────────────────────────────
        onSelectGoal(goal) {
            this._goal = goal;
            this.log('Goal: ' + goal);
            this.setState(OnboardingState.CONFIRM);
        }
        // ── Confirm Step ────────────────────────────────────────────────────────
        updateConfirmUI() {
            if (!this.confirmSummaryText)
                return;
            var fitnessLabels = {
                'beginner': 'Beginner',
                'regular': 'Regular',
                'athlete': 'Athlete',
            };
            var goalLabels = {
                'finish_strong': 'Finish Strong',
                'beat_pb': 'Beat My PB',
                'max_effort': 'Max Effort',
                'pacing': 'Pacing Practice',
            };
            var summary = this._displayName + '\n';
            if (!this._birthYearSkipped) {
                var age = new Date().getFullYear() - this._birthYear;
                summary += 'Age: ' + age + '\n';
            }
            summary += 'Level: ' + fitnessLabels[this._fitnessLevel] + '\n';
            summary += 'Goal: ' + goalLabels[this._goal];
            this.confirmSummaryText.text = summary;
        }
        onLetsGo() {
            this.log('Onboarding confirmed');
            this.setState(OnboardingState.COMPLETE);
        }
        // ── Completion ──────────────────────────────────────────────────────────
        completeOnboarding() {
            // Save profile via ProfileManager
            if (this.profileManager) {
                var birthYear = this._birthYearSkipped ? null : this._birthYear;
                var profile = this.profileManager.createProfile(this._displayName, birthYear, this._fitnessLevel, this._goal, this._isGuest, null // odizUserId - will be set by CloudManager auth
                );
                this.log('Profile saved');
                // Notify callback
                if (this.onCompleteCallback) {
                    this.onCompleteCallback(profile);
                }
            }
            else {
                this.log('WARNING: ProfileManager not assigned');
                // Still call callback
                if (this.onCompleteCallback) {
                    this.onCompleteCallback(null);
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