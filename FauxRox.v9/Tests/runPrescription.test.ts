// ============================================================================
// runPrescription.test.ts — a run asked for in metres, or asked for in time
// ============================================================================
// Nothing generates a timed run yet; the archetypes that need one come next.
// So these exercise the primitive directly, which is the point of building it
// as a step of its own: the pipeline it has to survive - flattening, the
// preview override, the duration model - can be shown to handle both kinds
// before anything depends on it doing so.
// ============================================================================

import {
  RunPrescription,
  RunResult,
  StationConfig,
  StationMode,
  SessionBlock,
  BlockScheme,
  distanceRun,
  timedRun,
  hasRun,
  runMetresOf,
  runSecondsOf,
  runPaceSecPerKm,
  runPrescriptionCostSeconds,
  runCostSeconds,
  snapRunSeconds,
  MIN_RUN_SECONDS,
  flattenBlocks,
  shortenRunForPreview,
  stationCostSeconds,
  withRun,
  phaseAt,
} from '../Assets/Scripts/SessionTypes';

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

const CARRY: StationConfig = {
  name: 'HEAVY CARRY',
  mode: StationMode.DISTANCE,
  requirement: 40,
  instruction: 'Carry through the lane!',
  prefabType: 'HEAVY_CARRY',
};

const WALK: StationConfig = {
  name: 'WALK',
  mode: StationMode.TIMED,
  requirement: 90,
  instruction: 'Walk it off',
  prefabType: 'RECOVERY',
};

function block(run: RunPrescription | undefined, items: StationConfig[], rounds: number): SessionBlock {
  return {
    label: 'test',
    scheme: BlockScheme.STRAIGHT,
    rounds,
    run,
    items,
    restSeconds: 0,
    roundScales: new Array(rounds).fill(1),
  };
}

describe('each kind answers only in its own unit', () => {
  const far = distanceRun(400);
  const long = timedRun(900);

  check('a distance run has metres', runMetresOf(far) === 400);
  check('and no seconds', runSecondsOf(far) === 0);
  check('a timed run has seconds', runSecondsOf(long) === 900);

  // Not a claim that no ground is covered - a statement that no distance was
  // prescribed. A caller wanting to know how far the athlete went reads the
  // result, which is why the two are separate types.
  check('and no metres, because none were asked for', runMetresOf(long) === 0);

  check('both count as a run', hasRun(far) && hasRun(long));
  check('and nothing does not', !hasRun(undefined));
  check('nor a run of zero', !hasRun(distanceRun(0)));
});

describe('a pace falls out of either one', () => {
  // The reason the timed run is worth building. A distance run finishes on
  // the metre and the clock is read; a timed run finishes on the clock and
  // the accumulator is read. Same result type, same pace.
  const ranTheDistance: RunResult =
    { measured: { movingSeconds: 96, distanceMetres: 400 }, movingSeconds: 96, elapsedSeconds: 96, distanceMetres: 400 };
  const ranTheClock: RunResult =
    { measured: { movingSeconds: 600, distanceMetres: 1700 }, movingSeconds: 600, elapsedSeconds: 600, distanceMetres: 1700 };

  check('four hundred in 1:36 is 4:00/km', runPaceSecPerKm(ranTheDistance) === 240);
  check('ten minutes over 1700 m is 5:53/km',
    Math.round(runPaceSecPerKm(ranTheClock)) === 353, runPaceSecPerKm(ranTheClock));

  // Zero rather than null would read as infinitely fast, and a tracking
  // failure would arrive at the analysis looking like a personal best.
  check('a run that covered no ground has no pace',
    runPaceSecPerKm({ measured: { movingSeconds: 600, distanceMetres: 0 }, movingSeconds: 600, elapsedSeconds: 600, distanceMetres: 0 }) === null);
});

describe('the duration model asks each kind what it costs', () => {
  // A timed run costs what it says. There is nothing to assume and nothing
  // to get wrong about the athlete, which is the whole argument for it.
  check('a timed run costs exactly its prescription',
    runPrescriptionCostSeconds(timedRun(900)) === 900);

  // A distance run has to be divided by an assumed speed, and that
  // assumption is the one place the estimate can be wrong about somebody.
  check('a distance run costs its distance over the model speed',
    runPrescriptionCostSeconds(distanceRun(400)) === runCostSeconds(400));

  check('no run costs nothing', runPrescriptionCostSeconds(undefined) === 0);

  const station: StationConfig = { ...CARRY, run: timedRun(600) };
  check('and the station cost includes it',
    stationCostSeconds(station) > 600, stationCostSeconds(station));
});

describe('a run duration lands on numbers a coach would say', () => {
  check('rounded to the half minute', snapRunSeconds(707) === 720, snapRunSeconds(707));
  check('and down as well as up', snapRunSeconds(610) === 600, snapRunSeconds(610));

  // Below a minute it is a stride, and a stride is prescribed in metres.
  check('never below the floor', snapRunSeconds(20) === MIN_RUN_SECONDS);
  check('and zero stays zero', snapRunSeconds(0) === 0);
});

describe('flattening carries the run to the first movement of the round', () => {
  const timed = flattenBlocks([block(timedRun(900), [CARRY, WALK], 2)]);

  check('four stations from two rounds of two', timed.length === 4, timed.length);
  check('the run leads the round', runSecondsOf(timed[0].run) === 900);
  check('and not the movement after it', !hasRun(timed[1].run));
  check('every round gets one', runSecondsOf(timed[2].run) === 900);

  const measured = flattenBlocks([block(distanceRun(400), [CARRY], 3)]);
  check('a distance run flattens the same way',
    measured.every((s) => runMetresOf(s.run) === 400), measured.length);

  const none = flattenBlocks([block(undefined, [CARRY], 2)]);
  check('and a block with no run produces stations with none',
    none.every((s) => !hasRun(s.run)));
});

describe('preview shortens each kind in the unit it was asked for', () => {
  const interval: StationConfig = { ...CARRY, run: distanceRun(400) };
  const easy: StationConfig     = { ...CARRY, run: timedRun(900) };

  const shortInterval = shortenRunForPreview(interval, 6, 8);
  const shortEasy     = shortenRunForPreview(easy, 6, 8);

  check('four hundred metres becomes six', runMetresOf(shortInterval.run) === 6);
  check('and stays a distance run', shortInterval.run.kind === 'DISTANCE');

  // Six metres is a stand-in for four hundred. It is not a stand-in for
  // fifteen minutes: cutting a duration on the ground leaves the tester
  // sitting at a desk for the quarter of an hour that was not cut.
  check('fifteen minutes becomes eight seconds', runSecondsOf(shortEasy.run) === 8);

  // And its stretches come with it. Left where they were, a run cut to eight
  // seconds would be eight seconds of the opening stretch and the second one
  // would never arrive - so the shape the preview was opened to look at is
  // the one thing it could not show.
  const settled: StationConfig = {
    ...CARRY,
    run: timedRun(900, [
      { fromSeconds: 0, label: 'SETTLE IN', cue: 'Start slower than easy.', counts: false },
      { fromSeconds: 120, label: 'EASY', cue: 'Settled.', counts: true },
    ]),
  };

  const short = shortenRunForPreview(settled, 6, 12);

  check('the stretches are scaled with the run',
    phaseAt(short.run, 0).label === 'SETTLE IN' &&
    phaseAt(short.run, 11).label === 'EASY',
    JSON.stringify((short.run as any).phases));

  check('and the first one still starts at zero',
    (short.run as any).phases[0].fromSeconds === 0);

  check('the original keeps its own', phaseAt(settled.run, 11).label === 'SETTLE IN');
  check('and stays a timed run', shortEasy.run.kind === 'TIME');

  check('the originals are untouched',
    runMetresOf(interval.run) === 400 && runSecondsOf(easy.run) === 900);
});

describe('swapping the run keeps everything else about the station', () => {
  // The fixture that serves a distance run on the clock goes through here,
  // and so will the archetypes. Rebuilding the station field by field is how
  // dropCm, blockIndex and legMetres each went missing in turn.
  const interval: StationConfig = {
    ...CARRY,
    run: distanceRun(400),
    runLegMetres: 20,
    blockIndex: 2,
    blockLabel: '5 x 400m run + HEAVY CARRY',
    roundIndex: 3,
    roundCount: 5,
    dropCm: 40,
  };

  const onTheClock = withRun(interval, timedRun(12));

  check('the run changed kind', onTheClock.run.kind === 'TIME');
  check('and says twelve seconds', runSecondsOf(onTheClock.run) === 12);

  check('the station itself is untouched', onTheClock.requirement === 40);
  check('it still knows its block', onTheClock.blockIndex === 2);
  check('and its round', onTheClock.roundIndex === 3 && onTheClock.roundCount === 5);
  check('and its own tuning', onTheClock.dropCm === 40);

  // There is no distance left to divide into lengths.
  check('the leg cap is dropped', onTheClock.runLegMetres === undefined);

  check('the original is unchanged',
    runMetresOf(interval.run) === 400 && interval.runLegMetres === 20);

  const everythingElse = Object.keys(interval).filter(
    (k) => k !== 'run' && k !== 'runLegMetres' &&
           (interval as any)[k] !== (onTheClock as any)[k]
  );
  check('and nothing else moved', everythingElse.length === 0, everythingElse.join(', '));
});

describe('the preview cut lands where the athlete will see it', () => {
  // The transition is the whole of what absorbing the warm-up left to notice,
  // and it happens silently - nothing spawns, nothing ends. So it is worth
  // pinning down where it lands after the preview shortening, because "I saw
  // it on screen" is not something a bug report can carry.
  const easy: StationConfig = {
    ...CARRY,
    run: timedRun(900, [
      { fromSeconds: 0, label: 'SETTLE IN', cue: 'Start slower than easy.', counts: false },
      { fromSeconds: 120, label: 'EASY', cue: 'Settled.', counts: true },
    ]),
  };

  const preview = shortenRunForPreview(easy, 6, 40);

  check('a fifteen minute run previews as forty seconds',
    runSecondsOf(preview.run) === 40);

  // Two minutes of nine hundred is 13.3%, and 13.3% of forty is 5.3.
  const boundary = (preview.run as any).phases[1].fromSeconds;
  check('and the settling stretch ends at 5 seconds rather than 120',
    boundary === 5, boundary);

  check('so both stretches are reachable inside the preview',
    phaseAt(preview.run, 2).label === 'SETTLE IN' &&
    phaseAt(preview.run, 39).label === 'EASY');

  // The proportions are what survive, not the seconds.
  const prescribed = 120 / 900;
  const previewed = boundary / runSecondsOf(preview.run);
  check('the shape is the same shape',
    Math.abs(prescribed - previewed) < 0.02,
    prescribed.toFixed(3) + ' vs ' + previewed.toFixed(3));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
