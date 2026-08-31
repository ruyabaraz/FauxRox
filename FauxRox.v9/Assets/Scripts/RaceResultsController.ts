// ============================================================================
// RaceResultsController.ts — the completion layer
// ============================================================================
// Sits between RaceStateMachine (which only produces an immutable RaceResult)
// and everything that wants to interpret one. It is the single place that
// calls analyzeRace, so the UI and the AI coach are guaranteed to be looking
// at the same verdict rather than two independent computations.
//
// A plain class, not a component: it holds no scene references and needs no
// inspector wiring. Promoting it to a BaseScriptComponent later is mechanical.
//
// Nothing here is allowed to throw. A race that just finished must still show
// a time and a verdict when the cloud is down, when history is empty, when
// the course config is missing, or when the athlete has no heart rate strap.
// Every dependency is a callback so those failures can be simulated in tests.
// ============================================================================

import { RaceResult } from './RaceResult';
import {
  analyzeRace,
  RaceVerdict,
  SplitSample,
  HistoricRace,
} from './RaceAnalysis';

/** One past race as the cloud stores it - loose on purpose, it crosses a boundary */
export interface HistoricRaceRecord {
  splits: { name: string; duration: number; avgHR: number }[];
  configKey?: string;
  completed?: boolean;
}

export interface RaceResultsDeps {
  /** Cached history. Must not hit the network. May throw or return null. */
  getHistory: () => HistoricRaceRecord[];
  /** Modelled baseline per split name, in milliseconds */
  getModelBaselines: () => { [splitName: string]: number };
  /** Station name to display name */
  getDisplayNames: () => { [stationName: string]: string };
  /** Optional logger */
  log?: (message: string) => void;
}

export class RaceResultsController {

  private deps: RaceResultsDeps;
  private _result: RaceResult = null;
  private _verdict: RaceVerdict = null;

  constructor(deps: RaceResultsDeps) {
    this.deps = deps || ({} as RaceResultsDeps);
  }

  // ── Public state ──────────────────────────────────────────────────────────

  get result(): RaceResult { return this._result; }
  get verdict(): RaceVerdict { return this._verdict; }
  get hasVerdict(): boolean { return this._verdict !== null && this._verdict.hasEnoughData; }

  /** Deterministic text for the finish panel. Never empty once a race ran. */
  get summaryText(): string {
    if (!this._verdict) return '';
    return this._verdict.summary || '';
  }

  /** The same verdict, formatted for the coach prompt. Empty when unavailable. */
  get aiContext(): string {
    if (!this._verdict) return '';
    return this._verdict.aiContext || '';
  }

  /** Short 'NAME  +1:20' line for the finish panel's needs-work slot */
  get limiterLine(): string {
    if (!this._verdict || !this._verdict.limiter) return '';

    var limiter = this._verdict.limiter;
    return limiter.displayName.toUpperCase() + '  +' +
           this.formatShort(limiter.residualMs);
  }

  // ── Entry point ───────────────────────────────────────────────────────────

  /**
   * Interpret a finished race. Returns the verdict and caches it. Safe to call
   * with anything - a null result yields a null verdict, not an exception.
   */
  process(result: RaceResult): RaceVerdict {
    this._result = result;
    this._verdict = null;

    if (!result) {
      this.log('No result to process');
      return null;
    }

    // Training sessions are not measured against race baselines
    if (result.sessionKind === 'TRAINING') {
      this.log('Training session - skipping verdict');
      return null;
    }

    var samples = this.toSamples(result);
    var history = this.safeHistory(result.configKey);
    var baselines = this.safeCall(this.deps.getModelBaselines, {}, 'model baselines');
    var displayNames = this.safeCall(this.deps.getDisplayNames, {}, 'display names');

    try {
      this._verdict = analyzeRace(
        samples,
        history,
        baselines,
        result.maxHR,
        displayNames,
        result.configKey || undefined
      );
    } catch (e) {
      // Analysis is pure and tested, but a verdict is never worth losing a
      // finished race over.
      this.log('Verdict failed: ' + e);
      this._verdict = null;
      return null;
    }

    this.log('Verdict: ' + (this._verdict.limiter
      ? this._verdict.limiter.name
      : 'no limiter') +
      ', scale ' + this._verdict.globalScaleFactor.toFixed(2) +
      ', baseline ' + this._verdict.overallBaselineSource);

    return this._verdict;
  }

  /** Drop cached state, e.g. when the athlete restarts */
  reset(): void {
    this._result = null;
    this._verdict = null;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private toSamples(result: RaceResult): SplitSample[] {
    var out: SplitSample[] = [];
    if (!result.splits) return out;

    for (var i = 0; i < result.splits.length; i++) {
      var s = result.splits[i];
      if (!s || !s.name || s.durationMs <= 0) continue;
      out.push({ name: s.name, durationMs: s.durationMs, avgHR: s.avgHR });
    }

    return out;
  }

  /**
   * History for baselines. A cloud outage, a malformed row or a thrown
   * callback all collapse to "no history", which downgrades the verdict to
   * modelled baselines rather than removing it.
   */
  private safeHistory(currentConfigKey: string): HistoricRace[] {
    var records = this.safeCall<HistoricRaceRecord[]>(this.deps.getHistory, [], 'history');
    var out: HistoricRace[] = [];

    if (!records) return out;

    for (var i = 0; i < records.length; i++) {
      var record = records[i];
      if (!record || !record.splits || record.splits.length === 0) continue;
      if (record.completed === false) continue;

      var splits: SplitSample[] = [];
      for (var j = 0; j < record.splits.length; j++) {
        var sp = record.splits[j];
        if (!sp || !sp.name || !(sp.duration > 0)) continue;
        splits.push({ name: sp.name, durationMs: sp.duration, avgHR: sp.avgHR || 0 });
      }

      if (splits.length === 0) continue;

      out.push({ splits: splits, configKey: record.configKey });
    }

    return out;
  }

  private safeCall<T>(fn: () => T, fallback: T, label: string): T {
    if (!fn) return fallback;

    try {
      var value = fn();
      return value === null || value === undefined ? fallback : value;
    } catch (e) {
      this.log(label + ' unavailable: ' + e);
      return fallback;
    }
  }

  /** m:ss, matching the finish panel's existing split formatting */
  private formatShort(ms: number): string {
    var totalSeconds = Math.round(Math.abs(ms) / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  }

  /**
   * Logging is diagnostics, never a dependency. A logger that throws must not
   * be able to take down a race the athlete has already finished.
   */
  private log(message: string): void {
    if (!this.deps || !this.deps.log) return;

    try {
      this.deps.log('[RaceResults] ' + message);
    } catch (e) {
      // Nothing useful to do here - the reporting channel is the broken part
    }
  }
}
