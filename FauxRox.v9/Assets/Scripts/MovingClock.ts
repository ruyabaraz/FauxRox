// ============================================================================
// MovingClock.ts — a run's clock counts running, not waiting
// ============================================================================
// A distance prescription stops on its own when the athlete stops: no ground
// covered, no progress. A time prescription has no such property, and read
// from the wall it counts standing still as training. Fifteen minutes easy
// with five minutes spent waiting at a crossing is a ten minute run, and the
// aerobic stimulus - which is the entire reason that session is written in
// minutes - is ten minutes' worth.
//
// So the clock counts moving time. This is what every running watch does and
// calls auto-pause, for exactly this reason, and athletes already expect it.
//
// The grace period is what makes it usable rather than twitchy. Movement
// arrives in bursts - the path tracker credits displacement from an anchor
// rather than every frame, and a slow runner produces frames with nothing in
// them - so a clock that stopped the instant a frame came up empty would
// stutter through an ordinary easy run.
//
// One thing this is deliberately NOT right for: an interval prescribed as
// four minutes at maximal aerobic effort. There, stopping ends the interval -
// pausing the clock would stitch two two-minute efforts into something that
// is not the session at all. When the archetypes arrive and one of them wants
// that, the prescription is where the choice belongs.
//
// Pure: no Lens Studio imports.
// ============================================================================

/**
 * How long the athlete must be still before the clock stops.
 *
 * Derived rather than picked. The path tracker credits displacement once it
 * exceeds eight centimetres, so the longest a genuinely moving athlete goes
 * without crediting anything is however long eight centimetres takes them:
 * 0.03s running, 0.06s walking, 0.20s at a shuffle slow enough that calling
 * it moving is already generous. Everything above that is margin.
 *
 * This was three seconds and the first person to use it said it noticed them
 * stopping two or three seconds late, which it did - the number was four
 * times what my own argument for it supported. The extra was doing a second
 * job I had not admitted to: forgiving a brief stop at a kerb. That is a
 * policy about what counts as training rather than a fact about the tracker,
 * and no coach would say the first three seconds of standing still are
 * running. It only has the one job now.
 */
export const STILL_GRACE_SECONDS = 0.75;

/** Metres in a frame below which nothing has happened */
export const MOVED_EPSILON_METRES = 0.001;

export class MovingClock {
  private _movingSeconds: number = 0;
  private _stillSeconds: number = 0;
  private _wasStopped: boolean = false;

  reset(): void {
    this._movingSeconds = 0;
    this._stillSeconds = 0;
    this._wasStopped = false;
  }

  /**
   * Advance the clock by one frame.
   *
   * @param metresThisFrame what the path tracker credited, already filtered
   * @param dt              seconds since the last frame
   * @returns true when the stopped/running state changed on this frame, so a
   *          caller can tell the athlete rather than leaving them to wonder
   *          why the number is not moving
   */
  update(metresThisFrame: number, dt: number): boolean {
    if (dt <= 0) return false;

    if (metresThisFrame > MOVED_EPSILON_METRES) {
      this._stillSeconds = 0;
    } else {
      this._stillSeconds += dt;
    }

    // The grace seconds are credited rather than withheld, so the clock never
    // jumps backwards when a stop is confirmed. Under a second, it is noise
    // either way.
    if (this._stillSeconds <= STILL_GRACE_SECONDS) {
      this._movingSeconds += dt;
    }

    var stopped = this.isStopped;
    var changed = stopped !== this._wasStopped;
    this._wasStopped = stopped;

    return changed;
  }

  /** Seconds of running, excluding time spent standing still */
  get movingSeconds(): number {
    return this._movingSeconds;
  }

  /** True once stillness has outlasted the grace period */
  get isStopped(): boolean {
    return this._stillSeconds > STILL_GRACE_SECONDS;
  }

  /** How long the athlete has been still, grace period included */
  get stillSeconds(): number {
    return this._stillSeconds;
  }
}
