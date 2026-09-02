// ============================================================================
// PaceCoaching.ts — when to say something about the pace, and when to shut up
// ============================================================================
// A band on the panel tells somebody where they should be. It does not tell
// them they have drifted out of it, because reading a number while running is
// exactly what a voice is for.
//
// The whole difficulty is restraint. Pace measured over a rolling window
// wobbles by a few seconds a kilometre the entire time, and a coach that
// remarks on every wobble is one the athlete stops hearing by the second
// repetition. So: a drift big enough to be a decision rather than noise, one
// call at a time, a cooldown before the same call again, and one word when
// they come back.
//
// Pure: no Lens Studio imports. What comes out is which of four things is
// worth saying; who says it and how is somebody else's problem.
// ============================================================================

import { PaceBand, driftFromBand } from './PaceTarget';

export type PaceCall = 'EASE_OFF' | 'PICK_IT_UP' | 'ON_PACE' | 'NOTHING';

/**
 * Seconds per kilometre outside the band before it is worth a word.
 *
 * The band is already a range, so this is drift beyond a range that was drawn
 * wide on purpose. Eight seconds a kilometre is about two seconds per four
 * hundred metres: past the point where somebody is holding their pace badly
 * and into the point where they are running a different one.
 */
export const PACE_DRIFT_WORTH_SAYING = 8;

/**
 * How long before the same correction may be repeated.
 *
 * Long enough for the athlete to have acted on it and for the rolling window
 * to have noticed - the window is twenty seconds, so anything shorter would
 * be the coach arguing with a number that has not caught up yet.
 */
export const PACE_CUE_COOLDOWN_SECONDS = 30;

/**
 * Whether coming back into the band is worth acknowledging.
 *
 * Once, and only after a correction. "That's it" after being told to ease off
 * is the other half of the instruction; said on its own it is chatter.
 */
export const CONFIRM_RETURN_TO_BAND = true;

export class PaceCoach {

  /** The last correction given, or '' - not counting the confirmation */
  private _lastCall: PaceCall = 'NOTHING';
  private _lastCallAt: number = 0;
  private _correctionStanding: boolean = false;

  reset(): void {
    this._lastCall = 'NOTHING';
    this._lastCallAt = 0;
    this._correctionStanding = false;
  }

  /**
   * What is worth saying right now.
   *
   * @param secPerKm  the athlete's pace, or null while there is not enough
   *                  running yet to have one
   * @param band      what they were asked for, or null when nothing was
   * @param nowSeconds any clock that moves forward
   */
  update(
    secPerKm: number | null,
    band: PaceBand | null,
    nowSeconds: number
  ): PaceCall {
    // No target, or nothing measured yet. Both are ordinary and neither is
    // something to talk about: a pace nobody was given cannot be missed.
    if (!band || secPerKm === null || !(secPerKm > 0)) return 'NOTHING';

    var drift = driftFromBand(secPerKm, band);

    if (Math.abs(drift) < PACE_DRIFT_WORTH_SAYING) {
      return this.backInside();
    }

    // Positive drift is slower than asked for; pace runs backwards.
    var call: PaceCall = drift > 0 ? 'PICK_IT_UP' : 'EASE_OFF';

    // The same thing again, too soon. They heard it; what they need is time
    // to do something about it, not the sentence twice.
    if (call === this._lastCall &&
        nowSeconds - this._lastCallAt < PACE_CUE_COOLDOWN_SECONDS) {
      return 'NOTHING';
    }

    // Drifting the other way is new information even inside the cooldown -
    // somebody told to pick it up who is now well over the top has done
    // something the first call did not cover.
    this._lastCall = call;
    this._lastCallAt = nowSeconds;
    this._correctionStanding = true;

    return call;
  }

  /** Back where they were asked to be, said once and only after a correction */
  private backInside(): PaceCall {
    if (!this._correctionStanding) return 'NOTHING';

    this._correctionStanding = false;
    this._lastCall = 'NOTHING';

    return CONFIRM_RETURN_TO_BAND ? 'ON_PACE' : 'NOTHING';
  }

  /** Whether a correction is currently outstanding, for anything that asks */
  get correcting(): boolean {
    return this._correctionStanding;
  }
}

/**
 * What the coach should be told to say.
 *
 * Not the sentence itself - the coach says it in its own voice, in the
 * athlete's language, with whatever it knows about them. This is the
 * instruction and the reason, and the reason is a measurement rather than a
 * judgement: they are running eleven seconds a kilometre slow, not badly.
 */
export function paceCueContext(
  call: PaceCall,
  secPerKm: number,
  band: PaceBand
): string {
  if (call === 'NOTHING' || !band) return '';

  var drift = Math.round(Math.abs(driftFromBand(secPerKm, band)));

  switch (call) {
    case 'PICK_IT_UP':
      return 'The athlete is running ' + drift + ' seconds per kilometre ' +
             'slower than the pace this repetition was prescribed at. Tell ' +
             'them to pick it up, in four words or fewer. No numbers.';

    case 'EASE_OFF':
      return 'The athlete is running ' + drift + ' seconds per kilometre ' +
             'faster than the pace this repetition was prescribed at, which ' +
             'costs them the rest of the session. Tell them to ease off, in ' +
             'four words or fewer. No numbers.';

    case 'ON_PACE':
      return 'The athlete has come back into the prescribed pace band after ' +
             'a correction. Tell them that in two or three words, once.';

    default:
      return '';
  }
}

/** The same thing on the panel, for somebody who has the sound off */
export function paceCueLine(call: PaceCall): string {
  switch (call) {
    case 'PICK_IT_UP': return 'PICK IT UP';
    case 'EASE_OFF':   return 'EASE OFF';
    case 'ON_PACE':    return 'ON PACE';
    default:           return '';
  }
}
