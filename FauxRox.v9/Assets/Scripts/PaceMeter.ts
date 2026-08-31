// ============================================================================
// PaceMeter.ts — the pace the athlete is running at, smoothed enough to read
// ============================================================================
// Frame-to-frame displacement is not pace. The path tracker credits movement
// once it exceeds eight centimetres, so a running athlete produces bursts
// rather than a steady trickle, and dividing one frame's metres by one
// frame's seconds gives a number that swings by minutes per kilometre several
// times a second. Shown on a panel it would be unreadable, and worse than
// unreadable - an athlete holding a steady pace would watch it flicker and
// conclude they were not.
//
// So this averages over a short window of running. Long enough to be stable,
// short enough to answer the question the athlete is asking, which is "am I
// running this right now" and not "what was my average".
//
// It says nothing until it has seen enough ground to be worth saying. Twenty
// metres of tracking noise divided by a few seconds is a pace, arithmetically,
// and it is not information.
//
// Only fed while the run's clock is running, so a stop freezes the reading
// rather than sending it to infinity. The caller already knows whether the
// athlete is moving - it is the same judgement the run clock makes - and
// having one answer to that question rather than two is the point.
//
// Pure: no Lens Studio imports.
// ============================================================================

/** Seconds of running averaged over. About a hundred metres at a jog. */
export const PACE_WINDOW_SECONDS = 20;

/**
 * Ground that must be covered before a pace is worth reporting.
 *
 * Below this the reading is dominated by the tracker's own resolution and by
 * the acceleration at the start of the run, and reporting it would be
 * reporting the equipment rather than the athlete.
 */
export const MIN_DISTANCE_FOR_PACE_METRES = 25;

interface Sample {
  metres: number;
  seconds: number;
}

export class PaceMeter {
  private _samples: Sample[] = [];
  private _metres: number = 0;
  private _seconds: number = 0;

  reset(): void {
    this._samples = [];
    this._metres = 0;
    this._seconds = 0;
  }

  /**
   * Add one frame of running.
   *
   * Call only while the athlete is moving. Frames spent standing still are
   * not slow running and averaging them in would report a pace nobody ran.
   */
  update(metresThisFrame: number, dt: number): void {
    if (dt <= 0) return;

    this._samples.push({ metres: metresThisFrame, seconds: dt });
    this._metres += metresThisFrame;
    this._seconds += dt;

    while (this._samples.length > 1 && this._seconds - this._samples[0].seconds >= PACE_WINDOW_SECONDS) {
      var oldest = this._samples.shift();
      this._metres -= oldest.metres;
      this._seconds -= oldest.seconds;
    }
  }

  /**
   * Seconds per kilometre over the window, or null when there is not enough
   * to say.
   *
   * Null rather than a large number: a run that has covered no ground has no
   * pace, and a caller that treated a missing pace as a slow one would tell
   * the athlete they were crawling when the truth is that we do not know yet.
   */
  get secPerKm(): number | null {
    if (this._metres < MIN_DISTANCE_FOR_PACE_METRES) return null;
    if (this._seconds <= 0) return null;

    return (this._seconds * 1000) / this._metres;
  }

  /** Metres in the window, for callers that want to know why there is no pace */
  get windowMetres(): number {
    return this._metres;
  }
}
