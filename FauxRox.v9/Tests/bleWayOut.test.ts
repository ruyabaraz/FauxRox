// ============================================================================
// bleWayOut.test.ts — every screen has a way off it
// ============================================================================
// The heart-rate flow could strand somebody. Scan, find nothing, and what was
// left on screen was "No HR monitors found." above two buttons that are
// optional inputs — so in a scene where neither was wired there was no way
// forward and no way back, before the session had started.
//
// It is a runtime shell, so this reads it: the states somebody can be deeper
// than the question in must offer a way back, and the one screen whose
// buttons are not optional is the fallback when nothing else is wired.
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

const ROOT = path.join(__dirname, '..', '..', '..');
const UI = fs.readFileSync(
  path.join(ROOT, 'Assets', 'Scripts', 'BLEConnectionUI.ts'), 'utf8');

function member(signature: string): string {
  const start = UI.indexOf(signature);
  if (start < 0) return '';

  const end = UI.indexOf('\n  }', start);
  return end < 0 ? UI.substring(start) : UI.substring(start, end);
}

/** One case of the state switch, to the break that ends it */
function stateCase(state: string): string {
  const start = UI.indexOf('case BLEUIState.' + state + ':');
  if (start < 0) return '';

  const end = UI.indexOf('break;', start);
  return end < 0 ? '' : UI.substring(start, end);
}

describe('there is a way back, and it is not an answer', () => {
  check('the panel has a back button', UI.indexOf('backButton') > 0);

  // Skip and Cancel both mean "carry on without a monitor", which is an
  // answer to the question. Back returns to the question.
  const back = member('private onBackPressed');
  check('back returns to the prompt',
    back.indexOf('BLEUIState.PROMPT') > 0, back);
  check('and does not answer for them',
    back.indexOf('skipBLEConnection') < 0, back);

  // A scan still running behind the prompt would finish later and move the
  // panel underneath whoever is reading it.
  check('and stops the scan on the way', back.indexOf('stopScan') > 0, back);
});

describe('it is there while there is something to go back from', () => {
  check('during the scan',
    stateCase('SCANNING').indexOf('backButton') > 0, stateCase('SCANNING'));
  check('and on the device list',
    stateCase('DEVICE_LIST').indexOf('backButton') > 0, stateCase('DEVICE_LIST'));

  // And nowhere else: the prompt is what back goes back to.
  check('and not on the prompt itself',
    stateCase('PROMPT').indexOf('backButton') < 0, stateCase('PROMPT'));

  check('and every screen change puts it away first',
    member('private hideAll').indexOf('backButton') > 0);
});

describe('an unwired scene does not strand anybody', () => {
  const scan = member('private onScanComplete');

  check('finding nothing checks there is a way out',
    scan.indexOf('hasWayOut()') > 0, scan);
  check('and goes back to the question when there is not',
    scan.indexOf('BLEUIState.PROMPT') > 0, scan);
  check('and says why in the log', scan.indexOf('stranded') > 0);

  // The prompt is the fallback because its buttons are the only ones in this
  // panel that are not optional inputs.
  check('the prompt\'s own buttons are required',
    UI.indexOf('@input yesButton') > 0 && UI.indexOf('@input noButton') > 0);
  check('while every way out of the scan is optional',
    UI.indexOf('@allowUndefined backButton') > 0 &&
    UI.indexOf('@allowUndefined cancelButton') > 0 &&
    UI.indexOf('@allowUndefined rescanButton') > 0);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
