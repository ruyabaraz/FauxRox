// ============================================================================
// SessionEligibility.ts — what a session is allowed to become
// ============================================================================
// A leaderboard is only worth anything if everything in it was earned the same
// way. Four things can put a result in front of other people - the leaderboard
// itself, a personal best, an achievement, the history the analysis reads -
// and each of them was guarded separately, at the call site, by whoever
// remembered.
//
// That is the wrong place. A guard at the call site protects the calls that
// exist today: the next one to be written is a leaderboard entry from a
// session that auto-completed its stations after four seconds in an editor.
// So the rule lives here, it is asked at the boundary where the writing
// actually happens, and it refuses rather than trusting the caller.
//
// Three things disqualify a result, and only the first is about the athlete:
//
//   training      A workout is not a race. There is no course to compare it
//                 against and no time to beat.
//   preview       Hand-tracked stations complete on a timer in the editor.
//                 The times measure the harness.
//   incomplete    A race that was stopped is not a race that was run.
//
// Pure: no Lens Studio imports.
// ============================================================================

export interface SessionEligibility {
  /** May appear on the leaderboard and set a personal best */
  countsForRanking: boolean;
  /** May be written to the history the analysis and the coach read */
  countsForHistory: boolean;
  /** May unlock an achievement */
  countsForAchievements: boolean;
  /** Why not, when not - for the log and for the panel */
  reason: string;
}

export interface SessionFacts {
  /** 'RACE' or 'TRAINING' */
  kind: string;
  /** True when the editor replaced hand-tracked stations with timers */
  previewSimplified: boolean;
  /** True when the athlete crossed the finish rather than stopping */
  completed: boolean;
}

const ELIGIBLE: SessionEligibility = {
  countsForRanking: true,
  countsForHistory: true,
  countsForAchievements: true,
  reason: '',
};

function refuse(reason: string, history: boolean): SessionEligibility {
  return {
    countsForRanking: false,
    countsForHistory: history,
    countsForAchievements: false,
    reason: reason,
  };
}

/**
 * What this session may become.
 *
 * A stopped race still counts as history - the athlete did the work up to the
 * point they stopped, and the coach should know about it - but it is not a
 * result. A preview session counts as nothing at all: its times measure the
 * editor.
 */
export function eligibilityOf(facts: SessionFacts): SessionEligibility {
  if (!facts) return refuse('no session', false);

  if (facts.previewSimplified) {
    return refuse('ran in preview, where stations complete on a timer', false);
  }

  if (facts.kind !== 'RACE') {
    return refuse('a training session, not a race', true);
  }

  if (!facts.completed) {
    return refuse('the race was stopped before the finish', true);
  }

  return ELIGIBLE;
}

/** True when this session may be written anywhere other people can see */
export function mayRank(facts: SessionFacts): boolean {
  return eligibilityOf(facts).countsForRanking;
}

/** True when this session may be written to the athlete's own history */
export function mayRecord(facts: SessionFacts): boolean {
  return eligibilityOf(facts).countsForHistory;
}
