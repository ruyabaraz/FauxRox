// ============================================================================
// recoveryBouts.test.ts — rest, one bout at a time
// ============================================================================
// The session-level ratio was already locked, and a ratio can hide plenty: a
// block resting twice per round and another resting not at all average out to
// something reasonable. These check the bout the athlete is actually standing
// in, and the safety bounds are read off what the generator produces rather
// than chosen and then forced.
// ============================================================================

import {
  generateSession,
  focusFitsSpace,
  GeneratorInput,
  SessionRequest,
  ALL_SPACES,
  ALL_FOCUSES,
  ALL_DURATIONS,
  ALL_LEVELS,
  Focus,
} from '../Assets/Scripts/AdaptiveSessionGenerator';

import {
  StationConfig,
  StationMode,
  MotionType,
  SessionPlan,
  SessionBlock,
  BlockScheme,
  RECOVERY_POLICY,
  LEVEL_RECOVERY,
  RecoveryProfile,
  recoverySeconds,
  ratioBindingRange,
  stationWorkCostSeconds,
  runCostSeconds,
  runPrescriptionCostSeconds,
  MIN_HOLD_SECONDS,
  distanceRun,
  runMetresOf,
  hasRun,
  timedRun,
} from '../Assets/Scripts/SessionTypes';

import {
  RunningArchetype,
  archetypeRecoverySeconds,
  modelRunSeconds,
} from '../Assets/Scripts/RunningArchetype';

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
  { name: 'AIR SKIERG', mode: StationMode.ZONE_HIT, requirement: 50, instruction: 'x', prefabType: 'AIR_SKIERG', run: distanceRun(10), motionType: MotionType.AIR_SKIERG },
  { name: 'DUMBBELL BEAR CRAWL', mode: StationMode.DISTANCE, requirement: 50, instruction: 'x', prefabType: 'POWER_LANE', run: distanceRun(10) },
  { name: 'GOBLET REVERSE WALK', mode: StationMode.DISTANCE, requirement: 50, instruction: 'x', prefabType: 'CRAB_WALK', run: distanceRun(10) },
  { name: 'BURPEE BROAD JUMP', mode: StationMode.REPS, requirement: 25, instruction: 'x', prefabType: 'BURPEE_BROAD_JUMP', run: distanceRun(10) },
  { name: 'STANDING ROW', mode: StationMode.ZONE_HIT, requirement: 50, instruction: 'x', prefabType: 'POWER_ROW', run: distanceRun(10), motionType: MotionType.BACKWARD_PULL },
  { name: 'HEAVY CARRY', mode: StationMode.DISTANCE, requirement: 200, instruction: 'x', prefabType: 'HEAVY_CARRY', run: distanceRun(10) },
  { name: 'DB WALKING LUNGES', mode: StationMode.DISTANCE, requirement: 100, instruction: 'x', prefabType: 'WALKING_LUNGES', run: distanceRun(10) },
  { name: 'SQUAT TARGET REACH', mode: StationMode.ZONE_HIT, requirement: 75, instruction: 'x', prefabType: 'TARGET_PRESS', run: distanceRun(10), motionType: MotionType.OVERHEAD_REACH },
];

const INPUT: GeneratorInput = { templates: TEMPLATES, baseRunMetres: 10 };
const SEEDS = [0, 7, 42, 97537, 41089, 1234, 555, 60099];

/** Every request the picker can express, at one seed */
/**
 * Every request that has a session in it.
 *
 * Running in a five square metre room does not, and is refused rather than
 * answered with something else - so a sweep that includes it is sweeping over
 * a null.
 */
function everyRequest(seed: number): SessionRequest[] {
  const out: SessionRequest[] = [];
  for (const space of ALL_SPACES) {
    for (const focus of ALL_FOCUSES) {
      if (!focusFitsSpace(focus, space)) continue;

      for (const duration of ALL_DURATIONS) {
        for (const level of ALL_LEVELS) out.push({ space, duration, focus, level, seed });
      }
    }
  }
  return out;
}

/** Seconds of work in one round of a block - the bout its rest is earned by */
function boutSeconds(block: SessionBlock): number {
  // Through the prescription rather than through metres: a run written to the
  // clock has no distance, and reading one off it priced a fifteen minute
  // easy run as a bout of zero seconds.
  let seconds = runPrescriptionCostSeconds(block.run);
  for (const item of block.items) {
    if (item.prefabType === 'RECOVERY') continue;
    seconds += stationWorkCostSeconds(item);
  }
  return seconds;
}

const working = (plan: SessionPlan) =>
  plan.blocks!.filter((b) => b.scheme !== BlockScheme.WARMUP);

// ── The contract, bout by bout ──────────────────────────────────────────────

describe('every rest in a real session obeys the contract it was written to', () => {
  let outOfBounds: string[] = [];
  let checked = 0;

  for (const seed of SEEDS) {
    for (const request of everyRequest(seed)) {
      const policy = RECOVERY_POLICY[request.focus as RecoveryProfile];

      for (const block of working(generateSession(INPUT, request)!)) {
        if (block.restSeconds === 0) continue;      // the round carries its own
        if (!policy) continue;   // running prices its own, per archetype
        if (block.scheme === BlockScheme.EMOM) continue;  // written to the clock

        checked++;

        // The level multiplier moves the bounds with it, and the result is
        // rounded to a whole second at the end
        const floor = policy.floorSeconds * LEVEL_RECOVERY.ATHLETE - 1;
        const ceiling = policy.ceilingSeconds * LEVEL_RECOVERY.BEGINNER + 1;

        if (block.restSeconds < floor || block.restSeconds > ceiling) {
          outOfBounds.push(request.focus + '/' + request.level +
                           ' rest ' + block.restSeconds + 's');
        }
      }
    }
  }

  check('every rest sits inside its profile bounds',
    outOfBounds.length === 0, outOfBounds.slice(0, 4).join(', '));
  check('and there were plenty to check', checked > 400, checked);
});

describe('a lower level never rests less, bout for bout', () => {
  // Checked on the generated sessions rather than on the function alone: the
  // ordering held in recoverySeconds and broke in the sessions three separate
  // times, because something level-dependent had leaked into the fit.
  let violations: string[] = [];

  for (const seed of SEEDS) {
    for (const space of ALL_SPACES) {
      for (const focus of ALL_FOCUSES) {
        if (!focusFitsSpace(focus, space)) continue;

        for (const duration of ALL_DURATIONS) {
          const restOf = (level: 'BEGINNER' | 'REGULAR' | 'ATHLETE') => {
            const blocks = working(generateSession(INPUT,
              { space, duration, focus, level, seed })!);
            return blocks.reduce((t, b) => t + b.restSeconds * b.rounds, 0);
          };

          const b = restOf('BEGINNER'), r = restOf('REGULAR'), a = restOf('ATHLETE');
          if (!(b >= r - 1 && r >= a - 1)) {
            violations.push([space, focus, duration, seed].join('/') +
                            ' = ' + [b, r, a].join(' / '));
          }
        }
      }
    }
  }

  check('ATHLETE <= REGULAR <= BEGINNER across the session',
    violations.length === 0, violations.slice(0, 3).join(', '));
});

describe('a round never recovers twice', () => {
  // An interval is an effort and the easy half that follows it. When a room
  // replaced the run with fast feet the block stopped counting as
  // self-recovering, and every indoor interval got a second rest on top - a
  // beginner stood for ninety seconds after every forty seconds of work.
  let doubled: string[] = [];

  for (const seed of SEEDS) {
    for (const request of everyRequest(seed)) {
      for (const block of working(generateSession(INPUT, request)!)) {
        const carriesWalk = block.items.some((i) => i.prefabType === 'RECOVERY');
        if (carriesWalk && block.restSeconds > 0) {
          doubled.push(request.space + '/' + request.focus +
                       ' walk + ' + block.restSeconds + 's rest');
        }
      }
    }
  }

  check('a block with a recovery walk has no rest on top',
    doubled.length === 0, doubled.slice(0, 3).join(', '));
});

// ── The floor and the ceiling, in real sessions ─────────────────────────────

describe('the floor does not turn short work into a rest session', () => {
  // The floor exists so a four-second bout does not earn a four-second break.
  // Taken too far it does the opposite: a session of short bouts, each with a
  // full rest after it, is somebody standing in a room.
  let worst = { label: '', fraction: 0 };

  for (const seed of SEEDS) {
    for (const request of everyRequest(seed)) {
      const plan = generateSession(INPUT, request)!;

      let work = 0;
      let rest = 0;

      let declared = false;

      for (const block of working(plan)) {
        work += boutSeconds(block) * block.rounds;
        rest += block.restSeconds * block.rounds;
        for (const item of block.items) {
          if (item.prefabType === 'RECOVERY') rest += item.requirement * block.rounds;
        }
        if (block.archetype) declared = true;
      }

      // A session whose recovery is declared by its archetype is checked
      // against that declaration instead, just below. Speed work is four
      // parts recovery to one part running by design - that is what keeps
      // every repetition as good as the first - so a bound written for
      // sessions with roughly even work and rest would fail it for being
      // itself.
      if (declared) continue;

      const fraction = rest / Math.max(1, work + rest);
      if (fraction > worst.fraction) {
        worst = { label: request.space + '/' + request.focus + '/' +
                         request.duration + '/' + request.level, fraction };
      }
    }
  }

  // Measured spread across the whole space is 5-61%; the bound is set wide of
  // it rather than tight against it, so it catches a regression rather than
  // pinning today's numbers in place.
  check('no session is more than two thirds rest',
    worst.fraction < 0.67,
    worst.label + ' is ' + (worst.fraction * 100).toFixed(0) + '% rest');
});

describe('the ceiling stops a long bout buying the session off', () => {
  for (const profile of ['STRENGTH', 'ENGINE', 'MIXED'] as RecoveryProfile[]) {
    const policy = RECOVERY_POLICY[profile];
    const { maxBout } = ratioBindingRange(profile);

    // Ten minutes of work in one bout: nothing the generator makes, but the
    // bound should hold whatever it is handed.
    const absurd = recoverySeconds(600, profile, 'REGULAR', 1);
    check(profile + ': ten minutes of work still earns a bounded rest',
      absurd <= policy.ceilingSeconds, absurd + 's');

    check(profile + ': and that is less than the ratio would have given',
      absurd < 600 * policy.maxRatio);

    check(profile + ': the ceiling binds above the band, not inside it',
      maxBout > 0 && recoverySeconds(maxBout * 0.9, profile, 'REGULAR', 1)
        < policy.ceilingSeconds);
  }
});

describe('a work bout is always worth doing', () => {
  // A rest is only meaningful if there was work before it. The floors on the
  // prescription are what guarantee that: twenty metres, twenty seconds,
  // eight reps.
  let tiny: string[] = [];

  for (const seed of SEEDS) {
    for (const request of everyRequest(seed)) {
      for (const block of working(generateSession(INPUT, request)!)) {
        const bout = boutSeconds(block);
        if (bout < MIN_HOLD_SECONDS) {
          tiny.push(request.focus + '/' + request.duration +
                    ' bout of ' + bout.toFixed(0) + 's');
        }
      }
    }
  }

  check('no round is over before it has begun',
    tiny.length === 0, tiny.slice(0, 3).join(', '));
});

describe('rest fraction stays inside a wide safety band per focus', () => {
  // Read off the measured spread and set wide of it. The point is to catch a
  // regression that turns a workout into a break, not to hold today's numbers
  // still: a rest fraction is an output of the model, and forcing it to a
  // target would mean inflating rest to hit a number.
  const BOUNDS: { [K in Focus]: { min: number, max: number } } = {
    RUNNING:  { min: 0.02, max: 0.70 },
    ENGINE:   { min: 0.10, max: 0.55 },
    STRENGTH: { min: 0.20, max: 0.70 },
    MIXED:    { min: 0.05, max: 0.50 },
  };

  for (const focus of ALL_FOCUSES) {
    let low = 1;
    let high = 0;

    for (const seed of SEEDS) {
      for (const space of ALL_SPACES) {
        if (!focusFitsSpace(focus, space)) continue;

        for (const duration of ALL_DURATIONS) {
          for (const level of ALL_LEVELS) {
            const plan = generateSession(INPUT, { space, duration, focus, level, seed })!;

            let work = 0;
            let rest = 0;
            let hasRounds = false;

            for (const block of working(plan)) {
              work += boutSeconds(block) * block.rounds;
              rest += block.restSeconds * block.rounds;
              for (const item of block.items) {
                if (item.prefabType === 'RECOVERY') rest += item.requirement * block.rounds;
              }
              if (block.items.length > 0) hasRounds = true;
              if (block.archetype) hasRounds = false;
            }

            // A continuous run has nothing to rest between, so it rests for
            // none of its length and that is the session working correctly.
            // The band exists to catch a workout that has turned into a
            // break, which is a claim about sessions that have rounds.
            if (!hasRounds) continue;

            const fraction = rest / Math.max(1, work + rest);
            if (fraction < low) low = fraction;
            if (fraction > high) high = fraction;
          }
        }
      }
    }

    check(focus + ': rest fraction within its safety band',
      low >= BOUNDS[focus].min && high <= BOUNDS[focus].max,
      (low * 100).toFixed(0) + '-' + (high * 100).toFixed(0) + '%');
  }
});

describe('an archetype rests exactly as much as it says it does', () => {
  // The sharper question, and the one worth asking of these sessions. A
  // bound wide enough to admit both a threshold float and a speed session's
  // near-full recovery would be wide enough to admit almost anything; what
  // can be checked is that the recovery the athlete is given is the one the
  // archetype declared.
  let mismatched: string[] = [];
  let checked = 0;

  for (const seed of SEEDS) {
    for (const request of everyRequest(seed)) {
      if (request.focus !== 'RUNNING' || request.space === 'SMALL') continue;

      for (const block of working(generateSession(INPUT, request)!)) {
        if (!block.archetype) continue;

        const recovery = block.items.filter((i) => i.prefabType === 'RECOVERY')[0];
        if (!recovery) continue;

        checked++;
        const archetype = block.archetype as RunningArchetype;
        const work = modelRunSeconds(archetype, runMetresOf(block.run));
        const expected = archetypeRecoverySeconds(archetype, work);

        if (recovery.requirement !== expected) {
          mismatched.push(archetype + ' rests ' + recovery.requirement +
                          's, declared ' + expected + 's');
        }
      }
    }
  }

  check('there were archetype sessions to check', checked > 0, checked);
  check('and every recovery is the declared one',
    mismatched.length === 0, mismatched.slice(0, 3).join(', '));

  // The declarations differ from each other by more than rounding, which is
  // the whole reason for having five of them rather than one band.
  const ratios = ['THRESHOLD', 'VO2', 'SPEED_REPETITION', 'HYROX_PACE'].map(
    (a) => archetypeRecoverySeconds(a as RunningArchetype, 200) / 200);

  check('and no two archetypes recover alike',
    new Set(ratios.map((r) => r.toFixed(2))).size === ratios.length,
    ratios.map((r) => r.toFixed(2)).join(', '));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
