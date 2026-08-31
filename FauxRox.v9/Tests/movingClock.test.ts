// ============================================================================
// movingClock.test.ts — a run's clock counts running, not waiting
// ============================================================================

import {
  MovingClock,
  STILL_GRACE_SECONDS,
} from '../Assets/Scripts/MovingClock';

import {
  runPaceSecPerKm,
  timedRun,
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

const FRAME = 1 / 30;

/** Run for `seconds` at a steady pace, then stand still for `stillSeconds` */
function run(clock: MovingClock, seconds: number, metresPerSecond: number): number {
  let changes = 0;
  const frames = Math.round(seconds / FRAME);
  for (let i = 0; i < frames; i++) {
    if (clock.update(metresPerSecond * FRAME, FRAME)) changes++;
  }
  return changes;
}

function stand(clock: MovingClock, seconds: number): number {
  let changes = 0;
  const frames = Math.round(seconds / FRAME);
  for (let i = 0; i < frames; i++) {
    if (clock.update(0, FRAME)) changes++;
  }
  return changes;
}

describe('running counts', () => {
  const clock = new MovingClock();
  run(clock, 10, 3);

  check('ten seconds of running is ten seconds',
    Math.abs(clock.movingSeconds - 10) < 0.1, clock.movingSeconds);
  check('and the clock is not held', !clock.isStopped);
});

describe('standing still does not', () => {
  const clock = new MovingClock();
  run(clock, 10, 3);
  stand(clock, 30);

  // The grace seconds are credited so the clock never jumps backwards when a
  // stop is confirmed. Under a second, it is noise either way.
  const credited = 10 + STILL_GRACE_SECONDS;

  check('thirty seconds stood adds only the grace period',
    Math.abs(clock.movingSeconds - credited) < 0.2, clock.movingSeconds);
  check('and the clock says it is held', clock.isStopped);
  check('and knows how long', clock.stillSeconds > 29, clock.stillSeconds);
});

describe('it picks up again', () => {
  const clock = new MovingClock();
  run(clock, 5, 3);
  stand(clock, 20);
  run(clock, 5, 3);

  check('the running either side is counted',
    Math.abs(clock.movingSeconds - (10 + STILL_GRACE_SECONDS)) < 0.2, clock.movingSeconds);
  check('and the twenty seconds between them is not',
    clock.movingSeconds < 11.5, clock.movingSeconds);
  check('the clock is running again', !clock.isStopped);
});

describe('it reports the moment it changes, and only then', () => {
  const clock = new MovingClock();

  check('running from a standstill start is not a change', run(clock, 5, 3) === 0);

  // One transition into stopped, whatever the length of the stop - the
  // athlete is told once, not every frame for half a minute.
  check('one report when the athlete stops', stand(clock, 30) === 1);
  check('and one when they set off again', run(clock, 5, 3) === 1);
});

describe('a slow runner does not trip it', () => {
  // The path tracker credits displacement from an anchor rather than every
  // frame, so a slow athlete produces frames with nothing in them. A clock
  // that stopped on the first empty frame would stutter through an easy run.
  const clock = new MovingClock();

  // Eight centimetres takes a 0.4 m/s shuffle a fifth of a second, which is
  // the longest a genuinely moving athlete goes without crediting anything.
  // A burst at that spacing must not read as a stop.
  const SLOWEST_BURST_SECONDS = 0.2;

  for (let cycle = 0; cycle < 50; cycle++) {
    stand(clock, SLOWEST_BURST_SECONDS);
    run(clock, FRAME, 60);
  }

  check('the slowest credible burst spacing keeps the clock running',
    !clock.isStopped, clock.stillSeconds);
  // 50 cycles of a fifth of a second plus a frame, all of it credited
  check('and all of it is credited',
    Math.abs(clock.movingSeconds - 50 * (SLOWEST_BURST_SECONDS + FRAME)) < 0.4,
    clock.movingSeconds);

  // The margin is real but it is not unlimited, which is the point of
  // deriving the threshold rather than picking one that felt safe.
  const stalled = new MovingClock();
  stand(stalled, 1);
  check('and a full second of nothing does read as a stop', stalled.isStopped);
});

describe('pace divides by the running, not the waiting', () => {
  // The athlete covered 1700 m. Ten minutes of it was running and five were
  // spent at a crossing. 5:53/km is the run they did; 8:49/km is a number
  // about the traffic.
  const paceOfTheRun = runPaceSecPerKm({ measured: { movingSeconds: 600, distanceMetres: 1700 }, movingSeconds: 600, elapsedSeconds: 900, distanceMetres: 1700 });

  check('it reports the run', Math.round(paceOfTheRun) === 353, paceOfTheRun);

  check('a run that covered no ground still has no pace',
    runPaceSecPerKm({ measured: { movingSeconds: 600, distanceMetres: 0 }, movingSeconds: 600, elapsedSeconds: 600, distanceMetres: 0 }) === null);

  // Distance with no moving time is a tracking failure, not an instant
  // kilometre, and dividing by it would produce exactly that claim.
  check('and neither does one that recorded no running',
    runPaceSecPerKm({ measured: { movingSeconds: 0, distanceMetres: 400 }, movingSeconds: 0, elapsedSeconds: 600, distanceMetres: 400 }) === null);
});

describe('a reset clock is a new run', () => {
  const clock = new MovingClock();
  run(clock, 10, 3);
  stand(clock, 20);
  clock.reset();

  check('nothing is carried over', clock.movingSeconds === 0);
  check('and it does not start held', !clock.isStopped);
});

describe('a run that is standing still is not getting on with itself', () => {
  // The two pure pieces composed the way the engine composes them: the phase
  // is read at the clock's moving seconds, never at the wall.
  //
  // It matters because the transition is the only thing the athlete sees. A
  // phase driven by the wall would announce that the settling stretch was
  // over while they stood at a crossing, and they would arrive at the easy
  // part of the run without having run any of it.
  const easy = timedRun(900, [
    { fromSeconds: 0, label: 'SETTLE IN', cue: 'Start slower than easy.', counts: false },
    { fromSeconds: 120, label: 'EASY', cue: 'Settled.', counts: true },
  ]);

  const clock = new MovingClock();

  run(clock, 100, 2.5);
  check('a hundred seconds in, still settling',
    phaseAt(easy, clock.movingSeconds).label === 'SETTLE IN', clock.movingSeconds);

  // Five minutes standing. On the wall that is well past the boundary.
  stand(clock, 300);
  check('and five minutes of standing does not settle them',
    phaseAt(easy, clock.movingSeconds).label === 'SETTLE IN',
    clock.movingSeconds.toFixed(1) + 's moving of 400s elapsed');

  check('the clock knows it is held', clock.isStopped);

  // Running again is what advances it, and only running.
  run(clock, 25, 2.5);
  check('twenty more seconds of running does',
    phaseAt(easy, clock.movingSeconds).label === 'EASY', clock.movingSeconds);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
