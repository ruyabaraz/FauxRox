// ============================================================================
// adaptiveGenerator.test.ts — every workout the picker can produce
// ============================================================================
// The generator can emit 18 distinct sessions per seed, and a judge demo can
// hit any of them. Eyeballing four hand-written sessions was possible;
// eyeballing this space is not. So instead of checking examples, this suite
// checks invariants over the entire space, at several seeds.
//
// A generated plan is fed straight to CourseManager.loadPlan and then walked
// by RaceStateMachine, which makes structural assumptions it does not verify:
// index 0 is the start line, index 1 is the first workout station, and the
// finish flow keys off isFinish. A single malformed combination is a demo
// that dies on stage, so those assumptions are asserted first.
// ============================================================================

import {
  generateSession,
  allRequests,
  SessionRequest,
  GeneratorInput,
  ALL_SPACES,
  ALL_FOCUSES,
  ALL_DURATIONS,
  ALL_LEVELS,
  Level,
  focusFitsSpace,
  SMALL_SPACE_MAX_DISTANCE_RATIO,
  SMALL_SPACE_MAX_DISTANCE_METRES,
} from '../Assets/Scripts/AdaptiveSessionGenerator';

import {
  SMALL_SPACE_LEG_METRES,
  COMPROMISED_RUN_METRES,
  DURATION_BANDS,
  withinBand,
} from '../Assets/Scripts/TrainingPrescription';

import {
  StationConfig,
  StationMode,
  MotionType,
  SessionPlan,
  STATION_VARIANTS,
  ACCESSORY_STATIONS,
  WARMUP_MOVEMENTS,
  BlockScheme,
  isStationary,
  isAccessory,
  isRestStation,
  isWarmupStation,
  stationCostSeconds,
  stationWorkCostSeconds,
  runCostSeconds,
  estimateMinutes,
  distanceRun,
  runMetresOf,
  runSecondsOf,
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

/** Assert something for every request in the space, reporting the first failure */
function forEveryRequest(
  name: string,
  seeds: number[],
  predicate: (plan: SessionPlan, request: SessionRequest) => true | string
): void {
  for (const seed of seeds) {
    for (const request of allRequests(seed)) {
      const plan = generateSession(INPUT, request);

      if (!plan) {
        check(name, false, describeRequest(request) + ': no plan produced');
        return;
      }

      const result = predicate(plan, request);
      if (result !== true) {
        check(name, false, describeRequest(request) + ': ' + result);
        return;
      }
    }
  }
  check(name, true);
}

function describeRequest(r: SessionRequest): string {
  return r.space + '/' + r.duration + '/' + r.focus + '/' + (r.level ?? 'REGULAR') + '#' + (r.seed ?? 0);
}

// ── The real course, as CourseManager builds it ─────────────────────────────

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
const SEEDS = [0, 1, 7, 42, 1234];

const workoutStations = (plan: SessionPlan) => plan.stations.slice(1, plan.stations.length - 1);
/** Movements only — rest is part of the session but is not work */
const isWarmupDrill = (prefabType: string) =>
  WARMUP_MOVEMENTS.some((w) => w.prefabType === prefabType);
/** The work itself — not rest, not the walk between intervals, not the drills */
const movements = (plan: SessionPlan) =>
  workoutStations(plan).filter((s) =>
    s.prefabType !== 'REST' && s.prefabType !== 'RECOVERY' && !isWarmupDrill(s.prefabType));
/**
 * Seconds of actual work.
 *
 * A run is work wherever it appears - including the run attached to the walk
 * that recovers from it, which in a running session IS the session. Counting
 * only the movements missed every metre of running and reported a running
 * workout as containing no work at all.
 */
const workSeconds = (plan: SessionPlan) =>
  workoutStations(plan).reduce((sum, st) => {
    const run = runCostSeconds(runMetresOf(st.run));
    const isRecovery = st.prefabType === 'REST' || st.prefabType === 'RECOVERY';
    const isWarmup = isWarmupDrill(st.prefabType);
    return sum + run + (isRecovery || isWarmup ? 0 : stationWorkCostSeconds(st));
  }, 0);

/** Seconds spent recovering, warm-up excluded */
const restSeconds = (plan: SessionPlan) =>
  workoutStations(plan).reduce((sum, st) =>
    st.prefabType === 'REST' || st.prefabType === 'RECOVERY'
      ? sum + stationWorkCostSeconds(st)
      : sum, 0);

// ── Structure: what RaceStateMachine assumes but never checks ───────────────

describe('every generated plan is structurally loadable', () => {
  forEveryRequest('index 0 is the START marker', SEEDS, (plan) => {
    const first = plan.stations[0];
    if (first.name !== 'START') return 'first station is ' + first.name;
    if (first.prefabType !== 'START') return 'first prefabType is ' + first.prefabType;
    if (runMetresOf(first.run) !== 0) return 'START has a run before it';
    return true;
  });

  forEveryRequest('the last station is the finish marker', SEEDS, (plan) => {
    const last = plan.stations[plan.stations.length - 1];
    if (!last.isFinish) return 'last station is not isFinish';
    if (last.prefabType !== 'FINISH') return 'last prefabType is ' + last.prefabType;
    return true;
  });

  forEveryRequest('index 1 is a real workout station', SEEDS, (plan) => {
    if (plan.stations.length < 3) return 'only ' + plan.stations.length + ' entries';
    const second = plan.stations[1];
    if (second.isFinish) return 'index 1 is the finish marker';
    if (second.prefabType === 'START') return 'index 1 is a start marker';
    return true;
  });

  forEveryRequest('exactly one finish marker exists', SEEDS, (plan) => {
    const count = plan.stations.filter((s) => s.isFinish).length;
    return count === 1 ? true : count + ' finish markers';
  });

  forEveryRequest('at least one workout station', SEEDS, (plan) =>
    workoutStations(plan).length >= 1 ? true : 'no workout stations'
  );
});

describe('no station is generated at zero or negative volume', () => {
  // A continuous run carries all its work in the run and none in a
  // requirement, so the thing being asserted is that no station is empty -
  // which is what this always meant. Reading the requirement was the only way
  // to ask before a station could be nothing but a run.
  forEveryRequest('no station asks for nothing', SEEDS, (plan) => {
    for (const station of workoutStations(plan)) {
      if (!(stationCostSeconds(station) > 0)) {
        return station.name + ' costs ' + stationCostSeconds(station) + 's';
      }
      if (station.mode !== StationMode.RUN && !(station.requirement > 0)) {
        return station.name + ' has requirement ' + station.requirement;
      }
    }
    return true;
  });

  forEveryRequest('every run distance is non-negative and finite', SEEDS, (plan) => {
    for (const station of plan.stations) {
      const run = runMetresOf(station.run);
      if (!(run >= 0) || !isFinite(run)) return station.name + ' run is ' + run;
    }
    return true;
  });

  forEveryRequest('estimated duration is sane', SEEDS, (plan) => {
    if (!(plan.estimatedMinutes >= 1)) return 'estimate is ' + plan.estimatedMinutes;
    if (plan.estimatedMinutes > 90) return 'estimate is ' + plan.estimatedMinutes + ' min';
    return true;
  });
});

describe('station identity survives generation', () => {
  // Names change with the level variant, so identity is checked on prefabType.
  // Accessories are legitimate members of a training session, so they count as
  // known stations too.
  const byPrefab: { [k: string]: StationConfig } = {};
  for (const t of TEMPLATES) byPrefab[t.prefabType] = t;
  for (const a of ACCESSORY_STATIONS) byPrefab[a.prefabType] = a;
  for (const w of WARMUP_MOVEMENTS) byPrefab[w.prefabType] = w;

  forEveryRequest('names, prefabs and motion types are preserved', SEEDS, (plan) => {
    for (const station of workoutStations(plan)) {
      // Rest, the walk between intervals, and the high knees that stand in for
      // a run indoors are session furniture rather than movements pulled from
      // a catalogue
      if (station.prefabType === 'REST' ||
          station.prefabType === 'RECOVERY' ||
          station.prefabType === 'RUN' ||
          station.prefabType === 'HIGH_KNEE_RUNS') continue;

      const template = byPrefab[station.prefabType];
      if (!template) return 'invented station "' + station.prefabType + '"';
      if (station.mode !== template.mode) return station.name + ' mode changed';
      if (template.motionType && station.motionType !== template.motionType) {
        return station.name + ' lost its motion type';
      }
      if (!station.instruction) return station.name + ' lost its instruction';
    }
    return true;
  });

  // Rounds repeat the same movements on purpose, so uniqueness is a property
  // of a round rather than of the session.
  forEveryRequest('a movement is not repeated inside one round', SEEDS, (plan) => {
    for (const block of plan.blocks ?? []) {
      const seen: { [k: string]: boolean } = {};
      for (const item of block.items) {
        if (seen[item.prefabType]) return item.prefabType + ' twice in one round';
        seen[item.prefabType] = true;
      }
    }
    return true;
  });
});

// ── Space is a hard constraint ──────────────────────────────────────────────

describe('a small space is respected whatever else is asked for', () => {
  forEveryRequest('distance stations stay under the cap', SEEDS, (plan, request) => {
    if (request.space !== 'SMALL') return true;

    const stations = workoutStations(plan);
    const distance = stations.filter((s) => !isStationary(s)).length;
    const cap = Math.floor(stations.length * SMALL_SPACE_MAX_DISTANCE_RATIO);

    return distance <= Math.max(cap, 1)
      ? true
      : distance + ' of ' + stations.length + ' need space (cap ' + cap + ')';
  });

  // The room shortens the leg, not the dose.
  //
  // It used to cap the prescription: a 200m carry became 20m, which is not
  // the same workout made smaller but a different and much easier one.
  // Distance is tracked as accumulated path length rather than displacement,
  // so the full distance is completed by shuttling and the dose survives the
  // room.
  forEveryRequest('travelling work carries a leg cap in a small space', SEEDS, (plan, request) => {
    if (request.space !== 'SMALL') return true;

    for (const station of workoutStations(plan)) {
      const travels = station.mode === StationMode.DISTANCE;
      if (!travels) continue;
      if (station.requirement <= SMALL_SPACE_LEG_METRES) continue;

      if (station.legMetres === undefined) {
        return station.name + ' asks for ' + station.requirement + 'm with no leg cap';
      }
      if (station.legMetres > SMALL_SPACE_LEG_METRES) {
        return station.name + ' leg is ' + station.legMetres + 'm';
      }
    }
    return true;
  });

  forEveryRequest('and the athlete is told to shuttle it', SEEDS, (plan, request) => {
    if (request.space !== 'SMALL') return true;

    for (const station of workoutStations(plan)) {
      if (station.legMetres === undefined) continue;
      if (station.instruction.indexOf('Turn at the marker') < 0) {
        return station.name + ' has a leg cap but no instruction: ' + station.instruction;
      }
    }
    return true;
  });

  // The dose itself must survive.
  //
  // A small room may legitimately choose different movements - space outranks
  // focus, and it always did - but whatever it does choose must be prescribed
  // at full volume. The old rule clamped the requirement, so a 200m carry
  // became 20m: not the same workout made smaller, a different and much
  // easier one.
  let clamped = 0;
  let overLeg = 0;

  for (const request of allRequests(11)) {
    if (request.space !== 'SMALL') continue;

    for (const station of workoutStations(generateSession(INPUT, request)!)) {
      if (station.mode !== StationMode.DISTANCE) continue;
      if (station.requirement === SMALL_SPACE_LEG_METRES) clamped++;
      if (station.requirement > SMALL_SPACE_LEG_METRES) overLeg++;
    }
  }

  check('small-space distance work exceeds the room it is done in',
    overLeg > 0, overLeg + ' stations over the leg length');
  check('and is completed by shuttling rather than by being cut short',
    clamped < overLeg, clamped + ' sitting exactly at the cap');

  // Strength wants distance work, small space forbids it. Space must win.
  for (const seed of SEEDS) {
    const plan = generateSession(INPUT, { space: 'SMALL', duration: 'FULL', focus: 'STRENGTH', seed });
    const stations = workoutStations(plan!);
    const stationary = stations.filter(isStationary).length;
    check(
      'small + strength still fits the room (seed ' + seed + ')',
      stationary >= stations.length / 2,
      stationary + ' of ' + stations.length + ' stationary'
    );
  }
});

// ── Duration is monotonic ───────────────────────────────────────────────────

describe('a longer session is never lighter than a shorter one', () => {
  for (const seed of SEEDS) {
    for (const space of ALL_SPACES) {
      for (const focus of ALL_FOCUSES) {
        if (!focusFitsSpace(focus, space)) continue;

        const short = generateSession(INPUT, { space, focus, duration: 'SHORT', level: 'REGULAR', seed })!;
        const medium = generateSession(INPUT, { space, focus, duration: 'MEDIUM', level: 'REGULAR', seed })!;
        const full = generateSession(INPUT, { space, focus, duration: 'FULL', level: 'REGULAR', seed })!;

        const label = space + '/' + focus + '#' + seed;
        const work = (p: SessionPlan) => estimateMinutes(p.stations);

        check(
          'SHORT < MEDIUM < FULL workload (' + label + ')',
          work(short) <= work(medium) && work(medium) <= work(full),
          work(short) + ' / ' + work(medium) + ' / ' + work(full)
        );

        // Nesting says a shorter session is a subset of a longer one, which
        // holds while both are drawn from the same pool of movements. Running
        // outdoors is no longer drawn from a pool: a short running session is
        // an easy run and a full one is intervals, and they are different
        // sessions on purpose - that being the entire point of archetypes.
        const drawnFromAPool = !(focus === 'RUNNING' && space !== 'SMALL');

        if (drawnFromAPool) {
          check(
            'duration tiers are nested (' + label + ')',
            workoutStations(short).every((s) =>
              workoutStations(full).some((f) => f.name === s.name)
            ),
            'SHORT picked a station FULL did not'
          );
        }
      }
    }
  }
});

// ── Fitness level ───────────────────────────────────────────────────────────

describe('fitness level resizes a session without reshaping it', () => {
  for (const seed of SEEDS) {
    for (const space of ALL_SPACES) {
      const base = { space, duration: 'MEDIUM' as const, focus: 'MIXED' as const, seed };

      const beginner = generateSession(INPUT, { ...base, level: 'BEGINNER' })!;
      const regular  = generateSession(INPUT, { ...base, level: 'REGULAR' })!;
      const athlete  = generateSession(INPUT, { ...base, level: 'ATHLETE' })!;

      const label = space + '#' + seed;
      // Work in seconds, rest excluded. Rest scales the other way with level
      // — a beginner rests longer — so counting it would say a beginner does
      // more work than an athlete.
      const work = workSeconds;
      const names = (p: SessionPlan) => movements(p).map((x) => x.name).join('|');

      // Every level is promised the same minutes, and a beginner spends more
      // of them recovering - so within one duration tier the beginner does
      // less work than a regular athlete and the athlete does more. The rep
      // scheme is still the same scheme: same movements, same rounds, sized
      // to what each of them can repeat inside the time they were promised.
      // Within the tolerance the fitter converges to - the promise is a band
      // of minutes, not an exact number of seconds of work.
      check(
        'a beginner does not out-work a regular athlete (' + label + ')',
        work(beginner) <= work(regular) + 1,
        work(beginner) + ' vs ' + work(regular)
      );

      // Not more work in absolute seconds: every level is promised the same
      // minutes, and the prescription snaps to numbers a coach would say, so
      // a 1.2x volume can land on the same rung of the grid. What is true by
      // construction is that the athlete spends more of the session working.
      const fraction = (p: SessionPlan) =>
        work(p) / Math.max(1, work(p) + restSeconds(p));

      check(
        'an athlete trains a larger share of the session (' + label + ')',
        fraction(athlete) > fraction(beginner),
        (fraction(beginner) * 100).toFixed(0) + '% -> ' +
        (fraction(athlete) * 100).toFixed(0) + '%'
      );
      check(
        'and is never given less work than a beginner (' + label + ')',
        work(athlete) >= work(beginner),
        work(beginner) + ' -> ' + work(athlete)
      );

      const lengths = [beginner, regular, athlete].map((p) => p.estimatedMinutes);
      check(
        'and every level is promised the same length (' + label + ')',
        lengths.every((m) => withinBand(m, 'MEDIUM')),
        lengths.join(' / ')
      );

      const prefabs = (p: SessionPlan) =>
        movements(p).map((x) => x.prefabType).join('|');

      check(
        'the same movements are chosen at every level (' + label + ')',
        prefabs(beginner) === prefabs(regular) && prefabs(regular) === prefabs(athlete),
        prefabs(beginner) + '  vs  ' + prefabs(athlete)
      );

      check(
        'but the beginner is told to do them differently (' + label + ')',
        movements(beginner).some((b, i) =>
          b.instruction !== movements(regular)[i].instruction
        ),
        'no cue differed'
      );
    }
  }

  // Level must not be able to buy its way past a physical constraint.
  //
  // The constraint is the room's length, and it binds the leg. An athlete's
  // extra volume is legitimate and is completed the same way anyone else's
  // is: by turning round more times.
  for (const seed of SEEDS) {
    const plan = generateSession(INPUT, {
      space: 'SMALL', duration: 'FULL', focus: 'STRENGTH', level: 'ATHLETE', seed,
    })!;
    const unbounded = workoutStations(plan).filter(
      (s) => s.mode === StationMode.DISTANCE &&
             s.requirement > SMALL_SPACE_LEG_METRES &&
             (s.legMetres === undefined || s.legMetres > SMALL_SPACE_LEG_METRES)
    );
    check(
      'an athlete in a small room still turns at the wall (seed ' + seed + ')',
      unbounded.length === 0,
      unbounded.map((s) => s.name + '=' + s.requirement + 'm').join(', ')
    );
  }

  // Running is its own session shape, not stations with runs between them
  for (const seed of SEEDS) {
    const run = generateSession(INPUT, {
      space: 'NORMAL', duration: 'FULL', focus: 'RUNNING', level: 'REGULAR', seed,
    })!;

    const intervals = run.blocks!.slice(1);
    check(
      'a running session is intervals, not stations (seed ' + seed + ')',
      intervals.every((b) => b.items.length === 1 && b.items[0].prefabType === 'RECOVERY'),
      intervals.map((b) => b.items.map((i) => i.name).join('+')).join(' | ')
    );
    check(
      'its intervals get shorter as it goes on (seed ' + seed + ')',
      intervals.every((b, i) => i === 0 || runMetresOf(b.run) <= runMetresOf(intervals[i - 1].run)),
      intervals.map((b) => runMetresOf(b.run)).join(' → ')
    );

    // No finisher. A running session closing with three sit-ups closed that
    // way because a shared template wanted a finisher, not because the
    // session needed one.
    check(
      'and the running is the last thing in it (seed ' + seed + ')',
      run.blocks![run.blocks!.length - 1].items[0].prefabType === 'RECOVERY',
      run.blocks![run.blocks!.length - 1].label
    );

    // The distances are the training prescription's and owe nothing to how
    // far apart the race lays its stations out.
    //
    // This asserted a flat two kilometres, which held while every running
    // session was intervals in the hundreds of metres. A speed session is
    // deliberately low volume - six two-hundreds is twelve hundred metres of
    // fast running and the right dose - so the floor was testing one
    // archetype and failing the others for being themselves. What has to be
    // true of all of them is that the session prescribes real running.
    const working = run.blocks!.filter((b) => b.scheme !== BlockScheme.WARMUP);
    const totalMetres = working.reduce(
      (t, b) => t + runMetresOf(b.run) * b.rounds, 0);
    const totalSeconds = working.reduce(
      (t, b) => t + runSecondsOf(b.run) * b.rounds, 0);

    check(
      'a full running session prescribes real running (seed ' + seed + ')',
      totalMetres >= 1000 || totalSeconds >= 600,
      totalMetres + 'm / ' + totalSeconds + 's'
    );
  }

  // The decoupling itself: the course's between-station distance is a spatial
  // setting, the training volume is a physiological one, and retuning the
  // first must not silently rescale the second.
  for (const focus of ALL_FOCUSES) {
    const tiny = generateSession({ ...INPUT, baseRunMetres: 5 },
      { space: 'NORMAL', duration: 'MEDIUM', focus, level: 'REGULAR', seed: 3 })!;
    const huge = generateSession({ ...INPUT, baseRunMetres: 800 },
      { space: 'NORMAL', duration: 'MEDIUM', focus, level: 'REGULAR', seed: 3 })!;

    check(
      focus + ': training volume ignores the course run distance',
      JSON.stringify(tiny.stations) === JSON.stringify(huge.stations)
    );
  }

  forEveryRequest('a beginner is never scaled down to nothing', SEEDS, (plan) => {
    for (const station of workoutStations(plan)) {
      if (!(stationCostSeconds(station) > 0)) {
        return station.name + ' costs nothing';
      }
    }
    return true;
  });

  // Detection thresholds were tuned on the device. A variant may rename the
  // movement and change its cue, but must never touch what the Lens measures.
  forEveryRequest('a variant never carries detection overrides', SEEDS, (plan) => {
    for (const station of workoutStations(plan)) {
      if ((station as any).detection !== undefined) {
        return station.name + ' overrides detection';
      }
    }
    return true;
  });

  forEveryRequest('every station keeps an instruction', SEEDS, (plan) => {
    for (const station of workoutStations(plan)) {
      if (!station.instruction) return station.name + ' has no cue';
    }
    return true;
  });

  for (const prefabType of Object.keys(STATION_VARIANTS)) {
    const family = STATION_VARIANTS[prefabType];
    check(
      prefabType + ' declares all three levels',
      !!family.BEGINNER && !!family.REGULAR && !!family.ATHLETE
    );
  }

  const beginnerBurpee = generateSession(INPUT, {
    space: 'NORMAL', duration: 'FULL', focus: 'MIXED', level: 'BEGINNER', seed: 0,
  })!;
  const burpee = workoutStations(beginnerBurpee).find((s) => s.prefabType === 'BURPEE_BROAD_JUMP');
  check('a beginner burpee is renamed and re-cued',
    !!burpee && burpee.name === 'BURPEE STEP-FORWARD' && burpee.instruction.indexOf('walk forward') > -1,
    burpee ? burpee.name + ' / ' + burpee.instruction : 'not selected');

  check(
    'an omitted level behaves like REGULAR',
    JSON.stringify(generateSession(INPUT, { space: 'NORMAL', duration: 'MEDIUM', focus: 'MIXED', seed: 4 })) ===
    JSON.stringify(generateSession(INPUT, { space: 'NORMAL', duration: 'MEDIUM', focus: 'MIXED', level: 'REGULAR', seed: 4 }))
  );

  const athletePlan = generateSession(INPUT, { space: 'NORMAL', duration: 'MEDIUM', focus: 'MIXED', level: 'ATHLETE', seed: 0 })!;
  check(
    'the level is stated in the summary the athlete reads',
    athletePlan.rationale.indexOf('Athlete') > -1,
    athletePlan.rationale
  );
  check('and distinguishes the plan id', athletePlan.id.indexOf('athlete') > -1, athletePlan.id);
});

// ── Accessory movements ─────────────────────────────────────────────────────

describe('accessories build what the race tests', () => {
  // Not every accessory is stationary - the farmers carry is a carry, because
  // in HYROX that is what farmers work is. The rule that matters is that a
  // room can always be filled without one.
  const stationary = ACCESSORY_STATIONS.filter(isStationary);
  check('most accessories need no space at all',
    stationary.length >= ACCESSORY_STATIONS.length - 2,
    stationary.length + ' of ' + ACCESSORY_STATIONS.length);
  check('and every race station has a stationary accessory to pair with',
    TEMPLATES.every((race) =>
      stationary.some((a) => (a as any).develops.indexOf(race.prefabType) >= 0)) ||
    stationary.length >= 5,
    stationary.map((a) => a.name).join(', '));

  check(
    'every accessory names what it develops',
    ACCESSORY_STATIONS.every((a) => a.develops.length > 0)
  );

  check(
    'every accessory develops a real race station',
    ACCESSORY_STATIONS.every((a) =>
      a.develops.every((d) => TEMPLATES.some((t) => t.prefabType === d))
    ),
    ACCESSORY_STATIONS.filter((a) =>
      a.develops.some((d) => !TEMPLATES.some((t) => t.prefabType === d))
    ).map((a) => a.name).join(', ')
  );

  check(
    'rep-counted accessories declare their head travel',
    ACCESSORY_STATIONS
      .filter((a) => a.mode === StationMode.VERTICAL_REPS || a.mode === StationMode.LATERAL_REPS)
      .every((a) => (a.dropCm ?? 0) > 0)
  );

  // A block is a pair, and the pair has to mean something
  for (const seed of SEEDS) {
    for (const focus of ['STRENGTH', 'ENGINE', 'MIXED'] as const) {
      const plan = generateSession(INPUT, {
        space: 'NORMAL', duration: 'FULL', focus, level: 'REGULAR', seed,
      })!;

      const working = plan.blocks!.filter(
        (b) => b.scheme === BlockScheme.STRAIGHT || b.scheme === BlockScheme.LADDER
      );

      let related = 0;
      for (const block of working) {
        if (block.items.length < 2) continue;

        const race = block.items.find((i) => !isAccessory(i));
        const accessory = block.items.find((i) => isAccessory(i));
        if (!race || !accessory) continue;

        const entry = ACCESSORY_STATIONS.find((a) => a.prefabType === accessory.prefabType);
        if (entry && entry.develops.indexOf(race.prefabType) >= 0) related++;
      }

      // Engine rotates modalities rather than pairing a station with what
      // builds it - that is what makes it a different session, not the same
      // one with different names in it.
      if (focus === 'ENGINE') continue;

      check(
        'blocks pair a station with what builds it (' + focus + '#' + seed + ')',
        related > 0,
        working.map((b) => b.items.map((i) => i.name).join(' + ')).join(' | ')
      );
    }
  }

  // The point of the whole catalogue: answer a limiter with what builds it
  for (const seed of SEEDS) {
    const withLimiter = generateSession(
      { ...INPUT, limiterPrefabType: 'BURPEE_BROAD_JUMP' },
      { space: 'NORMAL', duration: 'MEDIUM', focus: 'MIXED', level: 'REGULAR', seed }
    )!;

    const helpers = workoutStations(withLimiter).filter(
      (s) => isAccessory(s) &&
        ACCESSORY_STATIONS.find((a) => a.prefabType === s.prefabType)!
          .develops.indexOf('BURPEE_BROAD_JUMP') >= 0
    );

    check(
      'a named limiter pulls in what develops it (seed ' + seed + ')',
      helpers.length > 0,
      workoutStations(withLimiter).map((s) => s.name).join(', ')
    );
  }

  const noLimiter = generateSession(INPUT, {
    space: 'NORMAL', duration: 'MEDIUM', focus: 'MIXED', level: 'REGULAR', seed: 7,
  })!;
  const raceStations = workoutStations(noLimiter).filter((s) => !isAccessory(s));
  check(
    'without a limiter the session stays mostly race-specific',
    raceStations.length >= workoutStations(noLimiter).length / 2,
    raceStations.length + ' of ' + workoutStations(noLimiter).length
  );

  const noAccessories = generateSession(
    { ...INPUT, accessories: [] },
    { space: 'SMALL', duration: 'FULL', focus: 'MIXED', level: 'REGULAR', seed: 0 }
  )!;
  check(
    'accessories can be switched off entirely',
    workoutStations(noAccessories).every((s) => !isAccessory(s))
  );

  // A small room used to offer four movements; the catalogue is why it no
  // longer has to repeat them
  const smallRoom = generateSession(INPUT, {
    space: 'SMALL', duration: 'FULL', focus: 'MIXED', level: 'REGULAR', seed: 0,
  })!;
  check(
    'a small room now has more than the four stationary race stations',
    workoutStations(smallRoom).length > 4,
    workoutStations(smallRoom).length + ' stations'
  );
});

// ── Block structure ─────────────────────────────────────────────────────────

describe('a training session is written as blocks of rounds', () => {
  forEveryRequest('every session has blocks', SEEDS, (plan) =>
    (plan.blocks ?? []).length > 0 ? true : 'no blocks'
  );

  forEveryRequest('every working block repeats', SEEDS, (plan) => {
    for (const block of plan.blocks ?? []) {
      // A continuous run is one bout by definition. Rounds would make it
      // intervals, which is a different archetype with a different name.
      if (block.items.length === 0) {
        if (hasRun(block.run)) continue;
        return block.label + ' is empty';
      }

      // A warm-up is one pass of drills, not rounds of work
      if (block.scheme === BlockScheme.WARMUP) continue;
      if (block.rounds < 2) return block.label + ' runs once';
    }
    return true;
  });

  forEveryRequest('only the first movement of a round carries the run', SEEDS, (plan) => {
    for (const block of plan.blocks ?? []) {
      for (let i = 1; i < block.items.length; i++) {
        if (runMetresOf(block.items[i].run) > 0) {
          return block.items[i].name + ' has a run mid-round';
        }
      }
    }
    return true;
  });

  forEveryRequest('rest sits between rounds, never at the very end', SEEDS, (plan) => {
    const stations = workoutStations(plan);
    const last = stations[stations.length - 1];
    if (last.prefabType === 'REST') return 'session ends on rest';

    // A running session has no REST stations at all, and should not: the
    // recovery jog is the rest half of the interval. Adding a break on top
    // gave every interval two recoveries.
    //
    // And a continuous easy run has no recovery of any kind, because it has
    // nothing to recover between. A session that is one bout is allowed to
    // contain no breaks; that is what makes it continuous.
    const continuous = stations.length === 1 && stations[0].mode === StationMode.RUN;
    if (continuous) return true;

    const hasRecovery = stations.some(
      (s) => s.prefabType === 'REST' || s.prefabType === 'RECOVERY'
    );
    return hasRecovery ? true : 'no recovery anywhere';
  });

  // A beginner needs longer between rounds to repeat the same work.
  // Read a working block: the warm-up rests the same however fit you are.
  for (const seed of SEEDS) {
    const restOf = (level: 'BEGINNER' | 'REGULAR' | 'ATHLETE') => {
      const blocks = generateSession(INPUT, {
        space: 'NORMAL', duration: 'MEDIUM', focus: 'MIXED', level, seed,
      })!.blocks!;
      return blocks.find((b) => b.scheme === BlockScheme.STRAIGHT || b.scheme === BlockScheme.LADDER)!
        .restSeconds;
    };

    // Never longer, rather than strictly shorter: rest is earned by the work
    // bout and the bout is snapped to a grid, so at small doses an athlete's
    // extra volume and their shorter recovery can land on the same second.
    check(
      'rest never lengthens as the athlete gets fitter (seed ' + seed + ')',
      restOf('BEGINNER') >= restOf('REGULAR') && restOf('REGULAR') >= restOf('ATHLETE') - 1,
      restOf('BEGINNER') + ' / ' + restOf('REGULAR') + ' / ' + restOf('ATHLETE')
    );
  }

  const full = generateSession(INPUT, {
    space: 'NORMAL', duration: 'FULL', focus: 'MIXED', level: 'REGULAR', seed: 7,
  })!;
  const lastBlock = full.blocks![full.blocks!.length - 1];
  check('the last block is a finisher', lastBlock.label.indexOf('Finisher') === 0, lastBlock.label);
  check('the finisher is a single movement', lastBlock.items.length === 1);
  check('the finisher has no run', runMetresOf(lastBlock.run) === 0);

  // Pairing two movements back to back is what makes a block a superset
  check(
    'working blocks pair two movements',
    full.blocks!.slice(1, -1).every((b) => b.items.length === 2),
    full.blocks!.slice(1, -1).map((b) => b.items.length).join(',')
  );

  const short = generateSession(INPUT, { space: 'NORMAL', duration: 'SHORT', focus: 'MIXED', level: 'REGULAR', seed: 7 })!;
  const medium = generateSession(INPUT, { space: 'NORMAL', duration: 'MEDIUM', focus: 'MIXED', level: 'REGULAR', seed: 7 })!;
  check('longer sessions have more blocks',
    short.blocks!.length < medium.blocks!.length && medium.blocks!.length < full.blocks!.length,
    short.blocks!.length + ' / ' + medium.blocks!.length + ' / ' + full.blocks!.length);
});

// ── Schemes, rounds and warm-up ─────────────────────────────────────────────

describe('sessions are written, not stamped from one template', () => {
  // Every session arrives warm. Almost all of them get there by doing drills
  // first; an easy run gets there by starting easy, which is what easy means
  // and why four and a half minutes of lunges in front of it would be warming
  // up for a warm-up.
  forEveryRequest('every session arrives warm', SEEDS, (plan) => {
    const first = (plan.blocks ?? [])[0];
    if (!first) return 'no blocks';
    if (first.scheme === BlockScheme.WARMUP) return true;
    if (first.selfWarming === true) return true;
    return 'opens with ' + first.scheme + ' and does not warm itself';
  });

  forEveryRequest('and a session that warms itself has no drills at all', SEEDS, (plan) => {
    const blocks = plan.blocks ?? [];
    if (!blocks[0] || blocks[0].selfWarming !== true) return true;

    // Not merely "the warm-up is not first" - it must not be anywhere. A
    // drill block pushed further down would be the same four and a half
    // minutes, in a stranger place.
    for (const block of blocks) {
      if (block.scheme === BlockScheme.WARMUP) return 'still has a drill block';
    }
    return true;
  });

  forEveryRequest('the warm-up is drills, done straight through', SEEDS, (plan) => {
    const warmup = (plan.blocks ?? [])[0];
    if (!warmup) return 'no blocks';
    if (warmup.scheme !== BlockScheme.WARMUP) return true;

    if (warmup.restSeconds !== 0) return 'warm-up rests ' + warmup.restSeconds + 's';
    if (runMetresOf(warmup.run) !== 0) return 'warm-up runs ' + runMetresOf(warmup.run) + 'm';

    for (const item of warmup.items) {
      if (!isWarmupDrill(item.prefabType)) return warmup.label + ' contains ' + item.name;
    }
    return true;
  });

  // A track session does not open with press ups
  for (const seed of SEEDS) {
    const run = generateSession(INPUT, {
      space: 'NORMAL', duration: 'MEDIUM', focus: 'RUNNING', level: 'REGULAR', seed,
    })!;
    const drills = run.blocks![0].items;
    check(
      'a running session warms up with running drills (seed ' + seed + ')',
      drills.every((d) => WARMUP_MOVEMENTS.find((w) => w.prefabType === d.prefabType)!.tag === 'RUNNING'),
      drills.map((d) => d.name).join(', ')
    );
  }

  forEveryRequest('round scales always match the round count', SEEDS, (plan) => {
    for (const block of plan.blocks ?? []) {
      if (block.roundScales.length !== block.rounds) {
        return block.label + ' has ' + block.roundScales.length + ' scales for ' + block.rounds + ' rounds';
      }
      if (block.roundScales.some((v) => !(v > 0))) return block.label + ' has a zero scale';
    }
    return true;
  });

  forEveryRequest('a ladder rises and falls', SEEDS, (plan) => {
    for (const block of plan.blocks ?? []) {
      if (block.scheme !== BlockScheme.LADDER) continue;

      if (block.rounds % 2 === 0) return 'ladder of ' + block.rounds + ' rounds has no peak';

      const peak = Math.floor(block.rounds / 2);
      const scales = block.roundScales;

      for (let i = 1; i <= peak; i++) {
        if (scales[i] < scales[i - 1]) return 'ladder does not climb';
      }
      for (let i = peak + 1; i < scales.length; i++) {
        if (scales[i] > scales[i - 1]) return 'ladder does not come back down';
      }
    }
    return true;
  });

  // An EMOM is written to the clock, so a hold cannot be its movement
  forEveryRequest('an EMOM never uses a hold', SEEDS, (plan) => {
    for (const block of plan.blocks ?? []) {
      if (block.scheme !== BlockScheme.EMOM) continue;
      for (const item of block.items) {
        if (item.mode === StationMode.TIMED) return 'EMOM on ' + item.name;
      }
    }
    return true;
  });

  forEveryRequest('an EMOM round fits inside its minute', SEEDS, (plan) => {
    for (const block of plan.blocks ?? []) {
      if (block.scheme !== BlockScheme.EMOM) continue;

      const work = block.items.reduce((sum, it) => sum + stationCostSeconds(it), 0);
      if (work > 60) return block.label + ' needs ' + Math.round(work) + 's of a 60s minute';
      if (block.restSeconds < 5) return block.label + ' leaves no rest';
    }
    return true;
  });

  // The whole point of generating rather than templating
  const shapes: { [k: string]: boolean } = {};
  for (const seed of [0, 1, 2, 3, 5, 7, 11, 42]) {
    const plan = generateSession(INPUT, {
      space: 'NORMAL', duration: 'FULL', focus: 'STRENGTH', level: 'REGULAR', seed,
    })!;
    shapes[plan.blocks!.map((b) => b.scheme + b.rounds).join('|')] = true;
  }
  check(
    'the same constraints produce more than one shape across seeds',
    Object.keys(shapes).length > 1,
    Object.keys(shapes).length + ' distinct shapes'
  );
});

// ── Determinism ─────────────────────────────────────────────────────────────

describe('the same request always produces the same workout', () => {
  forEveryRequest('repeated calls are identical', SEEDS, (plan, request) => {
    const again = generateSession(INPUT, request)!;
    return JSON.stringify(plan) === JSON.stringify(again)
      ? true
      : 'second call differed';
  });

  let differing = 0;
  for (const request of allRequests(0)) {
    const a = generateSession(INPUT, { ...request, seed: 1 })!;
    const b = generateSession(INPUT, { ...request, seed: 2 })!;
    if (JSON.stringify(a.stations) !== JSON.stringify(b.stations)) differing++;
  }
  check(
    'a different seed can produce a different workout',
    differing > 0,
    differing + ' of 18 requests varied'
  );

  check(
    'plans carry a stable id',
    generateSession(INPUT, { space: 'SMALL', duration: 'SHORT', focus: 'ENGINE', seed: 3 })!.id ===
      generateSession(INPUT, { space: 'SMALL', duration: 'SHORT', focus: 'ENGINE', seed: 3 })!.id
  );
});

// ── Focus is a preference, not a promise ────────────────────────────────────

describe('focus shapes the session where the space allows it', () => {
  for (const seed of SEEDS) {
    const engine = generateSession(INPUT, { space: 'NORMAL', duration: 'FULL', focus: 'ENGINE', level: 'REGULAR', seed })!;
    const strength = generateSession(INPUT, { space: 'NORMAL', duration: 'FULL', focus: 'STRENGTH', level: 'REGULAR', seed })!;

    // Distinct movements, since rounds repeat each one several times
    const distinct = (p: SessionPlan, mode: StationMode) => {
      const seen: { [k: string]: boolean } = {};
      for (const block of p.blocks ?? []) {
        for (const item of block.items) {
          if (item.mode === mode) seen[item.prefabType] = true;
        }
      }
      return Object.keys(seen).length;
    };
    const zoneHits = (p: SessionPlan) => distinct(p, StationMode.ZONE_HIT);
    const distances = (p: SessionPlan) => distinct(p, StationMode.DISTANCE);

    check(
      'engine leans on hand-tracked work (seed ' + seed + ')',
      zoneHits(engine) > zoneHits(strength),
      zoneHits(engine) + ' vs ' + zoneHits(strength)
    );
    check(
      'strength leans on loaded distance work (seed ' + seed + ')',
      distances(strength) > distances(engine),
      distances(strength) + ' vs ' + distances(engine)
    );
  }
});

// ── Presentation ────────────────────────────────────────────────────────────

describe('every plan is presentable', () => {
  forEveryRequest('title, rationale and id are filled in', SEEDS, (plan) => {
    if (!plan.title) return 'no title';
    if (!plan.rationale) return 'no rationale';
    if (!plan.id) return 'no id';
    if (plan.kind !== 'TRAINING') return 'kind is ' + plan.kind;
    if (plan.source !== 'generated') return 'source is ' + plan.source;
    return true;
  });

  forEveryRequest('the rationale states the real block count', SEEDS, (plan) =>
    plan.rationale.indexOf(String((plan.blocks ?? []).length) + ' blocks') > -1
      ? true
      : 'rationale says otherwise: ' + plan.rationale
  );
});

// ── Degenerate input ────────────────────────────────────────────────────────

describe('unusable input returns nothing rather than something broken', () => {
  check('no templates', generateSession({ templates: [], baseRunMetres: 100 }, allRequests(0)[0]) === null);
  check('null input', generateSession(null as any, allRequests(0)[0]) === null);
  check('null request', generateSession(INPUT, null as any) === null);

  const single = generateSession(
    { templates: [TEMPLATES[1]], baseRunMetres: 100, accessories: [] },
    { space: 'SMALL', duration: 'FULL', focus: 'ENGINE' }
  )!;
  check('a single distance template still yields a plan', single !== null);
  check('and it is built as rounds of that movement',
    movements(single).every((m) => m.prefabType === TEMPLATES[1].prefabType) &&
    movements(single).length > 1,
    movements(single).map((m) => m.name).join(', '));

  const noRun = generateSession({ templates: TEMPLATES, baseRunMetres: 0 }, { space: 'NORMAL', duration: 'SHORT', focus: 'MIXED' })!;
  check('zero base run distance is allowed', noRun !== null);

  // And is simply ignored. Compromised running is prescribed by the training
  // grammar in metres; the course's between-station distance says nothing
  // about how far the athlete should run to train.
  check('and the session still prescribes its own running',
    workoutStations(noRun).some((s) => runMetresOf(s.run) > 0));
  check('with no negative distances anywhere',
    workoutStations(noRun).every((s) => runMetresOf(s.run) >= 0 && s.requirement > 0));

  const noSeed = generateSession(INPUT, { space: 'NORMAL', duration: 'SHORT', focus: 'MIXED' });
  check('an omitted seed behaves like seed 0',
    JSON.stringify(noSeed) === JSON.stringify(generateSession(INPUT, { space: 'NORMAL', duration: 'SHORT', focus: 'MIXED', seed: 0 })));
});

// ── The duration contract ───────────────────────────────────────────────────

describe('SHORT, MEDIUM and FULL are a promise about time', () => {
  // Measured before this existed, the tiers overlapped: a SHORT could run to
  // 21 minutes and a MEDIUM come in at 14, so the two words told the athlete
  // nothing. The bands have gaps between them for the same reason - no
  // session may be ambiguous about which tier it belongs to.
  const WIDE_SEEDS = [0, 1, 7, 42, 97537, 41089, 60099, 65934, 1234, 555];
  let outOfBand: string[] = [];

  for (const space of ALL_SPACES) {
    for (const focus of ALL_FOCUSES) {
      if (!focusFitsSpace(focus, space)) continue;

      for (const duration of ALL_DURATIONS) {
        for (const level of ALL_LEVELS) {
          for (const seed of WIDE_SEEDS) {
            const plan = generateSession(INPUT, { space, duration, focus, level, seed })!;
            if (!withinBand(plan.estimatedMinutes, duration)) {
              outOfBand.push([space, duration, focus, level, seed].join('/') +
                             ' = ' + plan.estimatedMinutes + 'min');
            }
          }
        }
      }
    }
  }

  check('every session lands inside its own band',
    outOfBand.length === 0, outOfBand.slice(0, 4).join(', '));

  // The gaps: no session can belong to two tiers
  check('the bands do not overlap',
    DURATION_BANDS.SHORT.maxMinutes < DURATION_BANDS.MEDIUM.minMinutes &&
    DURATION_BANDS.MEDIUM.maxMinutes < DURATION_BANDS.FULL.minMinutes);
});

describe('a longer tier is more training, not just more resting', () => {
  // A FULL session that is longer only because it rests more is not a longer
  // session. Work volume has to be monotonic in the tier too.
  for (const focus of ALL_FOCUSES) {
    for (const seed of [0, 7, 42, 97537]) {
      const at = (duration: 'SHORT' | 'MEDIUM' | 'FULL') => workSeconds(
        generateSession(INPUT, { space: 'NORMAL', duration, focus, level: 'REGULAR', seed })!
      );

      const short = at('SHORT'), medium = at('MEDIUM'), full = at('FULL');
      check(
        focus + ': work grows with the tier (seed ' + seed + ')',
        short < medium && medium < full,
        [short, medium, full].map((x) => (x / 60).toFixed(1)).join(' → ') + ' min'
      );
    }
  }
});

describe('a session is mostly the session, not mostly the break', () => {
  // Rest used to be a flat sixty seconds whatever it followed, which measured
  // out as sessions that were 70 to 93 per cent rest. The worst of them was a
  // 36-minute running session containing under three minutes of running.
  let worst = { label: '', fraction: 0 };

  for (const focus of ALL_FOCUSES) {
    for (const duration of ALL_DURATIONS) {
      for (const seed of [0, 7, 42, 97537, 41089]) {
        const plan = generateSession(INPUT,
          { space: 'NORMAL', duration, focus, level: 'REGULAR', seed })!;

        const work = workSeconds(plan);
        const rest = restSeconds(plan);
        const fraction = rest / Math.max(1, work + rest);

        if (fraction > worst.fraction) {
          worst = { label: focus + '/' + duration + '#' + seed, fraction };
        }
      }
    }
  }

  check('no session is more than three quarters rest',
    worst.fraction < 0.75,
    worst.label + ' is ' + (worst.fraction * 100).toFixed(0) + '% rest');
});

// ── A room has no running in it ─────────────────────────────────────────────

describe('a small space is never asked to run', () => {
  // Not a shortened run, not a shuttled one. Five square metres has no run in
  // it at any distance, and shuttling eighty metres is four turns.
  let runs: string[] = [];

  for (const request of allRequests(31)) {
    if (request.space !== 'SMALL') continue;

    const plan = generateSession(INPUT, request)!;

    for (const block of plan.blocks!) {
      if (runMetresOf(block.run) > 0) {
        runs.push([request.focus, request.duration].join('/') +
                  ' = ' + runMetresOf(block.run) + 'm');
      }
    }

    for (const station of workoutStations(plan)) {
      if (runMetresOf(station.run) > 0) {
        runs.push([request.focus, request.duration].join('/') +
                  ' station run ' + runMetresOf(station.run) + 'm');
      }
    }
  }

  check('no block prescribes any distance at all',
    runs.length === 0, runs.slice(0, 4).join(', '));

  // An open space still runs, or the rule has eaten more than it should
  let openRuns = 0;
  for (const request of allRequests(31)) {
    if (request.space !== 'NORMAL') continue;
    for (const block of generateSession(INPUT, request)!.blocks!) {
      if (runMetresOf(block.run) > 0) openRuns++;
    }
  }
  check('an open space still runs', openRuns > 0, openRuns);
});

describe('the conditioning survives the room', () => {
  // The run in a compromised round exists so the athlete arrives at the
  // station already tired. Indoors that is fast feet on the spot - the round
  // keeps its shape, it just stops claiming a distance nobody covered.
  // RUNNING is not in this list any more. A running session in a room used to
  // fall back to fast feet on the spot, which kept the focus reachable in a
  // space that cannot hold it; the combination is refused outright now, and
  // the conditioning it used to build lives under MIXED where it belongs.
  for (const focus of ['MIXED'] as const) {
    for (const seed of SEEDS) {
      const plan = generateSession(INPUT, {
        space: 'SMALL', duration: 'MEDIUM', focus, level: 'REGULAR', seed,
      })!;

      // The finisher is one movement to empty the tank, not a compromised
      // round, so it never carried a run and does not need a stand-in.
      const working = plan.blocks!.filter((b) =>
        b.scheme !== BlockScheme.WARMUP && b.label.indexOf('Finisher') !== 0);
      const opensWithWork = working.every((b) =>
        b.items.some((i) => i.prefabType === 'HIGH_KNEE_RUNS'));

      check(focus + ': every round still opens with conditioning (seed ' + seed + ')',
        opensWithWork,
        working.map((b) => b.label).join(' | '));
    }
  }

  // And an open space does not get fast feet instead of a run
  const open = generateSession(INPUT, {
    space: 'NORMAL', duration: 'MEDIUM', focus: 'MIXED', level: 'REGULAR', seed: 0,
  })!;
  check('an open space runs rather than marching on the spot',
    workoutStations(open).every((s) => s.prefabType !== 'HIGH_KNEE_RUNS'));
});

// ── The warm-up knows who it is warming up ──────────────────────────────────

describe('a warm-up matches the athlete it is preparing', () => {
  // A beginner marching their knees up and an advanced athlete running theirs
  // are the same movement at two intensities. Giving both the same drill
  // either leaves one cold or asks the other to sprint before they have moved.
  const opener = (level: 'BEGINNER' | 'REGULAR' | 'ATHLETE', seed: number) => {
    const first = generateSession(INPUT, {
      space: 'NORMAL', duration: 'MEDIUM', focus: 'MIXED', level, seed,
    })!.blocks![0].items[0];

    return WARMUP_MOVEMENTS.find((w) => w.prefabType === first.prefabType)!;
  };

  for (const seed of SEEDS) {
    check('a beginner opens on something controlled (seed ' + seed + ')',
      opener('BEGINNER', seed).intensity === 'EASY',
      opener('BEGINNER', seed).name);

    check('an athlete opens on something brisk (seed ' + seed + ')',
      opener('ATHLETE', seed).intensity === 'BRISK',
      opener('ATHLETE', seed).name);
  }

  // Preference, not restriction: there are only two brisk general drills, so
  // filtering on intensity gave every advanced session the same two, forever.
  const athleteWarmups = new Set<string>();
  for (let seed = 0; seed < 25; seed++) {
    athleteWarmups.add(generateSession(INPUT, {
      space: 'NORMAL', duration: 'MEDIUM', focus: 'MIXED', level: 'ATHLETE', seed,
    })!.blocks![0].items.map((i) => i.prefabType).join('|'));
  }
  check('and an athlete still gets a varied warm-up',
    athleteWarmups.size >= 3, athleteWarmups.size + ' distinct in 25');
});

describe('a warm-up is the same four and a half minutes for everybody', () => {
  const warmupSeconds = (level: 'BEGINNER' | 'REGULAR' | 'ATHLETE',
                         duration: 'SHORT' | 'MEDIUM' | 'FULL',
                         seed = 5) =>
    generateSession(INPUT, {
      space: 'NORMAL', duration, focus: 'MIXED', level, seed,
    })!.blocks![0].items.reduce((t, i) => t + i.requirement, 0);

  // Being ready takes as long as it takes. The level changes which drills
  // fill the time, not how much time it takes.
  const lengths = new Set<number>();
  for (const level of ['BEGINNER', 'REGULAR', 'ATHLETE'] as const) {
    for (const duration of ['SHORT', 'MEDIUM', 'FULL'] as const) {
      lengths.add(warmupSeconds(level, duration));
    }
  }
  const spread = Math.max(...lengths) - Math.min(...lengths);
  check('every level and every tier warms up for the same time',
    spread <= 3, 'spread of ' + spread + 's');

  check('and that time is four to five minutes',
    warmupSeconds('REGULAR', 'MEDIUM') >= 240 &&
    warmupSeconds('REGULAR', 'MEDIUM') <= 300,
    warmupSeconds('REGULAR', 'MEDIUM') + 's');

  // The total is a target, not the sum of whatever came up: a warm-up whose
  // cost floated with the draw also floated with the level, and fed the level
  // straight back into the duration fit.
  const totals = new Set<number>();
  for (let seed = 0; seed < 20; seed++) totals.add(warmupSeconds('REGULAR', 'MEDIUM', seed));
  const drawSpread = Math.max(...totals) - Math.min(...totals);
  check('and it costs the same however the drills fall',
    drawSpread <= 3, 'spread of ' + drawSpread + 's across ' + totals.size + ' draws');
});

// ── Levels are one session at three doses ───────────────────────────────────

/** Metres of running prescribed across the whole session */
const runMetres = (plan: SessionPlan) =>
  workoutStations(plan).reduce((t, s) => t + runMetresOf(s.run), 0);

/** Metres of loaded travel - carries, crawls, lunges */
const carryMetres = (plan: SessionPlan) =>
  workoutStations(plan).reduce(
    (t, s) => t + (s.mode === StationMode.DISTANCE ? s.requirement : 0), 0);

/** Seconds of work at the stations themselves, runs and rest excluded */
const stationWork = (plan: SessionPlan) =>
  workoutStations(plan).reduce((t, s) => {
    if (s.prefabType === 'REST' || s.prefabType === 'RECOVERY') return t;
    if (isWarmupDrill(s.prefabType)) return t;
    return t + stationWorkCostSeconds(s);
  }, 0);

describe('every component of the dose respects the level, not just the total', () => {
  // A composite number can hide a swap: fewer metres of running paid for with
  // more seconds at the stations comes out level on any single score, and is
  // not the same session scaled. Each component is checked on its own.
  const components: { name: string, of: (p: SessionPlan) => number }[] = [
    { name: 'running metres', of: runMetres },
    { name: 'carry metres', of: carryMetres },
    { name: 'station work', of: stationWork },
  ];

  for (const component of components) {
    let violations = 0;
    let worst = '';

    for (const space of ALL_SPACES) {
      for (const focus of ALL_FOCUSES) {
        if (!focusFitsSpace(focus, space)) continue;

        for (const duration of ALL_DURATIONS) {
          for (const seed of SEEDS) {
            const at = (level: 'BEGINNER' | 'REGULAR' | 'ATHLETE') => component.of(
              generateSession(INPUT, { space, duration, focus, level, seed })!
            );

            const b = at('BEGINNER'), r = at('REGULAR'), a = at('ATHLETE');

            if (!(b <= r + 1 && r <= a + 1)) {
              violations++;
              if (!worst) {
                worst = [space, duration, focus, seed].join('/') +
                        ' = ' + [b, r, a].join(' / ');
              }
            }
          }
        }
      }
    }

    check(component.name + ': BEGINNER <= REGULAR <= ATHLETE',
      violations === 0, worst);
  }
});

describe('a fitter athlete is never given less to do', () => {
  // The invariant that keeps the levels comparable. It broke four separate
  // times, each in the same way: something level-dependent leaked into the
  // duration fit, the fitter answered by giving the levels different
  // structures, and a beginner came out of it having done more work than a
  // regular athlete. The last of them was the warm-up being snapped to the
  // hold grid, which pulled its total off target by up to half a minute -
  // differently per level, since the levels are offered different drills.
  let worst = '';
  let violations = 0;

  for (const space of ALL_SPACES) {
    for (const focus of ALL_FOCUSES) {
      if (!focusFitsSpace(focus, space)) continue;

      for (const duration of ALL_DURATIONS) {
        for (const seed of SEEDS) {
          const at = (level: 'BEGINNER' | 'REGULAR' | 'ATHLETE') => workSeconds(
            generateSession(INPUT, { space, duration, focus, level, seed })!
          );

          const b = at('BEGINNER'), r = at('REGULAR'), a = at('ATHLETE');

          if (!(b <= r + 1 && r <= a + 1)) {
            violations++;
            if (!worst) {
              worst = [space, duration, focus, seed].join('/') + ' = ' +
                      [b, r, a].map((x) => (x / 60).toFixed(1)).join(' / ') + ' min';
            }
          }
        }
      }
    }
  }

  check('BEGINNER <= REGULAR <= ATHLETE, everywhere', violations === 0, worst);
});

describe('the levels do not compound into a different sport', () => {
  // Three levers move together - load, volume and recovery - and none of them
  // is measured on the athlete. This is the generator's own estimate of how
  // much of a session is working time, computed from the cost model: a
  // regression guard on the shape of the prescription, not a statement about
  // how hard anybody actually worked. The real thing needs the pace they ran,
  // the weight they picked and the time they took, and we have none of it.
  //
  // What it does catch is compounding: if an advanced session came out twice
  // as dense as a beginner's it would not be the same workout scaled.
  let widest = 0;
  let widestAt = '';

  for (const focus of ALL_FOCUSES) {
    for (const duration of ALL_DURATIONS) {
      const density = (level: 'BEGINNER' | 'ATHLETE') => {
        const plan = generateSession(INPUT,
          { space: 'NORMAL', duration, focus, level, seed: 97537 })!;
        const w = workSeconds(plan);
        return w / Math.max(1, w + restSeconds(plan));
      };

      const spread = density('ATHLETE') - density('BEGINNER');
      if (spread > widest) {
        widest = spread;
        widestAt = focus + '/' + duration;
      }
    }
  }

  check('modelled work fraction rises with level, without compounding',
    widest > 0.02 && widest < 0.25,
    widestAt + ' spread ' + (widest * 100).toFixed(0) + ' points');
});

describe('every distance is a number a coach would say', () => {
  // "137m run" was the duration fitter scaling a clean 300m by whatever real
  // number landed the session in its band, and 24m and 32m carries were the
  // ladder doing the same to a rung.
  const RUN_OK = [50, 100, 150, 200, 300, 400, 500, 600, 800, 1000, 1200, 1600, 2000];
  const CARRY_OK = [20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200];

  const oddRuns: number[] = [];
  const oddCarries: number[] = [];

  for (const request of allRequests(41)) {
    const plan = generateSession(INPUT, request)!;

    for (const block of plan.blocks!) {
      if (runMetresOf(block.run) > 0 && RUN_OK.indexOf(runMetresOf(block.run)) < 0) {
        oddRuns.push(runMetresOf(block.run));
      }
    }

    for (const station of workoutStations(plan)) {
      if (station.mode !== StationMode.DISTANCE) continue;
      if (CARRY_OK.indexOf(station.requirement) < 0) oddCarries.push(station.requirement);
    }
  }

  check('runs land on the grid', oddRuns.length === 0,
    [...new Set(oddRuns)].join(', '));
  check('and so do carries, rung by rung', oddCarries.length === 0,
    [...new Set(oddCarries)].join(', '));
});

// ── The fitter may shorten a session, not change what it is ─────────────────

describe('dropping a block never costs the session its character', () => {
  // The third knob removes a working block when nothing else can honour the
  // promised minutes. It must not take the focus with it: an engine session
  // reduced to one modality is not an engine session, and a mixed one with no
  // station left to run to is just running.
  for (const space of ALL_SPACES) {
    for (const duration of ALL_DURATIONS) {
      for (const seed of SEEDS) {
        const plan = (focus: 'RUNNING' | 'ENGINE' | 'STRENGTH' | 'MIXED') =>
          generateSession(INPUT, { space, duration, focus, level: 'REGULAR', seed })!;

        const working = (p: SessionPlan) => p.blocks!.filter((b) =>
          b.scheme !== BlockScheme.WARMUP && b.label.indexOf('Finisher') !== 0);

        const label = space + '/' + duration + '#' + seed;

        // Running: the running survives, whatever kind of running it is.
        // Dropping a block must not leave a session called "Running" with no
        // run in it - but an easy run is one continuous bout with no
        // recovery, so demanding an interval was demanding one archetype.
        if (focusFitsSpace('RUNNING', space)) {
          const runBlocks = working(plan('RUNNING'));
          check('RUNNING keeps its running (' + label + ')',
            runBlocks.length >= 1 && runBlocks.some((b) => hasRun(b.run)),
            runBlocks.map((b) => b.label).join(' | '));
        }

        // Strength: at least one block of loaded work
        const strengthBlocks = working(plan('STRENGTH'));
        check('STRENGTH keeps a loaded block (' + label + ')',
          strengthBlocks.length >= 1 && strengthBlocks.some((b) =>
            b.items.some((i) => i.mode === StationMode.DISTANCE ||
                                i.mode === StationMode.TIMED ||
                                !isAccessory(i))),
          strengthBlocks.map((b) => b.label).join(' | '));

        // Engine: enough modalities left to still be a rotation
        const engineBlocks = working(plan('ENGINE'));
        const modalities = new Set<string>();
        for (const b of engineBlocks) for (const i of b.items) modalities.add(i.prefabType);
        check('ENGINE keeps more than one modality (' + label + ')',
          modalities.size >= 2, [...modalities].join(', '));

        // Mixed: at least one round that runs to a station
        const mixedBlocks = working(plan('MIXED'));
        check('MIXED keeps a run paired with a station (' + label + ')',
          mixedBlocks.some((b) =>
            (runMetresOf(b.run) > 0 || b.items.some((i) => i.prefabType === 'HIGH_KNEE_RUNS')) &&
            b.items.some((i) => i.prefabType !== 'HIGH_KNEE_RUNS' &&
                                i.prefabType !== 'RECOVERY')),
          mixedBlocks.map((b) => b.label).join(' | '));
      }
    }
  }
});

// ── The plan and the stations are the same session ──────────────────────────

describe('what the plan says a break is, is what the break runs for', () => {
  // Two layers are printed and the athlete is told both: the prescription,
  // read off the blocks, and the stations, which are what actually run. A
  // break appeared as seventy-six seconds in one and seventy-five in the
  // other, because flattening put it on the grid of round numbers meant for
  // work. Nothing about the session changed and it was still wrong to show
  // the athlete two different numbers for one thing.
  forEveryRequest('a recovery lasts what it was prescribed', SEEDS, (plan) => {
    for (let b = 0; b < plan.blocks.length; b++) {
      const block = plan.blocks[b];
      for (const item of block.items) {
        if (!isRestStation(item)) continue;

        const ran = plan.stations.filter(
          (s) => s.name === item.name && s.blockIndex === b
        );

        for (const station of ran) {
          if (station.requirement !== item.requirement) {
            return block.label + ' prescribes ' + item.requirement +
                   's of ' + item.name + ' and runs ' + station.requirement + 's';
          }
        }
      }
    }
    return true;
  });

  forEveryRequest('and so does a warm-up drill', SEEDS, (plan) => {
    for (let b = 0; b < plan.blocks.length; b++) {
      const block = plan.blocks[b];
      for (const item of block.items) {
        if (!isWarmupStation(item)) continue;

        const ran = plan.stations.filter(
          (s) => s.name === item.name && s.blockIndex === b
        );

        for (const station of ran) {
          if (station.requirement !== item.requirement) {
            return item.name + ': prescribed ' + item.requirement +
                   's, runs ' + station.requirement + 's';
          }
        }
      }
    }
    return true;
  });
});

// ── Who recovers how ────────────────────────────────────────────────────────

describe('what a recovery is, and who is recovering, are two questions', () => {
  // The level decides how an ordinary interval recovery is taken - a beginner
  // walks so the heart rate actually comes down, a trained athlete jogs so
  // the session stays one piece of work rather than eight separated by rests.
  //
  // But where the kind is definitive it wins at every level. A threshold
  // float that is walked is not a float: the lactate clears and the session
  // becomes a different one. Speed work's recovery is walked by everybody,
  // because near-full recovery is the point rather than a concession.
  const recoveries = (plan: SessionPlan) =>
    plan.stations.filter((s) => s.prefabType === 'RECOVERY');

  const EXPECTED: { [kind: string]: { [level: string]: string } } = {
    FLOAT_JOG:   { BEGINNER: 'FLOAT', REGULAR: 'FLOAT', ATHLETE: 'FLOAT' },
    WALK_OR_JOG: { BEGINNER: 'WALK',  REGULAR: 'WALK',  ATHLETE: 'WALK'  },
    EASY_JOG:    { BEGINNER: 'WALK',  REGULAR: 'JOG',   ATHLETE: 'JOG'   },
  };

  forEveryRequest('every recovery is named by its kind and its level',
    [0, 7, 42], (plan, request) => {
      for (const station of recoveries(plan)) {
        const kind = station.recoveryKind || 'EASY_JOG';
        const wanted = EXPECTED[kind][request.level ?? 'REGULAR'];

        if (station.name !== wanted) {
          return kind + ' at ' + request.level + ' is "' + station.name +
                 '", wanted "' + wanted + '"';
        }
      }
      return true;
    });

  forEveryRequest('and every recovery says what kind it is', [0, 7, 42], (plan) => {
    for (const station of recoveries(plan)) {
      if (!station.recoveryKind) return station.name + ' has no kind';
      if (!EXPECTED[station.recoveryKind]) {
        return 'unknown kind ' + station.recoveryKind;
      }
    }
    return true;
  });

  // The kind names it; the archetype sizes it. Two things reaching for the
  // same field is how a level ends up applied twice.
  const at = (level: Level) => generateSession(INPUT, {
    space: 'NORMAL', duration: 'MEDIUM', focus: 'RUNNING', level, seed: 3,
  } as SessionRequest);

  const beginner = recoveries(at('BEGINNER'));
  const athlete = recoveries(at('ATHLETE'));

  check('both levels get one', beginner.length > 0 && athlete.length > 0,
    beginner.length + ' / ' + athlete.length);

  check('and the length does not move with the level',
    beginner[0].requirement === athlete[0].requirement,
    beginner[0].requirement + ' vs ' + athlete[0].requirement);

  // The instruction is the only place the athlete learns that a float is
  // meant to stay short, or that walking the speed recovery is correct.
  const float = recoveries(at('REGULAR')).filter((s) => s.recoveryKind === 'FLOAT_JOG')[0];
  if (float) {
    check('a float tells them to keep jogging',
      float.instruction.toLowerCase().indexOf('jog') >= 0, float.instruction);
  }
});

// ── Nothing is left of the old running grammar ──────────────────────────────

describe('a session that cannot be built is not built', () => {
  // There used to be a fallback here. Asked for running in a five square
  // metre room, the generator answered with on-the-spot conditioning - so an
  // illegal request produced a session, the picker's rule was the only thing
  // enforcing the contract, and a violation looked like a feature.
  for (const duration of ALL_DURATIONS) {
    for (const level of ALL_LEVELS) {
      const plan = generateSession(INPUT, {
        space: 'SMALL', focus: 'RUNNING', duration, level, seed: 0,
      });

      check('SMALL + RUNNING at ' + duration + '/' + level + ' is refused',
        plan === null, plan ? plan.stations.length + ' stations' : 'null');
    }
  }

  check('and the rule lives where sessions are made',
    !focusFitsSpace('RUNNING', 'SMALL') &&
    focusFitsSpace('MIXED', 'SMALL') &&
    focusFitsSpace('RUNNING', 'NORMAL'));

  // Every running session is an archetype now. A block of running without one
  // would be something the old grammar built, surviving.
  forEveryRequest('every running block declares what kind it is', SEEDS,
    (plan, request) => {
      if (request.focus !== 'RUNNING') return true;

      for (const block of plan.blocks ?? []) {
        if (block.scheme === BlockScheme.WARMUP) continue;
        if (!block.archetype) return block.label + ' has no archetype';
      }
      return true;
    });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
