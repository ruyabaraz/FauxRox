// ============================================================================
// TrainingHistory.ts — what the athlete has already trained, and been offered
// ============================================================================
// Pure functions over a small value. Persistence lives in ProfileManager; the
// rules for what counts and what gets remembered live here so they can be
// tested without an editor.
//
// Three counters, because there are three different questions and collapsing
// any two of them produces a bug we have already shipped once:
//
//   completionOrdinal  How many training sessions the athlete has actually
//                      done. This is history. Progression reads this and
//                      nothing else.
//
//   offerOrdinal       How many sessions have been offered and thrown away.
//                      Starting a workout and walking out of it must not
//                      count as having trained - but it must not hand back
//                      the identical workout either, which is what happened
//                      when a single counter served both purposes.
//
//   previewOffset      Sessions ended in Lens Studio preview. Kept in memory
//                      by ProfileManager, never stored, so an afternoon of
//                      testing does not arrive on device as a training block.
//
// Only the first is a claim about the athlete. The other two are claims about
// the app's own state, which is why persisting offerOrdinal does not mean
// counting an abandoned workout as done.
// ============================================================================

export interface TrainingLog {
  /** Completed training sessions - history, and the only progression input */
  completionOrdinal: number;
  /** Sessions offered and abandoned - draw state, not history */
  offerOrdinal: number;
  /** Unique prefabTypes from the most recent completed session */
  recent: string[];

  /**
   * The running archetype of the last completed session, or '' for a session
   * that was not running.
   *
   * The movement list above cannot answer this. Threshold repetitions and
   * maximal aerobic ones are the same movement - a run - and what separates
   * them is the distance, the recovery and the pace they are meant to be run
   * at, none of which survives being reduced to a prefab name.
   */
  lastArchetype: string;

  /**
   * When that session finished, epoch milliseconds, or 0 when unknown.
   *
   * A hard session yesterday and a hard session three weeks ago are different
   * situations, and scheduling that could not tell them apart would be
   * refusing hard sessions to somebody who has not trained since. Zero means
   * a log written before this was recorded, and is read as long ago rather
   * than as recent: with no evidence the athlete trained yesterday, holding
   * them back would be a guess against their interest.
   */
  lastCompletedAt: number;

  /**
   * How many times the Lens has been opened.
   *
   * The draw moved when a session was finished or abandoned, and only then.
   * That is right while somebody is standing in the picker changing their
   * mind - toggling the options should not reshuffle the workout underneath
   * them - and wrong across days: an athlete who opens the Lens, is offered
   * an easy run and closes it again was offered the same easy run the next
   * morning, and the morning after that, because nothing they did counted as
   * an outcome. Three of those in a row is indistinguishable from a broken
   * generator, which is what it was reported as.
   *
   * So opening the app moves it too. Same session all the way through one
   * visit; a different draw the next time they come back.
   */
  launchOrdinal: number;
}

export function emptyTrainingLog(): TrainingLog {
  return {
    completionOrdinal: 0,
    offerOrdinal: 0,
    recent: [],
    lastArchetype: '',
    lastCompletedAt: 0,
    launchOrdinal: 0,
  };
}

/**
 * Another visit.
 *
 * Called once when the Lens starts. Everything else about the log is a claim
 * about training; this is a claim about the app, and it exists so that the
 * same athlete on the same profile is not handed the same session every
 * morning until they happen to finish one.
 */
export function noteLaunch(log: TrainingLog): TrainingLog {
  var current = log || emptyTrainingLog();

  return {
    completionOrdinal: current.completionOrdinal,
    offerOrdinal: current.offerOrdinal,
    recent: current.recent,
    lastArchetype: current.lastArchetype,
    lastCompletedAt: current.lastCompletedAt,
    launchOrdinal: (current.launchOrdinal | 0) + 1,
  };
}

/**
 * Entries that are session furniture rather than movements.
 *
 * Rest and the walk between intervals are not exercises, the markers are not
 * either, and warm-up drills are chosen from their own pool - penalising them
 * in the race and accessory ranking would mean nothing.
 */
const NOT_A_MOVEMENT: { [prefabType: string]: boolean } = {
  START: true,
  FINISH: true,
  REST: true,
  RECOVERY: true,
};

function isWarmupPrefab(prefabType: string): boolean {
  return prefabType.indexOf('WARMUP_') === 0;
}

/**
 * The movements a session actually trained.
 *
 * A movement repeated across seven rounds is one movement, so the result is
 * unique: the recency list stays the size of a workout, not the size of a
 * flattened plan.
 */
export function extractMovements(
  stations: { prefabType: string }[]
): string[] {
  var out: string[] = [];
  var seen: { [k: string]: boolean } = {};

  for (var i = 0; i < (stations ? stations.length : 0); i++) {
    var prefabType = stations[i] ? stations[i].prefabType : '';
    if (!prefabType) continue;
    if (NOT_A_MOVEMENT[prefabType]) continue;
    if (isWarmupPrefab(prefabType)) continue;
    if (seen[prefabType]) continue;

    seen[prefabType] = true;
    out.push(prefabType);
  }

  return out;
}

/**
 * Fold a completed session into the log.
 *
 * This is the only function that touches completionOrdinal or recent, and the
 * only one an athlete can trigger by finishing something.
 */
export function recordCompletedSession(
  log: TrainingLog,
  movements: string[],
  archetype?: string,
  completedAt?: number
): TrainingLog {
  var previous = log || emptyTrainingLog();

  return {
    completionOrdinal: previous.completionOrdinal + 1,
    offerOrdinal: previous.offerOrdinal,
    recent: movements ? movements.slice() : [],
    lastArchetype: archetype || '',
    lastCompletedAt: completedAt !== undefined ? completedAt : 0,
    launchOrdinal: previous.launchOrdinal,
  };
}

/**
 * Fold an abandoned session into the log.
 *
 * Nothing was trained, so history does not move and the recency list keeps
 * describing the last session that was actually finished. What moves is the
 * draw: press START, press STOP, ask for another one, and it has to be
 * another one.
 */
export function recordAbandonedSession(log: TrainingLog): TrainingLog {
  var previous = log || emptyTrainingLog();

  return {
    completionOrdinal: previous.completionOrdinal,
    offerOrdinal: previous.offerOrdinal + 1,
    recent: previous.recent.slice(),
    // Nothing was trained, so the last session the athlete actually did is
    // still the last session they actually did - and still owes whatever
    // recovery it owed.
    lastArchetype: previous.lastArchetype,
    lastCompletedAt: previous.lastCompletedAt,
    launchOrdinal: previous.launchOrdinal,
  };
}

/**
 * The seed the generator draws from.
 *
 * Both counters feed it and neither can stand in for the other: mixing rather
 * than adding means (3 completed, 0 abandoned) and (0 completed, 3 abandoned)
 * are different states of the world and get different sessions, which is what
 * they are. Adding them back together would be the original bug wearing new
 * field names.
 *
 * Same FNV-and-xorshift shape as the generator's own jitter, so the two agree
 * about what "a nearby seed" means - which is: nothing.
 *
 * @param previewOffset ephemeral, from ProfileManager; zero on device
 */
export function trainingSeed(log: TrainingLog, previewOffset: number): number {
  var current = log || emptyTrainingLog();
  var completed = current.completionOrdinal | 0;
  var offered = (current.offerOrdinal + (previewOffset || 0)) | 0;
  var visits = current.launchOrdinal | 0;

  var h = 2166136261 ^ completed;
  h = Math.imul(h, 16777619);
  h ^= offered;
  h = Math.imul(h, 16777619);
  h ^= visits;
  h = Math.imul(h, 16777619);

  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  h ^= h >>> 16;

  // Kept small and non-negative: the seed is hashed again with a key string
  // for every decision, so its magnitude carries no meaning and a huge number
  // only makes the logs harder to read.
  return (h >>> 0) % 100000;
}

/**
 * Parse a stored log, falling back to an empty one on anything unexpected.
 *
 * Also migrates the single-counter form this replaced: a log written before
 * the split has `ordinal`, and that number was only ever incremented on
 * completion, so it is a completionOrdinal.
 */
export function parseTrainingLog(raw: string): TrainingLog {
  if (!raw || raw.length === 0) return emptyTrainingLog();

  try {
    var parsed = JSON.parse(raw);

    var completed = count(parsed.completionOrdinal);
    if (completed === 0) completed = count(parsed.ordinal);

    var recent: string[] = [];
    if (parsed.recent && parsed.recent.length !== undefined) {
      for (var i = 0; i < parsed.recent.length; i++) {
        if (typeof parsed.recent[i] === 'string') recent.push(parsed.recent[i]);
      }
    }

    return {
      completionOrdinal: completed,
      offerOrdinal: count(parsed.offerOrdinal),
      recent: recent,
      // Absent in every log written before scheduling existed, and read as
      // "not known" rather than defaulted to something plausible: an invented
      // archetype would be scheduled against, and an invented timestamp would
      // hold a real athlete back from a session they had earned.
      lastArchetype: typeof parsed.lastArchetype === 'string'
        ? parsed.lastArchetype : '',
      lastCompletedAt: count(parsed.lastCompletedAt),
      launchOrdinal: count(parsed.launchOrdinal),
    };
  } catch (e) {
    return emptyTrainingLog();
  }
}

function count(value: any): number {
  return typeof value === 'number' && isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}
