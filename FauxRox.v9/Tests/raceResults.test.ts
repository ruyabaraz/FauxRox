// ============================================================================
// raceResults.test.ts — the completion layer under failure
// ============================================================================
// A finished race is not recoverable. The athlete just ran it, and there is no
// second chance to show them the result. So every dependency the results layer
// touches is treated as unreliable here: the cloud can be down, history can be
// malformed, the course config can be missing, and the coach can be offline.
//
// In every one of those cases the race must still produce a result, and the
// deterministic verdict must still produce text. The AI is a narrator, never a
// dependency.
// ============================================================================

import { RaceResultsController, HistoricRaceRecord } from '../Assets/Scripts/RaceResultsController';
import { makeRaceResult, makeRaceSplit, RaceResult } from '../Assets/Scripts/RaceResult';

let passed = 0;
let failed = 0;

function describe(name: string, body: () => void): void {
  console.log('\n=== ' + name + ' ===');
  body();
}

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail !== undefined ? '   -> ' + String(detail) : '')); }
}

/** Nothing in this layer may throw, whatever it is handed */
function neverThrows(name: string, body: () => void): void {
  try { body(); check(name, true); }
  catch (e) { check(name, false, 'threw: ' + e); }
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const BASELINES = {
  'Run to AIR SKIERG': 40000,
  'AIR SKIERG': 100000,
  'BURPEE BROAD JUMP': 100000,
  'HEAVY CARRY': 250000,
  'DB WALKING LUNGES': 125000,
};

const DISPLAY = {
  'AIR SKIERG': 'Air SkiErg',
  'BURPEE BROAD JUMP': 'Burpee Broad Jump',
  'HEAVY CARRY': 'Heavy Carry',
  'DB WALKING LUNGES': 'Dumbbell Walking Lunges',
};

/** A race where burpees ran long and everything else was on the model */
function finishedRace(configKey = 'v1', sessionKind = 'RACE'): RaceResult {
  return makeRaceResult({
    finishedAtMs: 1000,
    totalMs: 921000,
    completed: true,
    splits: [
      makeRaceSplit('Run to AIR SKIERG', 40000, 150, 160),
      makeRaceSplit('AIR SKIERG', 100000, 168, 175),
      makeRaceSplit('BURPEE BROAD JUMP', 180000, 182, 190),
      makeRaceSplit('HEAVY CARRY', 250000, 160, 170),
      makeRaceSplit('DB WALKING LUNGES', 125000, 145, 155),
    ],
    avgHR: 161,
    peakHR: 190,
    maxHR: 190,
    configKey,
    sessionKind,
    sessionTitle: 'Race Day',
    countsForRanking: true,
    incompleteStations: [],
  });
}

function pastRace(burpeeMs: number, configKey?: string): HistoricRaceRecord {
  return {
    completed: true,
    configKey,
    splits: [
      { name: 'Run to AIR SKIERG', duration: 40000, avgHR: 150 },
      { name: 'AIR SKIERG', duration: 100000, avgHR: 165 },
      { name: 'BURPEE BROAD JUMP', duration: burpeeMs, avgHR: 180 },
      { name: 'HEAVY CARRY', duration: 250000, avgHR: 160 },
      { name: 'DB WALKING LUNGES', duration: 125000, avgHR: 145 },
    ],
  };
}

function controller(overrides: any = {}): RaceResultsController {
  return new RaceResultsController({
    getHistory: overrides.getHistory || (() => []),
    getModelBaselines: overrides.getModelBaselines || (() => BASELINES),
    getDisplayNames: overrides.getDisplayNames || (() => DISPLAY),
    log: overrides.log,
  });
}

// ── Baseline behaviour ──────────────────────────────────────────────────────

describe('a healthy race produces a verdict', () => {
  const c = controller();
  const v = c.process(finishedRace());

  check('verdict exists', v !== null && v.hasEnoughData);
  check('limiter is the burpee station', v!.limiter?.name === 'BURPEE BROAD JUMP', v!.limiter?.name);
  check('summary is not empty', c.summaryText.length > 0);
  check('ai context is not empty', c.aiContext.length > 0);
  check('limiter line is formatted', /^BURPEE BROAD JUMP {2}\+\d+:\d\d$/.test(c.limiterLine), c.limiterLine);
});

describe('the UI and the coach read the same verdict object', () => {
  const c = controller();
  const returned = c.process(finishedRace());

  check('process returns the cached verdict', returned === c.verdict);
  check('summary comes from that verdict', c.summaryText === c.verdict!.summary);
  check('ai context comes from that verdict', c.aiContext === c.verdict!.aiContext);
});

describe('personal history is used when it is available and comparable', () => {
  const withHistory = controller({
    getHistory: () => [pastRace(120000, 'v1'), pastRace(125000, 'v1'), pastRace(130000, 'v1')],
  });
  withHistory.process(finishedRace('v1'));
  const burpee = withHistory.verdict!.outcomes.find((o) => o.name === 'BURPEE BROAD JUMP')!;
  check('baseline is personal', burpee.baselineSource === 'PERSONAL', burpee.baselineSource);

  const staleTuning = controller({
    getHistory: () => [pastRace(120000, 'OLD'), pastRace(125000, 'OLD'), pastRace(130000, 'OLD')],
  });
  staleTuning.process(finishedRace('v1'));
  check(
    'history from a different tuning is ignored',
    staleTuning.verdict!.outcomes.find((o) => o.name === 'BURPEE BROAD JUMP')!.baselineSource === 'MODEL'
  );
});

// ── Cloud failure ───────────────────────────────────────────────────────────

describe('the cloud being down does not cost the athlete their verdict', () => {
  const thrown = controller({
    getHistory: () => { throw new Error('supabase unreachable'); },
  });
  let v: any = null;
  neverThrows('a throwing history callback is contained', () => { v = thrown.process(finishedRace()); });

  check('verdict still produced', v !== null && v.hasEnoughData);
  check('it falls back to modelled baselines', thrown.verdict!.overallBaselineSource === 'MODEL');
  check('summary still shown', thrown.summaryText.length > 0);
  check('limiter still identified', thrown.verdict!.limiter?.name === 'BURPEE BROAD JUMP');
});

describe('history that is missing or malformed is skipped, not fatal', () => {
  const cases: { name: string; history: any }[] = [
    { name: 'null history', history: null },
    { name: 'undefined entries', history: [undefined, null] },
    { name: 'entries with no splits', history: [{ splits: null }, { splits: [] }] },
    { name: 'splits with no name', history: [{ splits: [{ duration: 1000, avgHR: 0 }] }] },
    { name: 'splits with zero duration', history: [{ splits: [{ name: 'AIR SKIERG', duration: 0, avgHR: 0 }] }] },
    { name: 'incomplete races', history: [pastRace(120000), { ...pastRace(120000), completed: false }] },
  ];

  for (const testCase of cases) {
    const c = controller({ getHistory: () => testCase.history });
    neverThrows(testCase.name, () => {
      const v = c.process(finishedRace());
      if (!v || !v.hasEnoughData) throw new Error('lost the verdict');
    });
  }
});

// ── Course config failure ───────────────────────────────────────────────────

describe('a missing course config degrades rather than crashes', () => {
  const noBaselines = controller({ getModelBaselines: () => ({}) });
  let v: any = 'unset';
  neverThrows('empty baselines are survivable', () => { v = noBaselines.process(finishedRace()); });
  check('verdict reports it has no data', v !== null && v.hasEnoughData === false);
  check('but still carries text for the panel', noBaselines.summaryText.length > 0, noBaselines.summaryText);

  const thrower = controller({ getModelBaselines: () => { throw new Error('no CourseManager'); } });
  neverThrows('a throwing baseline callback is contained', () => { thrower.process(finishedRace()); });
  check('still produces text', thrower.summaryText.length > 0);

  const noNames = controller({ getDisplayNames: () => { throw new Error('no display names'); } });
  neverThrows('a throwing display-name callback is contained', () => { noNames.process(finishedRace()); });
  check('falls back to a readable name', noNames.verdict!.limiter!.displayName.length > 0, noNames.verdict!.limiter!.displayName);
});

describe('everything failing at once still leaves the race intact', () => {
  const broken = new RaceResultsController({
    getHistory: () => { throw new Error('cloud down'); },
    getModelBaselines: () => { throw new Error('course gone'); },
    getDisplayNames: () => { throw new Error('names gone'); },
    log: () => { throw new Error('even the logger is broken'); },
  });

  const race = finishedRace();
  let v: any = 'unset';
  neverThrows('total dependency failure is contained', () => { v = broken.process(race); });

  check('a verdict object is still returned', v !== null);
  check('the panel still has something to show', broken.summaryText.length > 0, broken.summaryText);
  check('the finished race itself is untouched', broken.result === race);
  check('its total time survives', broken.result!.totalMs === 921000);
  check('its splits survive', broken.result!.splits.length === 5);
});

describe('the coach going offline changes nothing', () => {
  // The AI is never called by this layer. It is handed aiContext and may do
  // nothing with it; the deterministic summary is computed either way.
  const c = controller();
  c.process(finishedRace());

  check('summary is produced without any AI involvement', c.summaryText.length > 0);
  check('summary names the limiter', c.summaryText.indexOf('Burpee Broad Jump') > -1, c.summaryText);
  check('ai context is offered separately', c.aiContext !== c.summaryText);
  check('context tells the model not to recalculate', c.aiContext.indexOf('do not recalculate') > -1);
});

// ── Input contract ──────────────────────────────────────────────────────────

describe('odd inputs are handled without exceptions', () => {
  const c = controller();

  neverThrows('a null result', () => {
    const v = c.process(null as any);
    if (v !== null) throw new Error('expected null verdict');
  });

  neverThrows('a race with no splits', () => {
    c.process(makeRaceResult({
      finishedAtMs: 0, totalMs: 0, completed: false, splits: [],
      avgHR: 0, peakHR: 0, maxHR: 0, configKey: '', sessionKind: 'RACE',
      sessionTitle: '', countsForRanking: true, incompleteStations: [],
    }));
  });

  const training = controller();
  const t = training.process(finishedRace('v1', 'TRAINING'));
  check('training sessions get no race verdict', t === null);
  check('and no stale text is left behind', training.summaryText === '');

  const reset = controller();
  reset.process(finishedRace());
  reset.reset();
  check('reset clears the verdict', reset.verdict === null);
  check('reset clears the result', reset.result === null);
});

describe('a published result cannot be altered after the fact', () => {
  const race = finishedRace();

  neverThrows('mutating a frozen result is contained', () => {
    try { (race as any).totalMs = 1; } catch (e) { /* strict mode throws */ }
    try { (race.splits as any).push({}); } catch (e) { /* frozen array */ }
  });

  check('total time is unchanged', race.totalMs === 921000, race.totalMs);
  check('split count is unchanged', race.splits.length === 5, race.splits.length);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
