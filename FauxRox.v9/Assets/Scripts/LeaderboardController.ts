// ============================================================================
// LeaderboardController.ts — Leaderboard UI Controller
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Handles:
// - Fetching leaderboard from CloudManager
// - Populating UI with top players
// - Highlighting current user's rank
// - Personal best display
// ============================================================================

import { CloudManager, LeaderboardEntry } from './CloudManager';

import { comparisonKey, unrankedReason } from './RaceComparability';

@component
export class LeaderboardController extends BaseScriptComponent {

  // ── References ──────────────────────────────────────────────────────────────

  @input cloudManager: CloudManager;

  /** Leaderboard panel container */
  @input @allowUndefined leaderboardPanel: SceneObject;

  /** Title text (e.g., "LEADERBOARD") */
  @input @allowUndefined titleText: Text;

  /** Leaderboard list - all ranks in single Text */
  @input @allowUndefined leaderboardListText: Text;

  /** Your rank section */
  @input @allowUndefined yourRankText: Text;
  @input @allowUndefined yourTimeText: Text;

  /** Loading indicator */
  @input @allowUndefined loadingText: Text;

  /** Go Back button - returns to finish panel */
  @input @allowUndefined goBackButton: ScriptComponent;

  /** Race Again button - resets race */
  @input @allowUndefined raceAgainButton: ScriptComponent;

  @input debugPrint: boolean = true;

  // ── Internal ────────────────────────────────────────────────────────────────

  private _isLoading: boolean = false;
  private _onCloseCallback: () => void = null;
  private _onRaceAgainCallback: () => void = null;

  onAwake(): void {
    this.log('LeaderboardController initialized');

    // Hide panel initially
    if (this.leaderboardPanel) {
      this.leaderboardPanel.enabled = false;
    }

    // Bind go back button
    this.createEvent('OnStartEvent').bind(() => {
      this.bindGoBackButton();
    });
  }

  private bindGoBackButton(): void {
    if (this.goBackButton) {
      var btn = this.goBackButton as any;
      if (btn.onTriggerUp && btn.onTriggerUp.add) {
        btn.onTriggerUp.add(() => {
          this.hide();
        });
        this.log('Go Back button bound');
      }
    }

    if (this.raceAgainButton) {
      var raceBtn = this.raceAgainButton as any;
      if (raceBtn.onTriggerUp && raceBtn.onTriggerUp.add) {
        raceBtn.onTriggerUp.add(() => {
          this.onRaceAgainPressed();
        });
        this.log('Race Again button bound');
      }
    }
  }

  private onRaceAgainPressed(): void {
    // Hide panel
    if (this.leaderboardPanel) {
      this.leaderboardPanel.enabled = false;
    }

    // Call race again callback
    if (this._onRaceAgainCallback) {
      this._onRaceAgainCallback();
      this._onRaceAgainCallback = null;
    }
    this._onCloseCallback = null;

    this.log('Race Again pressed');
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Show leaderboard panel and fetch data
   * @param onClose Called when Go Back is pressed
   * @param onRaceAgain Called when Race Again is pressed
   */
  show(onClose?: () => void, onRaceAgain?: () => void): void {
    this._onCloseCallback = onClose || null;
    this._onRaceAgainCallback = onRaceAgain || null;

    if (this.leaderboardPanel) {
      this.leaderboardPanel.enabled = true;
    }

    // Show loading state
    this.showLoading();

    // Fetch leaderboard
    this.fetchAndDisplay();
  }

  /**
   * Hide leaderboard panel
   */
  hide(): void {
    if (this.leaderboardPanel) {
      this.leaderboardPanel.enabled = false;
    }

    if (this._onCloseCallback) {
      this._onCloseCallback();
      this._onCloseCallback = null;
    }

    this.log('Leaderboard hidden');
  }

  /**
   * Check if panel is visible
   */
  get isVisible(): boolean {
    return this.leaderboardPanel ? this.leaderboardPanel.enabled : false;
  }

  // ── Data Fetching ──────────────────────────────────────────────────────────

  private async fetchAndDisplay(): Promise<void> {
    if (!this.cloudManager) {
      this.log('ERROR: CloudManager not assigned');
      this.showError('Cloud not available');
      return;
    }

    if (this._isLoading) return;
    this._isLoading = true;

    try {
      // Fetch top 10
      const entries = await this.cloudManager.getLeaderboard(10);
      this.log('Fetched ' + entries.length + ' entries');

      // Populate UI
      this.populateLeaderboard(entries);

      // Fetch and show user's rank
      await this.fetchUserRank();

    } catch (e) {
      this.log('Fetch error: ' + e);
      this.showError('Failed to load');
    } finally {
      this._isLoading = false;
      this.hideLoading();
    }
  }

  private populateLeaderboard(entries: LeaderboardEntry[]): void {
    if (!this.leaderboardListText) return;

    const currentUserId = this.cloudManager?.userUUID || '';
    var lines: string[] = [];

    for (let i = 0; i < 10; i++) {
      if (i < entries.length) {
        const entry = entries[i];
        const timeStr = this.formatTime(entry.bestTime);
        const isYou = entry.odizUserId === currentUserId;
        const dateStr = entry.bestTimeDate ? this.formatDate(entry.bestTimeDate) : '';

        // Format: "1. PlayerName  1:23.4  Jun 1 *"
        const youMarker = isYou ? ' *' : '';
        lines.push((i + 1) + '.  ' + this.truncateName(entry.displayName, 10) + '  ' + timeStr + '  ' + dateStr + youMarker);
      } else {
        // Empty row
        lines.push((i + 1) + '.  ---');
      }
    }

    // Say what the list is. Everyone picks their own dumbbells and nothing
    // records what they picked, so ordering by time orders the times and not
    // the athletes - and a board that quietly implies otherwise teaches a
    // light athlete they are faster than a heavy one.
    var caveat = unrankedReason(comparisonKey(
      this.cloudManager ? (this.cloudManager as any).currentConfigKey : ''
    ));

    this.leaderboardListText.text = caveat
      ? lines.join('\n') + '\n\n' + caveat
      : lines.join('\n');
  }

  private async fetchUserRank(): Promise<void> {
    if (!this.cloudManager || !this.cloudManager.isAuthenticated) {
      if (this.yourRankText) this.yourRankText.text = 'Not logged in';
      if (this.yourTimeText) this.yourTimeText.text = '--:--';
      return;
    }

    try {
      const pb = await this.cloudManager.getPersonalBest();
      if (pb) {
        // Get full leaderboard to find user's rank
        const allEntries = await this.cloudManager.getLeaderboard(100);
        const userRank = allEntries.findIndex(e => e.odizUserId === this.cloudManager.userUUID) + 1;

        if (this.yourRankText) {
          this.yourRankText.text = userRank > 0 ? userRank.toString() : '--';
        }
        if (this.yourTimeText) {
          this.yourTimeText.text = this.formatTime(pb.totalTime);
        }
      } else {
        if (this.yourRankText) this.yourRankText.text = 'No races yet';
        if (this.yourTimeText) this.yourTimeText.text = '--:--';
      }
    } catch (e) {
      this.log('User rank error: ' + e);
    }
  }

  // ── UI Helpers ─────────────────────────────────────────────────────────────

  private showLoading(): void {
    if (this.loadingText) {
      this.loadingText.text = 'Loading...';
      this.loadingText.enabled = true;
    }

    // Clear list while loading
    if (this.leaderboardListText) {
      this.leaderboardListText.text = '';
    }
  }

  private hideLoading(): void {
    if (this.loadingText) {
      this.loadingText.enabled = false;
    }
  }

  private showError(msg: string): void {
    if (this.loadingText) {
      this.loadingText.text = msg;
      this.loadingText.enabled = true;
    }
  }

  private formatTime(ms: number): string {
    const totalSec = ms / 1000;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min + ':' + sec.toFixed(1).padStart(4, '0');
  }

  private formatDate(isoDate: string): string {
    try {
      const date = new Date(isoDate);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months[date.getMonth()] + ' ' + date.getDate();
    } catch (e) {
      return '';
    }
  }

  private truncateName(name: string, maxLen: number): string {
    if (name.length <= maxLen) return name;
    return name.substring(0, maxLen - 1) + '.';
  }

  // ── Debug ──────────────────────────────────────────────────────────────────

  private log(msg: string): void {
    if (this.debugPrint) {
      print('[LeaderboardController] ' + msg);
    }
  }
}
