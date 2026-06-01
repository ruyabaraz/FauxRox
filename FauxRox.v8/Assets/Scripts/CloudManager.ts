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

    try {
      const { data, error } = await this.client
        .from('race_history')
        .insert({
          user_id: this._userUUID,
          display_name: this._displayName,
          total_time: Math.round(record.totalTime),
          completed: record.completed,
          splits: JSON.stringify(record.splits),
          avg_hr: Math.round(record.avgHR),
          peak_hr: Math.round(record.peakHR)
        })
        .select();

      if (error) {
        this.log('Save error: ' + error.message);
        return false;
      }

      this.log('Race saved: ' + record.totalTime + 'ms');
      return true;
    } catch (e) {
      this.log('Save exception: ' + e);
      return false;
    }
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

  async getPersonalBest(): Promise<RaceRecord | null> {
    if (!this.client || !this._isAuthenticated) {
      this.log('Cannot fetch: not authenticated');
      return null;
    }

    try {
      const { data, error } = await this.client
        .from('race_history')
        .select('*')
        .eq('user_id', this._userUUID)
        .eq('completed', true)
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
    const pb = await this.getPersonalBest();
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
