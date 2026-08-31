// ============================================================================
// sessionEligibility.test.ts — what may be shown to other people
// ============================================================================
// A leaderboard is worth something only if everything in it was earned the
// same way. Four things put a result in front of other people - the board
// itself, a personal best, an achievement, the history the coach reads - and
// each was guarded separately, at the call site, by whoever remembered.
//
// A guard at the call site protects the calls that exist today. These lock
// the rule itself, so the next call to be written cannot quietly put an
// editor session with four-second stations on the board.
// ============================================================================

import {
  eligibilityOf,
  mayRank,
  mayRecord,
  SessionFacts,
} from '../Assets/Scripts/SessionEligibility';

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

const race = (over: Partial<SessionFacts> = {}): SessionFacts => ({
  kind: 'RACE', previewSimplified: false, completed: true, ...over,
});

// ── The one thing that counts ───────────────────────────────────────────────

describe('a finished race on a device counts for everything', () => {
  const e = eligibilityOf(race());
  check('it ranks', e.countsForRanking === true);
  check('it is recorded', e.countsForHistory === true);
  check('it can unlock something', e.countsForAchievements === true);
  check('and there is nothing to explain', e.reason === '');
});

// ── Preview ─────────────────────────────────────────────────────────────────

describe('a preview session becomes nothing at all', () => {
  // Hand-tracked stations complete after four seconds in the editor. The
  // times measure the harness, and a personal best set by the harness is a
  // personal best the athlete can never beat.
  const e = eligibilityOf(race({ previewSimplified: true }));

  check('no leaderboard', e.countsForRanking === false);
  check('no personal best', e.countsForRanking === false);
  check('no achievement', e.countsForAchievements === false);
  check('and not even history', e.countsForHistory === false);
  check('the reason names the preview', e.reason.indexOf('preview') >= 0, e.reason);

  // Preview beats everything else: a finished race in the editor is still
  // the editor
  check('a finished preview race still counts for nothing',
    !mayRank(race({ previewSimplified: true })) &&
    !mayRecord(race({ previewSimplified: true })));

  check('and so does a preview training session',
    !mayRank(race({ kind: 'TRAINING', previewSimplified: true })) &&
    !mayRecord(race({ kind: 'TRAINING', previewSimplified: true })));
});

// ── Training ────────────────────────────────────────────────────────────────

describe('a training session is history, never a result', () => {
  const e = eligibilityOf(race({ kind: 'TRAINING' }));

  check('it does not rank', e.countsForRanking === false);
  check('it unlocks nothing', e.countsForAchievements === false);

  // But the athlete did the work, and the coach should know
  check('it is still recorded', e.countsForHistory === true);
  check('the reason says what it was',
    e.reason.indexOf('training') >= 0, e.reason);
});

// ── Stopping ────────────────────────────────────────────────────────────────

describe('a race that was stopped is not a race that was run', () => {
  const e = eligibilityOf(race({ completed: false }));

  check('it does not rank', e.countsForRanking === false);
  check('and sets no personal best', e.countsForRanking === false);

  // The work up to the stop was still done
  check('but it is recorded', e.countsForHistory === true);
  check('the reason says it was stopped',
    e.reason.indexOf('stopped') >= 0, e.reason);
});

// ── Nothing slips through ───────────────────────────────────────────────────

describe('only one combination reaches the leaderboard', () => {
  const kinds = ['RACE', 'TRAINING'];
  let ranking = 0;
  let total = 0;

  for (const kind of kinds) {
    for (const previewSimplified of [false, true]) {
      for (const completed of [false, true]) {
        total++;
        if (mayRank({ kind, previewSimplified, completed })) ranking++;
      }
    }
  }

  check('exactly one of the eight ranks', ranking === 1, ranking + ' of ' + total);

  // And an unrecognised kind is not a race
  check('an unknown session kind does not rank',
    !mayRank({ kind: 'SOMETHING_NEW', previewSimplified: false, completed: true }));
  check('nor does a missing one',
    !mayRank({ kind: '', previewSimplified: false, completed: true }));
  check('and no facts at all rank nothing',
    !mayRank(null as any) && !mayRecord(null as any));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
