// ============================================================================
// ProfileManager.ts — HYROX User Profile Manager
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Singleton managing user profile with local + cloud persistence.
// Handles onboarding data, HR zone calculation, and AI personalization.
// ============================================================================

export type FitnessLevel = 'beginner' | 'regular' | 'athlete';
export type GoalType = 'finish_strong' | 'beat_pb' | 'max_effort' | 'pacing';

export interface UserProfile {
  displayName: string;
  birthYear: number | null;
  fitnessLevel: FitnessLevel;
  goal: GoalType;
  isGuest: boolean;
  odizUserId: string | null;
  createdAt: number;
  lastModified: number;
}

@component
export class ProfileManager extends BaseScriptComponent {

  // ── Inspector Settings ──────────────────────────────────────────────────

  @input enableDebug: boolean = true;

  // ── Constants ───────────────────────────────────────────────────────────

  private static readonly STORAGE_KEY = 'hyrox_user_profile';
  private static readonly DEFAULT_MAX_HR = 190;

  // ── Singleton ───────────────────────────────────────────────────────────

  private static _instance: ProfileManager = null;

  static getInstance(): ProfileManager {
    return ProfileManager._instance;
  }

  // ── State ───────────────────────────────────────────────────────────────

  private _profile: UserProfile | null = null;
  private _isInitialized: boolean = false;

  // ── Callbacks ───────────────────────────────────────────────────────────

  private _onProfileLoaded: ((profile: UserProfile | null) => void)[] = [];
  private _onProfileSaved: ((profile: UserProfile) => void)[] = [];

  // ── Lifecycle ───────────────────────────────────────────────────────────

  onAwake(): void {
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
  hasProfile(): boolean {
    return this._profile !== null;
  }

  /**
   * Check if user is in guest mode
   */
  isGuest(): boolean {
    return this._profile?.isGuest ?? true;
  }

  /**
   * Get current profile (may be null if not onboarded)
   */
  getProfile(): UserProfile | null {
    return this._profile;
  }

  /**
   * Get display name or default
   */
  getDisplayName(): string {
    return this._profile?.displayName ?? 'Athlete';
  }

  /**
   * Get fitness level or default
   */
  getFitnessLevel(): FitnessLevel {
    return this._profile?.fitnessLevel ?? 'regular';
  }

  /**
   * Get goal or default
   */
  getGoal(): GoalType {
    return this._profile?.goal ?? 'finish_strong';
  }

  /**
   * Get birth year (may be null)
   */
  getBirthYear(): number | null {
    return this._profile?.birthYear ?? null;
  }

  // ── Public API: Profile Management ──────────────────────────────────────

  /**
   * Create a new profile from onboarding data
   */
  createProfile(
    displayName: string,
    birthYear: number | null,
    fitnessLevel: FitnessLevel,
    goal: GoalType,
    isGuest: boolean = false,
    odizUserId: string | null = null
  ): UserProfile {
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
  createGuestProfile(): UserProfile {
    return this.createProfile(
      'Guest',
      null,
      'regular',
      'finish_strong',
      true,
      null
    );
  }

  /**
   * Update existing profile fields
   */
  updateProfile(updates: Partial<UserProfile>): void {
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
  clearProfile(): void {
    this._profile = null;
    this.clearStorage();
    this.log('Profile cleared');
  }

  // ── Public API: HR Calculation ──────────────────────────────────────────

  /**
   * Calculate max heart rate using 220 - age formula
   * Returns default 190 if age unknown
   */
  getMaxHeartRate(): number {
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
  getHRZones(): number[] {
    var maxHR = this.getMaxHeartRate();

    return [
      Math.round(maxHR * 0.60), // Zone 1: 50-60% (recovery)
      Math.round(maxHR * 0.70), // Zone 2: 60-70% (fat burn)
      Math.round(maxHR * 0.80), // Zone 3: 70-80% (aerobic)
      Math.round(maxHR * 0.90), // Zone 4: 80-90% (anaerobic)
      maxHR,                     // Zone 5: 90-100% (max)
    ];
  }

  /**
   * Get current HR zone (1-5) for a given heart rate
   */
  getHRZone(currentHR: number): number {
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
  getAIContextString(): string {
    if (!this._profile) {
      return 'User: Guest athlete (no profile data)';
    }

    var p = this._profile;
    var age = p.birthYear ? (new Date().getFullYear() - p.birthYear) : 'unknown';
    var maxHR = this.getMaxHeartRate();

    var fitnessDesc: Record<FitnessLevel, string> = {
      'beginner': 'beginner (new to HYROX/fitness)',
      'regular': 'regular gym-goer (moderate fitness)',
      'athlete': 'competitive athlete (high fitness)',
    };

    var goalDesc: Record<GoalType, string> = {
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
  getCoachingTone(): 'encouraging' | 'balanced' | 'competitive' {
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
  onProfileLoaded(callback: (profile: UserProfile | null) => void): void {
    this._onProfileLoaded.push(callback);

    // If already initialized, call immediately
    if (this._isInitialized) {
      callback(this._profile);
    }
  }

  /**
   * Register callback for when profile is saved
   */
  onProfileSaved(callback: (profile: UserProfile) => void): void {
    this._onProfileSaved.push(callback);
  }

  private notifyProfileSaved(profile: UserProfile): void {
    for (var i = 0; i < this._onProfileSaved.length; i++) {
      this._onProfileSaved[i](profile);
    }
  }

  // ── Storage ─────────────────────────────────────────────────────────────

  private loadFromStorage(): void {
    try {
      if (!global.persistentStorageSystem) {
        this.log('PersistentStorageSystem not available');
        return;
      }

      var store = global.persistentStorageSystem.store;
      var data = store.getString(ProfileManager.STORAGE_KEY);

      if (data && data.length > 0) {
        this._profile = JSON.parse(data) as UserProfile;
        this.log('Loaded profile: ' + this._profile.displayName);

        // Notify listeners
        for (var i = 0; i < this._onProfileLoaded.length; i++) {
          this._onProfileLoaded[i](this._profile);
        }
      } else {
        this.log('No stored profile found');

        for (var j = 0; j < this._onProfileLoaded.length; j++) {
          this._onProfileLoaded[j](null);
        }
      }
    } catch (error) {
      this.log('Load error: ' + error);
    }
  }

  private saveToStorage(): void {
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
    } catch (error) {
      this.log('Save error: ' + error);
    }
  }

  private clearStorage(): void {
    try {
      if (!global.persistentStorageSystem) {
        return;
      }

      var store = global.persistentStorageSystem.store;
      store.putString(ProfileManager.STORAGE_KEY, '');

      this.log('Storage cleared');
    } catch (error) {
      this.log('Clear error: ' + error);
    }
  }

  // ── Debug ───────────────────────────────────────────────────────────────

  private log(msg: string): void {
    if (this.enableDebug) {
      print('[ProfileManager] ' + msg);
    }
  }
}
