// ============================================================================
// raceAnalysis.test.ts — Coach's Verdict pipeline
// ============================================================================
// Run with: npm test   (from the Tests folder)
// ============================================================================

import {
  analyzeRace,
  loadBandFor,
  formatDuration,
  SplitSample,
  HistoricRace,
  RaceVerdict,
} from '../Assets/Scripts/RaceAnalysis';

// ── Harness ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let suite = '';

function describe(name: string, body: () => void): void {
  suite = name;
  console.log('\n=== ' + name + ' ===');
  body();
}

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed++;
    console.log('  ok   ' + name);
  } else {
    failed++;
    console.log('  FAIL ' + name + (detail !== undefined ? '   -> ' + String(detail) : ''));
  }
}

/** Split sample from seconds */
function split(name: string, seconds: number, hr = 0): SplitSample {
  return { name, durationMs: seconds * 1000, avgHR: hr };
}

/** Baseline map from seconds */
function model(entries: { [name: string]: number }): { [name: string]: number } {
  const out: { [name: string]: number } = {};
  for (const key of Object.keys(entries)) out[key] = entries[key] * 1000;
  return out;
}

function race(splits: SplitSample[], configKey?: string): HistoricRace {
  return configKey === undefined ? { splits } : { splits, configKey };
}

const DISPLAY = {
  'AIR SKIERG': 'Air SkiErg',
  'BURPEE BROAD JUMP': 'Burpee Broad Jump',
  'HEAVY CARRY': 'Heavy Carry',
  'DB WALKING LUNGES': 'Dumbbell Walking Lunges',
};

// ── The behaviour the pipeline exists for ───────────────────────────────────

describe('global scale factor absorbs a uniformly wrong reference', () => {
  // Model thinks this athlete is 1.4x faster than they are, and is
  // additionally wrong about burpees specifically.
  const baselines = model({
    'Run to AIR SKIERG': 40,
    'AIR SKIERG': 100,
    'BURPEE BROAD JUMP': 100,
    'HEAVY CARRY': 250,
    'DB WALKING LUNGES': 125,
  });
  const current = [
    split('Run to AIR SKIERG', 56),
    split('AIR SKIERG', 140),
    split('BURPEE BROAD JUMP', 200),
    split('HEAVY CARRY', 350),
    split('DB WALKING LUNGES', 175),
  ];

  const v = analyzeRace(current, [], baselines, 190, DISPLAY);

  check('factor applied', v.scaleFactorApplied);
  check('factor is 1.40', Math.abs(v.globalScaleFactor - 1.4) < 1e-9, v.globalScaleFactor);
  check('limiter is the burpee station', v.limiter?.name === 'BURPEE BROAD JUMP', v.limiter?.name);
  check('burpee residual is +1:00', formatDuration(v.limiter!.residualMs) === '1:00', formatDuration(v.limiter!.residualMs));
  check(
    'every other residual collapses to ~0',
    v.outcomes.filter((o) => o.name !== 'BURPEE BROAD JUMP').every((o) => Math.abs(o.residualMs) < 1),
    v.outcomes.map((o) => o.name + ':' + o.residualMs).join(' ')
  );
  check('exactly one significant loss', v.outcomes.filter((o) => o.isSignificantLoss).length === 1);
});

describe('a uniformly bad day blames nobody', () => {
  const baselines = model({
    'AIR SKIERG': 100, 'BURPEE BROAD JUMP': 120, 'HEAVY CARRY': 180,
    'DB WALKING LUNGES': 140, 'Run to AIR SKIERG': 40,
  });
  const current = [
    split('AIR SKIERG', 110), split('BURPEE BROAD JUMP', 132), split('HEAVY CARRY', 198),
    split('DB WALKING LUNGES', 154), split('Run to AIR SKIERG', 44),
  ];

  const v = analyzeRace(current, [], baselines, 190, DISPLAY);

  check('factor is 1.10', Math.abs(v.globalScaleFactor - 1.1) < 1e-9, v.globalScaleFactor);
  check('no limiter named', v.limiter === null, v.limiter?.name);
  check(
    'the longest split is not scapegoated',
    !v.outcomes.some((o) => o.name === 'HEAVY CARRY' && o.isSignificantLoss)
  );
});

// ── Significance ────────────────────────────────────────────────────────────

describe('a residual must clear both an absolute and a relative bar', () => {
  const flat = model({ A: 40, B: 100, C: 100, D: 100, E: 100 });
  const bigPctSmallAbs = analyzeRace(
    [split('A', 46), split('B', 100), split('C', 100), split('D', 100), split('E', 100)],
    [], flat, 190
  );
  check('15% of a short split, only 6s, is not significant', bigPctSmallAbs.limiter === null);

  const longFirst = model({ A: 300, B: 100, C: 100, D: 100, E: 100 });
  const bigAbsSmallPct = analyzeRace(
    [split('A', 311), split('B', 100), split('C', 100), split('D', 100), split('E', 100)],
    [], longFirst, 190
  );
  check('11s that is only 3.7% is not significant', bigAbsSmallPct.limiter === null);

  const even = model({ A: 100, B: 100, C: 100, D: 100, E: 100 });
  const both = analyzeRace(
    [split('A', 130), split('B', 100), split('C', 100), split('D', 100), split('E', 100)],
    [], even, 190
  );
  check('30s and 30% is significant', both.limiter?.name === 'A');
});

describe('strongest is the biggest negative residual, not the shortest split', () => {
  const baselines = model({ A: 100, B: 100, C: 100, D: 100, SHORT: 50, LONG: 300 });
  const current = [
    split('A', 100), split('B', 100), split('C', 100), split('D', 100),
    split('SHORT', 50), split('LONG', 200),
  ];

  const v = analyzeRace(current, [], baselines, 190);

  check('strongest is LONG', v.strongest?.name === 'LONG', v.strongest?.name);
  check('strongest is not the shortest split', v.strongest?.name !== 'SHORT');
  check('its residual is negative', v.strongest!.residualMs < 0, v.strongest?.residualMs);
});

describe('the factor needs enough splits to be trustworthy', () => {
  const v = analyzeRace(
    [split('A', 150), split('B', 150), split('C', 150)],
    [], model({ A: 100, B: 100, C: 100 }), 190
  );

  check('not applied below 5 splits', v.scaleFactorApplied === false);
  check('factor falls back to 1.0', v.globalScaleFactor === 1.0, v.globalScaleFactor);
  check('so every split reads as a loss', v.outcomes.every((o) => o.isSignificantLoss));
});

// ── Baselines ───────────────────────────────────────────────────────────────

describe('personal baseline takes over at 3 comparable samples', () => {
  const baselines = model({ A: 999, B: 100, C: 100, D: 100, E: 100 });
  const past = (a: number) => race([split('A', a), split('B', 100), split('C', 100), split('D', 100), split('E', 100)]);
  const current = [split('A', 120), split('B', 100), split('C', 100), split('D', 100), split('E', 100)];

  const two = analyzeRace(current, [past(100), past(110)], baselines, 190);
  const a2 = two.outcomes.find((o) => o.name === 'A')!;
  check('2 samples still uses the model', a2.baselineSource === 'MODEL', a2.baselineSource);
  check('confidence is PROVISIONAL', a2.baselineConfidence === 'PROVISIONAL');

  const three = analyzeRace(current, [past(100), past(110), past(120)], baselines, 190);
  const a3 = three.outcomes.find((o) => o.name === 'A')!;
  check('3 samples switches to personal', a3.baselineSource === 'PERSONAL', a3.baselineSource);
  check('personal baseline is the median', a3.baselineMs === 110000, a3.baselineMs);
  check('confidence is LOW', a3.baselineConfidence === 'LOW');

  const five = analyzeRace(current, [past(100), past(105), past(110), past(115), past(120)], baselines, 190);
  check('5 samples reaches HIGH', five.outcomes.find((o) => o.name === 'A')!.baselineConfidence === 'HIGH');
});

describe('only races under the same course tuning count', () => {
  const baselines = model({ A: 999, B: 100, C: 100, D: 100, E: 100 });
  const past = (a: number, key?: string) =>
    race([split('A', a), split('B', 100), split('C', 100), split('D', 100), split('E', 100)], key);
  const current = [split('A', 120), split('B', 100), split('C', 100), split('D', 100), split('E', 100)];

  const mismatched = analyzeRace(current, [past(100, 'v2'), past(110, 'v2'), past(120, 'v2')], baselines, 190, {}, 'v1');
  check('different tuning is excluded', mismatched.outcomes.find((o) => o.name === 'A')!.baselineSource === 'MODEL');

  const matched = analyzeRace(current, [past(100, 'v1'), past(110, 'v1'), past(120, 'v1')], baselines, 190, {}, 'v1');
  check('same tuning is used', matched.outcomes.find((o) => o.name === 'A')!.baselineSource === 'PERSONAL');

  const legacy = analyzeRace(current, [past(100), past(110), past(120)], baselines, 190, {}, 'v1');
  check(
    'legacy records with no tuning are incompatible',
    legacy.outcomes.find((o) => o.name === 'A')!.baselineSource === 'MODEL',
    legacy.outcomes.find((o) => o.name === 'A')!.baselineSource
  );

  const noCurrentKey = analyzeRace(current, [past(100), past(110), past(120)], baselines, 190, {});
  check(
    'without a current key we do not filter at all',
    noCurrentKey.outcomes.find((o) => o.name === 'A')!.baselineSource === 'PERSONAL'
  );
});

// ── Reporting ───────────────────────────────────────────────────────────────

describe('runs and stations are reported separately', () => {
  const baselines = model({
    'Run to AIR SKIERG': 40, 'Run to HEAVY CARRY': 40,
    'AIR SKIERG': 100, 'HEAVY CARRY': 250, 'DB WALKING LUNGES': 125,
  });
  const current = [
    split('Run to AIR SKIERG', 40), split('Run to HEAVY CARRY', 40),
    split('AIR SKIERG', 100), split('HEAVY CARRY', 250), split('DB WALKING LUNGES', 125),
  ];

  const v = analyzeRace(current, [], baselines, 190, DISPLAY);

  check('two runs', v.runOutcomes.length === 2, v.runOutcomes.length);
  check('three stations', v.stationOutcomes.length === 3, v.stationOutcomes.length);
  check('run display name keeps its prefix', v.runOutcomes[0].displayName.indexOf('Run to ') === 0, v.runOutcomes[0].displayName);
  check('SkiErg keeps its casing', v.stationOutcomes.some((o) => o.displayName === 'Air SkiErg'));
  check('DB is expanded to Dumbbell', v.stationOutcomes.some((o) => o.displayName === 'Dumbbell Walking Lunges'));
});

describe('heart rate bands split at 80 and 90 percent', () => {
  check('95% is high load', loadBandFor(0.95) === 'HIGH_LOAD');
  check('90% is high load', loadBandFor(0.9) === 'HIGH_LOAD');
  check('85% is mixed', loadBandFor(0.85) === 'MIXED');
  check('80% is mixed', loadBandFor(0.8) === 'MIXED');
  check('75% is low load', loadBandFor(0.75) === 'LOW_LOAD');
  check('no reading is unknown', loadBandFor(0) === 'UNKNOWN');
});

describe('wording never overclaims', () => {
  const baselines = model({ A: 100, B: 100, C: 100, D: 100, E: 100 });
  const current = [split('A', 140, 180), split('B', 100), split('C', 100), split('D', 100), split('E', 100)];

  const modelled = analyzeRace(current, [], baselines, 190, {});
  check('a modelled reference never says "weakest"', modelled.summary.indexOf('weakest') === -1);
  check('it stays provisional', modelled.summary.indexOf('model-adjusted') > -1, modelled.summary);
  check('heart rate is never stated as proof', modelled.summary.indexOf('rather than technique') === -1);
  check('cause is hedged', modelled.summary.indexOf('may be contributing') > -1);
  check('the AI is told not to recalculate', modelled.aiContext.indexOf('do not recalculate') > -1);
  check('the AI is warned maxHR is estimated', modelled.aiContext.indexOf('age estimate') > -1);

  const flat = () => race([split('A', 100), split('B', 100), split('C', 100), split('D', 100), split('E', 100)]);
  const personal = analyzeRace(current, [flat(), flat(), flat()], baselines, 190, {});
  check('a personal baseline speaks plainly', personal.summary.indexOf('biggest limiter today') > -1, personal.summary);
});

// ── Robustness ──────────────────────────────────────────────────────────────

describe('bad input never throws', () => {
  check('null everything', analyzeRace(null as any, null as any, null as any, 0).hasEnoughData === false);
  check('empty arrays', analyzeRace([], [], {}, 190).hasEnoughData === false);
  check('zero durations are dropped', analyzeRace([split('A', 0), split('B', 0)], [], model({ A: 10, B: 10 }), 190).hasEnoughData === false);
  check('splits with no baseline are dropped', analyzeRace([split('A', 10), split('B', 10)], [], {}, 190).hasEnoughData === false);

  const noHR = analyzeRace([split('A', 200), split('B', 100)], [], model({ A: 100, B: 100 }), 0);
  check('maxHR of zero yields UNKNOWN bands', noHR.outcomes[0].loadBand === 'UNKNOWN');

  const verdict: RaceVerdict = analyzeRace([split('A', 200), split('B', 100)], [], model({ A: 100, B: 100 }), 190);
  check('a verdict always carries a summary', verdict.summary.length > 0);
});

// ── Result ──────────────────────────────────────────────────────────────────

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
