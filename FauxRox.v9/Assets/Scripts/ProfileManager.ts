// ============================================================================
// ProfileManager.ts — HYROX User Profile Manager
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Singleton managing user profile with local + cloud persistence.
// Handles onboarding data, HR zone calculation, and AI personalization.
// ============================================================================

import {
  TrainingLog,
  emptyTrainingLog,
  recordCompletedSession,
  recordAbandonedSession,
  trainingSeed,
  noteLaunch,
  parseTrainingLog,
} from './TrainingHistory';

import { SchedulingContext, isRunningArchetype } from './RunningSchedule';

import { PaceAnchor } from './PaceTarget';

import {
  PaceEvidenceStore,
  HyroxRunSample,
  emptyPaceEvidence,
  parsePaceEvidence,
  recordFiveK,
  recordDeclined,
  shouldOfferPaceEvidence,
  anchorFrom,
  recordHyroxRuns,
  hyroxAnchorFrom,
  freshHyroxRuns,
  RunObservation,
  recordObservations,
  calibrationAnchorFrom,
  calibratableObservations,
} from './PaceEvidence';

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
  /** Kept apart from the profile blob so one cannot corrupt the other */
  private static readonly TRAINING_LOG_KEY = 'hyrox_training_log';
  private static readonly PACE_EVIDENCE_KEY = 'hyrox_pace_evidence';
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
    this.loadTrainingLog();
    this.loadPaceEvidence();
    this.loadPaceEvidence();
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

  // ── Training history ────────────────────────────────────────────────────
  //
  // The generator's seed comes from how much the athlete has trained, not from
  // how many races they have run. Racing and training are different things to
  // have done, and only one of them should change tomorrow's session.

  private _trainingLog: TrainingLog = emptyTrainingLog();

  /**
   * Sessions completed in Lens Studio preview, this run only.
   *
   * Preview auto-completes hand-tracked stations after a few seconds, so it is
   * not a training session that happened - it must never reach the stored log,
   * or fifteen minutes of testing arrives on device as fifteen workouts and
   * poisons the recency data. Held in memory and lost on reset, which is
   * exactly what is wanted: variety is still visible while testing, and none
   * of it is remembered.
   */
  private _previewOffset: number = 0;

  /** What the generator should seed from */
  getTrainingSeed(): number {
    return trainingSeed(this._trainingLog, this._previewOffset);
  }

  /**
   * Completed training sessions actually performed.
   *
   * History. Anything that adapts to how much the athlete has trained reads
   * this - never the seed, and never the offer count, which say only how many
   * times the app has drawn a workout.
   */
  getCompletedTrainingCount(): number {
    return this._trainingLog.completionOrdinal;
  }

  /** Movements from the most recent completed session, pushed down the ranking */
  getRecentMovements(): string[] {
    return this._trainingLog.recent;
  }

  /**
   * Fold a completed session in.
   *
   * @param wasPreview true when the session ran with preview auto-completion,
   *                   in which case exactly the ephemeral counter moves
   */
  recordCompletedTraining(
    movements: string[],
    wasPreview: boolean,
    archetype?: string
  ): void {
    if (wasPreview) {
      this._previewOffset++;
      this.log('Preview training complete (offset ' + this._previewOffset + ', not stored)');
      return;
    }

    this._trainingLog = recordCompletedSession(
      this._trainingLog, movements, archetype, Date.now());
    this.saveTrainingLog();
    this.log('Training #' + this._trainingLog.completionOrdinal + ' recorded: ' +
             this._trainingLog.recent.join(', ') +
             (archetype ? '  [' + archetype + ']' : ''));
  }

  /**
   * What the scheduler needs to know about the athlete's recent training.
   *
   * Read from the stored log, so a preview session cannot reach it - which is
   * the point: a session that was never really done should not be the reason
   * the next one is easy.
   */
  get schedulingContext(): SchedulingContext {
    var log = this._trainingLog;

    if (!log || !isRunningArchetype(log.lastArchetype)) {
      this.log('Scheduling: nothing to go on (lastArchetype "' +
               (log ? log.lastArchetype : '') + '")');
      return {};
    }

    var hours = log.lastCompletedAt > 0
      ? (Date.now() - log.lastCompletedAt) / 3600000
      : undefined;

    this.log('Scheduling: last was ' + log.lastArchetype + ', ' +
             (hours === undefined ? 'when is not recorded' : hours.toFixed(1) + 'h ago') +
             ' (completed ' + log.completionOrdinal + ', offered ' + log.offerOrdinal + ')');

    return {
      recent: [log.lastArchetype as any],
      hoursSinceLast: hours,
    };
  }

  /**
   * Fold an abandoned session in.
   *
   * Nothing was trained, so nothing is claimed: history and the recency list
   * stay exactly where they were. Only the draw moves, so that asking for
   * another session gives another session.
   *
   * @param wasPreview true when the session ran with preview auto-completion
   */
  recordAbandonedTraining(wasPreview: boolean): void {
    if (wasPreview) {
      this._previewOffset++;
      this.log('Preview training abandoned (offset ' + this._previewOffset + ', not stored)');
      return;
    }

    this._trainingLog = recordAbandonedSession(this._trainingLog);
    this.saveTrainingLog();
    this.log('Training abandoned (offer #' + this._trainingLog.offerOrdinal +
             '; ' + this._trainingLog.completionOrdinal + ' completed, unchanged)');
  }

  // ── Pace evidence ────────────────────────────────────────────────────────
  //
  // What the athlete told us, kept as what they told us. The bands are
  // derived from it on every read and never written down: the threshold model
  // moved by nine seconds a kilometre between two drafts of it, and anybody
  // whose profile had been written during the first would have carried it.

  private _paceEvidence: PaceEvidenceStore = emptyPaceEvidence();

  /** The anchor the stored 5K produces, or null */
  get paceAnchor(): PaceAnchor | null {
    return anchorFrom(this._paceEvidence);
  }

  /**
   * Everything known about this athlete's paces, most specific first.
   *
   * Two kinds of knowledge, and they answer different questions. Their races
   * say what they hold on race day and nothing else, so they come first and
   * are asked for one archetype only; a 5K speaks for the rest. An athlete
   * can have both, one, or neither, and neither is the ordinary case.
   */
  get paceAnchors(): PaceAnchor[] {
    var out: PaceAnchor[] = [];

    var raced = hyroxAnchorFrom(this._paceEvidence, Date.now());
    if (raced) out.push(raced);

    // Their own sessions before the time they typed in. Both speak for the
    // whole range, and the one measured from running we watched beats the one
    // remembered from a race we did not.
    var calibrated = calibrationAnchorFrom(this._paceEvidence, Date.now());
    if (calibrated) out.push(calibrated);

    var entered = anchorFrom(this._paceEvidence);
    if (entered) out.push(entered);

    return out;
  }

  /** How many threshold repetitions are on file and could still count */
  get calibrationSampleCount(): number {
    return calibratableObservations(this._paceEvidence, Date.now()).length;
  }

  /**
   * Fold a training session's repetitions in.
   *
   * Recorded whatever they say. Whether enough of them agree to describe the
   * athlete is asked on the way out, not on the way in - a policy that
   * discarded evidence as it arrived could never be made stricter or looser
   * afterwards without the athlete's history having been thrown away.
   */
  recordRunObservations(observations: RunObservation[]): void {
    if (!observations || observations.length === 0) return;

    var before = (this._paceEvidence.observations || []).length;
    this._paceEvidence = recordObservations(this._paceEvidence, observations);
    var after = (this._paceEvidence.observations || []).length;

    if (after === before) return;

    this.savePaceEvidence();
    this.log('Run observations recorded: ' + (after - before) +
             ' (' + after + ' on file)');
  }

  /** How many race runs are on file and still recent enough to count */
  get hyroxRunSampleCount(): number {
    return freshHyroxRuns(this._paceEvidence, Date.now()).length;
  }

  /**
   * Fold a race's runs in.
   *
   * Called with what was measured, not with what was prescribed - the whole
   * value of this source is that nobody modelled it.
   */
  recordRaceRuns(samples: HyroxRunSample[]): void {
    if (!samples || samples.length === 0) return;

    var before = (this._paceEvidence.hyroxRuns || []).length;
    this._paceEvidence = recordHyroxRuns(this._paceEvidence, samples);
    var after = (this._paceEvidence.hyroxRuns || []).length;

    if (after === before) return;

    this.savePaceEvidence();
    this.log('Race runs recorded: ' + (after - before) + ' (' + after + ' on file)');
  }

  /** Whether there is still a question to put to this athlete */
  get shouldOfferPace(): boolean {
    return shouldOfferPaceEvidence(this._paceEvidence);
  }

  /** The 5K they entered, or 0 */
  get fiveKSeconds(): number {
    return this._paceEvidence.fiveK ? this._paceEvidence.fiveK.seconds : 0;
  }

  recordFiveKTime(seconds: number): void {
    var before = this._paceEvidence.fiveK
      ? this._paceEvidence.fiveK.seconds + 's'
      : 'nothing';

    this._paceEvidence = recordFiveK(this._paceEvidence, seconds, Date.now());
    this.savePaceEvidence();

    // Loud on purpose. This is the only place a 5K is ever written down, so
    // a time that appears on a profile without this line in the log got
    // there some other way, and there is no other way.
    this.log('5K WRITTEN: ' + seconds + 's (was ' + before + ') at ' + Date.now());
  }

  /**
   * Forget what was entered, and ask again.
   *
   * For somebody who mistyped, or whose evidence arrived by accident. There
   * was no way to correct a 5K once it was on the profile, which made a wrong
   * one permanent.
   */
  clearPaceEvidence(): void {
    this._paceEvidence = emptyPaceEvidence();
    this.savePaceEvidence();
    this.log('Pace evidence cleared - the 5K question comes back');
  }

  /**
   * They were asked and said no.
   *
   * A perfectly good answer, and one worth remembering - most athletes do not
   * have a recent 5K, and a session with no pace target is a whole session.
   */
  declinePaceEvidence(): void {
    this._paceEvidence = recordDeclined(this._paceEvidence, Date.now());
    this.savePaceEvidence();
    this.log('Pace evidence declined');
  }

  private loadPaceEvidence(): void {
    try {
      if (!global.persistentStorageSystem) return;

      var store = global.persistentStorageSystem.store;
      this._paceEvidence = parsePaceEvidence(
        store.getString(ProfileManager.PACE_EVIDENCE_KEY));

      if (this._paceEvidence.fiveK) {
        this.log('Pace evidence: 5K in ' + this._paceEvidence.fiveK.seconds +
                 's, entered at ' + this._paceEvidence.fiveK.enteredAtEpochMs +
                 ' — the question will not be asked again');
      } else if (this._paceEvidence.declinedAtEpochMs) {
        this.log('Pace evidence: declined at ' +
                 this._paceEvidence.declinedAtEpochMs +
                 ' — the question will not be asked again');
      } else {
        this.log('Pace evidence: none — the question will be asked');
      }
    } catch (error) {
      this.log('Pace evidence load error: ' + error);
      this._paceEvidence = emptyPaceEvidence();
    }
  }

  private savePaceEvidence(): void {
    try {
      if (!global.persistentStorageSystem) return;

      var store = global.persistentStorageSystem.store;
      store.putString(ProfileManager.PACE_EVIDENCE_KEY,
                      JSON.stringify(this._paceEvidence));
    } catch (error) {
      this.log('Pace evidence save error: ' + error);
    }
  }

  private loadTrainingLog(): void {
    try {
      if (!global.persistentStorageSystem) return;

      var store = global.persistentStorageSystem.store;
      this._trainingLog = parseTrainingLog(store.getString(ProfileManager.TRAINING_LOG_KEY));

      // Opening the Lens is a visit, and the draw moves with it. Otherwise an
      // athlete who is offered a session and closes the app is offered the
      // same one tomorrow, and the morning after that.
      this._trainingLog = noteLaunch(this._trainingLog);
      this.saveTrainingLog();

      this.log('Training log: ' + this._trainingLog.completionOrdinal + ' completed, ' +
               this._trainingLog.offerOrdinal + ' abandoned, ' +
               this._trainingLog.launchOrdinal + ' visits, ' +
               this._trainingLog.recent.length + ' recent movements');
    } catch (error) {
      this.log('Training log load error: ' + error);
      this._trainingLog = emptyTrainingLog();
    }
  }

  private saveTrainingLog(): void {
    try {
      if (!global.persistentStorageSystem) return;

      var store = global.persistentStorageSystem.store;
      store.putString(ProfileManager.TRAINING_LOG_KEY, JSON.stringify(this._trainingLog));
    } catch (error) {
      this.log('Training log save error: ' + error);
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
