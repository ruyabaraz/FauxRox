// ============================================================================
// TrainingAnalysis.ts — what a training session can honestly be said to show
// ============================================================================
// The race analysis ranks splits by duration. Applied to a training session
// that produced this, out loud:
//
//     "Longest split: ALTERNATING LATERAL LUNGE (0:40)"
//
// The lunge was a forty-second warm-up drill. It took forty seconds because
// the plan said forty seconds. Two independent runs of that session produced
// 40.5s, 30.5s, 40.5s - the same three numbers to the tenth. A quantity that
// reproduces exactly is not a measurement, it is a constant, and the coach was
// interpreting a constant.
//
// The rule this module exists to enforce:
//
//     THE VARIABLE THE PLAN FIXES IS NOT A PERFORMANCE METRIC.
//
// Which leaves, per mode:
//
//   mode           plan fixes   measured    derived
//   ------------   ----------   ---------   ------------------------
//   TIMED          duration     -           nothing
//   REPS           reps         duration    work rate, seconds/rep
//   VERTICAL_REPS  reps         duration    work rate, seconds/rep
//   LATERAL_REPS   reps         duration    work rate, seconds/rep
//   ZONE_HIT       reps         duration    work rate, seconds/rep
//   DISTANCE       metres       duration    pace, seconds/metre
//   RUN            metres       duration    pace, seconds/metre
//
// TIMED is empty today because a timed station is a stopwatch and nothing
// else: no detector runs during one, so no reps are counted and there is
// nothing to divide by. That row is honest, not an oversight - and it is why
// this module never says anything at all about a hold.
//
// The comparisons that survive are narrow on purpose. There is no function
// here that orders two different movements, because there is no axis on which
// a burpee and a carry can be ordered. The only comparison offered is one
// movement against itself across the rounds of its own block, which is also
// the only thing a coach would actually look at.
//
// Pure: no Lens Studio imports, so it can be tested outside the editor.
// ============================================================================

/** The axis on which a station can be measured, if any */
import {
  RunSample,
  analyseRunning,
  runningAiContext,
} from './RunningAnalysis';

import {
  HyroxRunSample,
  RunObservation,
  isBelievableRunSample,
  isBelievableObservation,
} from './PaceEvidence';

export type Axis = 'NONE' | 'WORK_RATE' | 'PACE';

/** Where a station sits in the session, for the purposes of analysis */
export type Role = 'WORK' | 'WARMUP' | 'REST';

/** One completed split, with everything needed to know what it can support */
export interface EffortRecord {
  name: string;
  prefabType: string;
  /** StationMode value */
  mode: string;
  /** What the plan asked for: seconds, reps or metres, per the mode */
  prescribed: number;
  durationMs: number;
  /** BlockScheme value, '' for a race */
  blockScheme: string;
  blockIndex: number;
  roundIndex: number;
  avgHR: number;
  /**
   * For a break, what kind it was - a RecoveryKind value, or '' for work.
   *
   * Forty seconds jogged and forty seconds standing are both breaks and are
   * not the same break. Without this the coach can say how long the athlete
   * rested and not what they were doing, which in a threshold session is the
   * difference between the session that was written and a different one.
   */
  recoveryKind?: string;

  /**
   * For a run, the pace of the part that counts, in seconds per kilometre.
   *
   * Computed at the moment of truth from the run's own measurement, not
   * reconstructed here from the prescription and the split duration - those
   * are the wall clock and the distance asked for, and neither is what the
   * athlete ran.
   */
  paceSecPerKm?: number;

  /** For a run, which archetype it belonged to */
  archetype?: string;

  /** For a run, the band it was prescribed at, when there was one */
  paceBand?: { fastestSecPerKm: number; slowestSecPerKm: number } | null;

  /** For a run, what was asked for and in which unit */
  prescribedKind?: 'DISTANCE' | 'TIME';

  /**
   * For a run, how far the athlete actually went.
   *
   * Beside the pace rather than derived back out of it, because how far they
   * ran decides whether the pace means anything: a pace taken over forty
   * metres is a measurement of turning around.
   */
  measuredMetres?: number;

  /**
   * Time actually spent working, where that is less than the time the effort
   * took. Runs only: standing at a crossing is not slow running.
   *
   * Absent everywhere else, where the two are the same thing - a plank held
   * for thirty seconds took thirty seconds and there is nothing to subtract.
   */
  activeMs?: number;
}

/**
 * The observability contract, as data rather than as a comment.
 *
 * Every consumer asks this rather than testing modes itself, so a new mode is
 * a line here and cannot silently default to "rank it by duration".
 */
export function axisOf(mode: string): Axis {
  switch (mode) {
    case 'REPS':
    case 'VERTICAL_REPS':
    case 'LATERAL_REPS':
    case 'ZONE_HIT':
      return 'WORK_RATE';

    case 'DISTANCE':
    case 'RUN':
      return 'PACE';

    // The plan fixes the duration, and nothing counts anything while it runs.
    case 'TIMED':
    default:
      return 'NONE';
  }
}

const NOT_WORK: { [prefabType: string]: boolean } = {
  REST: true,
  RECOVERY: true,
  START: true,
  FINISH: true,
};

/**
 * A break the athlete spends moving.
 *
 * Forty-six seconds of jogging and forty-six seconds of standing still are
 * both breaks and they are not the same break, and the difference is the
 * point of some sessions rather than a detail of them: a threshold float is
 * short and active precisely so that lactate never fully clears, and calling
 * it rest describes the clock rather than the session.
 *
 * Both are excluded from the work total, because neither is work. What this
 * separates is what the athlete is told they did.
 */
const ACTIVE_REST: { [prefabType: string]: boolean } = {
  RECOVERY: true,
};

/** Breaks that are not taken standing still */
const MOVING_KIND: { [kind: string]: boolean } = {
  FLOAT_JOG: true,
  EASY_JOG: true,
};

export function isActiveRest(effort: EffortRecord): boolean {
  if (!effort) return false;
  if (effort.recoveryKind) return MOVING_KIND[effort.recoveryKind] === true;
  return ACTIVE_REST[effort.prefabType] === true;
}

/** How a break should be described back to the athlete */
export function recoveryPhrase(kind?: string): string {
  switch (kind) {
    case 'FLOAT_JOG':   return 'floating between repetitions';
    case 'EASY_JOG':    return 'jogging between repetitions';
    case 'WALK_OR_JOG': return 'walking between repetitions';
    default:            return 'resting between sets';
  }
}

export function roleOf(effort: EffortRecord): Role {
  if (NOT_WORK[effort.prefabType]) return 'REST';
  if (effort.blockScheme === 'WARMUP') return 'WARMUP';
  if (effort.prefabType.indexOf('WARMUP_') === 0) return 'WARMUP';
  return 'WORK';
}

// ── Series ──────────────────────────────────────────────────────────────────

/**
 * One movement across the rounds of its block, on one axis.
 *
 * Constructed only by grouping identical prefabTypes, so a series can never
 * hold two movements and there is nowhere to put a cross-modality comparison
 * even if somebody wanted one.
 */
export interface MovementSeries {
  name: string;
  prefabType: string;
  axis: Axis;
  /**
   * StationMode, kept for wording only.
   *
   * Comparability is the axis's business and nothing here may widen it: two
   * series with the same axis are still two different movements and are still
   * never ranked against each other. The mode decides units, because seconds
   * per metre is how a bear crawl reads and minutes per kilometre is how a
   * run reads, and printing a 240m interval as "0.3s per metre" rounds two
   * different paces to the same number.
   */
  mode: string;
  /** The derived rate per round: seconds per rep, or seconds per metre */
  rates: number[];
}

/** Smallest rate worth dividing into; below this the ratio is noise */
const MIN_PRESCRIBED = 1;
const MIN_DURATION_MS = 500;

function rateOf(effort: EffortRecord): number {
  if (effort.prescribed < MIN_PRESCRIBED) return -1;
  if (effort.durationMs < MIN_DURATION_MS) return -1;

  return (effort.durationMs / 1000) / effort.prescribed;
}

/**
 * Group the working efforts into per-movement series.
 *
 * Warm-up and rest never enter. A movement with one round produces a series
 * with one rate, which supports no trend and is dropped by the caller - kept
 * here so the counting stays honest.
 */
export function seriesFrom(efforts: EffortRecord[]): MovementSeries[] {
  var order: string[] = [];
  var byMovement: { [prefabType: string]: MovementSeries } = {};

  for (var i = 0; i < (efforts ? efforts.length : 0); i++) {
    var effort = efforts[i];
    if (!effort) continue;
    if (roleOf(effort) !== 'WORK') continue;

    var axis = axisOf(effort.mode);
    if (axis === 'NONE') continue;

    var rate = rateOf(effort);
    if (rate < 0) continue;

    var existing = byMovement[effort.prefabType];

    if (!existing) {
      byMovement[effort.prefabType] = {
        name: effort.name,
        prefabType: effort.prefabType,
        axis: axis,
        mode: effort.mode,
        rates: [rate],
      };
      order.push(effort.prefabType);
      continue;
    }

    // A movement cannot change what it is measured on between rounds. If it
    // somehow did, the two are not the same series and the later one is not
    // comparable to the earlier.
    if (existing.axis !== axis) continue;

    existing.rates.push(rate);
  }

  var out: MovementSeries[] = [];
  for (var k = 0; k < order.length; k++) out.push(byMovement[order[k]]);
  return out;
}

// ── Fatigue ─────────────────────────────────────────────────────────────────

export type Direction = 'HELD' | 'SLOWED' | 'IMPROVED';

export interface FatigueFinding {
  name: string;
  axis: Axis;
  /** StationMode, for units only - never for deciding what may be compared */
  mode: string;
  /** Mean rate over the opening rounds */
  openingRate: number;
  /** Mean rate over the closing rounds */
  closingRate: number;
  /** Positive means it got slower */
  changePercent: number;
  direction: Direction;
  rounds: number;
}

/** Rounds needed before a first-to-last difference is a trend rather than one number */
export const MIN_ROUNDS_FOR_TREND = 3;

/** How far the rate has to move before it is called a change and not noise */
export const SIGNIFICANT_CHANGE_PERCENT = 10;

function mean(values: number[]): number {
  var total = 0;
  for (var i = 0; i < values.length; i++) total += values[i];
  return values.length > 0 ? total / values.length : 0;
}

/**
 * Compare the opening rounds against the closing ones.
 *
 * Halves rather than first-against-last: one bad round at either end would
 * otherwise decide the whole finding. With an odd count the middle round is
 * left out of both halves, which is the point of it being the middle.
 *
 * A ladder deliberately changes the reps every round, so the raw durations
 * are meant to differ - which is exactly why the comparison is on the rate.
 */
export function fatigueOf(series: MovementSeries): FatigueFinding {
  var rates = series.rates;
  if (rates.length < MIN_ROUNDS_FOR_TREND) return null;

  var half = Math.floor(rates.length / 2);
  var opening = mean(rates.slice(0, half));
  var closing = mean(rates.slice(rates.length - half));

  if (opening <= 0) return null;

  var change = ((closing - opening) / opening) * 100;
  var direction: Direction = 'HELD';
  if (change >= SIGNIFICANT_CHANGE_PERCENT) direction = 'SLOWED';
  else if (change <= -SIGNIFICANT_CHANGE_PERCENT) direction = 'IMPROVED';

  return {
    name: series.name,
    axis: series.axis,
    mode: series.mode,
    openingRate: opening,
    closingRate: closing,
    changePercent: change,
    direction: direction,
    rounds: rates.length,
  };
}

// ── Session summary ─────────────────────────────────────────────────────────

export interface TrainingSummary {
  totalMs: number;
  warmupMs: number;
  workMs: number;
  restMs: number;
  /**
   * Time inside the work that was spent standing still.
   *
   * Not rest - nobody prescribed it and the athlete was not recovering to a
   * plan. It is what happened, and leaving it inside the work total would
   * have told the athlete they worked for forty-eight seconds when they ran
   * for forty.
   */
  stoppedMs: number;
  /**
   * Of the rest, the part spent moving - a recovery jog or walk between
   * intervals rather than standing between sets.
   */
  activeRestMs: number;
  /**
   * What the breaks in this session were, when they were all one kind.
   *
   * Empty when the session mixed kinds, because a summary that picks one to
   * report would be describing a session the athlete did not do.
   */
  recoveryKind: string;

  /**
   * True when the session warmed the athlete up inside its own opening rather
   * than with drills in front of it.
   *
   * Said rather than left silent. An easy run has no warm-up block and did
   * warm up - in its first minutes, which is what easy means - and a summary
   * that simply omits the figure leaves the coach free to read the silence as
   * a warm-up that was skipped, and tell the athlete off for it.
   */
  selfWarmed: boolean;

  /**
   * What the running did, when the session was running and was measured.
   *
   * Empty in preview, where the runs complete on a timer, and empty for a
   * session with no running in it. Kept apart from the fatigue findings above
   * because it answers different questions about a different kind of work.
   */
  runningLines: string[];
  /** Working movements performed, warm-up excluded */
  movementCount: number;
  findings: FatigueFinding[];
  /** False when nothing in the session supports a performance statement */
  hasMeasurement: boolean;
  /** Why there is no measurement, when there is none */
  reason: string;
}

/**
 * A rate in the units the movement is actually read in.
 *
 * Running pace is minutes per kilometre because that is the number a runner
 * carries in their head, and because seconds per metre collapses the whole
 * useful range into two decimal places - 4:40/km and 5:12/km both print as
 * "0.3s per metre", which made one finding read "slowed 12% from 0.3s per
 * metre to 0.3s per metre".
 */
function formatRate(finding: FatigueFinding, rate: number): string {
  if (finding.mode === 'RUN') {
    var secondsPerKm = Math.round(rate * 1000);
    var min = Math.floor(secondsPerKm / 60);
    var sec = secondsPerKm % 60;
    return min + ':' + (sec < 10 ? '0' : '') + sec + ' per km';
  }

  if (finding.axis === 'PACE') return rate.toFixed(1) + 's per metre';

  return rate.toFixed(1) + 's per rep';
}

/**
 * Everything that can be said about the session, and nothing else.
 *
 * @param trustworthy false in Lens Studio preview, where hand-tracked stations
 *                    auto-complete after a few seconds. Those durations are
 *                    the harness, not the athlete, and no fitness conclusion
 *                    may be drawn from them.
 */
/**
 * The repetitions of running, as the running analysis wants them.
 *
 * Only efforts that recorded a pace. A run whose tracking produced nothing
 * has no pace, and carrying it through as a zero would drag every average it
 * touched towards a run nobody did.
 */
function runSamplesOf(efforts: EffortRecord[]): RunSample[] {
  var out: RunSample[] = [];

  for (var i = 0; i < (efforts ? efforts.length : 0); i++) {
    var effort = efforts[i];
    if (!effort || effort.prefabType !== 'RUN') continue;
    if (effort.paceSecPerKm === undefined || !(effort.paceSecPerKm > 0)) continue;

    out.push({
      archetype: effort.archetype || '',
      prescribed: effort.prescribed,
      prescribedKind: effort.prescribedKind || 'DISTANCE',
      paceSecPerKm: effort.paceSecPerKm,
      target: effort.paceBand || null,
    });
  }

  return out;
}

/**
 * The runs from a race, in the form the pace evidence keeps them.
 *
 * Only what was measured: how far they went and how fast, taken from the
 * run's own measurement rather than from the distance the plan asked for.
 * Anything without both is not a sample - it is a split we happened to time.
 *
 * The caller decides whether the session was a race at all. This function
 * cannot know, and a training run priced at a band we handed the athlete is
 * exactly the number that must never come back in as evidence.
 */
export function raceRunSamples(
  efforts: EffortRecord[],
  atEpochMs: number
): HyroxRunSample[] {
  var out: HyroxRunSample[] = [];

  for (var i = 0; i < (efforts ? efforts.length : 0); i++) {
    var effort = efforts[i];
    if (!effort || effort.prefabType !== 'RUN') continue;
    if (!(effort.paceSecPerKm > 0) || !(effort.measuredMetres > 0)) continue;

    var sample: HyroxRunSample = {
      paceSecPerKm: effort.paceSecPerKm,
      metres: effort.measuredMetres,
      atEpochMs: atEpochMs,
    };

    if (isBelievableRunSample(sample)) out.push(sample);
  }

  return out;
}

/**
 * The repetitions a training session measured, as observations.
 *
 * Observations, not an anchor: what happened on one afternoon. Whether any of
 * it is ever allowed to describe the athlete is the promotion policy's
 * question, and it asks for several sessions that agree before it answers
 * yes.
 *
 * Every repetition carries the session's own time, so that six repetitions of
 * one session cannot pass for six sessions.
 */
export function runObservations(
  efforts: EffortRecord[],
  sessionAtEpochMs: number
): RunObservation[] {
  var out: RunObservation[] = [];

  for (var i = 0; i < (efforts ? efforts.length : 0); i++) {
    var effort = efforts[i];
    if (!effort || effort.prefabType !== 'RUN') continue;
    if (!effort.archetype) continue;
    if (!(effort.paceSecPerKm > 0) || !(effort.measuredMetres > 0)) continue;

    var observation: RunObservation = {
      archetype: effort.archetype,
      paceSecPerKm: effort.paceSecPerKm,
      metres: effort.measuredMetres,
      sessionAtEpochMs: sessionAtEpochMs,
    };

    if (isBelievableObservation(observation)) out.push(observation);
  }

  return out;
}

export function analyseTraining(
  efforts: EffortRecord[],
  trustworthy: boolean,
  selfWarmed?: boolean
): TrainingSummary {
  var summary: TrainingSummary = {
    totalMs: 0,
    warmupMs: 0,
    workMs: 0,
    restMs: 0,
    stoppedMs: 0,
    activeRestMs: 0,
    recoveryKind: '',
    runningLines: [],
    selfWarmed: selfWarmed === true,
    movementCount: 0,
    findings: [],
    hasMeasurement: false,
    reason: '',
  };

  var movements: { [prefabType: string]: boolean } = {};
  var restKind: string | null = null;

  for (var i = 0; i < (efforts ? efforts.length : 0); i++) {
    var effort = efforts[i];
    if (!effort) continue;

    summary.totalMs += effort.durationMs;

    var role = roleOf(effort);
    if (role === 'WARMUP') {
      summary.warmupMs += effort.durationMs;
    } else if (role === 'REST') {
      summary.restMs += effort.durationMs;
      if (isActiveRest(effort)) summary.activeRestMs += effort.durationMs;

      var kind = effort.recoveryKind || 'REST';
      if (restKind === null) restKind = kind;
      else if (restKind !== kind) restKind = '';
    } else {
      // The work is the working, not the clock around it. A run that took
      // forty-eight seconds with eight of them spent standing was forty
      // seconds of running, and saying otherwise credits the athlete for the
      // pause - which matters more on the glasses than in the editor, where
      // a real session has real stops in it.
      var active = effort.activeMs !== undefined && effort.activeMs >= 0
        ? Math.min(effort.activeMs, effort.durationMs)
        : effort.durationMs;

      summary.workMs += active;
      summary.stoppedMs += effort.durationMs - active;

      if (!movements[effort.prefabType]) {
        movements[effort.prefabType] = true;
        summary.movementCount++;
      }
    }
  }

  summary.recoveryKind = restKind && restKind !== 'REST' ? restKind : '';

  // Only when the session was measured on the athlete. In preview the runs
  // complete on a timer, so their pace is a fact about the editor.
  if (trustworthy) {
    summary.runningLines = runningAiContext(analyseRunning(runSamplesOf(efforts)));
  }

  if (!trustworthy) {
    summary.reason =
      'the session ran in preview, where stations complete on a timer rather ' +
      'than on the athlete';
    return summary;
  }

  var series = seriesFrom(efforts);
  for (var s = 0; s < series.length; s++) {
    var finding = fatigueOf(series[s]);
    if (finding) summary.findings.push(finding);
  }

  summary.hasMeasurement = summary.findings.length > 0;

  if (!summary.hasMeasurement) {
    summary.reason = series.length === 0
      ? 'nothing in this session was measured on a rate - timed holds fix ' +
        'their own duration, so there is nothing to compare'
      : 'no movement ran for enough rounds to show a trend';
  }

  return summary;
}

function formatClock(ms: number): string {
  var totalSec = Math.floor(ms / 1000);
  var min = Math.floor(totalSec / 60);
  var sec = totalSec % 60;
  return min + ':' + (sec < 10 ? '0' : '') + sec;
}

/**
 * A duration with its units said out loud.
 *
 * On a clock face "0:48" is unambiguous - the reader knows they are looking
 * at a stopwatch. In a sentence handed to a language model it is not, and the
 * model read a forty-eight second session back to the athlete as forty-eight
 * minutes.
 *
 * That is not the model being careless. Nothing in "finished after 0:48" says
 * which units those are, and we were relying on a convention that only holds
 * when there is a clock around the number. The panel keeps m:ss, because
 * there is one; the text does not.
 */
/**
 * Below this a stop is somebody adjusting a shoelace.
 *
 * Reporting every pause would make the summary about the athlete's
 * interruptions rather than their training, and the coach reads it aloud.
 */
export const STOPPAGE_WORTH_MENTIONING_MS = 20000;

export function spellDuration(ms: number): string {
  var totalSec = Math.max(0, Math.round(ms / 1000));
  var min = Math.floor(totalSec / 60);
  var sec = totalSec % 60;

  if (min === 0) return sec + ' seconds';
  if (sec === 0) return min + (min === 1 ? ' minute' : ' minutes');

  return min + (min === 1 ? ' minute ' : ' minutes ') + sec + ' seconds';
}

/**
 * The summary in the words the model is allowed to use.
 *
 * Ends with an explicit prohibition rather than trusting the absence of data
 * to be read as absence of a claim: given a list of splits and no instruction,
 * a language model will find the longest one and call it a weakness, which is
 * the behaviour this whole module exists to prevent.
 */
export function trainingAiContext(summary: TrainingSummary): string {
  var lines: string[] = [];

  // A session with no breaks in it says nothing about breaks. "0:00 resting
  // between sets" is not a fact about a continuous run; it is a sentence
  // about sets, said to somebody who did not do any.
  lines.push('SESSION SHAPE: ' + spellDuration(summary.workMs) + ' working, ' +
             (summary.stoppedMs >= STOPPAGE_WORTH_MENTIONING_MS
               ? spellDuration(summary.stoppedMs) + ' of it stopped, '
               : '') +
             (summary.restMs > 0
               ? spellDuration(summary.restMs) + ' ' +
                 recoveryPhrase(summary.recoveryKind) + ', '
               : '') +
             (summary.warmupMs > 0
               ? spellDuration(summary.warmupMs) + ' of warm-up. '
               : summary.selfWarmed
                 ? 'no separate warm-up - the run warms up in its own opening minutes. '
                 : '') +
             summary.movementCount +
             (summary.movementCount === 1 ? ' movement.' : ' movements.'));

  for (var r = 0; r < summary.runningLines.length; r++) {
    lines.push(summary.runningLines[r]);
  }

  if (summary.hasMeasurement) {
    lines.push('WHAT WAS MEASURED (the only performance facts available):');

    for (var i = 0; i < summary.findings.length; i++) {
      var f = summary.findings[i];
      var magnitude = Math.abs(f.changePercent).toFixed(0);

      if (f.direction === 'HELD') {
        lines.push('- ' + f.name + ': rate held across ' + f.rounds +
                   ' rounds at about ' + formatRate(f, f.closingRate) + '.');
      } else if (f.direction === 'SLOWED') {
        lines.push('- ' + f.name + ': slowed ' + magnitude + '% from ' +
                   formatRate(f, f.openingRate) + ' to ' +
                   formatRate(f, f.closingRate) + ' over ' + f.rounds + ' rounds.');
      } else {
        lines.push('- ' + f.name + ': sped up ' + magnitude + '% from ' +
                   formatRate(f, f.openingRate) + ' to ' +
                   formatRate(f, f.closingRate) + ' over ' + f.rounds + ' rounds.');
      }
    }
  } else {
    lines.push('NOTHING MEASURABLE: ' + summary.reason + '.');
  }

  lines.push(
    'RULES: say nothing about how fast or slow any station was unless it is ' +
    'listed above. Timed holds and warm-up drills last exactly as long as the ' +
    'plan told them to, so their durations mean nothing - never call one long, ' +
    'short, slow or a weakness. Never rank different movements against each ' +
    'other. If nothing was measured, acknowledge the work and stop there.'
  );

  return lines.join('\n');
}

/**
 * The one line the finish panel has room for.
 *
 * The largest significant change, or nothing. "Needs work" is deliberately
 * not the wording: a rate dropping over seven rounds of a ladder is what a
 * ladder is for.
 */
export function headlineFinding(summary: TrainingSummary): string {
  var worst: FatigueFinding = null;

  for (var i = 0; i < summary.findings.length; i++) {
    var f = summary.findings[i];
    if (f.direction === 'HELD') continue;
    if (!worst || Math.abs(f.changePercent) > Math.abs(worst.changePercent)) {
      worst = f;
    }
  }

  if (!worst) return '';

  var verb = worst.direction === 'SLOWED' ? 'slowed' : 'sped up';
  return worst.name.toUpperCase() + '  ' + verb + ' ' +
         Math.abs(worst.changePercent).toFixed(0) + '%  over ' +
         worst.rounds + ' rounds';
}

/** "12:10 work · 4:20 rest" — the neutral shape of the session */
export function shapeLine(summary: TrainingSummary): string {
  return formatClock(summary.workMs) + ' work  ·  ' +
         formatClock(summary.restMs) + ' rest';
}
