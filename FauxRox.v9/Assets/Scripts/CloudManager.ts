// ============================================================================
// CloudManager.ts — Supabase Cloud Integration
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Handles:
// - Race data persistence (save on finish)
// - Leaderboard fetch
// - Friend comparison data
// - Historical records
// ============================================================================

import { createClient, SupabaseClient } from 'SupabaseClient.lspkg/supabase-snapcloud';

import { eligibilityOf } from './SessionEligibility';
import { comparisonKey, unrankedReason } from './RaceComparability';

export interface RaceRecord {
  id?: string;
  odizUserId?: string;
  displayName?: string;
  totalTime: number;
  completed: boolean;
  splits: SplitData[];
  avgHR: number;
  peakHR: number;
  createdAt?: string;
  /**
   * Course tuning this race was run under, from CourseManager.getConfigKey().
   * Baselines are only comparable across races sharing it. Records written
   * before this existed have none and are treated as incompatible.
   */
  configKey?: string;

  /**
   * What this session was, so the boundary can decide whether it belongs in
   * a table other people read. Absent on records written before this existed,
   * which are treated as ordinary completed races - they were, since nothing
   * else could reach the table then.
   */
  sessionKind?: string;
  previewSimplified?: boolean;
}

export interface SplitData {
  name: string;
  duration: number;
  avgHR: number;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  bestTime: number;
  odizUserId: string;
  bestTimeDate?: string;
}

@component
export class CloudManager extends BaseScriptComponent {

  @input supabaseProject: SupabaseProject;
  @input debugPrint: boolean = true;

  private client: SupabaseClient = null;
  private _isAuthenticated: boolean = false;
  private _userUUID: string = '';
  private _displayName: string = '';

  /** Races fetched ahead of time so finishing a race never waits on network */
  private _historyCache: RaceRecord[] = [];
  private _historyFetched: boolean = false;
  private _historyInFlight: boolean = false;

  /** Set false once we learn the race_history table has no config_key column */
  private _configKeySupported: boolean = true;

  /**
   * The course tuning in force, so a personal best is fetched from the same
   * course rather than from whichever race happened to be quickest.
   *
   * Set by whoever knows - CourseManager owns the tuning, this class owns the
   * queries, and neither should have to reach into the other.
   */
  currentConfigKey: string = '';

  get isAuthenticated(): boolean { return this._isAuthenticated; }
  get userUUID(): string { return this._userUUID; }
  get displayName(): string { return this._displayName; }

  /** Override display name (use profile name instead of Snapchat name) */
  setDisplayName(name: string): void {
    if (name && name.trim().length > 0) {
      this._displayName = name.trim();
      this.log('Display name set to: ' + this._displayName);
    }
  }

  onAwake(): void {
    this.log('CloudManager initialized');

    if (!this.supabaseProject) {
      this.log('WARNING: SupabaseProject not assigned');
      return;
    }

    this.initClient();

    // Warm the baseline history now, while the athlete is still in onboarding
    // and calibration. Finishing a race must never wait on the network.
    this.prefetchHistory().then((ok) => {
      if (!ok) {
        this.log('History not available - verdicts will use modelled baselines');
      }
    });
  }

  // ── Initialization ──────────────────────────────────────────────────────────

  private initClient(): void {
    try {
      this.client = createClient(
        this.supabaseProject.url,
        this.supabaseProject.publicToken,
        {
          realtime: {
            heartbeatIntervalMs: 2500  // Required for alpha
          }
        }
      );
      this.log('Supabase client created');
    } catch (e) {
      this.log('ERROR creating client: ' + e);
    }
  }

  // ── Authentication ──────────────────────────────────────────────────────────

  async authenticate(): Promise<boolean> {
    if (!this.client) {
      this.log('ERROR: Client not initialized');
      return false;
    }

    try {
      const { data, error } = await this.client.auth.signInWithIdToken({
        provider: 'snapchat',
        token: ''
      });

      if (error) {
        this.log('Auth error: ' + error.message);
        return false;
      }

      this._isAuthenticated = true;
      this._userUUID = data.user?.id || '';

      // Debug: log all user data to see what Snapchat provides
      this.log('Auth user data: ' + JSON.stringify(data.user));

      this._displayName = data.user?.user_metadata?.display_name
        || data.user?.user_metadata?.name
        || data.user?.user_metadata?.username
        || 'Player';

      this.log('Authenticated: ' + this._displayName + ' (' + this._userUUID + ')');
      return true;
    } catch (e) {
      this.log('Auth exception: ' + e);
      return false;
    }
  }

  // ── Profile Sync ─────────────────────────────────────────────────────────────

  /**
   * Save user profile to cloud (upsert)
   */
  async saveProfile(profile: {
    displayName: string;
    birthYear: number | null;
    fitnessLevel: string;
    goal: string;
  }): Promise<boolean> {
    if (!this.client) {
      this.log('Cannot save profile: client not initialized');
      return false;
    }

    // Auto-authenticate if needed
    if (!this._isAuthenticated) {
      this.log('Auto-authenticating before profile save...');
      var authSuccess = await this.authenticate();
      if (!authSuccess) {
        this.log('Auto-auth failed, cannot save profile');
        return false;
      }
    }

    try {
      const { data, error } = await this.client
        .from('profiles')
        .upsert({
          user_id: this._userUUID,
          display_name: profile.displayName,
          birth_year: profile.birthYear,
          fitness_level: profile.fitnessLevel,
          goal: profile.goal
        }, {
          onConflict: 'user_id'
        })
        .select();

      if (error) {
        this.log('Profile save error: ' + error.message);
        return false;
      }

      this.log('Profile saved to cloud');
      return true;
    } catch (e) {
      this.log('Profile save exception: ' + e);
      return false;
    }
  }

  /**
   * Load user profile from cloud
   */
  async loadProfile(): Promise<{
    displayName: string;
    birthYear: number | null;
    fitnessLevel: string;
    goal: string;
  } | null> {
    if (!this.client || !this._isAuthenticated) {
      this.log('Cannot load profile: not authenticated');
      return null;
    }

    try {
      const { data, error } = await this.client
        .from('profiles')
        .select('*')
        .eq('user_id', this._userUUID)
        .single();

      if (error || !data) {
        this.log('No cloud profile found');
        return null;
      }

      return {
        displayName: data.display_name,
        birthYear: data.birth_year,
        fitnessLevel: data.fitness_level,
        goal: data.goal
      };
    } catch (e) {
      this.log('Profile load exception: ' + e);
      return null;
    }
  }

  // ── Save Race ───────────────────────────────────────────────────────────────

  async saveRace(record: RaceRecord, isGuest: boolean = false): Promise<boolean> {
    // The rule is applied here rather than trusted to the caller.
    //
    // race_history is what getLeaderboard and getPersonalBest read, so
    // anything written to it is a claim in front of other people. A guard at
    // the call site protects the calls that exist today; this one protects
    // the table.
    var allowed = eligibilityOf({
      kind: record.sessionKind || 'RACE',
      previewSimplified: record.previewSimplified === true,
      completed: record.completed,
    });

    if (!allowed.countsForRanking) {
      this.log('Refusing to save: ' + allowed.reason);
      return false;
    }

    // Skip cloud save for guest users
    if (isGuest) {
      this.log('Skipping cloud save for guest user');
      return true;
    }

    if (!this.client) {
      this.log('Cannot save: client not initialized');
      return false;
    }

    // Auto-authenticate if needed
    if (!this._isAuthenticated) {
      this.log('Auto-authenticating before save...');
      var authSuccess = await this.authenticate();
      if (!authSuccess) {
        this.log('Auto-auth failed, cannot save');
        return false;
      }
    }

    var row: any = {
      user_id: this._userUUID,
      display_name: this._displayName,
      total_time: Math.round(record.totalTime),
      completed: record.completed,
      splits: JSON.stringify(record.splits),
      avg_hr: Math.round(record.avgHR),
      peak_hr: Math.round(record.peakHR)
    };

    if (this._configKeySupported && record.configKey) {
      row.config_key = record.configKey;
    }

    try {
      const { error } = await this.client.from('race_history').insert(row).select();

      if (error) {
        // The config_key column is optional infrastructure - if the migration
        // has not been run, save the race anyway rather than losing it. Those
        // records then count as legacy and are excluded from baselines.
        if (row.config_key && this.isMissingColumnError(error)) {
          this.log('race_history has no config_key column - saving without it. ' +
                   'Run Migrations/001_race_history_config_key.sql to enable ' +
                   'personal baselines; until then they stay modelled.');
          this._configKeySupported = false;
          delete row.config_key;

          const retry = await this.client.from('race_history').insert(row).select();
          if (retry.error) {
            this.log('Save error after retry: ' + retry.error.message);
            return false;
          }

          this.appendToHistoryCache(record);
          this.log('Race saved (no config key): ' + record.totalTime + 'ms');
          return true;
        }

        this.log('Save error: ' + error.message);
        return false;
      }

      this.appendToHistoryCache(record);
      this.log('Race saved: ' + record.totalTime + 'ms');
      return true;
    } catch (e) {
      this.log('Save exception: ' + e);
      return false;
    }
  }

  /** Postgres reports an unknown column as 42703 */
  private isMissingColumnError(error: any): boolean {
    if (!error) return false;
    if (error.code === '42703') return true;

    var msg = (error.message || '').toLowerCase();
    return msg.indexOf('config_key') > -1 &&
           (msg.indexOf('column') > -1 || msg.indexOf('schema') > -1);
  }

  // ── Leaderboard ─────────────────────────────────────────────────────────────

  async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    if (!this.client) {
      this.log('ERROR: Client not initialized');
      return [];
    }

    try {
      const { data, error } = await this.client
        .from('leaderboard')
        .select('*')
        .order('best_time', { ascending: true })
        .limit(limit);

      if (error) {
        this.log('Leaderboard error: ' + error.message);
        return [];
      }

      // Ordered by time, and ordering is all it is. Everyone picks their own
      // dumbbells and nothing records what they picked, so a place in this
      // list is a place in a list - see RaceComparability.
      return (data || []).map((row: any, idx: number) => ({
        rank: idx + 1,
        displayName: row.display_name,
        bestTime: row.best_time,
        odizUserId: row.user_id,
        bestTimeDate: row.best_time_date || null
      }));
    } catch (e) {
      this.log('Leaderboard exception: ' + e);
      return [];
    }
  }

  // ── Personal Best ───────────────────────────────────────────────────────────

  // ── Race History ──────────────────────────────────────────────────────────
  //
  // RaceAnalysis needs past races to build personal baselines, but a race
  // finishing is the worst moment to start a network round trip. History is
  // fetched once at startup and kept in memory; the verdict reads the cache.

  /** How many past races to keep for baseline calculation */
  private static readonly HISTORY_LIMIT = 20;

  /**
   * Fetch race history into the cache. Safe to call more than once - only the
   * first call hits the network. Failure is not fatal: the verdict falls back
   * to modelled baselines.
   */
  async prefetchHistory(force: boolean = false): Promise<boolean> {
    if (this._historyInFlight) return false;
    if (this._historyFetched && !force) return true;

    if (!this.client) {
      this.log('History prefetch skipped - no client');
      return false;
    }

    if (!this._isAuthenticated) {
      var ok = await this.authenticate();
      if (!ok) {
        this.log('History prefetch skipped - not authenticated');
        return false;
      }
    }

    this._historyInFlight = true;

    try {
      const { data, error } = await this.client
        .from('race_history')
        .select('*')
        .eq('user_id', this._userUUID)
        .eq('completed', true)
        .order('created_at', { ascending: false })
        .limit(CloudManager.HISTORY_LIMIT);

      if (error) {
        this.log('History prefetch error: ' + error.message);
        return false;
      }

      this._historyCache = this.parseRaceRows(data);
      this._historyFetched = true;
      this.log('History cached: ' + this._historyCache.length + ' races');
      return true;
    } catch (e) {
      this.log('History prefetch exception: ' + e);
      return false;
    } finally {
      this._historyInFlight = false;
    }
  }

  /**
   * Cached history. Never hits the network, never throws, returns [] when
   * nothing has been fetched - the caller treats that as "no baselines yet".
   */
  getCachedHistory(): RaceRecord[] {
    return this._historyCache;
  }

  /** True once a prefetch has completed, successfully or not */
  get isHistoryReady(): boolean {
    return this._historyFetched;
  }

  /** Keep the cache honest after a save so a second race sees the first */
  private appendToHistoryCache(record: RaceRecord): void {
    if (!record.completed) return;
    this._historyCache = [record].concat(this._historyCache)
                                 .slice(0, CloudManager.HISTORY_LIMIT);
  }

  private parseRaceRows(rows: any[]): RaceRecord[] {
    var out: RaceRecord[] = [];
    if (!rows) return out;

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var splits: SplitData[] = [];

      try {
        splits = JSON.parse(row.splits || '[]');
      } catch (e) {
        this.log('Skipping race with unparseable splits: ' + row.id);
        continue;
      }

      if (!splits || splits.length === 0) continue;

      out.push({
        id: row.id,
        totalTime: row.total_time,
        completed: row.completed,
        splits: splits,
        avgHR: row.avg_hr,
        peakHR: row.peak_hr,
        createdAt: row.created_at,
        configKey: row.config_key || undefined,
      });
    }

    return out;
  }

  async getPersonalBest(configKey?: string): Promise<RaceRecord | null> {
    if (!this.client || !this._isAuthenticated) {
      this.log('Cannot fetch: not authenticated');
      return null;
    }

    try {
      // The athlete's own races, on the course they are running now.
      //
      // A best set at twenty-five burpees is not a best to chase at fifty.
      // Load is not a problem here the way it is on the leaderboard - it is
      // the same person and the same dumbbells - but the course is.
      var query = this.client
        .from('race_history')
        .select('*')
        .eq('user_id', this._userUUID)
        .eq('completed', true);

      if (this._configKeySupported && configKey) {
        query = query.eq('config_key', configKey);
      }

      const { data, error } = await query
        .order('total_time', { ascending: true })
        .limit(1);

      if (error || !data || data.length === 0) {
        return null;
      }

      const row = data[0];
      return {
        totalTime: row.total_time,
        completed: row.completed,
        splits: JSON.parse(row.splits || '[]'),
        avgHR: row.avg_hr,
        peakHR: row.peak_hr,
        createdAt: row.created_at
      };
    } catch (e) {
      this.log('PersonalBest exception: ' + e);
      return null;
    }
  }

  // ── Friend Comparison ───────────────────────────────────────────────────────

  /**
   * Search for a user by display name and get their best race
   */
  async searchUserByName(name: string): Promise<RaceRecord | null> {
    if (!this.client) {
      this.log('Cannot search: client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.client
        .from('race_history')
        .select('*')
        .ilike('display_name', '%' + name + '%')
        .eq('completed', true)
        .order('total_time', { ascending: true })
        .limit(1);

      if (error || !data || data.length === 0) {
        this.log('No user found with name: ' + name);
        return null;
      }

      const row = data[0];
      this.log('Found user: ' + row.display_name);

      return {
        displayName: row.display_name,
        totalTime: row.total_time,
        completed: row.completed,
        splits: JSON.parse(row.splits || '[]'),
        avgHR: row.avg_hr,
        peakHR: row.peak_hr,
        createdAt: row.created_at
      };
    } catch (e) {
      this.log('Search exception: ' + e);
      return null;
    }
  }

  async getFriendRace(friendUserId: string): Promise<RaceRecord | null> {
    if (!this.client) {
      this.log('ERROR: Client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.client
        .from('race_history')
        .select('*')
        .eq('user_id', friendUserId)
        .eq('completed', true)
        .order('total_time', { ascending: true })
        .limit(1);

      if (error || !data || data.length === 0) {
        return null;
      }

      const row = data[0];
      return {
        displayName: row.display_name,
        totalTime: row.total_time,
        completed: row.completed,
        splits: JSON.parse(row.splits || '[]'),
        avgHR: row.avg_hr,
        peakHR: row.peak_hr,
        createdAt: row.created_at
      };
    } catch (e) {
      this.log('FriendRace exception: ' + e);
      return null;
    }
  }

  // ── Get Race Context for AI ─────────────────────────────────────────────────

  async getAIContext(friendUserId?: string): Promise<string> {
    // Auto-authenticate if needed
    if (!this._isAuthenticated) {
      var authSuccess = await this.authenticate();
      if (!authSuccess) {
        return 'Cloud data not available (not authenticated)';
      }
    }

    var lines: string[] = [];

    // Personal best
    const pb = await this.getPersonalBest(this.currentConfigKey);
    if (pb) {
      lines.push('Your Personal Best: ' + (pb.totalTime / 1000).toFixed(1) + 's');
      lines.push('Your PB Splits: ' + pb.splits.map(s => s.name + ': ' + (s.duration / 1000).toFixed(1) + 's').join(', '));
    } else {
      lines.push('No personal best yet (first race)');
    }

    // Leaderboard - top 5
    try {
      const leaderboard = await this.getLeaderboard(5);
      this.log('Leaderboard fetched: ' + leaderboard.length + ' entries');
      if (leaderboard.length > 0) {
        lines.push('');
        lines.push('=== Leaderboard (Top 5) ===');
        lines.push(unrankedReason(comparisonKey(this.currentConfigKey)) ||
                   'Comparable: same course, same load division.');
        leaderboard.forEach((entry, idx) => {
          var isSelf = entry.odizUserId === this._userUUID ? ' (YOU)' : '';
          lines.push((idx + 1) + '. ' + entry.displayName + ': ' + (entry.bestTime / 1000).toFixed(1) + 's' + isSelf);
        });
      } else {
        lines.push('');
        lines.push('No leaderboard data yet (be the first!)');
      }
    } catch (e) {
      this.log('Leaderboard error: ' + e);
      lines.push('Leaderboard not available');
    }

    // Friend comparison
    if (friendUserId) {
      const friend = await this.getFriendRace(friendUserId);
      if (friend) {
        lines.push('');
        lines.push('Friend ' + friend.displayName + ' Best: ' + (friend.totalTime / 1000).toFixed(1) + 's');
      }
    }

    return lines.join('\n');
  }

  // ── Debug ───────────────────────────────────────────────────────────────────

  private log(msg: string): void {
    if (this.debugPrint) {
      print('[CloudManager] ' + msg);
    }
  }
}
