// ============================================================================
// paceMeter.test.ts — a pace the athlete can read
// ============================================================================

import {
  PaceMeter,
  PACE_WINDOW_SECONDS,
  MIN_DISTANCE_FOR_PACE_METRES,
} from '../Assets/Scripts/PaceMeter';

import { formatPace } from '../Assets/Scripts/PaceTarget';

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

/** Run at a steady speed for a number of seconds */
function run(meter: PaceMeter, seconds: number, metresPerSecond: number): void {
  const frames = Math.round(seconds / FRAME);
  for (let i = 0; i < frames; i++) meter.update(metresPerSecond * FRAME, FRAME);
}

/**
 * The same speed, credited in bursts - which is what the path tracker
 * actually produces, since it holds an anchor until displacement exceeds
 * eight centimetres.
 */
function runInBursts(meter: PaceMeter, seconds: number, metresPerSecond: number): void {
  const frames = Math.round(seconds / FRAME);
  let owed = 0;

  for (let i = 0; i < frames; i++) {
    owed += metresPerSecond * FRAME;
    if (owed >= 0.08) {
      meter.update(owed, FRAME);
      owed = 0;
    } else {
      meter.update(0, FRAME);
    }
  }
}

describe('it says nothing until it has seen enough ground', () => {
  const meter = new PaceMeter();

  check('a fresh meter has no pace', meter.secPerKm === null);

  run(meter, 2, 3);
  check('and two seconds of running is not enough',
    meter.secPerKm === null, meter.windowMetres.toFixed(1) + 'm');

  // Below the threshold the reading is the tracker's resolution and the
  // acceleration off the start line, not the athlete.
  check('the threshold is a distance, not a time',
    MIN_DISTANCE_FOR_PACE_METRES > 0);

  run(meter, 10, 3);
  check('twelve seconds is', meter.secPerKm !== null, meter.windowMetres.toFixed(1) + 'm');
});

describe('a steady runner reads steady', () => {
  const meter = new PaceMeter();
  run(meter, 30, 3);

  // Three metres a second is 5:33 per kilometre.
  check('three metres a second reads as 5:33',
    formatPace(meter.secPerKm) === '5:33', formatPace(meter.secPerKm));

  // The reading a real athlete produces, credited in bursts rather than every
  // frame. An average that flickered here would be unreadable on a panel and
  // worse than unreadable - somebody holding a steady pace would watch it
  // swing and conclude they were not.
  const bursty = new PaceMeter();
  runInBursts(bursty, 30, 3);

  check('and bursts read the same as a trickle',
    Math.abs(bursty.secPerKm - meter.secPerKm) < 5,
    formatPace(bursty.secPerKm) + ' vs ' + formatPace(meter.secPerKm));
});

describe('it answers about now, not about the whole run', () => {
  const meter = new PaceMeter();

  // Two minutes slow, then half a minute fast. An average over the run would
  // still be reporting the slow part; the athlete is asking whether they are
  // running this right now.
  run(meter, 120, 2);
  const slow = meter.secPerKm;

  run(meter, PACE_WINDOW_SECONDS + 5, 4);
  const fast = meter.secPerKm;

  check('two metres a second reads as 8:20', formatPace(slow) === '8:20', formatPace(slow));
  check('and after speeding up it reads the new pace',
    formatPace(fast) === '4:10', formatPace(fast));

  check('the window is short enough to be about now',
    PACE_WINDOW_SECONDS <= 30, PACE_WINDOW_SECONDS);
});

describe('a stop freezes the reading rather than ruining it', () => {
  // The meter is fed only while the run clock is running, so this is what a
  // stop looks like from in here: nothing arrives. The reading holds.
  const meter = new PaceMeter();
  run(meter, 30, 3);

  const before = meter.secPerKm;
  // ... athlete stops; the caller stops feeding ...
  const after = meter.secPerKm;

  check('the pace does not decay towards a crawl', before === after);
  check('and it is still the pace they were running',
    formatPace(after) === '5:33', formatPace(after));

  check('a reset clears it', (() => { meter.reset(); return meter.secPerKm === null; })());
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
