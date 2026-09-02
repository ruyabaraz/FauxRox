// ============================================================================
// runningTopology.test.ts — five sessions, not one session with five numbers
// ============================================================================
// Nothing selects an archetype yet; that is the next step. These build them
// directly, which is what a pure builder is for - unlike the timed run in B0,
// there is no runtime path here that can only be reached by playing the Lens.
// ============================================================================

import {
  buildArchetypeBlocks,
  generateSession,
  GeneratorInput,
  SessionRequest,
} from '../Assets/Scripts/AdaptiveSessionGenerator';

import {
  StationConfig as Template,
  MotionType,
} from '../Assets/Scripts/SessionTypes';

import {
  RunningArchetype,
  ALL_RUNNING_ARCHETYPES,
  RUNNING_TOPOLOGY,
  archetypeRecoverySeconds,
  legalMetresFor,
  modelRunSeconds,
  tierHoldsArchetype,
  minimumRounds,
  cycleSeconds,
  affordableMetresFor,
  DurationTier,
} from '../Assets/Scripts/RunningArchetype';

import {
  SessionBlock,
  StationMode,
  flattenBlocks,
  hasRun,
  runMetresOf,
  runSecondsOf,
  phaseAt,
  stationCostSeconds,
} from '../Assets/Scripts/SessionTypes';

const TEMPLATE_INPUT: GeneratorInput = {
  templates: [
    { name: 'AIR SKIERG', mode: 4 as any, requirement: 50, instruction: 'x',
      prefabType: 'AIR_SKIERG', run: { kind: 'DISTANCE', metres: 100 } },
    { name: 'HEAVY CARRY', mode: 1 as any, requirement: 200, instruction: 'x',
      prefabType: 'HEAVY_CARRY', run: { kind: 'DISTANCE', metres: 100 } },
  ] as Template[],
  baseRunMetres: 100,
};

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

/** Working budget at target: the tier's target minus the flat warm-up */
const BUDGET: { [K in DurationTier]: number } = {
  SHORT: 630, MEDIUM: 1170, FULL: 1890,
};

const TIERS: DurationTier[] = ['SHORT', 'MEDIUM', 'FULL'];

function build(
  archetype: RunningArchetype,
  tier: DurationTier,
  seed = 0,
  level = 'REGULAR'
): SessionBlock[] {
  const request = {
    space: 'NORMAL', duration: tier, focus: 'RUNNING', level, seed,
  } as SessionRequest;

  return buildArchetypeBlocks(archetype, request, seed, BUDGET[tier]);
}

describe('an easy run is one continuous run that warms itself up', () => {
  const blocks = build('EASY_BASE', 'SHORT');

  check('one block', blocks.length === 1, blocks.length);
  check('with nothing in it but the running', blocks[0].items.length === 0);
  check('asked for on the clock', blocks[0].run.kind === 'TIME');
  check('for the whole fifteen minutes', runSecondsOf(blocks[0].run) === 900,
    runSecondsOf(blocks[0].run));

  // The four and a half minutes of drills are inside this, not in front of
  // it. A short session stops being drills-then-running and becomes a run.
  check('and it is its own warm-up', RUNNING_TOPOLOGY.EASY_BASE.absorbsWarmup);

  check('the label is just the run', blocks[0].label === '15:00 run', blocks[0].label);
});

describe('the run changes character without stopping', () => {
  const run = build('EASY_BASE', 'MEDIUM')[0].run;

  const start = phaseAt(run, 0);
  const middle = phaseAt(run, 400);
  const end = phaseAt(run, 1400);

  check('it opens by settling in', start.label === 'SETTLE IN', start.label);
  check('and tells them how', start.cue.length > 0);
  check('then it is easy', middle.label === 'EASY', middle.label);
  check('and stays that way', end.label === 'EASY');

  // A phase is a reading of the clock. Nothing is spawned, nothing ends, and
  // the plan is not divided - which is the whole reason it is not two runs.
  const blocks = build('EASY_BASE', 'MEDIUM');
  check('all of it is still one run', blocks.length === 1 && blocks[0].rounds === 1);

  const stations = flattenBlocks(blocks);
  check('and one station', stations.length === 1, stations.length);
  check('which is the run', stations[0].mode === StationMode.RUN);
  check('carrying it', runSecondsOf(stations[0].run) === runSecondsOf(run));
  check('and costing what the run costs',
    Math.abs(stationCostSeconds(stations[0]) - runSecondsOf(run)) < 1,
    stationCostSeconds(stations[0]));

  // Too short to have two stretches is one stretch: below about four minutes
  // the settling would be most of the session.
  const tiny = buildArchetypeBlocks(
    'EASY_BASE',
    { space: 'NORMAL', duration: 'SHORT', focus: 'RUNNING', level: 'REGULAR', seed: 0 } as SessionRequest,
    0, 200
  );
  check('a run always has a phase to be in', phaseAt(tiny[0].run, 0) !== null);
});

describe('every interval archetype is a different session', () => {
  // The point of the split. Same tier, same seed, and the four of them differ
  // in distance, in repetitions and in how long the recovery is - which is
  // what stops them being one session with four sets of numbers.
  const shapes = ALL_RUNNING_ARCHETYPES
    .filter((a) => RUNNING_TOPOLOGY[a].shape === 'REPS')
    .map((a) => {
      const b = build(a, 'FULL')[0];
      return {
        archetype: a,
        metres: runMetresOf(b.run),
        rounds: b.rounds,
        recovery: b.items[0].requirement,
      };
    });

  check('all four build', shapes.length === 4, shapes.length);

  const signatures = new Set(shapes.map((s) => s.metres + '/' + s.rounds + '/' + s.recovery));
  check('and no two are the same session', signatures.size === 4,
    shapes.map((s) => s.archetype + ' ' + s.rounds + '×' + s.metres + 'm r' + s.recovery).join(' | '));

  // Threshold's float is what makes it threshold. Speed work's near-full
  // recovery is what keeps every repetition as good as the first. One band
  // for both - which is what ships today - cannot be right for either.
  const threshold = shapes.filter((s) => s.archetype === 'THRESHOLD')[0];
  const speed = shapes.filter((s) => s.archetype === 'SPEED_REPETITION')[0];

  check('threshold rests briefly', threshold.recovery <= 75, threshold.recovery);
  check('speed work rests properly', speed.recovery >= 90, speed.recovery);
  check('and the difference is not cosmetic',
    speed.recovery > threshold.recovery * 2,
    speed.recovery + ' vs ' + threshold.recovery);
});

describe('what is built is what the tier can hold', () => {
  for (const archetype of ALL_RUNNING_ARCHETYPES) {
    for (const tier of TIERS) {
      const blocks = build(archetype, tier);
      const holds = tierHoldsArchetype(archetype, tier, BUDGET[tier]);
      const legal = RUNNING_TOPOLOGY[archetype].shape === 'CONTINUOUS'
        ? true
        : affordableMetresFor(archetype, tier, BUDGET[tier]).length > 0;

      if (!legal) {
        check(archetype + ' has nothing to build at ' + tier, blocks.length === 0);
        continue;
      }

      check(archetype + ' builds at ' + tier, blocks.length > 0);

      // Never below the dose that earns the name. An under-built session
      // carrying the word "threshold" is worse than no session: the athlete
      // would believe they had done one.
      if (RUNNING_TOPOLOGY[archetype].shape === 'REPS') {
        const block = blocks[0];
        const metres = runMetresOf(block.run);
        check('  ' + archetype + ' at ' + tier + ' meets its own minimum',
          block.rounds >= minimumRounds(archetype, metres),
          block.rounds + ' × ' + metres + 'm, wanted ' + minimumRounds(archetype, metres));
      }
    }
  }
});

describe('a session fills the time it was given', () => {
  // Not exactly - repetitions are whole - but close enough that the fitter is
  // adjusting rather than rescuing.
  for (const archetype of ALL_RUNNING_ARCHETYPES) {
    if (RUNNING_TOPOLOGY[archetype].shape !== 'REPS') continue;

    for (const tier of TIERS) {
      if (!tierHoldsArchetype(archetype, tier, BUDGET[tier])) continue;
      if (legalMetresFor(archetype, tier).length === 0) continue;

      const block = build(archetype, tier)[0];
      const work = modelRunSeconds(archetype, runMetresOf(block.run));
      const cycle = work + archetypeRecoverySeconds(archetype, work);
      const total = block.rounds * cycle;

      check(archetype + ' at ' + tier + ' lands near the budget',
        total <= BUDGET[tier] * 1.2 && total >= BUDGET[tier] * 0.6,
        Math.round(total) + 's of ' + BUDGET[tier] + 's  (' +
        block.rounds + ' × ' + runMetresOf(block.run) + 'm)');
    }
  }
});

describe('a break carries what it is, not only how long', () => {
  // Threshold's float is short and moving because that is what stops lactate
  // clearing. Walked, at any level of fitness, it is an ordinary break and
  // the session is no longer a threshold session - so the kind wins over the
  // level here, and the level wins where it is only a matter of how the
  // athlete takes an ordinary recovery.
  const float = build('THRESHOLD', 'FULL', 3, 'BEGINNER')[0].items[0];
  const floatForAnAthlete = build('THRESHOLD', 'FULL', 3, 'ATHLETE')[0].items[0];

  check('a float is a float for a beginner too', float.name === 'FLOAT', float.name);
  check('and for an athlete', floatForAnAthlete.name === 'FLOAT');
  check('and says so', float.recoveryKind === 'FLOAT_JOG');

  // Speed work recovers fully, and how somebody takes a full recovery is a
  // question about them. A beginner walks it; anybody else jogs. What does
  // not change is the length of it or what it was prescribed as - the last
  // repetition still has to be as good as the first.
  const speed = build('SPEED_REPETITION', 'FULL', 3, 'ATHLETE')[0].items[0];
  const speedForABeginner = build('SPEED_REPETITION', 'FULL', 3, 'BEGINNER')[0].items[0];

  check('an athlete jogs the full recovery', speed.name === 'JOG', speed.name);
  check('and a beginner walks it',
    speedForABeginner.name === 'WALK', speedForABeginner.name);
  check('and it is the same recovery either way',
    speed.recoveryKind === 'WALK_OR_JOG' &&
    speedForABeginner.recoveryKind === 'WALK_OR_JOG');
  check('and says why', speed.instruction.toLowerCase().indexOf('as good as') >= 0,
    speed.instruction);

  // An ordinary interval recovery is still the level's to decide.
  const easyBeginner = build('VO2', 'FULL', 3, 'BEGINNER')[0].items[0];
  const easyAthlete = build('VO2', 'FULL', 3, 'ATHLETE')[0].items[0];

  check('a beginner walks an ordinary recovery', easyBeginner.name === 'WALK');
  check('and an athlete jogs it', easyAthlete.name === 'JOG');

  // The kind names it; the archetype sizes it. Two things reaching for the
  // same field is how a level ends up applied twice.
  check('and the archetype still decides how long it is',
    easyBeginner.requirement === easyAthlete.requirement,
    easyBeginner.requirement + ' vs ' + easyAthlete.requirement);

  // Continuous work has nothing to recover between, so it declares nothing.
  check('an easy run has no recovery to describe',
    RUNNING_TOPOLOGY.EASY_BASE.recovery === undefined);
});

describe('the session says how hard it is meant to feel', () => {
  // Found in the preview: a speed session told the athlete "controlled hard,
  // about seven out of ten - every interval the same speed as the first",
  // which is the focus cue. RUNNING covers an easy run and a set of fast
  // repetitions with one line, and that line is the opposite of what speed
  // work is asking for - the whole point of it is that no repetition is run
  // tired.
  //
  // The archetype had the right words all along and nothing read them.
  for (const archetype of ALL_RUNNING_ARCHETYPES) {
    const cue = RUNNING_TOPOLOGY[archetype].effortCue;
    check(archetype + ' has a cue', !!cue && cue.length > 20, cue);
  }

  const cues = ALL_RUNNING_ARCHETYPES.map((a) => RUNNING_TOPOLOGY[a].effortCue);
  check('and no two archetypes say the same thing',
    new Set(cues).size === cues.length);

  // The two furthest apart are the test of whether this matters. One asks for
  // a conversation; the other asks for speed with nothing left over.
  check('an easy run asks for a conversation',
    RUNNING_TOPOLOGY.EASY_BASE.effortCue.toLowerCase().indexOf('conversation') >= 0);

  check('and speed work asks for quality over fatigue',
    RUNNING_TOPOLOGY.SPEED_REPETITION.effortCue.toLowerCase().indexOf('quality') >= 0);

  // The plan the athlete reads carries it, so this is checked where they see
  // it rather than only where it is declared.
  const plan = generateSession(TEMPLATE_INPUT, {
    space: 'NORMAL', duration: 'SHORT', focus: 'RUNNING', level: 'REGULAR', seed: 0,
  } as SessionRequest);

  check('a short running session is an easy run', plan.blocks[0].archetype === 'EASY_BASE',
    plan.blocks[0].archetype);
  check('and its rationale says so, not "controlled hard"',
    plan.rationale.toLowerCase().indexOf('conversation') > 0 &&
    plan.rationale.toLowerCase().indexOf('controlled hard') < 0,
    plan.rationale.split('\n').pop());
});

describe('a session says nothing about pace it cannot stand behind', () => {
  // Every session today, and every session of an athlete who has never run
  // anything. The panel shows no target rather than a greyed-out one, and
  // what it shows instead is the archetype's effort target - which is not a
  // fallback but the prescription a coach gives when they do not know your
  // pace, which is most of the time.
  for (const archetype of ALL_RUNNING_ARCHETYPES) {
    for (const tier of TIERS) {
      const blocks = build(archetype, tier);
      if (blocks.length === 0) continue;

      for (const block of blocks) {
        check(archetype + ' at ' + tier + ' prescribes no pace',
          !block.paceTarget, JSON.stringify(block.paceTarget));
      }
    }
  }

  // And the thing shown in its place exists, at a length that fits a panel.
  for (const archetype of ALL_RUNNING_ARCHETYPES) {
    const short = RUNNING_TOPOLOGY[archetype].effortShort;
    check(archetype + ' has an effort line short enough to read while running',
      !!short && short.length > 8 && short.length <= 52,
      short + '  (' + (short ? short.length : 0) + ')');
  }

  const shorts = ALL_RUNNING_ARCHETYPES.map((a) => RUNNING_TOPOLOGY[a].effortShort);
  check('and no two archetypes show the same line',
    new Set(shorts).size === shorts.length);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
