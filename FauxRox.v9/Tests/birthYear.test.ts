// ============================================================================
// birthYear.test.ts — a half-typed year is not a year
// ============================================================================

import {
  parseBirthYear,
  isPlausibleBirthYear,
  commitBirthYear,
  EARLIEST_BIRTH_YEAR,
  LATEST_BIRTH_YEAR,
} from '../Assets/Scripts/BirthYear';

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

describe('a year is four digits and a person could have been born in it', () => {
  check('1978 is a year', parseBirthYear('1978') === 1978);
  check('and so is the earliest allowed',
    parseBirthYear(String(EARLIEST_BIRTH_YEAR)) === EARLIEST_BIRTH_YEAR);
  check('and the latest', parseBirthYear(String(LATEST_BIRTH_YEAR)) === LATEST_BIRTH_YEAR);
  check('spaces around it are fine', parseBirthYear('  1990 ') === 1990);

  // The half-typed states. Somebody reaching 1978 passes through all of
  // these, and none of them is a birth year.
  check('nothing is not a year', parseBirthYear('') === null);
  check('one digit is not', parseBirthYear('1') === null);
  check('two are not', parseBirthYear('19') === null);
  check('three are not', parseBirthYear('197') === null);

  check('nor is a year nobody could be born in', parseBirthYear('1066') === null);
  check('nor one in the future', parseBirthYear('2099') === null);
  check('nor five digits', parseBirthYear('19780') === null);

  // Anything that is not a digit disqualifies the whole field rather than
  // being stripped out - a stray character should not quietly become a
  // different year.
  check('a stray character is not silently removed', parseBirthYear('19x8') === null);
  check('nor a minus sign', parseBirthYear('-978') === null);
  check('a pasted phone number is not a year', parseBirthYear('5551234') === null);

  check('the range is wide on purpose',
    isPlausibleBirthYear(1925) && isPlausibleBirthYear(2010) &&
    !isPlausibleBirthYear(1900));
});

describe('an unreadable field never overwrites a saved year', () => {
  // The whole reason the stepper could be replaced safely. Somebody who
  // already has 1978 on their profile and taps confirm with an empty field
  // keeps 1978.
  check('empty leaves the stored year', commitBirthYear('', 1978) === 1978);
  check('half-typed leaves it too', commitBirthYear('19', 1978) === 1978);
  check('nonsense leaves it', commitBirthYear('abcd', 1978) === 1978);
  check('and an impossible year leaves it', commitBirthYear('3000', 1978) === 1978);

  check('a real year replaces it', commitBirthYear('1990', 1978) === 1990);

  // A profile that somehow holds nothing usable still comes out with
  // something a person could have been born in.
  check('a corrupt stored year cannot survive either',
    isPlausibleBirthYear(commitBirthYear('', 0)));
  check('nor an impossible one',
    isPlausibleBirthYear(commitBirthYear('nope', 99999)));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
