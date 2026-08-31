// ============================================================================
// RaceResult.ts — the immutable record of a finished race
// ============================================================================
// RaceStateMachine's only output. It states what happened and nothing about
// what it means: no baselines, no verdict, no interpretation. Analysis is the
// results layer's job, which keeps the state machine free of any reason to
// know about RaceAnalysis, CloudManager or the coach.
//
// Frozen on construction so a consumer cannot quietly mutate a race after the
// fact and desync the verdict from the UI.
// ============================================================================

export interface RaceSplit {
  readonly name: string;
  readonly durationMs: number;
  readonly avgHR: number;
  readonly peakHR: number;
}

export interface RaceResult {
  /** getTime() * 1000 at the moment the race ended */
  readonly finishedAtMs: number;
  readonly totalMs: number;
  /** false when the athlete stopped early */
  readonly completed: boolean;

  readonly splits: ReadonlyArray<RaceSplit>;
  readonly avgHR: number;
  readonly peakHR: number;
  /** Athlete's estimated max HR, needed to read the splits' load */
  readonly maxHR: number;

  /** Course tuning, from CourseManager.getConfigKey() */
  readonly configKey: string;
  /** 'RACE' or 'TRAINING' */
  readonly sessionKind: string;
  readonly sessionTitle: string;
  /** True when this counts for PB and leaderboard */
  readonly countsForRanking: boolean;

  readonly incompleteStations: ReadonlyArray<string>;
}

/**
 * Freeze without assuming the runtime supports it. Object.freeze is ES5 and
 * should be present, but a missing implementation must not take down a race
 * the athlete just finished.
 */
function freeze<T>(value: T): T {
  try {
    if (typeof Object.freeze === 'function') {
      return Object.freeze(value);
    }
  } catch (e) {
    // Immutability is a guard rail, not a requirement
  }
  return value;
}

export function makeRaceSplit(
  name: string,
  durationMs: number,
  avgHR: number,
  peakHR: number
): RaceSplit {
  return freeze({
    name: name || '',
    durationMs: durationMs > 0 ? durationMs : 0,
    avgHR: avgHR > 0 ? avgHR : 0,
    peakHR: peakHR > 0 ? peakHR : 0,
  });
}

export function makeRaceResult(fields: {
  finishedAtMs: number;
  totalMs: number;
  completed: boolean;
  splits: RaceSplit[];
  avgHR: number;
  peakHR: number;
  maxHR: number;
  configKey: string;
  sessionKind: string;
  sessionTitle: string;
  countsForRanking: boolean;
  incompleteStations: string[];
}): RaceResult {
  var splits: RaceSplit[] = [];
  for (var i = 0; i < (fields.splits ? fields.splits.length : 0); i++) {
    splits.push(freeze(fields.splits[i]));
  }

  return freeze({
    finishedAtMs: fields.finishedAtMs,
    totalMs: fields.totalMs,
    completed: fields.completed,
    splits: freeze(splits),
    avgHR: fields.avgHR || 0,
    peakHR: fields.peakHR || 0,
    maxHR: fields.maxHR || 0,
    configKey: fields.configKey || '',
    sessionKind: fields.sessionKind || 'RACE',
    sessionTitle: fields.sessionTitle || '',
    countsForRanking: fields.countsForRanking !== false,
    incompleteStations: freeze(fields.incompleteStations || []),
  });
}
