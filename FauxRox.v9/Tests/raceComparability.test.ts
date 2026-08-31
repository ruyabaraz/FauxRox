// ============================================================================
// raceComparability.test.ts — a list of times is not a ranking
// ============================================================================
// The leaderboard sorted numbers and said nothing about where they came from.
// Two of the things that shape a time are not the same between any two rows:
// the course, which is a set of scene inputs and can differ between athletes,
// and the load, which the athlete picks out of their own gym and which the
// app has never been told.
//
// The first is fixable and now is. The second is not, and the honest response
// is to say so rather than to sort anyway.
// ============================================================================

import {
  comparisonKey,
  sameConditions,
  ranksAthletes,
  unrankedReason,
  comparableToOwnRace,
  RULES_VERSION,
  LOAD_UNKNOWN,
} from '../Assets/Scripts/RaceComparability';

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

const COURSE_A = 'r400_sk50_ro50_tp75_pl50_cw50_bu25_hc200_lu100';
const COURSE_B = 'r400_sk50_ro50_tp75_pl50_cw50_bu50_hc200_lu100';   // 50 burpees

// ── The course ──────────────────────────────────────────────────────────────

describe('two races on different courses are two different races', () => {
  check('the same course compares',
    sameConditions(comparisonKey(COURSE_A, 'rx'), comparisonKey(COURSE_A, 'rx')));

  // Twenty-five burpees and fifty burpees are not the same race
  check('a different rep count does not',
    !sameConditions(comparisonKey(COURSE_A, 'rx'), comparisonKey(COURSE_B, 'rx')));

  // "We do not know which course" is not "the same course as yours". Records
  // written before the column existed say nothing, and nothing is not a match.
  check('a missing course is not a wildcard',
    !sameConditions(comparisonKey('', 'rx'), comparisonKey(COURSE_A, 'rx')));
  check('and neither is two missing ones',
    !sameConditions(comparisonKey('', 'rx'), comparisonKey('', 'rx')));
});

describe('the rules the race was run under are part of the key', () => {
  const a = comparisonKey(COURSE_A, 'rx');
  const b = comparisonKey(COURSE_A, 'rx');

  check('today matches today', sameConditions(a, b));
  check('and the version is recorded', a.rulesVersion === RULES_VERSION);

  const old = { configKey: COURSE_A, rulesVersion: RULES_VERSION - 1, loadDivision: 'rx' };
  check('a race under older rules does not compare', !sameConditions(a, old));
});

// ── The load ────────────────────────────────────────────────────────────────

describe('nobody is ranked while the weights are unknown', () => {
  // The one that cannot be fixed with the data we have. An eight-kilo carry
  // and a thirty-kilo carry over the same distance produce two times that
  // sort against each other and mean nothing next to each other.
  const unknown = comparisonKey(COURSE_A);

  check('load defaults to unknown', unknown.loadDivision === LOAD_UNKNOWN);
  check('and an unknown load does not rank', !ranksAthletes(unknown));

  check('the reason says why, in words the athlete would use',
    unrankedReason(unknown).indexOf('own weights') > 0, unrankedReason(unknown));

  // Once a division is recorded the board means something
  check('a recorded division does rank', ranksAthletes(comparisonKey(COURSE_A, 'rx')));
  check('and then there is nothing to explain',
    unrankedReason(comparisonKey(COURSE_A, 'rx')) === '');

  // A known load on an unknown course still does not rank
  check('a known load does not rescue an unknown course',
    !ranksAthletes(comparisonKey('', 'rx')));
  check('and the reason names the course, not the weights',
    unrankedReason(comparisonKey('', 'rx')).indexOf('course settings') > 0,
    unrankedReason(comparisonKey('', 'rx')));
});

// ── A personal best is a different question ─────────────────────────────────

describe('an athlete may be compared to themselves', () => {
  // Load is not a problem here the way it is on the board: same person, same
  // dumbbells between Tuesday and Thursday. The course still has to match.
  check('the same course compares', comparableToOwnRace(COURSE_A, COURSE_A));
  check('a different one does not', !comparableToOwnRace(COURSE_A, COURSE_B));
  check('and an unrecorded one does not either',
    !comparableToOwnRace(COURSE_A, '') && !comparableToOwnRace('', COURSE_A));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
