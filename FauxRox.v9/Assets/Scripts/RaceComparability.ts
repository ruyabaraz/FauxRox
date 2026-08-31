// ============================================================================
// RaceComparability.ts — when two race times mean the same thing
// ============================================================================
// A leaderboard sorts numbers. It only says anything about the athletes if
// every number was produced by the same work, and two of ours are not:
//
//   the course      The station distances and rep counts are scene inputs.
//                   A race run at fifty burpees and one run at twenty-five
//                   are different races with the same name, and configKey
//                   already records which was which.
//
//   the load        The athlete picks their own dumbbells. Nothing asks how
//                   heavy and nothing records it, so two identical times can
//                   be an eight-kilo carry and a thirty-kilo one.
//
// The first is fixable here: the key is on the record and the query can use
// it. The second is not. Load is a fact about the athlete's gym that the app
// has never been told, and no amount of care with the data we do have will
// recover it.
//
// So the contract is stated rather than assumed. A time is comparable to
// another when everything that shapes it matches, and until load is one of
// the things we know, a table of times from different people is a list of who
// has run this course - not a ranking of who is fastest.
//
// That is a decision to present honestly, not a bug to hide. A leaderboard
// that quietly compares a heavy athlete to a light one teaches the athlete
// the wrong thing about their own training.
//
// Pure: no Lens Studio imports.
// ============================================================================

/** Everything that has to match before two times can be set side by side */
export interface ComparisonKey {
  /** Station distances and rep counts, from CourseManager.getConfigKey() */
  configKey: string;
  /** Which rules the race was run under; bumped when the course changes shape */
  rulesVersion: number;
  /**
   * The load division the athlete competed in.
   *
   * Unknown today: nothing asks and nothing records it. Present in the key so
   * that adding it later is a value change rather than a redesign, and so
   * that the reason the board is unranked has somewhere to live.
   */
  loadDivision: string;
}

/** The rules a race is run under today */
export const RULES_VERSION = 1;

/** What the load division is when nobody has been asked */
export const LOAD_UNKNOWN = 'unknown';

export function comparisonKey(configKey: string, loadDivision?: string): ComparisonKey {
  return {
    configKey: configKey || '',
    rulesVersion: RULES_VERSION,
    loadDivision: loadDivision || LOAD_UNKNOWN,
  };
}

/** True when two races were run under the same conditions */
export function sameConditions(a: ComparisonKey, b: ComparisonKey): boolean {
  if (!a || !b) return false;

  // A missing configKey is not a wildcard. Records written before the column
  // existed do not say which course they ran, and "we do not know" is not the
  // same as "the same as yours".
  if (!a.configKey || !b.configKey) return false;

  return a.configKey === b.configKey &&
         a.rulesVersion === b.rulesVersion &&
         a.loadDivision === b.loadDivision;
}

/**
 * Whether a table of these times ranks anybody.
 *
 * It does not while the load is unknown, however carefully everything else
 * matches. Two athletes carrying different weights over the same distance are
 * not competing.
 */
export function ranksAthletes(key: ComparisonKey): boolean {
  return !!key && key.loadDivision !== LOAD_UNKNOWN && !!key.configKey;
}

/** What to say about a board that does not rank, and why */
export function unrankedReason(key: ComparisonKey): string {
  if (!key || !key.configKey) {
    return 'These races were run on different course settings.';
  }

  if (key.loadDivision === LOAD_UNKNOWN) {
    return 'Times only, not a ranking: everyone chooses their own weights ' +
           'and the app does not know what anyone lifted.';
  }

  return '';
}

/**
 * Whether one of the athlete's own races can be compared to another.
 *
 * A personal best is a different question from a leaderboard: it is the same
 * person, and the load they own has not changed between Tuesday and Thursday.
 * The course still has to match.
 */
export function comparableToOwnRace(mine: string, theirs: string): boolean {
  return !!mine && !!theirs && mine === theirs;
}
