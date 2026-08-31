// ============================================================================
// BirthYear.ts — reading a year out of whatever somebody typed
// ============================================================================
// The stepper this replaces could not produce a wrong answer: every press
// landed on a legal year. A text field can produce anything - an empty box
// mid-edit, "19", a pasted phone number, four digits that happen to be next
// year - and the difference between those matters, because one of them is
// somebody halfway through typing and the others are not.
//
// So parsing and committing are separate. While the athlete is typing, the
// field holds whatever they have typed and nothing is written anywhere. On
// confirmation the text is read once, and if it does not resolve to a year a
// person could have been born in, the profile keeps the value it already had.
// Nobody's birth year is overwritten by a half-finished one.
//
// Pure: no Lens Studio imports.
// ============================================================================

/**
 * The oldest and youngest athletes this is willing to believe in.
 *
 * Wide on purpose. The point is to catch a typo or a pasted phone number, not
 * to have an opinion about who is allowed to train - a hundred and five year
 * old with a pair of Spectacles has earned the benefit of the doubt.
 */
export const EARLIEST_BIRTH_YEAR = 1920;
export const LATEST_BIRTH_YEAR = 2015;

/**
 * A year from typed text, or null.
 *
 * Null covers three different situations that all mean the same thing here -
 * empty, incomplete, and nonsense - because the caller's response to each is
 * to leave what it already has alone.
 */
export function parseBirthYear(text: string): number | null {
  if (!text) return null;

  // Digits only, and only the ones that are there. A field that has had a
  // stray character typed into it should not silently become a different
  // year, so anything that is not a digit disqualifies the whole thing
  // rather than being stripped out.
  var trimmed = String(text).trim();
  if (trimmed.length !== 4) return null;

  for (var i = 0; i < trimmed.length; i++) {
    var code = trimmed.charCodeAt(i);
    if (code < 48 || code > 57) return null;
  }

  var year = parseInt(trimmed, 10);
  if (!isFinite(year)) return null;

  return isPlausibleBirthYear(year) ? year : null;
}

export function isPlausibleBirthYear(year: number): boolean {
  return typeof year === 'number' && isFinite(year) &&
         year >= EARLIEST_BIRTH_YEAR && year <= LATEST_BIRTH_YEAR;
}

/**
 * The year to save, given what was typed and what was already there.
 *
 * The whole rule in one place: a legible year replaces the old one, anything
 * else leaves it standing. Separated from the field so it can be checked
 * without a keyboard.
 */
export function commitBirthYear(typed: string, current: number): number {
  var parsed = parseBirthYear(typed);
  if (parsed !== null) return parsed;

  return isPlausibleBirthYear(current) ? current : EARLIEST_BIRTH_YEAR;
}
