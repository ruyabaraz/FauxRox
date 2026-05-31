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
exports.ProfileManager = void 0;
var __selfType = requireType("./ProfileManager");
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
let ProfileManager = (() => {
    let _classDecorators = [component];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = BaseScriptComponent;
    var ProfileManager = _classThis = class extends _classSuper {
        constructor() {
            super();
            // ── Inspector Settings ──────────────────────────────────────────────────
            this.enableDebug = this.enableDebug;
            // ── State ───────────────────────────────────────────────────────────────
            this._profile = null;
            this._isInitialized = false;
            // ── Callbacks ───────────────────────────────────────────────────────────
            this._onProfileLoaded = [];
            this._onProfileSaved = [];
        }
        __initialize() {
            super.__initialize();
            // ── Inspector Settings ──────────────────────────────────────────────────
            this.enableDebug = this.enableDebug;
            // ── State ───────────────────────────────────────────────────────────────
            this._profile = null;
            this._isInitialized = false;
            // ── Callbacks ───────────────────────────────────────────────────────────
            this._onProfileLoaded = [];
            this._onProfileSaved = [];
        }
        static getInstance() {
            return ProfileManager._instance;
        }
        // ── Lifecycle ───────────────────────────────────────────────────────────
        onAwake() {
            if (ProfileManager._instance !== null && ProfileManager._instance !== this) {
                this.log('WARNING: ProfileManager already exists, destroying duplicate');
                this.getSceneObject().destroy();
                return;
            }
            ProfileManager._instance = this;
            this.loadFromStorage();
            this._isInitialized = true;
            this.log('Initialized');
        }
        // ── Public API: Profile State ───────────────────────────────────────────
        /**
         * Check if user has completed onboarding (has a stored profile)
         */
        hasProfile() {
            return this._profile !== null;
        }
        /**
         * Check if user is in guest mode
         */
        isGuest() {
            return this._profile?.isGuest ?? true;
        }
        /**
         * Get current profile (may be null if not onboarded)
         */
        getProfile() {
            return this._profile;
        }
        /**
         * Get display name or default
         */
        getDisplayName() {
            return this._profile?.displayName ?? 'Athlete';
        }
        /**
         * Get fitness level or default
         */
        getFitnessLevel() {
            return this._profile?.fitnessLevel ?? 'regular';
        }
        /**
         * Get goal or default
         */
        getGoal() {
            return this._profile?.goal ?? 'finish_strong';
        }
        /**
         * Get birth year (may be null)
         */
        getBirthYear() {
            return this._profile?.birthYear ?? null;
        }
        // ── Public API: Profile Management ──────────────────────────────────────
        /**
         * Create a new profile from onboarding data
         */
        createProfile(displayName, birthYear, fitnessLevel, goal, isGuest = false, odizUserId = null) {
            var now = Date.now();
            this._profile = {
                displayName: displayName || 'Athlete',
                birthYear: birthYear,
                fitnessLevel: fitnessLevel,
                goal: goal,
                isGuest: isGuest,
                odizUserId: odizUserId,
                createdAt: now,
                lastModified: now,
            };
            this.saveToStorage();
            this.notifyProfileSaved(this._profile);
            this.log('Profile created: ' + displayName + ' (guest=' + isGuest + ')');
            return this._profile;
        }
        /**
         * Create a guest profile with minimal data
         */
        createGuestProfile() {
            return this.createProfile('Guest', null, 'regular', 'finish_strong', true, null);
        }
        /**
         * Update existing profile fields
         */
        updateProfile(updates) {
            if (!this._profile) {
                this.log('Cannot update: no profile exists');
                return;
            }
            this._profile = {
                ...this._profile,
                ...updates,
                lastModified: Date.now(),
            };
            this.saveToStorage();
            this.notifyProfileSaved(this._profile);
            this.log('Profile updated');
        }
        /**
         * Clear profile (for testing or sign out)
         */
        clearProfile() {
            this._profile = null;
            this.clearStorage();
            this.log('Profile cleared');
        }
        // ── Public API: HR Calculation ──────────────────────────────────────────
        /**
         * Calculate max heart rate using 220 - age formula
         * Returns default 190 if age unknown
         */
        getMaxHeartRate() {
            if (!this._profile?.birthYear) {
                return ProfileManager.DEFAULT_MAX_HR;
            }
            var currentYear = new Date().getFullYear();
            var age = currentYear - this._profile.birthYear;
            // Sanity check age
            if (age < 10 || age > 100) {
                return ProfileManager.DEFAULT_MAX_HR;
            }
            return 220 - age;
        }
        /**
         * Get HR zone thresholds based on max HR
         * Returns array of 5 zone thresholds: [Z1 max, Z2 max, Z3 max, Z4 max, Z5 max]
         */
        getHRZones() {
            var maxHR = this.getMaxHeartRate();
            return [
                Math.round(maxHR * 0.60), // Zone 1: 50-60% (recovery)
                Math.round(maxHR * 0.70), // Zone 2: 60-70% (fat burn)
                Math.round(maxHR * 0.80), // Zone 3: 70-80% (aerobic)
                Math.round(maxHR * 0.90), // Zone 4: 80-90% (anaerobic)
                maxHR, // Zone 5: 90-100% (max)
            ];
        }
        /**
         * Get current HR zone (1-5) for a given heart rate
         */
        getHRZone(currentHR) {
            var zones = this.getHRZones();
            for (var i = 0; i < zones.length; i++) {
                if (currentHR <= zones[i]) {
                    return i + 1;
                }
            }
            return 5; // Max zone
        }
        // ── Public API: AI Context ──────────────────────────────────────────────
        /**
         * Get formatted string for AI coach context
         */
        getAIContextString() {
            if (!this._profile) {
                return 'User: Guest athlete (no profile data)';
            }
            var p = this._profile;
            var age = p.birthYear ? (new Date().getFullYear() - p.birthYear) : 'unknown';
            var maxHR = this.getMaxHeartRate();
            var fitnessDesc = {
                'beginner': 'beginner (new to HYROX/fitness)',
                'regular': 'regular gym-goer (moderate fitness)',
                'athlete': 'competitive athlete (high fitness)',
            };
            var goalDesc = {
                'finish_strong': 'finish strong (complete the race confidently)',
                'beat_pb': 'beat personal best (push for faster time)',
                'max_effort': 'maximum effort (all-out performance)',
                'pacing': 'pacing practice (learn optimal pace)',
            };
            var context = 'User Profile:\n' +
                '- Name: ' + p.displayName + '\n' +
                '- Age: ' + age + '\n' +
                '- Max HR: ' + maxHR + ' bpm\n' +
                '- Fitness: ' + fitnessDesc[p.fitnessLevel] + '\n' +
                '- Goal: ' + goalDesc[p.goal];
            if (p.isGuest) {
                context += '\n- Status: Guest (limited personalization)';
            }
            return context;
        }
        /**
         * Get coaching tone recommendation based on fitness level
         */
        getCoachingTone() {
            var level = this._profile?.fitnessLevel ?? 'regular';
            switch (level) {
                case 'beginner':
                    return 'encouraging';
                case 'athlete':
                    return 'competitive';
                default:
                    return 'balanced';
            }
        }
        // ── Callbacks ───────────────────────────────────────────────────────────
        /**
         * Register callback for when profile is loaded from storage
         */
        onProfileLoaded(callback) {
            this._onProfileLoaded.push(callback);
            // If already initialized, call immediately
            if (this._isInitialized) {
                callback(this._profile);
            }
        }
        /**
         * Register callback for when profile is saved
         */
        onProfileSaved(callback) {
            this._onProfileSaved.push(callback);
        }
        notifyProfileSaved(profile) {
            for (var i = 0; i < this._onProfileSaved.length; i++) {
                this._onProfileSaved[i](profile);
            }
        }
        // ── Storage ─────────────────────────────────────────────────────────────
        loadFromStorage() {
            try {
                if (!global.persistentStorageSystem) {
                    this.log('PersistentStorageSystem not available');
                    return;
                }
                var store = global.persistentStorageSystem.store;
                var data = store.getString(ProfileManager.STORAGE_KEY);
                if (data && data.length > 0) {
                    this._profile = JSON.parse(data);
                    this.log('Loaded profile: ' + this._profile.displayName);
                    // Notify listeners
                    for (var i = 0; i < this._onProfileLoaded.length; i++) {
                        this._onProfileLoaded[i](this._profile);
                    }
                }
                else {
                    this.log('No stored profile found');
                    for (var j = 0; j < this._onProfileLoaded.length; j++) {
                        this._onProfileLoaded[j](null);
                    }
                }
            }
            catch (error) {
                this.log('Load error: ' + error);
            }
        }
        saveToStorage() {
            try {
                if (!global.persistentStorageSystem) {
                    this.log('PersistentStorageSystem not available');
                    return;
                }
                if (!this._profile) {
                    this.log('No profile to save');
                    return;
                }
                var store = global.persistentStorageSystem.store;
                store.putString(ProfileManager.STORAGE_KEY, JSON.stringify(this._profile));
                this.log('Profile saved to storage');
            }
            catch (error) {
                this.log('Save error: ' + error);
            }
        }
        clearStorage() {
            try {
                if (!global.persistentStorageSystem) {
                    return;
                }
                var store = global.persistentStorageSystem.store;
                store.putString(ProfileManager.STORAGE_KEY, '');
                this.log('Storage cleared');
            }
            catch (error) {
                this.log('Clear error: ' + error);
            }
        }
        // ── Debug ───────────────────────────────────────────────────────────────
        log(msg) {
            if (this.enableDebug) {
                print('[ProfileManager] ' + msg);
            }
        }
    };
    __setFunctionName(_classThis, "ProfileManager");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ProfileManager = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
    })();
    // ── Constants ───────────────────────────────────────────────────────────
    _classThis.STORAGE_KEY = 'hyrox_user_profile';
    _classThis.DEFAULT_MAX_HR = 190;
    // ── Singleton ───────────────────────────────────────────────────────────
    _classThis._instance = null;
    (() => {
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ProfileManager = _classThis;
})();
exports.ProfileManager = ProfileManager;
//# sourceMappingURL=ProfileManager.js.map