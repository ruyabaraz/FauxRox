// ============================================================================
// noLegacyRunning.test.ts — the old running grammar is gone, and stays gone
// ============================================================================
// Removing dead code is easy; keeping it removed is not. The old running
// grammar left a shape behind that is easy to reach for again - a table of
// interval geometries, a single recovery band for all of running, a fallback
// that answered an illegal request with something else - and each of those
// went on working while being wrong, which is why they lasted.
//
// So this reads the source. Not a substitute for the behavioural tests, which
// say what the archetypes do; this says what may not come back.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

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

// Compiled to Tests/out/Tests, so the project root is three levels up. The
// source is read rather than the build output: what is being forbidden is a
// shape somebody might type, and the build would only show what survived it.
const ROOT = path.join(__dirname, '..', '..', '..');
const SOURCES = [
  path.join(ROOT, 'Assets', 'Scripts'),
  path.join(ROOT, 'Tests'),
];

function everySourceFile(): { file: string, text: string }[] {
  const out: { file: string, text: string }[] = [];

  for (const dir of SOURCES) {
    if (!fs.existsSync(dir)) continue;

    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.ts')) continue;
      // This file names the things it is forbidding, and would fail itself.
      if (name === 'noLegacyRunning.test.ts') continue;

      out.push({
        file: path.basename(dir) + '/' + name,
        text: fs.readFileSync(path.join(dir, name), 'utf8'),
      });
    }
  }

  return out;
}

const FILES = everySourceFile();

/** Everywhere a token appears, outside comments */
function referencesTo(token: string): string[] {
  const out: string[] = [];

  for (const { file, text } of FILES) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const code = line.replace(/^\s*(\/\/|\*|\/\*).*$/, '');
      if (code.indexOf(token) >= 0) out.push(file + ':' + (i + 1));
    }
  }

  return out;
}

describe('there is source to read', () => {
  check('the sweep found the scripts', FILES.length > 20, FILES.length + ' files');
  check('and it can see a token that does exist',
    referencesTo('buildArchetypeBlocks').length > 0);
});

describe('the old running grammar leaves nothing behind', () => {
  // A table of interval geometries per tier. Four entries that were four
  // arrangements of one session, which is the thing the archetypes replaced.
  check('RUNNING_SHAPES is gone', referencesTo('RUNNING_SHAPES').length === 0,
    referencesTo('RUNNING_SHAPES').join(', '));

  check('and so is the shape it was made of',
    referencesTo('IntervalShape').length === 0,
    referencesTo('IntervalShape').join(', '));

  // One band for every kind of running. Right for one archetype of five, and
  // wrong by a factor of six for threshold, whose float it repriced as an
  // ordinary break - turning the session into a different one silently.
  check('running no longer has a single recovery band',
    referencesTo("RECOVERY_POLICY.RUNNING").length === 0 &&
    referencesTo("RECOVERY_POLICY['RUNNING']").length === 0);

  check('nor a function to apply it',
    referencesTo('runRecoverySeconds').length === 0,
    referencesTo('runRecoverySeconds').join(', '));
});

describe('the rule about space lives in one place', () => {
  const rule = referencesTo("space === 'SMALL' && focus === 'RUNNING'");

  // It was written twice: once in the picker, which hid the button, and
  // nowhere in the generator, which built something anyway. A rule only the
  // picker knows is a rule the generator can be asked to break.
  check('the small-room running rule is written once',
    rule.length === 1, rule.join(', '));

  check('and it is in the generator', rule.length === 1 &&
    rule[0].indexOf('AdaptiveSessionGenerator') >= 0, rule[0]);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
