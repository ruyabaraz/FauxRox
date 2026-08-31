// ============================================================================
// runningSchedule.test.ts — which of the legal sessions to give somebody today
// ============================================================================
// Legality has no history in it and this has nothing else. Tested apart for
// the same reason they are written apart: "is VO2 legal in a medium session"
// and "should they do VO2 today" are different questions, and answering them
// in one function means neither can be checked without simulating a year.
// ============================================================================

import {
  scheduleRunning,
  intensityOf,
  isRunningArchetype,
  QUALITY_RECOVERY_WINDOW_HOURS,
  SchedulingContext,
} from '../Assets/Scripts/RunningSchedule';

import {
  RunningArchetype,
  ALL_RUNNING_ARCHETYPES,
  selectRunningArchetype,
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

const ALL = ALL_RUNNING_ARCHETYPES;
const QUALITY: RunningArchetype[] = ['HYROX_PACE', 'THRESHOLD', 'VO2', 'SPEED_REPETITION'];

const after = (
  last: RunningArchetype,
  hoursSinceLast?: number
): SchedulingContext => ({ recent: [last], hoursSinceLast });

describe('one easy kind and four hard ones', () => {
  check('an easy run is the easy one', intensityOf('EASY_BASE') === 'EASY');

  for (const archetype of QUALITY) {
    check(archetype + ' is quality', intensityOf(archetype) === 'QUALITY');
  }

  // Two bands rather than five. What separates a threshold session from a
  // maximal aerobic one matters enormously for what they train and not at all
  // for whether the athlete should be doing something hard today.
  check('and there are only the two', new Set(ALL.map(intensityOf)).size === 2);
});

describe('two easy runs in a row is ordinary training', () => {
  const afterEasy = scheduleRunning(ALL, after('EASY_BASE', 2));

  check('an easy run does not rule out another one',
    afterEasy.indexOf('EASY_BASE') >= 0, afterEasy.join(', '));
  check('and nothing else is ruled out either',
    afterEasy.length === ALL.length, afterEasy.join(', '));

  // This was excluded, and the exclusion combined with the safety rule to
  // produce a policy nobody wrote: inside the recovery window it forced
  // strict alternation, and outside it an easy run could never follow an easy
  // run, so the draw came out ninety-three per cent quality.
  const afterQuality = scheduleRunning(ALL, after('THRESHOLD', 200));

  check('but another kind of quality is preferred to the same one',
    afterQuality.indexOf('THRESHOLD') < 0, afterQuality.join(', '));
  check('and the easy one is still there',
    afterQuality.indexOf('EASY_BASE') >= 0);

  // A preference rather than a rule: where it is the only quality session
  // the tier can hold, it is still the answer.
  const cornered = scheduleRunning(['VO2'] as RunningArchetype[], after('VO2', 200));
  check('a preference yields when it is the only option',
    cornered.length === 1 && cornered[0] === 'VO2');
});

describe('the sequences it actually produces', () => {
  // The two rules were each defensible and their combination was not, which
  // is not something either of them says on its own. This walks the policy
  // the way an athlete would.
  const walk = (hoursBetween: number, count: number): RunningArchetype[] => {
    const out: RunningArchetype[] = [];
    let last: RunningArchetype | null = null;

    for (let i = 0; i < count; i++) {
      const context = last ? after(last, hoursBetween) : {};
      out.push(selectRunningArchetype(ALL, i * 977 + 13, context));
      last = out[out.length - 1];
    }

    return out;
  };

  const easyFraction = (seq: RunningArchetype[]) =>
    seq.filter((a) => intensityOf(a) === 'EASY').length / seq.length;

  const backToBackQuality = (seq: RunningArchetype[]) => {
    let n = 0;
    for (let i = 1; i < seq.length; i++) {
      if (intensityOf(seq[i]) === 'QUALITY' && intensityOf(seq[i - 1]) === 'QUALITY') n++;
    }
    return n;
  };

  const daily = walk(24, 200);

  // The safety rule, which is the whole of the claim being made.
  check('training daily, no hard session follows a hard session',
    backToBackQuality(daily) === 0, backToBackQuality(daily));

  // The mechanism rather than the ratio. Somebody training daily alternates,
  // and that is a consequence of the safety rule and their own frequency -
  // not a distribution this is trying to hit. Asserting the percentage would
  // turn an emergent number into a target, and the target is the thing this
  // was written not to invent.
  let everyQualityFollowedByEasy = true;
  for (let i = 1; i < daily.length; i++) {
    if (intensityOf(daily[i - 1]) === 'QUALITY' && intensityOf(daily[i]) !== 'EASY') {
      everyQualityFollowedByEasy = false;
    }
  }
  check('every hard session is followed by an easy one', everyQualityFollowedByEasy);

  // A loose sanity bound, deliberately far wider than the numbers this
  // actually produces. It catches the shape going wrong - the ninety-three
  // per cent quality the old rules gave - and cannot be read as a target.
  check('and neither band collapses',
    easyFraction(daily) > 0.2 && easyFraction(daily) < 0.8,
    (easyFraction(daily) * 100).toFixed(0) + '% easy - emergent, not a target');

  const spaced = walk(72, 200);

  // Outside the window there is no claim to make, so the draw is unweighted
  // and its shape follows from how many archetypes are in each band. Worth
  // knowing rather than worth hiding: adding a sixth quality archetype would
  // move this number, and nothing about training would have changed.
  check('training every three days, hard sessions are allowed to follow each other',
    backToBackQuality(spaced) > 0);
  check('and the easy run is still drawn',
    easyFraction(spaced) > 0.1, (easyFraction(spaced) * 100).toFixed(0) + '%');
});

describe('not two hard days in a row', () => {
  check('an easy session two hours ago blocks nothing',
    scheduleRunning(ALL, after('EASY_BASE', 2)).length === ALL.length);

  const soon = scheduleRunning(ALL, after('THRESHOLD', 12));

  check('after a hard session, only the easy one', soon.length === 1 && soon[0] === 'EASY_BASE',
    soon.join(', '));

  // The one rule here with a physiological claim behind it, in its modest
  // version: a quality session leaves the athlete owing an easy one.
  const later = scheduleRunning(ALL, after('THRESHOLD', QUALITY_RECOVERY_WINDOW_HOURS + 1));
  check('and once it is paid for, everything but a repeat',
    later.length === ALL.length - 1 && later.indexOf('THRESHOLD') < 0, later.join(', '));

  check('a quality session three days ago owes nothing',
    scheduleRunning(ALL, after('VO2', 72)).indexOf('THRESHOLD') >= 0);

  // The boundary itself, since the whole point of storing a timestamp was to
  // have one. One constant, one comparison: changing the policy is changing
  // that number and nothing else.
  const W = QUALITY_RECOVERY_WINDOW_HOURS;

  check('a minute inside the window still blocks quality',
    scheduleRunning(ALL, after('VO2', W - 0.02)).length === 1, W - 0.02);

  check('and the boundary itself does not',
    scheduleRunning(ALL, after('VO2', W)).length > 1, W);

  check('nor a minute past it',
    scheduleRunning(ALL, after('VO2', W + 0.02)).length > 1, W + 0.02);

  check('the window is a stated policy value',
    QUALITY_RECOVERY_WINDOW_HOURS === 48, QUALITY_RECOVERY_WINDOW_HOURS);

  // Refusing a hard session to somebody who has not trained since would be a
  // guess against their interest, and a log written before this existed has
  // no timestamp to guess from.
  const unknown = scheduleRunning(ALL, { recent: ['VO2'] });
  check('an unknown elapsed time is read as long ago',
    unknown.length === ALL.length - 1 && unknown.indexOf('THRESHOLD') >= 0,
    unknown.join(', '));
});

describe('a rule that cannot be honoured is skipped, never enforced into nothing', () => {
  // A filter that removed the last candidate would leave nothing to build,
  // and the fallback for that - something, anything - is how a policy quietly
  // becomes the opposite of itself.
  const onlyHard = scheduleRunning(QUALITY, after('VO2', 1));
  check('a tier with no easy session still produces one',
    onlyHard.length > 0, onlyHard.join(', '));

  // The safety rule has nothing to fall back on here and skips itself. The
  // preference still runs - it was an early return, so a tier of nothing but
  // quality handed back the same session an hour later.
  check('and it is a different hard session, not the same one an hour later',
    onlyHard.indexOf('VO2') < 0, onlyHard.join(', '));

  const cornered = scheduleRunning(['VO2'] as RunningArchetype[], after('VO2', 1));
  check('and a single candidate survives both rules',
    cornered.length === 1 && cornered[0] === 'VO2');

  check('no history is no narrowing', scheduleRunning(ALL).length === ALL.length);
  check('nor is a first-ever session', scheduleRunning(ALL, {}).length === ALL.length);
});

describe('the policy narrows and then the seed picks', () => {
  // In that order. The seed choosing first and the policy overruling turns
  // every rejection into a fallback, and the fallbacks become the behaviour
  // nobody designed.
  let sawSomethingElse = false;

  for (let seed = 0; seed < 200; seed++) {
    const chosen = selectRunningArchetype(ALL, seed, after('VO2', 6));
    if (chosen !== 'EASY_BASE') sawSomethingElse = true;
  }

  check('after a hard session every seed gives the easy one', !sawSomethingElse);

  // And with the policy satisfied the seed is still doing the choosing.
  const drawn = new Set<string>();
  for (let seed = 0; seed < 200; seed++) {
    drawn.add(selectRunningArchetype(ALL, seed, after('EASY_BASE', 200)));
  }

  check('otherwise the draw is still varied', drawn.size >= 3, [...drawn].join(', '));
  check('and an easy run can follow an easy run', drawn.has('EASY_BASE'),
    [...drawn].join(', '));
});

describe('a stored archetype is checked before it is believed', () => {
  // The log is a string on disk and may hold anything - an older name, a
  // truncated write, a value from a version that thought differently.
  for (const archetype of ALL) {
    check(archetype + ' is recognised', isRunningArchetype(archetype));
  }

  check('and a name from nowhere is not', !isRunningArchetype('LONG'));
  check('nor an empty one', !isRunningArchetype(''));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
