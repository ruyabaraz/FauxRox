// ============================================================================
// PaceTarget.ts — a pace the athlete is told to run at, or nothing
// ============================================================================
// There is a number in this codebase that says how fast a threshold kilometre
// is, and it must never appear on the panel. MODEL_THRESHOLD_PACE_SEC_PER_KM
// and the archetype factors are a prior for fitting sessions to a duration -
// they exist so the generator can decide how many repetitions fit in twenty
// minutes, and they are the same numbers for everybody who opens the app.
//
// Shown as a target they would be a coaching prescription: an athlete whose
// threshold is 4:15/km would be told to run 5:08, and so would a beginner
// whose threshold is 6:00. That is not an estimator being imprecise. It is
// the app telling two different people the same wrong thing with a straight
// face, and it is the one rule this project has held to throughout - we do
// not coach from numbers we have not measured.
//
// So the separation is in the types rather than in a comment. A pace target
// can only be constructed with a source, and the sources are all things that
// came from the athlete. There is no MODEL among them, and adding one would
// mean editing this file on purpose rather than passing the wrong number by
// accident.
//
// Until an anchor exists, every target is null and the archetype's effort cue
// is the whole of what the athlete is told. That is not a placeholder - RPE
// is a real prescription, and it is the honest one while pace is unknown.
//
// Pure: no Lens Studio imports.
// ============================================================================

import { RunningArchetype } from './RunningArchetype';
import { bandFor, profileFromFiveK, THRESHOLD_OFFSET_MID_SEC_PER_KM } from './PaceModel';

/**
 * Where a pace target came from. Every one of them is the athlete's own.
 *
 * A recent 5K they entered, a pace measured from their own running in this
 * app, or their own race splits. Nothing derived from the duration model
 * belongs here, which is why it is not in the list.
 */
export type PaceSource = '5K_ENTRY' | 'CALIBRATION' | 'HYROX_HISTORY';

export const ALL_PACE_SOURCES: PaceSource[] = [
  '5K_ENTRY',
  'CALIBRATION',
  'HYROX_HISTORY',
];

/**
 * A band rather than a number.
 *
 * "4:46/km" is false precision on an easy run and unhelpful on a threshold
 * one: the athlete would be a second outside it and reading that as a miss.
 * A band is what a coach says out loud, and it leaves room for the hill, the
 * wind and the day.
 *
 * Named for direction rather than for magnitude. Pace runs backwards - fewer
 * seconds per kilometre is faster - so "min" and "max" invert their ordinary
 * meaning here, and the field that sounds like the slow end is the fast one.
 * That is exactly the trap the pace factors were renamed to avoid.
 */
export interface PaceBand {
  fastestSecPerKm: number;
  slowestSecPerKm: number;
}

export interface PaceTarget {
  source: PaceSource;
  band: PaceBand;
  /**
   * How the band was arrived at from the evidence.
   *
   * Kept because "your recent 5K" and "measured while you ran" are different
   * claims with different strengths, and a target that cannot say which it is
   * cannot be argued with later.
   */
  derivation?: string;
  /**
   * True while the band is inferred rather than observed at that intensity.
   *
   * In the data, never on the panel. An athlete mid-repetition wants the band
   * and their pace; where the band came from is a question for the moment it
   * was made, not the moment it is being run to.
   */
  provisional?: boolean;
}

/**
 * What is known about the athlete's running, in the form the sessions read.
 *
 * A fitness index rather than one band, because the five intensities are
 * derived from their own physiological meanings rather than by scaling a
 * single anchor - an error in one estimate should not multiply through the
 * whole profile.
 */
export interface DerivedAnchor {
  /** The bands are computed from a fitness index */
  kind: 'INDEX';
  source: PaceSource;
  derivation: string;
  provisional: boolean;
  /** Daniels' fitness index, from whatever the athlete gave us */
  vdot: number;
  /** Their 5K pace in seconds per kilometre, where a 5K is the evidence */
  fiveKPaceSecPerKm: number;
}

/**
 * A band that was measured rather than modelled.
 *
 * Race pace has no derivation - what somebody holds over eight kilometres
 * with eight stations between them is not predicted by any road running they
 * have done. The only way to know it is to have watched them do it, so this
 * anchor carries the answer instead of the arithmetic that would produce one.
 */
export interface MeasuredAnchor {
  kind: 'MEASURED';
  source: PaceSource;
  derivation: string;
  provisional: boolean;
  band: PaceBand;
}

/**
 * Two kinds, because they are two kinds of knowledge.
 *
 * A union rather than an index with an optional band beside it: the pairing
 * that says "these two fields are meaningful together and those two are not"
 * is the one nobody maintains, and the failure mode is a race band answering
 * a threshold question.
 */
export type PaceAnchor = DerivedAnchor | MeasuredAnchor;

/**
 * Which archetypes a source is allowed to prescribe for.
 *
 * Race splits are run under fatigue, between stations, on a course we do not
 * control. They are a measurement of one specific thing and they say what
 * that athlete holds on race day - which is precisely what a race-pace
 * session is asking for, and precisely not a threshold, so they feed one
 * archetype and no others.
 *
 * A 5K entry or a pace measured from their own running is general, and can
 * anchor the whole range.
 */
export function sourceSuitsArchetype(
  source: PaceSource,
  archetype: RunningArchetype
): boolean {
  if (source === 'HYROX_HISTORY') return archetype === 'HYROX_PACE';
  return true;
}

/**
 * The pace target for a session, or null when there is nothing to say.
 *
 * Null today for every session, because nothing yet produces an athlete
 * anchor - that is step A. The shape exists so that A switches it on rather
 * than rewriting the sessions, and so that everything downstream is already
 * written to handle its absence, which is the state it will spend most of its
 * life in: a first-time athlete has no anchor and never will have one until
 * they have run something.
 */
export function paceTargetFor(
  archetype: RunningArchetype,
  anchor?: PaceAnchor
): PaceTarget | null {
  if (!anchor) return null;
  if (!sourceSuitsArchetype(anchor.source, archetype)) return null;

  var band = anchor.kind === 'MEASURED'
    ? anchor.band
    : bandFor(archetype, anchor.vdot, anchor.fiveKPaceSecPerKm);
  if (!band) return null;

  return {
    source: anchor.source,
    band: band,
    derivation: anchor.derivation,
    provisional: anchor.provisional,
  };
}

/**
 * What the athlete's recent 5K says about their training paces.
 *
 * Provisional by construction: a 5K is one performance on one day, and it is
 * evidence about their running rather than a measurement of any of the
 * intensities it is used to prescribe. Calibration from their own sessions
 * replaces it when there is enough of it.
 */
export function anchorFromFiveK(seconds: number): PaceAnchor | null {
  if (!(seconds > 0)) return null;

  var profile = profileFromFiveK(seconds);
  if (!(profile.vdot > 0)) return null;

  return {
    kind: 'INDEX',
    source: '5K_ENTRY',
    derivation: 'DANIELS_GILBERT',
    provisional: true,
    vdot: profile.vdot,
    fiveKPaceSecPerKm: seconds / 5,
  };
}

/**
 * What the athlete's own threshold running says about their fitness.
 *
 * The inverse of the derivation A2 uses in the other direction: a threshold
 * pace is a 5K pace plus the offset between them, so a measured threshold
 * pace implies the 5K that would produce it, and the same index comes out.
 * Going through the 5K rather than fitting a new curve is deliberate - two
 * routes to the index that disagreed would be two models, and the second one
 * would be nobody's.
 *
 * Not provisional. It came from their running rather than from a number they
 * typed in about a run we never saw.
 */
export function anchorFromThresholdPace(secPerKm: number): PaceAnchor | null {
  if (!(secPerKm > 0)) return null;

  var impliedFiveKPace = secPerKm - THRESHOLD_OFFSET_MID_SEC_PER_KM;
  if (!(impliedFiveKPace > 0)) return null;

  var profile = profileFromFiveK(impliedFiveKPace * 5);
  if (!(profile.vdot > 0)) return null;

  return {
    kind: 'INDEX',
    source: 'CALIBRATION',
    derivation: 'THRESHOLD_OBSERVED',
    provisional: false,
    vdot: profile.vdot,
    fiveKPaceSecPerKm: impliedFiveKPace,
  };
}

/**
 * The target for a session, from everything known about the athlete.
 *
 * More than one thing can be known at once - a 5K they typed in and a race
 * they ran - and they answer different questions. Asked in order, the first
 * anchor that can speak for this archetype answers, which is what keeps a
 * race band out of a threshold session without any caller having to know the
 * rule.
 *
 * Order is the caller's, and it should be most specific first: a measured
 * race pace beats a modelled one for the one archetype it covers, and covers
 * nothing else.
 */
export function resolveTarget(
  archetype: RunningArchetype,
  anchors?: PaceAnchor[]
): PaceTarget | null {
  if (!anchors) return null;

  for (var i = 0; i < anchors.length; i++) {
    var target = paceTargetFor(archetype, anchors[i]);
    if (target) return target;
  }

  return null;
}

/** Said once, where the bands are made - never on the panel while running */
export function provenanceLine(anchor: PaceAnchor | null): string {
  return anchor ? provenanceOf(anchor.source) : '';
}

/**
 * Where the target in front of the athlete came from.
 *
 * Asked of the target rather than of the anchor, because an athlete can hold
 * two anchors at once and only one of them is answering today. Somebody with
 * races on file doing a threshold session is being prescribed from their 5K,
 * and telling them it came from their race splits would be a lie about the
 * one thing this line exists to be honest about.
 */
export function provenanceOfTarget(target: PaceTarget | null): string {
  return target ? provenanceOf(target.source) : '';
}

function provenanceOf(source: PaceSource): string {
  switch (source) {
    case '5K_ENTRY':      return 'Based on your recent 5K';
    case 'CALIBRATION':   return 'Measured from your own sessions';
    case 'HYROX_HISTORY': return 'From your race splits';
    default:              return '';
  }
}

/**
 * The middle of a target band, for the one caller that needs a single number.
 *
 * A band is what the athlete is told to run, because a pace is held to within
 * a few seconds rather than to the second. But a duration estimate cannot be
 * a range - the picker promises minutes - so it prices the session at the
 * middle of the band, which is the pace the band is centred on and the one
 * they will average if they run it as prescribed.
 *
 * Null where there is no target. A caller with no answer here has to fall
 * back on the model, and it should be obvious in the code that it is.
 */
export function targetPaceSecPerKm(target: PaceTarget | null | undefined): number | null {
  if (!target || !target.band) return null;

  var fastest = target.band.fastestSecPerKm;
  var slowest = target.band.slowestSecPerKm;
  if (!isFinite(fastest) || !isFinite(slowest) || fastest <= 0) return null;

  return (fastest + slowest) / 2;
}

/** "4:40–4:50 /km", or '' when there is no target */
export function formatPaceBand(target: PaceTarget | null): string {
  if (!target) return '';

  return formatPace(target.band.fastestSecPerKm) + '-' +
         formatPace(target.band.slowestSecPerKm) + ' /km';
}

/** m:ss */
export function formatPace(secPerKm: number): string {
  var whole = Math.max(0, Math.round(secPerKm));
  var mins = Math.floor(whole / 60);
  var secs = whole % 60;
  return mins + ':' + (secs < 10 ? '0' : '') + secs;
}

/** True when a measured pace sits inside the band it was prescribed */
export function withinBand(secPerKm: number, band: PaceBand): boolean {
  if (!band) return false;
  return secPerKm >= band.fastestSecPerKm && secPerKm <= band.slowestSecPerKm;
}

/**
 * How far outside the band a pace fell, in seconds per kilometre.
 *
 * Signed: positive is slower than prescribed, negative is faster. Zero inside
 * the band - not "zero error", but nothing to say, which is the point of
 * prescribing a band rather than a number.
 */
export function driftFromBand(secPerKm: number, band: PaceBand): number {
  if (!band) return 0;
  if (secPerKm > band.slowestSecPerKm) return secPerKm - band.slowestSecPerKm;
  if (secPerKm < band.fastestSecPerKm) return secPerKm - band.fastestSecPerKm;
  return 0;
}
