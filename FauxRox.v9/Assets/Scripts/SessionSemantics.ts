// ============================================================================
// SessionSemantics.ts — what kind of thing the athlete is doing
// ============================================================================
// The race and a training session share one execution engine, and that is
// deliberate: one detection stack, one HUD, one spatial layer. What must not
// be shared is the *meaning*.
//
// Before this module the engine's vocabulary was hard-coded as race vocabulary
// in six places at once - the finish panel, the retry button, the coach's
// summary, the model's tool schema, its system instruction and the status
// line. The data layer knew perfectly well it was a training session (it was
// printing "Training session - skipping verdict" at that very moment) and then
// the coach said "Race completed in 2:39" out loud.
//
// So the kind is resolved once, into a value, and every layer that has to say
// something about the session reads it from here. Adding a third kind means
// adding a case here, not grepping for the word "race".
//
// Pure: no Lens Studio imports, so it can be tested outside the editor.
// ============================================================================

export type SessionKindName = 'RACE' | 'TRAINING';

export interface SessionSemantics {
  readonly kind: SessionKindName;

  /** Lowercase, for the middle of a sentence: "stop the session" */
  readonly noun: string;
  /** Sentence case, for the start of one: "Session paused" */
  readonly nounTitle: string;

  /** Finish panel headline when the whole thing was finished */
  readonly completionTitle: string;
  /** Finish panel headline when it was ended early */
  readonly stoppedTitle: string;

  /** Primary button on the finish panel */
  readonly retryLabel: string;

  /** Opening clause of the summary handed to the model */
  readonly summaryOpening: string;
  /** What to call the summary when asking the model for one */
  readonly summaryKind: string;

  /**
   * The paragraph the model is given about what it is looking at. This is the
   * only defence against it reaching for race language on its own: the system
   * instruction is sent once at connect time, long before the athlete has
   * picked anything, so the kind can only arrive per turn.
   */
  readonly aiContext: string;

  /** Whether the result belongs on the leaderboard and the personal best list */
  readonly countsForRanking: boolean;
}

const RACE: SessionSemantics = {
  kind: 'RACE',

  noun: 'race',
  nounTitle: 'Race',

  completionTitle: 'FINISHED!',
  stoppedTitle: 'STOPPED',

  retryLabel: 'RACE AGAIN',

  summaryOpening: 'Race completed in ',
  summaryKind: 'post-race',

  aiContext:
    'SESSION KIND: RACE. The athlete is running a full timed HYROX race. ' +
    'The finish time counts for their personal best and the leaderboard, so ' +
    'time and pacing are the point.',

  countsForRanking: true,
};

const TRAINING: SessionSemantics = {
  kind: 'TRAINING',

  noun: 'session',
  nounTitle: 'Session',

  completionTitle: 'SESSION COMPLETE',
  stoppedTitle: 'ENDED EARLY',

  retryLabel: 'NEW SESSION',

  summaryOpening: 'Training session finished after ',
  summaryKind: 'post-session',

  aiContext:
    'SESSION KIND: TRAINING. The athlete is doing a training session, not a ' +
    'race. There is no finish time to beat, no personal best and no ' +
    'leaderboard, and the total time is just how long the workout took. ' +
    'Never use the word "race" - call it a session or a workout. The athlete ' +
    'may still say "race" out of habit; they mean this session.',

  countsForRanking: false,
};

/**
 * The semantics for a kind.
 *
 * Anything unrecognised is treated as a race, which is the conservative
 * choice: a race that reads as training loses the athlete their personal
 * best, while training that reads as a race is only wrong out loud.
 */
export function semanticsFor(kind: string): SessionSemantics {
  return kind === 'TRAINING' ? TRAINING : RACE;
}

/** Headline for the finish panel */
export function finishTitle(
  semantics: SessionSemantics,
  completed: boolean
): string {
  return completed ? semantics.completionTitle : semantics.stoppedTitle;
}

/**
 * How the coach should open the summary.
 *
 * Kept next to the semantics rather than inside the coach so that the two
 * halves - "Race completed in" and "post-race summary" - cannot drift apart
 * and describe the session as two different things in one breath.
 */
export function summaryPreamble(semantics: SessionSemantics): string {
  return 'You are a supportive fitness coach. Give a brief ' +
         semantics.summaryKind + ' summary and feedback (2-3 sentences). ' +
         'Be encouraging but honest. Here is the data: ';
}


// ── Liveness ────────────────────────────────────────────────────────────────
//
// Whether a voice command can act depends on whether a session is happening,
// and that question was previously answered by listing the states in which it
// was. The list left out APPROACHING_STATION - walking up to a station, an
// entirely ordinary place to be - so an athlete standing there asked to stop
// and was told the session could not be stopped.
//
// Stated the other way round, as the two states in which nothing is running,
// so any state added later counts as live. That is the safe direction:
// refusing to stop is worse than stopping from an unusual state.

const NOT_RUNNING: { [state: string]: boolean } = {
  IDLE: true,
  FINISHED: true,
  '': true,
};

/** True while a session is happening, in any of the ways it can be happening */
export function isSessionUnderway(state: string): boolean {
  return !NOT_RUNNING[state || ''];
}

/** True when something is running that could be paused */
export function isSessionPausable(state: string): boolean {
  return isSessionUnderway(state) && state !== 'PAUSED';
}

/** True when something is waiting to be resumed */
export function isSessionPaused(state: string): boolean {
  return state === 'PAUSED';
}
