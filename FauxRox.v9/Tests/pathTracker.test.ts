// ============================================================================
// pathTracker.test.ts — the tracker is not a witness, it is a sensor
// ============================================================================
// Distance is the sum of how far the camera moved between frames, and that is
// what lets a carry shuttled across a room count as the full carry. It also
// believes everything head tracking says, including the things it gets wrong -
// and all three of them inflate the number in the athlete's favour, which is
// the direction that matters. A carry that finishes itself while somebody
// stands still is not a carry.
// ============================================================================

import {
  PathTracker,
  MOVEMENT_THRESHOLD_CM,
  MAX_PLAUSIBLE_SPEED_MS,
} from '../Assets/Scripts/PathTracker';

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

const FRAME = 1 / 60;

/** A deterministic wobble, so the test says the same thing every run */
function noise(i: number, amplitudeCm: number): number {
  return Math.sin(i * 1.7) * amplitudeCm;
}

/** Walk in a straight line at a given speed for a number of seconds */
function walk(tracker: PathTracker, speedMs: number, seconds: number, fromCm = 0): number {
  const frames = Math.round(seconds / FRAME);
  const stepCm = speedMs * 100 * FRAME;

  for (let i = 1; i <= frames; i++) {
    tracker.update({ x: 0, z: fromCm + i * stepCm, dt: FRAME, valid: true });
  }
  return frames;
}

// ── Standing still ──────────────────────────────────────────────────────────

describe('a head that is never still does not walk across the room', () => {
  const tracker = new PathTracker();

  // Ten seconds of a person standing, breathing, looking around a little
  for (let i = 0; i < 600; i++) {
    tracker.update({ x: noise(i, 2), z: noise(i * 0.7, 2), dt: FRAME, valid: true });
  }

  check('two centimetres of wobble adds nothing',
    tracker.metres === 0, tracker.metres.toFixed(2) + 'm');

  // Even generous noise, just under the threshold
  const bigger = new PathTracker();
  for (let i = 0; i < 600; i++) {
    bigger.update({
      x: noise(i, MOVEMENT_THRESHOLD_CM * 0.45),
      z: noise(i * 0.7, MOVEMENT_THRESHOLD_CM * 0.45),
      dt: FRAME, valid: true,
    });
  }
  check('and neither does noise right up against the threshold',
    bigger.metres === 0, bigger.metres.toFixed(2) + 'm');
});

// ── Walking ─────────────────────────────────────────────────────────────────

describe('walking is credited, however slowly it is done', () => {
  // The reason the threshold is on displacement rather than on the frame: a
  // slow loaded walk moves about a centimetre a frame, which is the size of
  // the noise. A per-frame dead zone big enough to reject one rejects the
  // other, and the athlete carrying something heavy gets nothing.
  for (const speed of [0.4, 0.8, 1.4, 2.5]) {
    const tracker = new PathTracker();
    walk(tracker, speed, 10);

    const expected = speed * 10;
    const lost = expected - tracker.metres;

    check('at ' + speed + ' m/s, ten seconds is credited',
      lost >= 0 && lost < 0.2,
      tracker.metres.toFixed(2) + 'm of ' + expected.toFixed(2) + 'm');
  }
});

describe('walking and wobbling at the same time', () => {
  const tracker = new PathTracker();
  const stepCm = 0.8 * 100 * FRAME;

  for (let i = 1; i <= 600; i++) {
    tracker.update({
      x: noise(i, 2),
      z: i * stepCm + noise(i * 1.3, 2),
      dt: FRAME, valid: true,
    });
  }

  // Noise on top of movement is credited along with it, which is correct:
  // the head really did move. What matters is that it does not accumulate
  // into metres of its own.
  check('ten seconds of walking is still about eight metres',
    tracker.metres > 7.5 && tracker.metres < 9.5,
    tracker.metres.toFixed(2) + 'm');
});

// ── Shuttles ────────────────────────────────────────────────────────────────

describe('turning round does not undo the distance', () => {
  // The whole reason a room can hold a hundred-metre carry.
  const tracker = new PathTracker();
  const stepCm = 1.0 * 100 * FRAME;

  // Five metres out and five metres back, four times
  for (let lap = 0; lap < 4; lap++) {
    for (let i = 1; i <= Math.round(500 / stepCm); i++) {
      tracker.update({ x: 0, z: i * stepCm, dt: FRAME, valid: true });
    }
    for (let i = Math.round(500 / stepCm); i >= 0; i--) {
      tracker.update({ x: 0, z: i * stepCm, dt: FRAME, valid: true });
    }
  }

  check('forty metres of shuttling is forty metres',
    tracker.metres > 38 && tracker.metres < 41,
    tracker.metres.toFixed(1) + 'm');
});

// ── Tracking loss ───────────────────────────────────────────────────────────

describe('a gap in the record is not distance covered', () => {
  const tracker = new PathTracker();

  // Walk two metres
  walk(tracker, 1.0, 2);
  const before = tracker.metres;
  check('two metres before the dropout', before > 1.8 && before < 2.2, before.toFixed(2));

  // Tracking lost for a second while the athlete is carried across the room
  for (let i = 0; i < 60; i++) {
    tracker.update({ x: 0, z: 0, dt: FRAME, valid: false });
  }

  check('nothing is credited while tracking is lost',
    tracker.metres === before, tracker.metres.toFixed(2));

  // Reacquired thirty metres away
  tracker.update({ x: 3000, z: 3000, dt: FRAME, valid: true });
  check('and the jump back is not credited either',
    tracker.metres === before, tracker.metres.toFixed(2));

  // Walking continues normally from the new position
  const frames = 120;
  const stepCm = 1.0 * 100 * FRAME;
  for (let i = 1; i <= frames; i++) {
    tracker.update({ x: 3000, z: 3000 + i * stepCm, dt: FRAME, valid: true });
  }
  check('and walking counts again afterwards',
    tracker.metres > before + 1.8 && tracker.metres < before + 2.2,
    (tracker.metres - before).toFixed(2) + 'm since');
});

describe('a relocalisation is not a sprint', () => {
  const tracker = new PathTracker();
  walk(tracker, 1.0, 1);
  const before = tracker.metres;

  // The origin moves four metres in one frame
  tracker.update({ x: 0, z: 40000, dt: FRAME, valid: true });

  check('a four-metre frame is rejected',
    tracker.metres === before, tracker.metres.toFixed(2));
  check('and counted as rejected rather than silently dropped',
    tracker.rejectedSamples === 1, tracker.rejectedSamples);

  // The athlete is now there; walking from the new place is fine
  const stepCm = 1.0 * 100 * FRAME;
  for (let i = 1; i <= 60; i++) {
    tracker.update({ x: 0, z: 40000 + i * stepCm, dt: FRAME, valid: true });
  }
  check('and the tracker carries on from where it now is',
    tracker.metres > before + 0.8, (tracker.metres - before).toFixed(2) + 'm since');

  // The bound is a speed, not a distance: a long frame allows a long step
  const slow = new PathTracker();
  slow.update({ x: 0, z: 0, dt: 1, valid: true });
  slow.update({ x: 0, z: MAX_PLAUSIBLE_SPEED_MS * 100 * 0.5, dt: 1, valid: true });
  check('a slow frame rate does not make a normal step implausible',
    slow.metres > 0, slow.metres.toFixed(2));
});

// ── Housekeeping ────────────────────────────────────────────────────────────

describe('a station starts from nothing', () => {
  const tracker = new PathTracker();
  walk(tracker, 1.0, 5);
  check('five metres accumulated', tracker.metres > 4, tracker.metres.toFixed(1));

  tracker.reset();
  check('reset clears it', tracker.metres === 0);

  // And the first sample after a reset anchors rather than crediting
  tracker.update({ x: 9999, z: 9999, dt: FRAME, valid: true });
  check('the first sample anchors rather than counting',
    tracker.metres === 0, tracker.metres.toFixed(2));

  // A reset during a dropout does not anchor to a position nobody was at
  const lost = new PathTracker();
  lost.update({ x: 0, z: 0, dt: FRAME, valid: false });
  lost.update({ x: 500, z: 500, dt: FRAME, valid: true });
  check('and an invalid first sample anchors nothing',
    lost.metres === 0, lost.metres.toFixed(2));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
