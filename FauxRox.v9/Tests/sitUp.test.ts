// ============================================================================
// sitUp.test.ts — a sit up is not a squat with the head lower
// ============================================================================
// It was counted by head travel, which is what a squat is counted by: down
// forty centimetres and back up. Both movements do that, so the station
// counted squats and called them sit ups.
//
// What separates them is not distance but direction. On your back the glasses
// look at the ceiling; at the top of a sit up they look across the room. A
// squat never does that - the head stays level all the way through.
//
// The counting itself lives in the state machine and cannot be unit tested.
// What can be is that the mode exists, that every place a mode has to be
// classified knows about it, and that the station uses it.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

import {
  StationMode,
  StationConfig,
  ACCESSORY_STATIONS,
  isStationary,
  needsHandTracking,
  stationWorkCostSeconds,
  snapRequirement,
} from '../Assets/Scripts/SessionTypes';

import { axisOf } from '../Assets/Scripts/TrainingAnalysis';

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

function accessory(name: string): StationConfig {
  for (const station of ACCESSORY_STATIONS as StationConfig[]) {
    if (station.name === name) return station;
  }
  return null;
}

describe('the sit up is counted by where the head looks', () => {
  const situp = accessory('SIT UP');
  check('the station is still there', situp !== null);
  check('and it is no longer counted like a squat',
    situp !== null && situp.mode === StationMode.PITCH_REPS, situp && situp.mode);

  // The one it was being confused with, still counted the way it should be.
  const squat = accessory('AIR SQUAT');
  check('a squat still is', squat !== null &&
    squat.mode === StationMode.VERTICAL_REPS);
  check('so they are no longer the same measurement',
    situp !== null && squat !== null && situp.mode !== squat.mode);
});

describe('every place a mode has to be classified knows it', () => {
  const situp: StationConfig = {
    name: 'SIT UP', mode: StationMode.PITCH_REPS, requirement: 25,
    instruction: 'x', prefabType: 'SIT_UP',
  };

  check('it happens on the spot', isStationary(situp));
  check('and cannot be done in front of a desk', needsHandTracking(situp));
  check('and it costs time like the repetitions it is',
    stationWorkCostSeconds(situp) > 0);
  check('and it is ranked by work rate, not duration',
    axisOf('PITCH_REPS') === 'WORK_RATE', axisOf('PITCH_REPS'));

  // A count of repetitions, so it lands on the grid a coach would say.
  check('and its requirement snaps like a rep count',
    snapRequirement(StationMode.PITCH_REPS, 23) ===
    snapRequirement(StationMode.REPS, 23));
});

describe('the state machine counts the crossing, not the hovering', () => {
  const ROOT = path.join(__dirname, '..', '..', '..');
  const MACHINE = fs.readFileSync(
    path.join(ROOT, 'Assets', 'Scripts', 'RaceStateMachine.ts'), 'utf8');

  const start = MACHINE.indexOf('private trackPitchReps');
  const body = start < 0 ? '' : MACHINE.substring(start, MACHINE.indexOf('\n  }', start));

  check('there is a tracker for it', body !== '');
  check('it reads the gaze rather than the height',
    body.indexOf('camTransform.back') > 0 && body.indexOf('gaze.y') > 0, body);

  // Two thresholds with a gap between them, or somebody hovering at the
  // crossing point scores ten repetitions without moving.
  check('and it uses two thresholds, not one',
    body.indexOf('situpLyingGaze') > 0 && body.indexOf('situpUpGaze') > 0);
  check('with the lying one above the sitting one',
    MACHINE.indexOf('situpLyingGaze: number = 0.6') > 0 &&
    MACHINE.indexOf('situpUpGaze: number = 0.25') > 0);

  // Tuned on the device, like every other detection threshold here.
  check('and both are inputs somebody can tune',
    MACHINE.indexOf('@input situpLyingGaze') > 0 &&
    MACHINE.indexOf('@input situpUpGaze') > 0);
  check('and the log says what it saw, so they can be',
    body.indexOf('gaze.y.toFixed') > 0);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
