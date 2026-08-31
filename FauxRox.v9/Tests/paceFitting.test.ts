// ============================================================================
// paceFitting.test.ts — a personal pace changes the timing, not the session
// ============================================================================
// What an athlete's own pace is allowed to touch: how long the session is
// estimated to take, and through that how many repetitions fit in the time
// they asked for. What it must not touch: the distances the archetype is run
// at, the recovery between them, and the smallest dose that earns the session
// its name. Those are the archetype, and the archetype is the same workout
// whoever is doing it.
//
// Most of what is below is that second list.
// ============================================================================

import {
  generateSession,
  GeneratorInput,
} from '../Assets/Scripts/AdaptiveSessionGenerator';

import {
  StationConfig,
  StationMode,
  SessionPlan,
  distanceRun,
  runMetresOf,
  runPrescriptionCostSeconds,
  isRestStation,
} from '../Assets/Scripts/SessionTypes';

import {
  anchorFromFiveK,
  paceTargetFor,
  targetPaceSecPerKm,
  PaceTarget,
} from '../Assets/Scripts/PaceTarget';

import {
  RunningArchetype,
  ALL_RUNNING_ARCHETYPES,
  legalMetresFor,
  minimumRounds,
  minimumRoundsAt,
  archetypeRecoverySeconds,
  modelRunSeconds,
  runSecondsAt,
  DurationTier,
} from '../Assets/Scripts/RunningArchetype';

import { DURATION_BANDS } from '../Assets/Scripts/TrainingPrescription';

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
  { name: 'AIR SKIERG', mode: StationMode.ZONE_HIT, requirement: 50, instruction: 'x',
    prefabType: 'AIR_SKIERG', run: distanceRun(100) },
  { name: 'HEAVY CARRY', mode: StationMode.DISTANCE, requirement: 200, instruction: 'x',
    prefabType: 'HEAVY_CARRY', run: distanceRun(100) },
  { name: 'BURPEE BROAD JUMP', mode: StationMode.REPS, requirement: 25, instruction: 'x',
    prefabType: 'BURPEE_BROAD_JUMP', run: distanceRun(100) },
];

const TIERS: DurationTier[] = ['SHORT', 'MEDIUM', 'FULL'];
const LEVELS = ['BEGINNER', 'REGULAR', 'ATHLETE'];

/** Somebody quick, somebody ordinary, and somebody who is nine minutes a kilometre */
const ANCHORS: Array<[string, number]> = [
  ['18:00', 1080], ['22:00', 1320], ['26:00', 1560], ['33:00', 1980], ['45:00', 2700],
];

function planFor(duration: string, level: string, seed: number, fiveK: number): SessionPlan {
  const input: GeneratorInput = { templates: TEMPLATES, baseRunMetres: 400 };
  if (fiveK > 0) input.paceAnchors = [anchorFromFiveK(fiveK)];

  return generateSession(input, {
    space: 'NORMAL', duration: duration as any, focus: 'RUNNING',
    level: level as any, seed: seed,
  });
}

describe('the middle of the band is the pace a session is priced at', () => {
  const target: PaceTarget = {
    source: '5K_ENTRY',
    band: { fastestSecPerKm: 300, slowestSecPerKm: 320 },
  };

  check('a band prices at its middle', targetPaceSecPerKm(target) === 310);
  check('no target, no number', targetPaceSecPerKm(null) === null);
  check('and nothing is invented from an empty one',
    targetPaceSecPerKm({ source: '5K_ENTRY', band: null } as any) === null);

  check('a distance run costs what the band says',
    Math.abs(runPrescriptionCostSeconds(distanceRun(1000), 'THRESHOLD', target) - 310) < 0.5,
    runPrescriptionCostSeconds(distanceRun(1000), 'THRESHOLD', target));

  // A timed run is the one prescription that cannot be wrong about anybody:
  // twelve minutes is twelve minutes at any pace.
  check('a timed run is untouched by any of it',
    runPrescriptionCostSeconds({ kind: 'TIME', seconds: 720 }, 'EASY_BASE', target) === 720);

  check('and with no target it falls back to the model',
    runPrescriptionCostSeconds(distanceRun(1000), 'THRESHOLD') ===
      modelRunSeconds('THRESHOLD', 1000));
});

describe('the dose is the dose, however fast it is run', () => {
  // Six repetitions is six repetitions and twenty-four hundred metres is
  // twenty-four hundred, whoever is running them.
  check('a dose counted in repetitions ignores pace',
    minimumRoundsAt('SPEED_REPETITION', 200, 200) ===
      minimumRounds('SPEED_REPETITION', 200));
  check('and so does one counted in metres',
    minimumRoundsAt('THRESHOLD', 800, 600) === minimumRounds('THRESHOLD', 800));

  // But eight minutes of maximal aerobic work is four six-hundreds for one
  // athlete and three for another, and pricing both at the model's pace gives
  // one of them a session they did not ask for.
  const fast = minimumRoundsAt('VO2', 600, 200);
  const slow = minimumRoundsAt('VO2', 600, 400);
  check('a dose counted in seconds is counted at the athlete\'s pace',
    fast > slow, fast + ' vs ' + slow);
  check('and the dose itself never moves',
    fast * runSecondsAt(600, 200) >= 480 && slow * runSecondsAt(600, 400) >= 480);
});

describe('nobody gets a distance the archetype does not run', () => {
  let checked = 0;
  let stray = '';

  for (const [label, seconds] of ANCHORS) {
    for (const duration of TIERS) {
      for (const level of LEVELS) {
        for (let seed = 0; seed < 12; seed++) {
          const plan = planFor(duration, level, seed, seconds);
          if (!plan || !plan.blocks) continue;

          for (const block of plan.blocks) {
            if (!block.archetype || !block.run || block.run.kind !== 'DISTANCE') continue;

            const legal = legalMetresFor(block.archetype as RunningArchetype, duration);
            checked++;
            if (legal.indexOf(block.run.metres) < 0 && !stray) {
              stray = label + ' ' + duration + '/' + level + '/s' + seed + ': ' +
                      block.archetype + ' at ' + block.run.metres + 'm, allowed ' +
                      legal.join('/');
            }
          }
        }
      }
    }
  }

  check('every repetition distance is one of the archetype\'s own', stray === '', stray);
  check('and there were enough of them to mean something', checked > 100, checked);
});

describe('the recovery belongs to the archetype, not to the runner', () => {
  // A slower runner given proportionally longer walks is not doing the same
  // session at their pace - the ratio, the floor and the ceiling are what
  // make a threshold repetition a threshold repetition.
  let mismatch = '';

  for (const [label, seconds] of ANCHORS) {
    for (const duration of TIERS) {
      for (let seed = 0; seed < 12; seed++) {
        const plan = planFor(duration, 'REGULAR', seed, seconds);
        if (!plan || !plan.blocks) continue;

        for (const block of plan.blocks) {
          if (!block.archetype || !block.run || block.run.kind !== 'DISTANCE') continue;

          const archetype = block.archetype as RunningArchetype;
          const expected = archetypeRecoverySeconds(
            archetype, modelRunSeconds(archetype, block.run.metres));

          for (const item of block.items) {
            if (!isRestStation(item)) continue;
            if (item.requirement !== expected && !mismatch) {
              mismatch = label + ' ' + duration + '/s' + seed + ': ' + archetype +
                         ' rested ' + item.requirement + ', archetype says ' + expected;
            }
          }
        }
      }
    }
  }

  check('recovery is what the archetype says it is, at every pace',
    mismatch === '', mismatch);
});

describe('the promise on the picker survives a personal pace', () => {
  // The whole reason the pace is in the costing at all. Three kilometres at
  // nine minute pace is a thirty-five minute session, and it used to be
  // offered under a twenty-five minute label.
  let worst = '';
  let outside = 0;
  let total = 0;

  for (const [label, seconds] of ANCHORS) {
    for (const duration of TIERS) {
      for (const level of LEVELS) {
        for (let seed = 0; seed < 12; seed++) {
          const plan = planFor(duration, level, seed, seconds);
          if (!plan) continue;

          total++;
          const band = (DURATION_BANDS as any)[duration];
          if (plan.estimatedMinutes < band.minMinutes ||
              plan.estimatedMinutes > band.maxMinutes) {
            outside++;
            if (!worst) {
              worst = label + ' ' + duration + '/' + level + '/s' + seed + ' = ' +
                      plan.estimatedMinutes + ' min, band ' + band.minMinutes +
                      '-' + band.maxMinutes;
            }
          }
        }
      }
    }
  }

  check('every session lands inside the band it was asked for',
    outside === 0, worst + '  (' + outside + '/' + total + ')');
  check('and there were enough of them to mean something', total > 400, total);
});

describe('a faster runner is given more work, not a different session', () => {
  // Same request, same seed, two athletes. Whatever changes between them must
  // be the amount, not the shape.
  let compared = 0;
  let regressions = '';

  for (const duration of TIERS) {
    for (let seed = 0; seed < 30; seed++) {
      const fast = planFor(duration, 'REGULAR', seed, 1080);
      const slow = planFor(duration, 'REGULAR', seed, 2700);
      if (!fast || !slow || !fast.blocks || !slow.blocks) continue;

      const f = fast.blocks[fast.blocks.length - 1];
      const s = slow.blocks[slow.blocks.length - 1];
      if (!f.archetype || f.archetype !== s.archetype) continue;
      if (!f.run || f.run.kind !== 'DISTANCE') continue;
      if (!s.run || s.run.kind !== 'DISTANCE') continue;
      if (f.run.metres !== s.run.metres) continue;

      compared++;
      if (f.rounds < s.rounds && !regressions) {
        regressions = duration + '/s' + seed + ': ' + f.archetype + ' ' +
                      f.rounds + ' reps fast vs ' + s.rounds + ' slow';
      }
    }
  }

  check('at the same distance the quicker athlete never does fewer repetitions',
    regressions === '', regressions);
  check('and the comparison actually happened', compared > 10, compared);
});

describe('an athlete with nothing on file gets exactly what they always did', () => {
  // The fallback has to be the old behaviour to the minute, or every session
  // anybody has ever been given has quietly changed.
  let drift = '';

  for (const duration of TIERS) {
    for (const level of LEVELS) {
      for (let seed = 0; seed < 20; seed++) {
        const plan = planFor(duration, level, seed, 0);
        if (!plan || !plan.blocks) continue;

        for (const block of plan.blocks) {
          if (!block.archetype || !block.run || block.run.kind !== 'DISTANCE') continue;

          const archetype = block.archetype as RunningArchetype;
          const target = paceTargetFor(archetype, undefined);
          if (targetPaceSecPerKm(target) !== null && !drift) {
            drift = archetype + ' has a band with no evidence behind it';
          }

          const cost = runPrescriptionCostSeconds(block.run, archetype, block.paceTarget);
          if (Math.abs(cost - modelRunSeconds(archetype, block.run.metres)) > 0.001 && !drift) {
            drift = duration + '/' + level + '/s' + seed + ': ' + archetype +
                    ' priced at ' + cost + ', model says ' +
                    modelRunSeconds(archetype, block.run.metres);
          }
        }
      }
    }
  }

  check('with no anchor every run is still priced by the model', drift === '', drift);
});

describe('HYROX pace waits for evidence of its own', () => {
  // A 5K says nothing about the pace somebody holds between eight strength
  // stations, so the one archetype it must not answer for is the race one.
  const anchor = anchorFromFiveK(1500);

  for (const archetype of ALL_RUNNING_ARCHETYPES) {
    const target = paceTargetFor(archetype, anchor);
    if (archetype === 'HYROX_PACE') {
      check('a 5K produces no HYROX target', target === null);
    } else {
      check(archetype + ' gets a band from a 5K', target !== null);
    }
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
