// ============================================================================
// engineVariety.test.ts — an engine session is not the same session every time
// ============================================================================
// buildEngineBlocks indexes its pool by block number: modalities[b * 2 + m].
// Read on its own that line looks seed-blind, and it was reported as a bug on
// exactly that reading - mine. It is not one. The array it indexes arrives
// from rankPool already ordered by score with a seeded tiebreak, so the seed
// enters one call earlier, in the ordering rather than in the index.
//
// The reading was wrong and the conclusion was too, which is the argument for
// this file: whether the sessions actually differ is a measurable property of
// the generator, and it should be measured rather than inferred from a line.
// ============================================================================

import {
  generateSession,
  GeneratorInput,
  SessionRequest,
  ALL_DURATIONS,
} from '../Assets/Scripts/AdaptiveSessionGenerator';

import {
  StationConfig,
  StationMode,
  MotionType,
  BlockScheme,
  ACCESSORY_STATIONS,
  distanceRun,
  runMetresOf,
  hasRun,
  timedRun,
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

const TEMPLATES: StationConfig[] = [
  { name: 'AIR SKIERG', mode: StationMode.ZONE_HIT, requirement: 50, instruction: 'Reach UP and PULL DOWN', prefabType: 'AIR_SKIERG', run: distanceRun(100), motionType: MotionType.AIR_SKIERG },
  { name: 'DUMBBELL BEAR CRAWL', mode: StationMode.DISTANCE, requirement: 50, instruction: 'Push through the lane!', prefabType: 'POWER_LANE', run: distanceRun(100) },
  { name: 'GOBLET REVERSE WALK', mode: StationMode.DISTANCE, requirement: 50, instruction: 'Walk backward', prefabType: 'CRAB_WALK', run: distanceRun(100) },
  { name: 'BURPEE BROAD JUMP', mode: StationMode.REPS, requirement: 25, instruction: 'Drop DOWN, JUMP forward!', prefabType: 'BURPEE_BROAD_JUMP', run: distanceRun(100) },
  { name: 'STANDING ROW', mode: StationMode.ZONE_HIT, requirement: 50, instruction: 'PULL BACK', prefabType: 'POWER_ROW', run: distanceRun(100), motionType: MotionType.BACKWARD_PULL },
  { name: 'HEAVY CARRY', mode: StationMode.DISTANCE, requirement: 200, instruction: 'Carry through the lane!', prefabType: 'HEAVY_CARRY', run: distanceRun(100) },
  { name: 'DB WALKING LUNGES', mode: StationMode.DISTANCE, requirement: 100, instruction: 'Walking Lunges', prefabType: 'WALKING_LUNGES', run: distanceRun(100) },
  { name: 'SQUAT TARGET REACH', mode: StationMode.ZONE_HIT, requirement: 75, instruction: 'Squat then reach UP', prefabType: 'TARGET_PRESS', run: distanceRun(100), motionType: MotionType.OVERHEAD_REACH },
];

const INPUT: GeneratorInput = { templates: TEMPLATES, baseRunMetres: 100 };
const SEEDS = 40;

const accessoryTypes: { [prefabType: string]: boolean } = {};
for (const a of ACCESSORY_STATIONS) accessoryTypes[a.prefabType] = true;

interface Sample {
  sequence: string;
  types: string[];
  blocks: string[][];
  races: number;
  accessories: number;
}

function sample(seed: number, duration: string): Sample | null {
  const request = {
    space: 'NORMAL', duration, focus: 'ENGINE', level: 'REGULAR', seed,
  } as SessionRequest;

  const plan = generateSession(INPUT, request);
  if (!plan) return null;

  const types: string[] = [];
  const blocks: string[][] = [];
  let races = 0;
  let accessories = 0;

  for (const block of plan.blocks) {
    if (block.scheme === BlockScheme.WARMUP) continue;

    const work = block.items
      .filter((i) => i.prefabType !== 'REST' && i.prefabType !== 'RECOVERY')
      .map((i) => i.prefabType);

    if (work.length === 0) continue;
    blocks.push(work);

    for (const t of work) {
      types.push(t);
      if (accessoryTypes[t]) accessories++; else races++;
    }
  }

  return { sequence: duration + ':' + types.join('+'), types, blocks, races, accessories };
}

const samples: Sample[] = [];
for (let seed = 0; seed < SEEDS; seed++) {
  for (const duration of ALL_DURATIONS) {
    const s = sample(seed, duration);
    if (s) samples.push(s);
  }
}

describe('the seed reaches the movements, through the ordering', () => {
  check('there are sessions to look at', samples.length >= 100, samples.length);

  const sequences: { [k: string]: boolean } = {};
  for (const s of samples) sequences[s.sequence] = true;
  const distinct = Object.keys(sequences).length;

  // Measured at 101 of 120. Well below that would mean the seed had stopped
  // reaching the pool order, which is the failure the reading suspected.
  check('most seeds produce a different session',
    distinct >= samples.length * 0.6, distinct + ' distinct of ' + samples.length);

  const movements: { [k: string]: boolean } = {};
  for (const s of samples) for (const t of s.types) movements[t] = true;
  check('and the pool is not narrowed to a handful',
    Object.keys(movements).length >= 8, Object.keys(movements).length + ' movements');
});

describe('and what it draws is a legal engine session', () => {
  let repeatedInSession = 0;
  let repeatedInBlock = 0;
  let noAccessory = 0;
  let noRace = 0;

  for (const s of samples) {
    const uniq: { [k: string]: boolean } = {};
    for (const t of s.types) uniq[t] = true;
    if (Object.keys(uniq).length !== s.types.length) repeatedInSession++;

    for (const b of s.blocks) {
      const seen: { [k: string]: boolean } = {};
      for (const t of b) seen[t] = true;
      if (Object.keys(seen).length !== b.length) repeatedInBlock++;
    }

    if (s.accessories === 0) noAccessory++;
    if (s.races === 0) noRace++;
  }

  check('a movement is never asked for twice in one session',
    repeatedInSession === 0, repeatedInSession + ' sessions repeat');

  check('nor twice inside one block',
    repeatedInBlock === 0, repeatedInBlock + ' blocks repeat');

  // An engine session built only from race stations is a race rehearsal, and
  // one built only from accessories has dropped the sport it is training for.
  // Both held across every sample; asserting it keeps the rotation honest if
  // the pools are ever re-filtered.
  check('every session mixes race work with accessories',
    noAccessory === 0 && noRace === 0,
    noAccessory + ' without an accessory, ' + noRace + ' without a race station');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
