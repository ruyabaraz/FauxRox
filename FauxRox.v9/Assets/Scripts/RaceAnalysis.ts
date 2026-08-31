// ============================================================================
// RaceAnalysis.ts — Coach's Verdict diagnosis
// Lens Studio 5.x · Spectacles · TypeScript
// ============================================================================
// Pure functions, no Lens Studio imports, so this can be run and tested in
// isolation. Course knowledge (baselines, display names) is injected.
//
// The AI never does this arithmetic. We compute where time went; AICoach only
// phrases the result.
//
// Pipeline:
//   raw splits
//     -> per-split baseline        (model, or personal median once trusted)
//     -> globalScaleFactor         (median of actual/baseline across splits)
//     -> expectedToday             (baseline x factor)
//     -> signed residual           (actual - expectedToday)
//     -> absolute AND relative significance test
//     -> rank, split into runs vs stations
//
// The scale factor is what makes this defensible on a first race. It absorbs
// whatever the reference is uniformly wrong by - a model calibrated for a
// fitter athlete, or simply a bad day - and leaves only the SHAPE of the
// performance behind. What it cannot absorb is a reference that is wrong at
// one split specifically, which is why first-race wording stays provisional.
// ============================================================================

// ── Enums ───────────────────────────────────────────────────────────────────

export enum SplitKind {
  RUN     = 'RUN',
  STATION = 'STATION',
}

/**
 * Cardiovascular load band. Deliberately descriptive, not causal - heart rate
 * alone cannot tell us whether conditioning or technique caused a slowdown,
 * and maxHR here is an age estimate carrying its own error.
 */
export enum LoadBand {
  HIGH_LOAD = 'HIGH_LOAD',   // >= 90% of estimated max
  MIXED     = 'MIXED',       // 80-90%
  LOW_LOAD  = 'LOW_LOAD',    // < 80%
  UNKNOWN   = 'UNKNOWN',     // no heart rate recorded
}

export enum BaselineSource {
  MODEL    = 'MODEL',
  PERSONAL = 'PERSONAL',
}

export enum BaselineConfidence {
  PROVISIONAL = 'PROVISIONAL',  // modelled reference, no personal history
  LOW         = 'LOW',          // 3-4 personal samples
  HIGH        = 'HIGH',         // 5+ personal samples
}

// ── Tuning ──────────────────────────────────────────────────────────────────

/** A residual must clear BOTH of these to be called significant */
export const SIGNIFICANT_RESIDUAL_MS = 10000;
export const SIGNIFICANT_RESIDUAL_RATIO = 0.10;

/** Below this many comparable splits the median is too shaky to trust */
export const MIN_SPLITS_FOR_SCALE = 5;

/** Fewer scored splits than this and we decline to give a verdict */
export const MIN_SPLITS = 2;

/** Personal samples needed before we prefer personal median over the model */
export const MIN_HISTORY_SAMPLES = 3;
/** Personal samples needed before confidence is HIGH */
export const HIGH_CONFIDENCE_SAMPLES = 5;

export const HIGH_LOAD_THRESHOLD = 0.90;
export const LOW_LOAD_THRESHOLD = 0.80;

/** Split names recorded by RaceStateMachine for run segments start with this */
export const RUN_SPLIT_PREFIX = 'Run to ';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SplitSample {
  /** Stable key, e.g. 'AIR SKIERG' or 'Run to AIR SKIERG' */
  name: string;
  durationMs: number;
  /** 0 when no heart rate was recorded */
  avgHR: number;
  /** Inferred from the name when omitted */
  kind?: SplitKind;
}

/** One past race, plus the course tuning it was run under */
export interface HistoricRace {
  splits: SplitSample[];
  /** Only races sharing the current key are comparable */
  configKey?: string;
}

export interface SplitOutcome {
  name: string;
  displayName: string;
  kind: SplitKind;
  durationMs: number;

  baselineMs: number;
  baselineSource: BaselineSource;
  baselineSampleCount: number;
  baselineConfidence: BaselineConfidence;

  expectedTodayMs: number;
  /** Signed. Positive means slower than expected today. */
  residualMs: number;
  /** Signed. actual / expectedToday - 1 */
  residualRatio: number;

  /** avgHR / maxHR, 0 when unknown */
  hrLoad: number;
  loadBand: LoadBand;

  isSignificantLoss: boolean;
  isSignificantGain: boolean;
}

export interface RaceVerdict {
  hasEnoughData: boolean;

  /** Median of actual/baseline across splits. 1.0 when not applied. */
  globalScaleFactor: number;
  scaleFactorApplied: boolean;
  /** How to read the factor - vs the model, or vs the athlete's own norm */
  overallBaselineSource: BaselineSource;

  /** All splits, worst residual first */
  outcomes: SplitOutcome[];
  stationOutcomes: SplitOutcome[];
  runOutcomes: SplitOutcome[];

  limiter: SplitOutcome | null;
  strongest: SplitOutcome | null;

  summary: string;
  aiContext: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function median(values: number[]): number {
  if (!values || values.length === 0) return 0;

  var sorted = values.slice().sort(function (a, b) { return a - b; });
  var mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function classifySplit(name: string): SplitKind {
  return name && name.indexOf(RUN_SPLIT_PREFIX) === 0
    ? SplitKind.RUN
    : SplitKind.STATION;
}

export function loadBandFor(hrLoad: number): LoadBand {
  if (hrLoad <= 0) return LoadBand.UNKNOWN;
  if (hrLoad >= HIGH_LOAD_THRESHOLD) return LoadBand.HIGH_LOAD;
  if (hrLoad >= LOW_LOAD_THRESHOLD) return LoadBand.MIXED;
  return LoadBand.LOW_LOAD;
}

function confidenceFor(source: BaselineSource, sampleCount: number): BaselineConfidence {
  if (source === BaselineSource.MODEL) return BaselineConfidence.PROVISIONAL;
  return sampleCount >= HIGH_CONFIDENCE_SAMPLES
    ? BaselineConfidence.HIGH
    : BaselineConfidence.LOW;
}

function prettify(name: string, displayNames: { [k: string]: string }): string {
  if (!name) return '';

  if (classifySplit(name) === SplitKind.RUN) {
    var target = name.substring(RUN_SPLIT_PREFIX.length);
    return 'Run to ' + prettify(target, displayNames);
  }

  if (displayNames && displayNames[name]) {
    return displayNames[name];
  }

  // Unknown split - title case is a fallback, not a naming decision
  var words = name.toLowerCase().split(' ');
  for (var i = 0; i < words.length; i++) {
    if (words[i].length > 0) {
      words[i] = words[i].charAt(0).toUpperCase() + words[i].substring(1);
    }
  }
  return words.join(' ');
}

// ── Baselines ───────────────────────────────────────────────────────────────

export interface BaselineResult {
  baselineMs: number;
  source: BaselineSource;
  sampleCount: number;
}

/**
 * Personal median once there are enough comparable samples, otherwise the
 * modelled reference. Races run under different course tuning - and legacy
 * races that never recorded their tuning - are excluded.
 */
export function baselineFor(
  splitName: string,
  history: HistoricRace[],
  modelMs: number,
  currentConfigKey?: string
): BaselineResult {
  var samples: number[] = [];

  if (history) {
    for (var i = 0; i < history.length; i++) {
      var race = history[i];
      if (!race || !race.splits) continue;

      // Comparability guard. Once the caller knows the current tuning, a race
      // only counts if it declares the same one. Legacy records that predate
      // configKey are treated as incompatible rather than assumed equal - a
      // 25 rep burpee station and a 10 rep one are not the same measurement,
      // and we cannot tell which an unlabelled record was.
      if (currentConfigKey && race.configKey !== currentConfigKey) {
        continue;
      }

      for (var j = 0; j < race.splits.length; j++) {
        var sp = race.splits[j];
        if (sp && sp.name === splitName && sp.durationMs > 0) {
          samples.push(sp.durationMs);
        }
      }
    }
  }

  if (samples.length >= MIN_HISTORY_SAMPLES) {
    return {
      baselineMs: median(samples),
      source: BaselineSource.PERSONAL,
      sampleCount: samples.length,
    };
  }

  return {
    baselineMs: modelMs,
    source: BaselineSource.MODEL,
    sampleCount: samples.length,
  };
}

// ── Entry point ─────────────────────────────────────────────────────────────

export function analyzeRace(
  current: SplitSample[],
  history: HistoricRace[],
  modelMs: { [splitName: string]: number },
  maxHR: number,
  displayNames?: { [stationName: string]: string },
  currentConfigKey?: string
): RaceVerdict {
  var names = displayNames || {};

  // ── 1. Baselines ──────────────────────────────────────────────────────────

  var prepared: {
    sample: SplitSample;
    base: BaselineResult;
  }[] = [];

  for (var i = 0; i < (current ? current.length : 0); i++) {
    var sample = current[i];
    if (!sample || sample.durationMs <= 0) continue;

    var model = modelMs && modelMs[sample.name] > 0 ? modelMs[sample.name] : 0;
    var base = baselineFor(sample.name, history, model, currentConfigKey);
    if (base.baselineMs <= 0) continue;

    prepared.push({ sample: sample, base: base });
  }

  if (prepared.length < MIN_SPLITS) {
    return emptyVerdict();
  }

  // ── 2. Global scale factor ────────────────────────────────────────────────
  //
  // Median of actual/baseline. Absorbs whatever the reference is uniformly
  // wrong by, so what remains is genuinely split-specific.

  var ratios: number[] = [];
  for (var r = 0; r < prepared.length; r++) {
    ratios.push(prepared[r].sample.durationMs / prepared[r].base.baselineMs);
  }

  var scaleFactorApplied = prepared.length >= MIN_SPLITS_FOR_SCALE;
  var globalScaleFactor = scaleFactorApplied ? median(ratios) : 1.0;
  if (!(globalScaleFactor > 0)) globalScaleFactor = 1.0;

  // ── 3. Residuals ──────────────────────────────────────────────────────────

  var outcomes: SplitOutcome[] = [];
  var personalCount = 0;

  for (var k = 0; k < prepared.length; k++) {
    var sm = prepared[k].sample;
    var bs = prepared[k].base;

    if (bs.source === BaselineSource.PERSONAL) personalCount++;

    var expectedTodayMs = bs.baselineMs * globalScaleFactor;
    var residualMs = sm.durationMs - expectedTodayMs;
    var residualRatio = sm.durationMs / expectedTodayMs - 1;
    var hrLoad = maxHR > 0 && sm.avgHR > 0 ? sm.avgHR / maxHR : 0;

    outcomes.push({
      name: sm.name,
      displayName: prettify(sm.name, names),
      kind: sm.kind || classifySplit(sm.name),
      durationMs: sm.durationMs,

      baselineMs: bs.baselineMs,
      baselineSource: bs.source,
      baselineSampleCount: bs.sampleCount,
      baselineConfidence: confidenceFor(bs.source, bs.sampleCount),

      expectedTodayMs: expectedTodayMs,
      residualMs: residualMs,
      residualRatio: residualRatio,

      hrLoad: hrLoad,
      loadBand: loadBandFor(hrLoad),

      isSignificantLoss:
        residualMs >= SIGNIFICANT_RESIDUAL_MS &&
        residualRatio >= SIGNIFICANT_RESIDUAL_RATIO,
      isSignificantGain:
        residualMs <= -SIGNIFICANT_RESIDUAL_MS &&
        residualRatio <= -SIGNIFICANT_RESIDUAL_RATIO,
    });
  }

  // Worst first
  outcomes.sort(function (a, b) { return b.residualMs - a.residualMs; });

  var stationOutcomes: SplitOutcome[] = [];
  var runOutcomes: SplitOutcome[] = [];
  for (var o = 0; o < outcomes.length; o++) {
    if (outcomes[o].kind === SplitKind.RUN) runOutcomes.push(outcomes[o]);
    else stationOutcomes.push(outcomes[o]);
  }

  // ── 4. Limiter and strongest ──────────────────────────────────────────────

  var limiter: SplitOutcome = null;
  for (var L = 0; L < outcomes.length; L++) {
    if (outcomes[L].isSignificantLoss) { limiter = outcomes[L]; break; }
  }

  var strongest: SplitOutcome = null;
  for (var g = outcomes.length - 1; g >= 0; g--) {
    if (outcomes[g].isSignificantGain) { strongest = outcomes[g]; break; }
  }

  var overallSource = personalCount > outcomes.length / 2
    ? BaselineSource.PERSONAL
    : BaselineSource.MODEL;

  var verdict: RaceVerdict = {
    hasEnoughData: true,
    globalScaleFactor: globalScaleFactor,
    scaleFactorApplied: scaleFactorApplied,
    overallBaselineSource: overallSource,
    outcomes: outcomes,
    stationOutcomes: stationOutcomes,
    runOutcomes: runOutcomes,
    limiter: limiter,
    strongest: strongest,
    summary: '',
    aiContext: '',
  };

  verdict.summary = buildSummary(verdict);
  verdict.aiContext = buildAIContext(verdict);

  return verdict;
}

function emptyVerdict(): RaceVerdict {
  return {
    hasEnoughData: false,
    globalScaleFactor: 1.0,
    scaleFactorApplied: false,
    overallBaselineSource: BaselineSource.MODEL,
    outcomes: [],
    stationOutcomes: [],
    runOutcomes: [],
    limiter: null,
    strongest: null,
    summary: 'Not enough split data for a verdict yet. Finish a full race to get one.',
    aiContext: '',
  };
}

// ── Formatting ──────────────────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  var negative = ms < 0;
  var totalSeconds = Math.round(Math.abs(ms) / 1000);
  var minutes = Math.floor(totalSeconds / 60);
  var seconds = totalSeconds % 60;

  return (negative ? '-' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

/** "12% slower" / "4% faster" / "on pace" */
function pacePhrase(factor: number): string {
  var pct = Math.round(Math.abs(factor - 1) * 100);
  if (pct === 0) return 'on pace';
  return pct + '% ' + (factor > 1 ? 'slower' : 'faster');
}

function scaleSentence(v: RaceVerdict): string {
  if (!v.scaleFactorApplied) return '';

  var phrase = pacePhrase(v.globalScaleFactor);
  if (phrase === 'on pace') return '';

  return v.overallBaselineSource === BaselineSource.PERSONAL
    ? 'Overall race pace was ' + phrase + ' than your typical performance.'
    : 'Overall race pace was ' + phrase + ' than the model reference.';
}

function loadSentence(o: SplitOutcome): string {
  switch (o.loadBand) {
    case LoadBand.HIGH_LOAD:
      return 'You lost time here under high cardiovascular load. Conditioning or pacing may be contributing.';
    case LoadBand.LOW_LOAD:
      return 'You lost time here without unusually high cardiovascular load. Technique, strength, or local muscular endurance may be contributing.';
    case LoadBand.MIXED:
      return 'Cardiovascular load was moderate there, so the cause is not clear cut.';
    default:
      return 'No heart rate data for that split, so the cause is unconfirmed.';
  }
}

/** Deterministic verdict text - shown when the AI coach is unavailable */
export function buildSummary(v: RaceVerdict): string {
  if (!v.hasEnoughData) {
    return 'Not enough split data for a verdict yet. Finish a full race to get one.';
  }

  var parts: string[] = [];
  var scale = scaleSentence(v);
  if (scale) parts.push(scale);

  if (!v.limiter) {
    parts.push('No single split cost you meaningful time beyond that - an even race.');
  } else {
    // Wording is deliberately weaker on a modelled reference: we are comparing
    // against a shape, not against this athlete's established norm.
    parts.push(
      v.limiter.baselineSource === BaselineSource.PERSONAL
        ? v.limiter.displayName + ' was your biggest limiter today, ' +
          formatDuration(v.limiter.residualMs) + ' beyond expected.'
        : v.limiter.displayName + ' showed the largest slowdown relative to your ' +
          'model-adjusted race profile, ' + formatDuration(v.limiter.residualMs) +
          ' beyond expected.'
    );
    parts.push(loadSentence(v.limiter));
  }

  if (v.strongest) {
    parts.push(v.strongest.displayName + ' was your standout, ' +
               formatDuration(Math.abs(v.strongest.residualMs)) + ' ahead of expected.');
  }

  return parts.join(' ');
}

/** Compact numeric block for the AI coach prompt - narration only, no math */
export function buildAIContext(v: RaceVerdict): string {
  if (!v.hasEnoughData) return '';

  var lines: string[] = [];

  lines.push('=== Race Verdict (already computed, do not recalculate) ===');
  lines.push('baselineSource: ' + v.overallBaselineSource);
  lines.push('globalScaleFactor: ' + v.globalScaleFactor.toFixed(2) +
             (v.scaleFactorApplied ? '' : ' (not applied, too few splits)'));
  lines.push(v.overallBaselineSource === BaselineSource.PERSONAL
    ? 'Meaning: overall pace vs this athlete\'s typical performance.'
    : 'Meaning: overall pace vs the model reference. No personal norm established yet - stay provisional, do not call anything their weakest station.');

  lines.push(v.limiter
    ? 'Limiter: ' + v.limiter.name + ' (' + v.limiter.loadBand + ')'
    : 'Limiter: none, the race was even');

  lines.push('Splits, worst residual first (residual = actual - baseline x scaleFactor):');

  for (var i = 0; i < v.outcomes.length; i++) {
    var o = v.outcomes[i];
    lines.push(
      '- [' + o.kind + '] ' + o.name +
      ': ' + formatDuration(o.durationMs) +
      ', expected ' + formatDuration(o.expectedTodayMs) +
      ', residual ' + (o.residualMs >= 0 ? '+' : '') + formatDuration(o.residualMs) +
      ' (' + (o.residualRatio >= 0 ? '+' : '-') + Math.round(Math.abs(o.residualRatio) * 100) + '%)' +
      (o.hrLoad > 0 ? ', HR ' + Math.round(o.hrLoad * 100) + '% of est. max' : ', no HR') +
      ', ' + o.loadBand +
      ', baseline ' + o.baselineSource + '/' + o.baselineConfidence +
      ' n=' + o.baselineSampleCount +
      (o.isSignificantLoss ? ' [SIGNIFICANT LOSS]' : '') +
      (o.isSignificantGain ? ' [SIGNIFICANT GAIN]' : '')
    );
  }

  lines.push('Note: maxHR is an age estimate, so HR bands are indicative. Do not claim heart rate proves a cause.');

  return lines.join('\n');
}
