// ============================================================================
// blockLifecycle.test.ts — a block exists before its first instruction runs
// ============================================================================
// Two failures, one cause. From the log:
//
//   RUN 6m to GOBLET REVERSE WALK
//   Run complete! 6.1m / 6m
//   Shout: "The warm-up is done. The working set starts now:
//           3 x 6m run + GOBLET REVERSE WALK + PLANK HOLD"
//
// The athlete was told the working set begins - and told it includes a 6m run
// - immediately after finishing that run. The block was announced on entering
// a station, and a block's first item is often not a station.
//
// And in the next session it was worse:
//
//   Entered: BURPEE BROAD JUMP
//   BURPEE BROAD JUMP COMPLETE - 4.0s
//   Shout: "The warm-up is done. The working set starts now: ..."
//
// One whole station late, because the editor preview rebuilt hand-tracked
// stations field by field and quietly dropped blockIndex on the way.
// ============================================================================

import {
  StationConfig,
  StationMode,
  MotionType,
  BlockScheme,
  SessionBlock,
  flattenBlocks,
  makeRestStation,
  simplifyForPreview,
  shortenRunForPreview,
  needsHandTracking,
  isWarmupStation,
  isRestStation,
  distanceRun,
  runMetresOf,
  hasRun,
  timedRun,
} from '../Assets/Scripts/SessionTypes';

import {
  generateSession,
  GeneratorInput,
  SessionRequest,
} from '../Assets/Scripts/AdaptiveSessionGenerator';

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

const TEMPLATES: StationConfig[] = [
  { name: 'AIR SKIERG', mode: StationMode.ZONE_HIT, requirement: 50, instruction: 'x', prefabType: 'AIR_SKIERG', run: distanceRun(100), motionType: MotionType.AIR_SKIERG },
  { name: 'DUMBBELL BEAR CRAWL', mode: StationMode.DISTANCE, requirement: 50, instruction: 'x', prefabType: 'POWER_LANE', run: distanceRun(100) },
  { name: 'GOBLET REVERSE WALK', mode: StationMode.DISTANCE, requirement: 50, instruction: 'x', prefabType: 'CRAB_WALK', run: distanceRun(100) },
  { name: 'BURPEE BROAD JUMP', mode: StationMode.REPS, requirement: 25, instruction: 'x', prefabType: 'BURPEE_BROAD_JUMP', run: distanceRun(100), dropCm: 10 },
  { name: 'STANDING ROW', mode: StationMode.ZONE_HIT, requirement: 50, instruction: 'x', prefabType: 'POWER_ROW', run: distanceRun(100), motionType: MotionType.BACKWARD_PULL },
  { name: 'HEAVY CARRY', mode: StationMode.DISTANCE, requirement: 200, instruction: 'x', prefabType: 'HEAVY_CARRY', run: distanceRun(100) },
  { name: 'DB WALKING LUNGES', mode: StationMode.DISTANCE, requirement: 100, instruction: 'x', prefabType: 'WALKING_LUNGES', run: distanceRun(100) },
  { name: 'SQUAT TARGET REACH', mode: StationMode.ZONE_HIT, requirement: 75, instruction: 'x', prefabType: 'TARGET_PRESS', run: distanceRun(100), motionType: MotionType.OVERHEAD_REACH },
];

const INPUT: GeneratorInput = { templates: TEMPLATES, baseRunMetres: 400 };

const FOCUSES: SessionRequest['focus'][] = ['RUNNING', 'ENGINE', 'STRENGTH', 'MIXED'];
const DURATIONS: SessionRequest['duration'][] = ['SHORT', 'MEDIUM', 'FULL'];

// ── Every station knows its block ───────────────────────────────────────────

describe('nothing in a flattened plan is outside a block', () => {
  let checked = 0;
  let orphans: string[] = [];

  for (const focus of FOCUSES) {
    for (const duration of DURATIONS) {
      for (const seed of [0, 5, 41089]) {
        const plan = generateSession(INPUT,
          { space: 'NORMAL', duration, focus, level: 'REGULAR', seed })!;

        for (const station of plan.stations) {
          if (station.prefabType === 'START' || station.prefabType === 'FINISH') continue;
          checked++;
          if (station.blockIndex === undefined) orphans.push(focus + '/' + station.name);
        }
      }
    }
  }

  check('every working station carries a block index',
    orphans.length === 0, orphans.slice(0, 5).join(', '));
  check('and there were plenty to check', checked > 500, checked);
});

describe('rest belongs to the block it rests inside', () => {
  const rest = makeRestStation(60);
  rest.blockIndex = 2;
  rest.blockLabel = 'Ladder';
  rest.blockScheme = BlockScheme.LADDER;

  check('rest carries a block index', rest.blockIndex === 2);
  // Otherwise entering a rest period would read as leaving the block, and the
  // next round would announce itself all over again.
  check('and a label', rest.blockLabel === 'Ladder');
});

// ── A block can open with a run ─────────────────────────────────────────────

describe('the first item of a block is often not a station', () => {
  const block: SessionBlock = {
    label: '3 x 240m run + HEAVY CARRY',
    scheme: BlockScheme.STRAIGHT,
    rounds: 3,
    run: distanceRun(240),
    items: [TEMPLATES[5]],
    restSeconds: 60,
    roundScales: [1, 1, 1],
  };

  const flat = flattenBlocks([block]);
  const first = flat[0];

  check('the block opens with something that carries a run',
    runMetresOf(first.run) > 0, runMetresOf(first.run));

  // The announcement is attached to the item, and the item is reached before
  // its run is served - so announcing at the item is announcing before the
  // run, which is the whole point.
  check('and that item already knows its block', first.blockIndex === 0);
  check('and its label', first.blockLabel === block.label);
  check('and its scheme', first.blockScheme === BlockScheme.STRAIGHT);

  // The label names a run the athlete has not done yet
  check('the label describes what is coming, not what happened',
    first.blockLabel.indexOf('240m run') >= 0, first.blockLabel);
});

// ── Preview must not strip the plan ─────────────────────────────────────────

describe('the editor preview changes how a station ends, nothing else', () => {
  const original: StationConfig = {
    name: 'BURPEE BROAD JUMP',
    mode: StationMode.REPS,
    requirement: 25,
    instruction: 'Chest to floor, then jump forward',
    prefabType: 'BURPEE_BROAD_JUMP',
    run: distanceRun(400),
    motionType: MotionType.AIR_SKIERG,
    dropCm: 10,
    blockIndex: 1,
    blockLabel: '5 x 4m run + BURPEE BROAD JUMP + BURPEE OVER DUMBBELL',
    blockScheme: BlockScheme.STRAIGHT,
    roundIndex: 2,
    roundCount: 5,
  };

  const preview = simplifyForPreview(original, 4);

  check('it completes on a timer now', preview.mode === StationMode.TIMED);
  check('after the preview duration', preview.requirement === 4);

  // The reported bug: this field went missing, so the block never announced
  // itself when its first movement was hand-tracked.
  check('the block index survives', preview.blockIndex === 1, preview.blockIndex);
  check('the block label survives', preview.blockLabel === original.blockLabel);
  check('the block scheme survives', preview.blockScheme === BlockScheme.STRAIGHT);
  check('the round index survives', preview.roundIndex === 2);
  check('the round count survives', preview.roundCount === 5);

  // The same class of bug bit dropCm once before, in applyLevel
  check('the burpee drop height survives', preview.dropCm === 10);
  check('the run before it survives', runMetresOf(preview.run) === 400);
  check('the motion type survives', preview.motionType === original.motionType);
  check('the instruction survives', preview.instruction === original.instruction);

  // Stated structurally rather than field by field, so a field added
  // tomorrow is covered by this test without anyone editing it
  const lost = Object.keys(original).filter(
    (k) => k !== 'mode' && k !== 'requirement' &&
           (preview as any)[k] !== (original as any)[k]
  );
  check('no field at all is lost or altered', lost.length === 0, lost.join(', '));

  check('and the original is untouched', original.mode === StationMode.REPS);
});

describe('only hand-tracked stations are simplified', () => {
  check('rep counting needs hands',
    needsHandTracking({ ...TEMPLATES[3] }) === true);
  check('hand-zone counting needs hands',
    needsHandTracking({ ...TEMPLATES[0] }) === true);
  check('camera rep counting needs hands',
    needsHandTracking({ ...TEMPLATES[3], mode: StationMode.VERTICAL_REPS }) === true);
  check('so does the lateral variant',
    needsHandTracking({ ...TEMPLATES[3], mode: StationMode.LATERAL_REPS }) === true);

  // These already complete by walking or waiting
  check('walking does not', needsHandTracking({ ...TEMPLATES[1] }) === false);
  check('a hold does not',
    needsHandTracking({ ...TEMPLATES[1], mode: StationMode.TIMED }) === false);
  check('a run does not',
    needsHandTracking({ ...TEMPLATES[1], mode: StationMode.RUN }) === false);
});

// ── Blocks stay in order ────────────────────────────────────────────────────

describe('block indices are contiguous and increasing', () => {
  for (const focus of FOCUSES) {
    const plan = generateSession(INPUT,
      { space: 'NORMAL', duration: 'FULL', focus, level: 'REGULAR', seed: 7 })!;

    let previous = -1;
    let ordered = true;
    const seen: number[] = [];

    for (const station of plan.stations) {
      if (station.blockIndex === undefined) continue;
      if (station.blockIndex < previous) ordered = false;
      if (seen.indexOf(station.blockIndex) < 0) seen.push(station.blockIndex);
      previous = station.blockIndex;
    }

    check(focus + ': blocks never go backwards', ordered, seen.join(', '));
    check(focus + ': every block index from 0 upwards is used',
      seen.length > 0 && seen[0] === 0 && seen[seen.length - 1] === seen.length - 1,
      seen.join(', '));

    // The announcement fires once per block, so a block seen twice in two
    // separate stretches would announce itself twice
    check(focus + ': a block is one contiguous stretch',
      seen.length === plan.blocks.length, seen.length + ' vs ' + plan.blocks.length);
  }
});

// ── Warm-up shortening ──────────────────────────────────────────────────────

describe('a warm-up drill is recognisable however it arrives', () => {
  check('by its block scheme',
    isWarmupStation({ ...TEMPLATES[1], blockScheme: BlockScheme.WARMUP }) === true);
  check('by its prefab',
    isWarmupStation({ ...TEMPLATES[1], prefabType: 'WARMUP_A_SKIPS' }) === true);
  check('a working station is not one',
    isWarmupStation({ ...TEMPLATES[1], blockScheme: BlockScheme.LADDER }) === false);

  // The rest between rounds is not warm-up, and shortening it in preview
  // would change the one thing the analysis does read off the clock
  check('rest is not a warm-up drill',
    isWarmupStation(makeRestStation(60)) === false);

  // Every generated session's warm-up must be findable, or the preview
  // shortening silently does nothing
  for (const focus of FOCUSES) {
    const plan = generateSession(INPUT,
      { space: 'NORMAL', duration: 'MEDIUM', focus, level: 'REGULAR', seed: 3 })!;
    const warmups = plan.stations.filter(isWarmupStation);
    check(focus + ': the warm-up is findable', warmups.length >= 3, warmups.length);
  }
});

describe('shortening a warm-up drill for preview keeps the plan intact', () => {
  const drill: StationConfig = {
    name: 'ALTERNATING LATERAL LUNGE',
    mode: StationMode.TIMED,
    requirement: 40,
    instruction: 'Step wide, sit into the hip',
    prefabType: 'WARMUP_LATERAL_LUNGE',
    blockIndex: 0,
    blockLabel: "Warm-up · A SKIPS + ALTERNATING LATERAL LUNGE",
    blockScheme: BlockScheme.WARMUP,
    roundIndex: 1,
    roundCount: 1,
  };

  const short = simplifyForPreview(drill, 6);

  check('it takes six seconds now', short.requirement === 6);
  check('it is still timed', short.mode === StationMode.TIMED);
  check('it is still a warm-up drill', isWarmupStation(short) === true);
  check('and still knows its block', short.blockIndex === 0);
  check('so the warm-up still announces itself',
    short.blockScheme === BlockScheme.WARMUP && short.blockLabel === drill.blockLabel);
  check('the original is untouched', drill.requirement === 40);
});

describe('preview shortens the run without rewriting the session', () => {
  const interval: StationConfig = {
    name: 'GOBLET REVERSE WALK',
    mode: StationMode.DISTANCE,
    requirement: 40,
    instruction: 'Hold at the chest, walk backwards',
    prefabType: 'CRAB_WALK',
    run: distanceRun(400),
    blockIndex: 2,
    blockLabel: '5 x 400m run + GOBLET REVERSE WALK',
    blockScheme: BlockScheme.STRAIGHT,
    roundIndex: 3,
    roundCount: 5,
    legMetres: 20,
  };

  const preview = shortenRunForPreview(interval, 6, 8);

  check('the run is doable at a desk', runMetresOf(preview.run) === 6);
  check('the station itself is untouched', preview.requirement === 40);
  check('and still knows its block', preview.blockIndex === 2);
  check('and its round', preview.roundIndex === 3 && preview.roundCount === 5);
  check('and its own leg cap', preview.legMetres === 20);
  check('the original is unchanged', runMetresOf(interval.run) === 400);

  // Same structural guarantee as every other transform here
  const lost = Object.keys(interval).filter(
    (k) => k !== 'run' && (preview as any)[k] !== (interval as any)[k]
  );
  check('nothing else is lost or altered', lost.length === 0, lost.join(', '));
});

describe('preview shortens the waiting, not the meaning', () => {
  // An engine session's breaks are real - rest is prescribed against the work
  // it follows - so previewing one meant eight minutes of standing still
  // around two minutes of work that had itself been cut to four seconds a
  // station.
  check('a between-rounds rest is a break', isRestStation(makeRestStation(60)) === true);
  check('so is an interval recovery walk',
    isRestStation({ ...TEMPLATES[1], prefabType: 'RECOVERY' }) === true);
  check('a working movement is not', isRestStation(TEMPLATES[1]) === false);
  check('nor is a warm-up drill',
    isRestStation({ ...TEMPLATES[1], prefabType: 'WARMUP_A_SKIPS' }) === false);

  // Shortening it is safe precisely because the analysis never reads it: rest
  // is excluded from every performance statement by construction.
  const rest = makeRestStation(38);
  rest.blockIndex = 2;
  rest.blockLabel = 'Ladder · HEAVY CARRY';
  rest.roundIndex = 3;

  const short = simplifyForPreview(rest, 5);
  check('the wait gets shorter', short.requirement === 5);
  check('and it is still a rest', isRestStation(short) === true);
  check('still inside its block', short.blockIndex === 2 && short.roundIndex === 3);
  check('the original is untouched', rest.requirement === 38);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
