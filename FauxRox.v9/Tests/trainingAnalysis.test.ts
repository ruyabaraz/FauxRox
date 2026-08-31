// ============================================================================
// trainingAnalysis.test.ts — the plan's own numbers are not results
// ============================================================================
// Reconstructed from the session that produced this, out loud:
//
//     "Longest split: ALTERNATING LATERAL LUNGE (0:40)"
//     "Shortest split: Run to DUMBBELL BEAR CRAWL (0:06)"
//
// A forty-second warm-up drill, ranked against a six-second run, on an axis
// neither of them shares. Run twice, that session produced 40.5s, 30.5s and
// 40.5s both times - identical to the tenth, because the plan had fixed all
// three. These lock the rules that make that sentence unsayable.
// ============================================================================

import {
  EffortRecord,
  axisOf,
  roleOf,
  seriesFrom,
  fatigueOf,
  analyseTraining,
  trainingAiContext,
  spellDuration,
  headlineFinding,
  shapeLine,
  MIN_ROUNDS_FOR_TREND,
} from '../Assets/Scripts/TrainingAnalysis';

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

// ── Fixtures ────────────────────────────────────────────────────────────────

function effort(over: Partial<EffortRecord>): EffortRecord {
  return {
    name: 'MOVEMENT',
    prefabType: 'MOVEMENT',
    mode: 'REPS',
    prescribed: 10,
    durationMs: 10000,
    blockScheme: 'STRAIGHT',
    blockIndex: 1,
    roundIndex: 0,
    avgHR: 0,
    ...over,
  };
}

/** The warm-up from the log, to the tenth of a second */
const WARMUP: EffortRecord[] = [
  effort({ name: 'JUMPING JACKS', prefabType: 'WARMUP_JUMPING_JACKS', mode: 'TIMED',
           prescribed: 40, durationMs: 40500, blockScheme: 'WARMUP', blockIndex: 0 }),
  effort({ name: 'DYNAMIC QUAD STRETCH', prefabType: 'WARMUP_QUAD_STRETCH', mode: 'TIMED',
           prescribed: 30, durationMs: 30500, blockScheme: 'WARMUP', blockIndex: 0 }),
  effort({ name: 'ALTERNATING LATERAL LUNGE', prefabType: 'WARMUP_LATERAL_LUNGE', mode: 'TIMED',
           prescribed: 40, durationMs: 40500, blockScheme: 'WARMUP', blockIndex: 0 }),
];

const REST = effort({ name: 'REST', prefabType: 'REST', mode: 'TIMED',
                      prescribed: 60, durationMs: 60000 });

/** Four rounds of a movement whose rate is flat, at 1.0s per rep */
function steadyRounds(reps: number[], secondsPerRep: number): EffortRecord[] {
  return reps.map((r, i) => effort({
    name: 'BURPEE BROAD JUMP', prefabType: 'BURPEE_BROAD_JUMP', mode: 'REPS',
    prescribed: r, durationMs: Math.round(r * secondsPerRep * 1000), roundIndex: i,
  }));
}

// ── The contract ────────────────────────────────────────────────────────────

describe('the observability contract, mode by mode', () => {
  check('TIMED measures nothing',        axisOf('TIMED') === 'NONE');
  check('REPS gives a work rate',        axisOf('REPS') === 'WORK_RATE');
  check('VERTICAL_REPS gives a work rate', axisOf('VERTICAL_REPS') === 'WORK_RATE');
  check('LATERAL_REPS gives a work rate',  axisOf('LATERAL_REPS') === 'WORK_RATE');
  check('ZONE_HIT gives a work rate',    axisOf('ZONE_HIT') === 'WORK_RATE');
  check('DISTANCE gives a pace',         axisOf('DISTANCE') === 'PACE');
  check('RUN gives a pace',              axisOf('RUN') === 'PACE');

  // A mode nobody has taught this module about must measure nothing, never
  // fall through to being ranked by duration.
  check('an unknown mode measures nothing', axisOf('SOMETHING_NEW') === 'NONE');
  check('no mode at all measures nothing',  axisOf('') === 'NONE');
});

describe('what counts as work', () => {
  check('rest is not work',     roleOf(REST) === 'REST');
  check('recovery is not work', roleOf(effort({ prefabType: 'RECOVERY' })) === 'REST');
  check('the warm-up is not work by scheme', roleOf(WARMUP[0]) === 'WARMUP');
  check('the warm-up is not work by prefab',
    roleOf(effort({ prefabType: 'WARMUP_A_SKIPS', blockScheme: 'STRAIGHT' })) === 'WARMUP');
  check('a working movement is work', roleOf(effort({})) === 'WORK');
});

// ── The reported sentence ───────────────────────────────────────────────────

describe('the warm-up cannot become a performance issue', () => {
  const efforts = WARMUP.concat(steadyRounds([10, 10, 10, 10], 1.0));
  const summary = analyseTraining(efforts, true);

  // 40.5s is the longest split in this session by a wide margin
  check('the lunge is still the longest split',
    Math.max(...efforts.map((e) => e.durationMs)) === 40500);

  check('but no finding names it',
    summary.findings.every((f) => f.name.indexOf('LUNGE') < 0),
    summary.findings.map((f) => f.name).join(', '));

  const context = trainingAiContext(summary);
  check('and the coach is never handed it',
    context.indexOf('LATERAL LUNGE') < 0, context);
  check('nor the headline', headlineFinding(summary).indexOf('LUNGE') < 0);

  // The warm-up still happened, and the session length should say so
  check('the warm-up is still counted in the session',
    summary.warmupMs === 111500, summary.warmupMs);
  check('but not in the working time',
    summary.workMs === 40000, summary.workMs);
});

describe('a timed hold produces no performance statement, ever', () => {
  // Three plausible timed movements, one of them dramatically "long"
  const efforts = [
    effort({ name: 'PLANK HOLD', prefabType: 'PLANK_HOLD', mode: 'TIMED',
             prescribed: 40, durationMs: 40500, roundIndex: 0 }),
    effort({ name: 'PLANK HOLD', prefabType: 'PLANK_HOLD', mode: 'TIMED',
             prescribed: 40, durationMs: 40500, roundIndex: 1 }),
    effort({ name: 'PLANK HOLD', prefabType: 'PLANK_HOLD', mode: 'TIMED',
             prescribed: 40, durationMs: 40500, roundIndex: 2 }),
    effort({ name: 'FARMERS HOLD', prefabType: 'FARMERS_HOLD', mode: 'TIMED',
             prescribed: 30, durationMs: 90000, roundIndex: 0 }),
  ];
  const summary = analyseTraining(efforts, true);

  check('timed work builds no series', seriesFrom(efforts).length === 0);
  check('so there are no findings', summary.findings.length === 0);
  check('and no measurement is claimed', summary.hasMeasurement === false);
  check('the headline is empty', headlineFinding(summary) === '');

  // The exact phrasing the log produced
  const context = trainingAiContext(summary);
  check('the coach is told the durations mean nothing',
    context.indexOf('their durations mean nothing') > 0, context);
  check('and is told not to call anything long or slow',
    context.indexOf('never call one long, short, slow or a weakness') > 0);
  check('and is given a reason rather than silence',
    context.indexOf('NOTHING MEASURABLE') > 0);

  // The session still gets described - refusing to judge is not refusing to speak
  check('the shape is still reported', shapeLine(summary).length > 0, shapeLine(summary));
});

describe('rest never enters any ranking', () => {
  const efforts = steadyRounds([10, 10, 10], 1.0);
  efforts.splice(1, 0, REST);
  efforts.splice(3, 0, effort({ name: 'WALK', prefabType: 'RECOVERY', mode: 'TIMED',
                                prescribed: 90, durationMs: 90000 }));

  const summary = analyseTraining(efforts, true);
  const series = seriesFrom(efforts);

  check('no series is built from rest',
    series.every((s) => s.prefabType !== 'REST' && s.prefabType !== 'RECOVERY'));
  check('rest is not counted as working time', summary.workMs === 30000, summary.workMs);
  check('rest is counted as rest', summary.restMs === 150000, summary.restMs);
  check('and no finding mentions it',
    summary.findings.every((f) => f.name !== 'REST' && f.name !== 'WALK'));
});

// ── Cross-modality ──────────────────────────────────────────────────────────

describe('different movements are never ordered against each other', () => {
  const efforts = [
    ...steadyRounds([10, 10, 10], 1.0),
    effort({ name: 'Run to HEAVY CARRY', prefabType: 'RUN', mode: 'RUN',
             prescribed: 240, durationMs: 70000, roundIndex: 0 }),
    effort({ name: 'Run to HEAVY CARRY', prefabType: 'RUN', mode: 'RUN',
             prescribed: 240, durationMs: 75000, roundIndex: 1 }),
    effort({ name: 'Run to HEAVY CARRY', prefabType: 'RUN', mode: 'RUN',
             prescribed: 240, durationMs: 80000, roundIndex: 2 }),
  ];

  const series = seriesFrom(efforts);
  check('each movement gets its own series', series.length === 2);
  check('and each carries one axis',
    series.every((s) => s.axis === 'WORK_RATE' || s.axis === 'PACE'));

  // A series holds exactly one movement, so there is nowhere to put a
  // comparison between two of them even if somebody wanted one.
  check('a series never mixes movements',
    series.every((s) => s.rates.length === 3));
  check('the reps series is a work rate',
    series[0].axis === 'WORK_RATE' && series[0].prefabType === 'BURPEE_BROAD_JUMP');
  check('the run series is a pace',
    series[1].axis === 'PACE' && series[1].prefabType === 'RUN');

  // Findings are per movement; nothing in the output ranks one above another
  const summary = analyseTraining(efforts, true);
  check('findings stay per movement',
    summary.findings.length === 2);
  const context = trainingAiContext(summary);
  check('the coach is told not to rank movements',
    context.indexOf('Never rank different movements against each other') > 0);
});

// ── Rounds of one movement ──────────────────────────────────────────────────

describe('a movement is compared against itself across rounds', () => {
  // A ladder: 3-3-4-5-4-3-3 reps. Raw durations differ by design, so any
  // analysis on duration would find a fake signal. The rate is flat.
  const ladder = steadyRounds([3, 3, 4, 5, 4, 3, 3], 2.0);
  const flat = fatigueOf(seriesFrom(ladder)[0]);

  check('a ladder with a flat rate reads as held', flat.direction === 'HELD', flat.changePercent);
  check('even though the durations vary by 67%',
    Math.max(...ladder.map((e) => e.durationMs)) /
    Math.min(...ladder.map((e) => e.durationMs)) > 1.6);

  // The same ladder, but the athlete fades: 2.0s/rep early, 3.0s/rep late
  const fading = [
    ...steadyRounds([3, 3, 4], 2.0).map((e, i) => ({ ...e, roundIndex: i })),
    ...steadyRounds([5, 4, 3, 3], 3.0).map((e, i) => ({ ...e, roundIndex: i + 3 })),
  ];
  const faded = fatigueOf(seriesFrom(fading)[0]);
  check('a real slowdown is caught', faded.direction === 'SLOWED', faded.changePercent);
  check('with roughly the right magnitude',
    faded.changePercent > 40 && faded.changePercent < 60, faded.changePercent);
  check('and it counts every round', faded.rounds === 7);

  // Getting faster is a different thing and is not called a weakness
  const warming = [
    ...steadyRounds([5, 5, 5], 3.0).map((e, i) => ({ ...e, roundIndex: i })),
    ...steadyRounds([5, 5, 5], 2.0).map((e, i) => ({ ...e, roundIndex: i + 3 })),
  ];
  check('speeding up is reported as improvement',
    fatigueOf(seriesFrom(warming)[0]).direction === 'IMPROVED');
});

describe('one round is not a trend', () => {
  for (let rounds = 1; rounds < MIN_ROUNDS_FOR_TREND; rounds++) {
    const reps: number[] = [];
    for (let i = 0; i < rounds; i++) reps.push(10);
    const series = seriesFrom(steadyRounds(reps, 1.0));
    check(rounds + ' round(s) supports no finding', fatigueOf(series[0]) === null);
  }

  const enough = seriesFrom(steadyRounds([10, 10, 10], 1.0));
  check(MIN_ROUNDS_FOR_TREND + ' rounds does', fatigueOf(enough[0]) !== null);
});

describe('small movements are not amplified into findings', () => {
  // 6% is inside the noise band; 10% is the threshold
  const small = [
    ...steadyRounds([10, 10, 10], 1.0).map((e, i) => ({ ...e, roundIndex: i })),
    ...steadyRounds([10, 10, 10], 1.06).map((e, i) => ({ ...e, roundIndex: i + 3 })),
  ];
  check('a 6% drift reads as held',
    fatigueOf(seriesFrom(small)[0]).direction === 'HELD');
  check('and never reaches the headline',
    headlineFinding(analyseTraining(small, true)) === '');
});

// ── Preview ─────────────────────────────────────────────────────────────────

describe('preview durations produce no fitness conclusion', () => {
  // Preview auto-completes hand-tracked stations after four seconds. The log
  // has the same bear crawl at 10.3s on one run and 0.9s on the next.
  const efforts = [
    ...steadyRounds([10, 10, 10, 10], 0.4),
    ...WARMUP,
  ];

  const trusted = analyseTraining(efforts, true);
  const preview = analyseTraining(efforts, false);

  check('the same data supports a finding when it is real',
    trusted.findings.length > 0);
  check('and none of it when it came from preview',
    preview.findings.length === 0);
  check('preview claims no measurement', preview.hasMeasurement === false);
  check('and says why',
    preview.reason.indexOf('preview') >= 0, preview.reason);

  // The session shape is the harness's, but it is not a performance claim
  check('the times are still totalled', preview.totalMs === trusted.totalMs);

  const context = trainingAiContext(preview);
  check('the coach is told nothing is measurable',
    context.indexOf('NOTHING MEASURABLE') > 0);
  check('and still forbidden from ranking',
    context.indexOf('Never rank different movements') > 0);
});

// ── Degenerate input ────────────────────────────────────────────────────────

describe('the summary works when there is nothing to summarise', () => {
  const empty = analyseTraining([], true);
  check('no efforts is not a crash', empty.totalMs === 0);
  check('and claims nothing', empty.hasMeasurement === false);
  check('and still produces a context', trainingAiContext(empty).length > 0);
  check('with no headline', headlineFinding(empty) === '');

  check('nulls in the list are ignored',
    analyseTraining([null, effort({}), undefined] as any, true).movementCount === 1);

  // A station that completed instantly, or one prescribed zero of something
  const degenerate = analyseTraining([
    effort({ prescribed: 0, durationMs: 10000 }),
    effort({ prescribed: 10, durationMs: 0 }),
  ], true);
  check('a zero prescription supports nothing', degenerate.findings.length === 0);
  check('and neither does a zero duration', degenerate.hasMeasurement === false);
});

// ── Wording ─────────────────────────────────────────────────────────────────

describe('a rate is printed in the units its movement is read in', () => {
  // Two runs a real distance apart. In seconds per metre both round to 0.3
  // and the finding reads "slowed 12% from 0.3s per metre to 0.3s per metre".
  const runs = [
    ...[0, 1, 2].map((i) => effort({ name: 'Run', prefabType: 'RUN', mode: 'RUN',
      prescribed: 240, durationMs: 240 * 288, roundIndex: i })),
    ...[3, 4, 5].map((i) => effort({ name: 'Run', prefabType: 'RUN', mode: 'RUN',
      prescribed: 240, durationMs: 240 * 322, roundIndex: i })),
  ];
  const context = trainingAiContext(analyseTraining(runs, true));

  check('a run reads in minutes per kilometre',
    context.indexOf('per km') > 0, context);
  check('and the two paces are distinguishable',
    context.indexOf('4:48 per km') > 0 && context.indexOf('5:22 per km') > 0, context);
  check('a run is never printed in seconds per metre',
    context.indexOf('s per metre') < 0, context);

  // A three-metre bear crawl in minutes per kilometre would be absurd
  const crawl = [
    ...[0, 1, 2].map((i) => effort({ name: 'BEAR CRAWL', prefabType: 'POWER_LANE',
      mode: 'DISTANCE', prescribed: 3, durationMs: 10000, roundIndex: i })),
    ...[3, 4, 5].map((i) => effort({ name: 'BEAR CRAWL', prefabType: 'POWER_LANE',
      mode: 'DISTANCE', prescribed: 3, durationMs: 14000, roundIndex: i })),
  ];
  const crawlContext = trainingAiContext(analyseTraining(crawl, true));
  check('a short carry reads in seconds per metre',
    crawlContext.indexOf('s per metre') > 0, crawlContext);
  check('and not in kilometres', crawlContext.indexOf('per km') < 0);

  // Units are wording. They must not widen what may be compared: a run and a
  // carry share the PACE axis and are still two separate findings.
  const both = runs.concat(crawl);
  check('sharing an axis does not merge two movements',
    analyseTraining(both, true).findings.length === 2);
});

describe('the panel line does not scold', () => {
  const fading = [
    ...steadyRounds([5, 5, 5], 2.0).map((e, i) => ({ ...e, roundIndex: i })),
    ...steadyRounds([5, 5, 5], 3.0).map((e, i) => ({ ...e, roundIndex: i + 3 })),
  ];
  const line = headlineFinding(analyseTraining(fading, true));

  check('it reports what happened', line.indexOf('slowed') > 0, line);
  // Fading over the rounds of a ladder is what a ladder is for
  check('it does not call it a weakness', line.toLowerCase().indexOf('needs work') < 0);
  check('it names the movement', line.indexOf('BURPEE BROAD JUMP') === 0, line);
});

describe('a break is reported as what it was', () => {
  // Forty seconds jogged and forty seconds standing are both breaks and are
  // not the same break. In a threshold session that difference is the session
  // - the float is short and moving because that is what stops lactate
  // clearing - so a summary that only says "resting" describes the clock.
  const bout = (kind: string, ms: number): EffortRecord => ({
    name: kind === 'FLOAT_JOG' ? 'FLOAT' : 'JOG',
    prefabType: 'RECOVERY',
    mode: 'TIMED',
    prescribed: ms / 1000,
    durationMs: ms,
    blockScheme: 'STRAIGHT',
    blockIndex: 1,
    roundIndex: 1,
    avgHR: 0,
    recoveryKind: kind,
  });

  const work: EffortRecord = {
    name: 'RUN', prefabType: 'RUN', mode: 'RUN', prescribed: 1000,
    durationMs: 300000, blockScheme: 'STRAIGHT', blockIndex: 1,
    roundIndex: 1, avgHR: 0,
  };

  const floats = analyseTraining([work, bout('FLOAT_JOG', 46000), work,
                                  bout('FLOAT_JOG', 46000)], true);

  check('a session of floats says so', floats.recoveryKind === 'FLOAT_JOG',
    floats.recoveryKind);
  check('and the coach is told what to call it',
    trainingAiContext(floats).indexOf('floating between repetitions') > 0,
    trainingAiContext(floats).split('\n')[0]);

  const walks = analyseTraining([work, bout('WALK_OR_JOG', 214000)], true);
  check('walking recovery is named as walking',
    trainingAiContext(walks).indexOf('walking between repetitions') > 0);

  // Walking is a break spent standing as far as the aerobic system is
  // concerned; jogging is not. Both are excluded from the work total.
  check('a float counts as time spent moving', floats.activeRestMs === 92000,
    floats.activeRestMs);
  check('and a walked recovery does not', walks.activeRestMs === 0,
    walks.activeRestMs);
  check('but neither counts as work',
    floats.workMs === 600000 && walks.workMs === 300000);

  // A session that mixed kinds has no single answer, and inventing one would
  // describe a session the athlete did not do.
  const mixed = analyseTraining([work, bout('FLOAT_JOG', 46000), work,
                                 bout('WALK_OR_JOG', 214000)], true);
  check('a mixed session claims no single kind', mixed.recoveryKind === '',
    mixed.recoveryKind);
  check('and falls back to the plainest word',
    trainingAiContext(mixed).indexOf('resting between sets') > 0);
});

describe('a session with no breaks says nothing about breaks', () => {
  // An easy run is one continuous bout. "0:00 resting between sets" is not a
  // fact about it - it is a sentence about sets, said to somebody who did
  // not do any, in the one paragraph the coach is asked to speak from.
  const run: EffortRecord = {
    name: '15:00 run', prefabType: 'RUN', mode: 'RUN', prescribed: 900,
    durationMs: 900000, blockScheme: 'STRAIGHT', blockIndex: 0,
    roundIndex: 1, avgHR: 0,
  };

  const continuous = trainingAiContext(analyseTraining([run], true));

  check('the shape is just the work',
    continuous.indexOf('resting') < 0 && continuous.indexOf('recovering') < 0,
    continuous.split('\n')[0]);

  // And it did warm up - in its own opening minutes, which is what easy
  // means. "0:00 warm-up" invites the coach to tell the athlete off for
  // skipping something they did not skip, and silence invites the same
  // reading, so the session says which it was.
  const shapeOf = (context: string) => context.split('\n')[0];

  check('nor a warm-up it never had',
    shapeOf(continuous).indexOf('warm-up') < 0, shapeOf(continuous));

  const warmedItself = trainingAiContext(analyseTraining([run], true, true));
  check('a session that warms itself says so',
    shapeOf(warmedItself).indexOf('warms up in its own opening minutes') > 0,
    shapeOf(warmedItself));

  check('and does not report a warm-up of zero',
    shapeOf(warmedItself).indexOf('0:00') < 0, shapeOf(warmedItself));

  check('and the work is still reported',
    continuous.indexOf('15 minutes working') > 0, continuous.split('\n')[0]);

  // And a session that does have breaks still reports them.
  const rest: EffortRecord = {
    name: 'JOG', prefabType: 'RECOVERY', mode: 'TIMED', prescribed: 60,
    durationMs: 60000, blockScheme: 'STRAIGHT', blockIndex: 0,
    roundIndex: 1, avgHR: 0, recoveryKind: 'EASY_JOG',
  };

  check('an interval session still says what the breaks were',
    trainingAiContext(analyseTraining([run, rest], true))
      .indexOf('jogging between repetitions') > 0);
});

describe('the running findings reach the coach, and only when measured', () => {
  const interval = (paceSecPerKm: number): EffortRecord => ({
    name: '1000m RUN', prefabType: 'RUN', mode: 'RUN', prescribed: 1000,
    durationMs: 300000, blockScheme: 'STRAIGHT', blockIndex: 0,
    roundIndex: 1, avgHR: 0,
    archetype: 'THRESHOLD',
    prescribedKind: 'DISTANCE',
    paceSecPerKm,
  });

  const faded = [interval(280), interval(284), interval(298), interval(306)];

  const measured = trainingAiContext(analyseTraining(faded, true));
  check('a fade is reported', measured.indexOf('FADE') > 0, measured);
  check('with both halves named',
    measured.indexOf('4:42') > 0 && measured.indexOf('5:02') > 0, measured);

  // In preview the runs complete on a timer, so their pace is a fact about
  // the editor. The rule that has held everywhere else holds here.
  const previewed = trainingAiContext(analyseTraining(faded, false));
  check('and nothing is reported from a preview',
    previewed.indexOf('FADE') < 0 && previewed.indexOf('PACE') < 0, previewed);
  check('which says why instead',
    previewed.indexOf('NOTHING MEASURABLE') > 0);

  // A run whose tracking produced nothing has no pace, and carrying it as a
  // zero would drag every average it touched towards a run nobody did.
  const broken: EffortRecord = { ...interval(0), paceSecPerKm: undefined };
  const withHole = trainingAiContext(analyseTraining(
    [interval(280), interval(284), broken, interval(288)], true));

  check('a run with no pace is left out rather than counted as zero',
    withHole.indexOf('FADE') < 0, withHole);

  // A session with no running says nothing about running.
  const carry: EffortRecord = {
    name: 'HEAVY CARRY', prefabType: 'HEAVY_CARRY', mode: 'DISTANCE',
    prescribed: 50, durationMs: 60000, blockScheme: 'STRAIGHT',
    blockIndex: 0, roundIndex: 1, avgHR: 0,
  };

  const strength = trainingAiContext(analyseTraining([carry, carry, carry], true));
  check('a strength session is told nothing about pace',
    strength.indexOf('PACE') < 0 && strength.indexOf('FADE') < 0, strength);
});

describe('a duration handed to the coach says which units it is in', () => {
  // Reported from a preview: a forty-eight second session was read back to
  // the athlete as forty-eight minutes. Not the model being careless -
  // "finished after 0:48" contains no units, and m:ss is a convention that
  // only holds when there is a clock face around the number.
  check('seconds are seconds', spellDuration(48000) === '48 seconds',
    spellDuration(48000));
  check('whole minutes are minutes', spellDuration(900000) === '15 minutes',
    spellDuration(900000));
  check('and one of them is singular', spellDuration(60000) === '1 minute');
  check('both together', spellDuration(252000) === '4 minutes 12 seconds',
    spellDuration(252000));
  check('nothing is nothing', spellDuration(0) === '0 seconds');

  // Nothing in the text handed to the model may be a bare clock.
  const short: EffortRecord = {
    name: '15:00 run', prefabType: 'RUN', mode: 'RUN', prescribed: 900,
    durationMs: 48000, blockScheme: 'STRAIGHT', blockIndex: 0,
    roundIndex: 1, avgHR: 0,
  };

  const shape = trainingAiContext(analyseTraining([short], true)).split('\n')[0];

  check('the session shape spells its durations',
    shape.indexOf('48 seconds working') > 0, shape);
  check('and carries no bare clock', shape.indexOf('0:48') < 0, shape);
});

describe('working time is the working, not the clock around it', () => {
  // Reported from a preview: forty seconds of running inside a forty-eight
  // second split came back as "48 seconds working". The eight seconds were
  // spent standing still, and crediting them as work tells the athlete they
  // trained for longer than they did - which matters more on the glasses,
  // where a real session has real stops in it, than in an editor.
  const run = (durationMs: number, activeMs: number): EffortRecord => ({
    name: '15:00 run', prefabType: 'RUN', mode: 'RUN', prescribed: 900,
    durationMs, activeMs, blockScheme: 'STRAIGHT', blockIndex: 0,
    roundIndex: 1, avgHR: 0,
  });

  const stopped = analyseTraining([run(48000, 40000)], true);

  check('the work is the running', stopped.workMs === 40000, stopped.workMs);
  check('and the standing is counted apart', stopped.stoppedMs === 8000,
    stopped.stoppedMs);

  // Not rest: nobody prescribed it and the athlete was not recovering to a
  // plan. It is simply what happened.
  check('it is not rest', stopped.restMs === 0);

  // Every other kind of effort has nothing to subtract - a plank held for
  // thirty seconds took thirty seconds.
  const hold: EffortRecord = {
    name: 'PLANK HOLD', prefabType: 'PLANK', mode: 'TIMED', prescribed: 30,
    durationMs: 30000, blockScheme: 'STRAIGHT', blockIndex: 0,
    roundIndex: 1, avgHR: 0,
  };

  const held = analyseTraining([hold], true);
  check('a hold is all work', held.workMs === 30000 && held.stoppedMs === 0);

  // Reported only when it is worth an athlete's attention. Every pause named
  // would make the summary about their interruptions.
  const brief = trainingAiContext(analyseTraining([run(45000, 40000)], true));
  check('five seconds of standing is not mentioned',
    brief.indexOf('stopped') < 0, brief.split('\n')[0]);

  const long = trainingAiContext(analyseTraining([run(120000, 60000)], true));
  check('a minute of it is', long.indexOf('1 minute of it stopped') > 0,
    long.split('\n')[0]);
  check('and the working time is still the running',
    long.indexOf('1 minute working') > 0, long.split('\n')[0]);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
