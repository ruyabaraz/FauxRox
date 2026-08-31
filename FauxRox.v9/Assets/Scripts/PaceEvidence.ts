// ============================================================================
// PaceEvidence.ts — what the athlete told us, kept as what they told us
// ============================================================================
// The thing that gets written to disk is "they ran a 5K in twenty-six
// minutes", not "their threshold is 5:27 to 5:31 per kilometre". The first is
// something that happened. The second is what this version of the model makes
// of it, and the model has already been wrong once in this project - the
// threshold estimate moved by nine seconds a kilometre between two drafts of
// A2, and anyone whose profile had been written during the first one would
// have carried it forever.
//
// So evidence is stored and prescriptions are derived, every time. A better
// model improves everybody's paces on the next session rather than only new
// athletes'.
//
// Declining counts as evidence too - of a decision rather than a performance.
// An athlete who says no should not be asked again every time they choose a
// running session, and the only way to know they said no is to have written
// it down.
//
// Pure: no Lens Studio imports.
// ============================================================================

import { PaceAnchor, PaceBand, anchorFromFiveK, anchorFromThresholdPace } from './PaceTarget';

/** A 5K the athlete says they ran */
export interface FiveKEvidence {
  seconds: number;
  enteredAtEpochMs: number;
}

/**
 * One run from a race, as it was measured.
 *
 * The pace is what the athlete actually ran - taken from the run's own
 * measurement of distance and moving time - and the distance is kept beside
 * it because a pace over forty metres is a measurement of turning around
 * rather than of running.
 */
export interface HyroxRunSample {
  paceSecPerKm: number;
  metres: number;
  atEpochMs: number;
}

/**
 * One repetition from a training session, as it was measured.
 *
 * An observation, which is not an anchor. It is what happened on one
 * repetition of one session, and what makes it evidence about the athlete
 * rather than about that afternoon is there being enough of it, agreeing.
 */
export interface RunObservation {
  archetype: string;
  paceSecPerKm: number;
  metres: number;
  /** The session it belongs to, so six repetitions are not six sessions */
  sessionAtEpochMs: number;
}

export interface PaceEvidenceStore {
  fiveK?: FiveKEvidence;
  /** When they were offered the question and said no */
  declinedAtEpochMs?: number;
  /** Runs measured during races, newest last */
  hyroxRuns?: HyroxRunSample[];
  /** Repetitions measured during training, newest last */
  observations?: RunObservation[];
}

export function emptyPaceEvidence(): PaceEvidenceStore {
  return {};
}

// ── Race pace ───────────────────────────────────────────────────────────────
//
// The one archetype no model can answer for. What somebody holds over eight
// kilometres with eight stations between them is not predicted by their road
// running, so the only honest source is having watched them do it.
//
// Which is also why this is the one band that is measured rather than
// derived, and why it stays out of everything else: a race split is run under
// fatigue, between stations, on a course we do not control. It says what that
// athlete holds on race day and nothing about their threshold.

/**
 * The shortest run a race pace may be read from.
 *
 * A course laid out in a living room runs its athletes forty metres at a
 * time, and a forty metre split is mostly acceleration and a turn. Two
 * hundred metres is where the running starts to outweigh the geometry.
 */
export const MIN_HYROX_SAMPLE_METRES = 200;

/**
 * How many runs before the centre of them means anything.
 *
 * One split is a split. Three is the beginning of a pace - and the median of
 * three survives the one where they stopped to fix a shoe, which a mean does
 * not.
 */
export const MIN_HYROX_SAMPLES = 3;

/** Runs kept. Older ones fall off the front rather than diluting the centre. */
export const HYROX_SAMPLE_CAPACITY = 16;

/**
 * How old a race split may be and still describe the athlete.
 *
 * Six months. Fitness moves, and a band built from last winter would be
 * prescribing to somebody who no longer exists.
 */
export const HYROX_EVIDENCE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * Half the width of the band built around a measured centre.
 *
 * Five seconds a kilometre either way - about two seconds per four hundred
 * metres, which is as fine as anybody holds a pace between stations. Narrower
 * would be false precision about a number that came from a handful of runs.
 */
export const HYROX_BAND_HALF_WIDTH_SEC_PER_KM = 5;

/** Paces outside this are a broken measurement, not a runner */
export const FASTEST_BELIEVABLE_PACE_SEC_PER_KM = 150;
export const SLOWEST_BELIEVABLE_PACE_SEC_PER_KM = 900;

export function isBelievableRunSample(sample: HyroxRunSample): boolean {
  if (!sample) return false;

  return sample.metres >= MIN_HYROX_SAMPLE_METRES &&
         isFinite(sample.paceSecPerKm) &&
         sample.paceSecPerKm >= FASTEST_BELIEVABLE_PACE_SEC_PER_KM &&
         sample.paceSecPerKm <= SLOWEST_BELIEVABLE_PACE_SEC_PER_KM;
}

/**
 * Fold a race's runs in, keeping the most recent.
 *
 * Samples that are too short or too strange never enter the store at all -
 * filtering on the way out would mean the count of what is known depends on
 * who is asking.
 */
export function recordHyroxRuns(
  store: PaceEvidenceStore,
  samples: HyroxRunSample[]
): PaceEvidenceStore {
  var previous = store || emptyPaceEvidence();
  var kept: HyroxRunSample[] = (previous.hyroxRuns || []).slice();

  for (var i = 0; i < (samples ? samples.length : 0); i++) {
    if (isBelievableRunSample(samples[i])) kept.push(samples[i]);
  }

  if (kept.length > HYROX_SAMPLE_CAPACITY) {
    kept = kept.slice(kept.length - HYROX_SAMPLE_CAPACITY);
  }

  return {
    fiveK: previous.fiveK,
    declinedAtEpochMs: previous.declinedAtEpochMs,
    hyroxRuns: kept,
    observations: previous.observations,
  };
}

/** Samples recent enough to describe the athlete as they are now */
export function freshHyroxRuns(
  store: PaceEvidenceStore,
  nowEpochMs: number
): HyroxRunSample[] {
  var all = (store || emptyPaceEvidence()).hyroxRuns || [];
  var out: HyroxRunSample[] = [];

  for (var i = 0; i < all.length; i++) {
    var age = nowEpochMs - all[i].atEpochMs;
    if (isBelievableRunSample(all[i]) && age >= 0 && age <= HYROX_EVIDENCE_MAX_AGE_MS) {
      out.push(all[i]);
    }
  }

  return out;
}

/**
 * The middle of a set of paces, the way a coach would read them.
 *
 * Median rather than mean. One run in a race is always the one where
 * something happened - a dropped dumbbell, a queue at the sled - and it lands
 * on the slow side, where a mean would carry it into the band and a median
 * steps over it.
 */
export function robustCentreSecPerKm(samples: HyroxRunSample[]): number {
  if (!samples || samples.length === 0) return 0;

  var paces: number[] = [];
  for (var i = 0; i < samples.length; i++) paces.push(samples[i].paceSecPerKm);

  return medianOf(paces);
}

/**
 * What the athlete's races say about their race pace, and only that.
 *
 * A band around what was measured rather than a fitness index: there is no
 * model to feed, and the whole point of this source is that it did not come
 * from one.
 */
export function hyroxAnchorFrom(
  store: PaceEvidenceStore,
  nowEpochMs: number
): PaceAnchor | null {
  var fresh = freshHyroxRuns(store, nowEpochMs);
  if (fresh.length < MIN_HYROX_SAMPLES) return null;

  var centre = robustCentreSecPerKm(fresh);
  if (!(centre > 0)) return null;

  var band: PaceBand = {
    fastestSecPerKm: centre - HYROX_BAND_HALF_WIDTH_SEC_PER_KM,
    slowestSecPerKm: centre + HYROX_BAND_HALF_WIDTH_SEC_PER_KM,
  };

  return {
    kind: 'MEASURED',
    source: 'HYROX_HISTORY',
    derivation: 'RACE_SPLITS',
    // Measured, from enough of them, and about the exact thing being
    // prescribed. Nothing about it is a stand-in for something better.
    provisional: false,
    band: band,
  };
}

/**
 * The slowest and fastest 5K worth believing.
 *
 * The fast end is inside the world record on purpose - somebody typing 11:00
 * has mistyped, and a fitness index built from it would prescribe paces
 * nobody can run. The slow end is generous: an hour for five kilometres is
 * walking, and below that is somebody's real starting point.
 */
export const FASTEST_BELIEVABLE_5K_SECONDS = 13 * 60;
export const SLOWEST_BELIEVABLE_5K_SECONDS = 60 * 60;

/**
 * Seconds from a typed time, or null.
 *
 * Minutes and seconds, because that is how everybody has their 5K in their
 * head. A bare number is refused rather than guessed at: "26" could be
 * twenty-six minutes or twenty-six seconds, and the difference is the
 * difference between a training plan and a nonsense one.
 */
export function parseFiveKTime(text: string): number | null {
  if (!text) return null;

  var trimmed = String(text).trim();
  var colon = trimmed.indexOf(':');
  if (colon < 1) return null;

  var minutePart = trimmed.substring(0, colon);
  var secondPart = trimmed.substring(colon + 1);

  if (!allDigits(minutePart) || secondPart.length !== 2 || !allDigits(secondPart)) {
    return null;
  }

  var minutes = parseInt(minutePart, 10);
  var seconds = parseInt(secondPart, 10);
  if (!isFinite(minutes) || !isFinite(seconds) || seconds > 59) return null;

  var total = minutes * 60 + seconds;
  return isBelievableFiveK(total) ? total : null;
}

/**
 * The same time, typed on a keypad with no colon on it.
 *
 * The AR keyboard's numeric type is the one worth raising on a pair of
 * glasses - six keys and a done, rather than a full keyboard hanging in the
 * air - and it has no colon. Four digits are read the way a stopwatch shows
 * them: 2430 is twenty-four thirty.
 *
 * Three digits are the same reading with the leading zero left off. Two are
 * still refused, because 26 is the answer everybody gives out loud and the
 * one nobody can be sure about.
 */
export function parseFiveKDigits(text: string): number | null {
  if (!text) return null;

  var digits = '';
  var raw = String(text);
  for (var i = 0; i < raw.length; i++) {
    var code = raw.charCodeAt(i);
    if (code >= 48 && code <= 57) digits += raw.charAt(i);
  }

  if (digits.length < 3 || digits.length > 4) return null;

  var minutes = parseInt(digits.substring(0, digits.length - 2), 10);
  var seconds = parseInt(digits.substring(digits.length - 2), 10);
  if (!isFinite(minutes) || !isFinite(seconds) || seconds > 59) return null;

  var total = minutes * 60 + seconds;
  return isBelievableFiveK(total) ? total : null;
}

/**
 * However they entered it.
 *
 * One reader for both keyboards, so the answer does not depend on which one
 * the glasses happened to raise.
 */
export function parseFiveKEntry(text: string): number | null {
  var withColon = parseFiveKTime(text);
  return withColon !== null ? withColon : parseFiveKDigits(text);
}

export function isBelievableFiveK(seconds: number): boolean {
  return typeof seconds === 'number' && isFinite(seconds) &&
         seconds >= FASTEST_BELIEVABLE_5K_SECONDS &&
         seconds <= SLOWEST_BELIEVABLE_5K_SECONDS;
}

/** mmss, for handing a time to a keypad that has no colon on it */
export function formatFiveKDigits(seconds: number): string {
  var whole = Math.max(0, Math.round(seconds));
  var mins = Math.floor(whole / 60);
  var secs = whole % 60;
  return String(mins) + (secs < 10 ? '0' : '') + String(secs);
}

/** mm:ss, for showing back what was entered */
export function formatFiveKTime(seconds: number): string {
  var whole = Math.max(0, Math.round(seconds));
  var mins = Math.floor(whole / 60);
  var secs = whole % 60;
  return mins + ':' + (secs < 10 ? '0' : '') + secs;
}

// ── Entering one without a keyboard ─────────────────────────────────────────
//
// The system keyboard does not exist in the editor preview and is a heavy
// thing to raise on a pair of glasses for four digits. A time is four taps on
// a stepper and no modal at all, and it is the only way the question can be
// answered while the session is being set up rather than in a text field
// somewhere else.
//
// The typed field still works where it is wired. This is what happens when it
// is not.

/**
 * Where the stepper opens.
 *
 * Twenty-five minutes, which is a five minute kilometre - near the middle of
 * the range of people who would answer this question at all, so most athletes
 * are a few taps from their time in either direction.
 */
export const FIVE_K_START_SECONDS = 25 * 60;

/** A minute at a time, and then fifteen seconds at a time */
export const FIVE_K_COARSE_STEP_SECONDS = 60;
export const FIVE_K_FINE_STEP_SECONDS = 15;

/**
 * Move the stepper, staying inside what anybody has run.
 *
 * Clamped rather than refused: somebody holding down the fast end wants the
 * fast end, and a stepper that stops moving says so more clearly than one
 * that silently declines the tap.
 */
export function stepFiveK(current: number, deltaSeconds: number): number {
  var from = isBelievableFiveK(current) ? current : FIVE_K_START_SECONDS;
  var moved = from + deltaSeconds;

  // On the grid the buttons move in, so a mix of coarse and fine taps cannot
  // leave a time on a number no button could reach.
  var snapped = Math.round(moved / FIVE_K_FINE_STEP_SECONDS) * FIVE_K_FINE_STEP_SECONDS;

  if (snapped < FASTEST_BELIEVABLE_5K_SECONDS) return FASTEST_BELIEVABLE_5K_SECONDS;
  if (snapped > SLOWEST_BELIEVABLE_5K_SECONDS) return SLOWEST_BELIEVABLE_5K_SECONDS;

  return snapped;
}

export function recordFiveK(
  store: PaceEvidenceStore,
  seconds: number,
  atEpochMs: number
): PaceEvidenceStore {
  if (!isBelievableFiveK(seconds)) return store || emptyPaceEvidence();

  var previous = store || emptyPaceEvidence();

  return {
    fiveK: { seconds: seconds, enteredAtEpochMs: atEpochMs },
    declinedAtEpochMs: previous.declinedAtEpochMs,
    hyroxRuns: previous.hyroxRuns,
    observations: previous.observations,
  };
}

/**
 * They were asked and said no.
 *
 * Remembered so the question is not put again on every running session. It is
 * a perfectly good answer - most athletes do not have a recent 5K, and a
 * session with no pace target is a complete session.
 */
export function recordDeclined(
  store: PaceEvidenceStore,
  atEpochMs: number
): PaceEvidenceStore {
  var previous = store || emptyPaceEvidence();

  return {
    fiveK: previous.fiveK,
    declinedAtEpochMs: atEpochMs,
    hyroxRuns: previous.hyroxRuns,
    observations: previous.observations,
  };
}

/** Whether there is anything to ask the athlete for */
export function shouldOfferPaceEvidence(store: PaceEvidenceStore): boolean {
  var current = store || emptyPaceEvidence();

  if (current.fiveK && isBelievableFiveK(current.fiveK.seconds)) return false;
  if (current.declinedAtEpochMs) return false;

  return true;
}

/**
 * The anchor the stored evidence produces, derived fresh every time.
 *
 * Never persisted. This is the whole reason the store holds a time rather
 * than a set of bands.
 */
export function anchorFrom(store: PaceEvidenceStore): PaceAnchor | null {
  var current = store || emptyPaceEvidence();
  if (!current.fiveK || !isBelievableFiveK(current.fiveK.seconds)) return null;

  return anchorFromFiveK(current.fiveK.seconds);
}

// ── Calibration ─────────────────────────────────────────────────────────────
//
// An observation is not an anchor.
//
// One threshold repetition run at 5:14 is a fact about that repetition. It
// becomes a fact about the athlete only when there is enough of it, from more
// than one session, and the sessions agree - which is the difference between
// measuring somebody and overreacting to a Tuesday.
//
// Threshold and nothing else. It is the one intensity long enough to be paced
// rather than gutted out, run at an effort people reproduce from week to
// week, and the one whose relationship to a fitness index the model already
// states in the other direction. Maximal aerobic repetitions are three
// minutes long and vary with how much somebody had left; easy runs are
// limited by patience rather than physiology; speed repetitions are not
// aerobic at all. A promotion policy built on any of them would be measuring
// the wrong thing precisely.

/** The archetype a fitness index may be read from */
export const CALIBRATION_ARCHETYPE = 'THRESHOLD';

/** Repetitions before the median of them is about the athlete */
export const MIN_CALIBRATION_SAMPLES = 5;

/**
 * Sessions those repetitions must come from.
 *
 * Two, because one session is one afternoon. Everybody has a day when they
 * were tired, or fresh, or racing a friend, and a fitness index built from it
 * would prescribe the next month from that day.
 */
export const MIN_CALIBRATION_SESSIONS = 2;

/**
 * How far apart the sessions may be before they stop describing one athlete.
 *
 * Twenty seconds a kilometre between the fastest and slowest session median.
 * Wider than that is not a noisy measurement of one fitness, it is two
 * different efforts, and taking a median of them would produce a number that
 * describes neither.
 */
export const CALIBRATION_SPREAD_LIMIT_SEC_PER_KM = 20;

/** Kept for the same six months as the race splits, and for the same reason */
export const OBSERVATION_MAX_AGE_MS = HYROX_EVIDENCE_MAX_AGE_MS;

/** Enough for several sessions of repetitions without growing without bound */
export const OBSERVATION_CAPACITY = 40;

export function isBelievableObservation(observation: RunObservation): boolean {
  if (!observation) return false;

  return observation.metres >= MIN_HYROX_SAMPLE_METRES &&
         isFinite(observation.paceSecPerKm) &&
         observation.paceSecPerKm >= FASTEST_BELIEVABLE_PACE_SEC_PER_KM &&
         observation.paceSecPerKm <= SLOWEST_BELIEVABLE_PACE_SEC_PER_KM;
}

/** Fold a session's repetitions in, keeping the most recent */
export function recordObservations(
  store: PaceEvidenceStore,
  observations: RunObservation[]
): PaceEvidenceStore {
  var previous = store || emptyPaceEvidence();
  var kept: RunObservation[] = (previous.observations || []).slice();

  for (var i = 0; i < (observations ? observations.length : 0); i++) {
    if (isBelievableObservation(observations[i])) kept.push(observations[i]);
  }

  if (kept.length > OBSERVATION_CAPACITY) {
    kept = kept.slice(kept.length - OBSERVATION_CAPACITY);
  }

  return {
    fiveK: previous.fiveK,
    declinedAtEpochMs: previous.declinedAtEpochMs,
    hyroxRuns: previous.hyroxRuns,
    observations: kept,
  };
}

/** Observations recent enough, and of the one archetype that can speak */
export function calibratableObservations(
  store: PaceEvidenceStore,
  nowEpochMs: number
): RunObservation[] {
  var all = (store || emptyPaceEvidence()).observations || [];
  var out: RunObservation[] = [];

  for (var i = 0; i < all.length; i++) {
    var observation = all[i];
    var age = nowEpochMs - observation.sessionAtEpochMs;

    if (observation.archetype === CALIBRATION_ARCHETYPE &&
        isBelievableObservation(observation) &&
        age >= 0 && age <= OBSERVATION_MAX_AGE_MS) {
      out.push(observation);
    }
  }

  return out;
}

/** One number per session, so a long session does not outvote two short ones */
export function sessionMedians(observations: RunObservation[]): number[] {
  var bySession: { [key: string]: number[] } = {};
  var order: string[] = [];

  for (var i = 0; i < (observations ? observations.length : 0); i++) {
    var key = String(observations[i].sessionAtEpochMs);
    if (!bySession[key]) { bySession[key] = []; order.push(key); }
    bySession[key].push(observations[i].paceSecPerKm);
  }

  var out: number[] = [];
  for (var s = 0; s < order.length; s++) out.push(medianOf(bySession[order[s]]));
  return out;
}

/**
 * Whether the sessions agree closely enough to describe one athlete.
 *
 * Compared session against session rather than repetition against
 * repetition: fading through a session is what a threshold session does to
 * people, and it is not a disagreement about their fitness.
 */
export function calibrationSpread(medians: number[]): number {
  if (!medians || medians.length === 0) return 0;

  var fastest = medians[0];
  var slowest = medians[0];

  for (var i = 1; i < medians.length; i++) {
    if (medians[i] < fastest) fastest = medians[i];
    if (medians[i] > slowest) slowest = medians[i];
  }

  return slowest - fastest;
}

/**
 * The anchor the athlete's own sessions have earned, or null.
 *
 * Null is the ordinary answer and stays the answer for most people: three
 * threshold sessions is a month of one kind of training, and plenty of
 * athletes never do them. Nothing degrades in that state - the 5K they typed
 * in keeps answering, and if they typed in nothing then the sessions say
 * nothing about pace, which is what they did before any of this existed.
 */
export function calibrationAnchorFrom(
  store: PaceEvidenceStore,
  nowEpochMs: number
): PaceAnchor | null {
  var usable = calibratableObservations(store, nowEpochMs);
  if (usable.length < MIN_CALIBRATION_SAMPLES) return null;

  var medians = sessionMedians(usable);
  if (medians.length < MIN_CALIBRATION_SESSIONS) return null;
  if (calibrationSpread(medians) > CALIBRATION_SPREAD_LIMIT_SEC_PER_KM) return null;

  return anchorFromThresholdPace(medianOf(medians));
}

function medianOf(values: number[]): number {
  if (!values || values.length === 0) return 0;

  var sorted = values.slice();
  sorted.sort(function (a, b) { return a - b; });

  var middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Read a stored blob back, believing only what is believable */
export function parsePaceEvidence(raw: string): PaceEvidenceStore {
  if (!raw) return emptyPaceEvidence();

  try {
    var parsed = JSON.parse(raw);
    var out: PaceEvidenceStore = {};

    if (parsed && parsed.fiveK && isBelievableFiveK(parsed.fiveK.seconds)) {
      out.fiveK = {
        seconds: parsed.fiveK.seconds,
        enteredAtEpochMs: whole(parsed.fiveK.enteredAtEpochMs),
      };
    }

    if (parsed && whole(parsed.declinedAtEpochMs) > 0) {
      out.declinedAtEpochMs = whole(parsed.declinedAtEpochMs);
    }

    if (parsed && parsed.hyroxRuns && parsed.hyroxRuns.length) {
      var runs: HyroxRunSample[] = [];
      for (var i = 0; i < parsed.hyroxRuns.length; i++) {
        var stored = parsed.hyroxRuns[i];
        if (!stored) continue;

        var sample: HyroxRunSample = {
          paceSecPerKm: typeof stored.paceSecPerKm === 'number' ? stored.paceSecPerKm : 0,
          metres: typeof stored.metres === 'number' ? stored.metres : 0,
          atEpochMs: whole(stored.atEpochMs),
        };
        if (isBelievableRunSample(sample)) runs.push(sample);
      }
      if (runs.length > 0) out.hyroxRuns = runs;
    }

    if (parsed && parsed.observations && parsed.observations.length) {
      var seen: RunObservation[] = [];
      for (var o = 0; o < parsed.observations.length; o++) {
        var held = parsed.observations[o];
        if (!held) continue;

        var observation: RunObservation = {
          archetype: typeof held.archetype === 'string' ? held.archetype : '',
          paceSecPerKm: typeof held.paceSecPerKm === 'number' ? held.paceSecPerKm : 0,
          metres: typeof held.metres === 'number' ? held.metres : 0,
          sessionAtEpochMs: whole(held.sessionAtEpochMs),
        };
        if (observation.archetype && isBelievableObservation(observation)) {
          seen.push(observation);
        }
      }
      if (seen.length > 0) out.observations = seen;
    }

    return out;
  } catch (e) {
    return emptyPaceEvidence();
  }
}

function whole(value: any): number {
  return typeof value === 'number' && isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function allDigits(text: string): boolean {
  if (!text || text.length === 0) return false;

  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }

  return true;
}
