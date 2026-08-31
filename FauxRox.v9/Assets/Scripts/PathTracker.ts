// ============================================================================
// PathTracker.ts — how far the athlete actually went
// ============================================================================
// Distance is measured by adding up how far the camera moved between frames.
// That works, and it is what makes a carry shuttled across a room still count
// as the full carry - but on its own it believes everything the tracker says,
// including the things tracking gets wrong.
//
// Three of those, and each inflates the number in the athlete's favour:
//
//   jitter        A head is never still. Sub-centimetre noise, added up sixty
//                 times a second, walks a standing athlete across a room.
//
//   reacquisition When tracking is lost and found again, the camera reappears
//                 wherever it now is. The jump between the two is not
//                 distance covered; it is the gap in the record.
//
//   teleport      A relocalisation can move the origin by metres in one
//                 frame. Nobody covers four metres in sixteen milliseconds.
//
// The fix for jitter cannot be a per-frame dead zone. A slow walk is about a
// centimetre per frame, which is the same size as the noise, so a threshold
// large enough to reject one rejects the other - and the athlete carrying
// something heavy, walking slowly because it is heavy, gets no credit at all.
//
// So the threshold is on displacement from an anchor rather than on the
// frame. Noise oscillates around a point and never leaves it; walking leaves
// it, and when it does the whole distance is credited and the anchor moves
// up. Slow movement is not lost, only delayed by a few centimetres.
//
// Pure: no Lens Studio imports.
// ============================================================================

/**
 * Centimetres the athlete must move from the anchor before it counts.
 *
 * Above head-tracking noise, below a stride. Small enough that a slow loaded
 * walk still registers within a step.
 */
export const MOVEMENT_THRESHOLD_CM = 8;

/**
 * Fastest anyone travels, metres per second.
 *
 * Sprint speed with room to spare. Anything above this in a single frame is
 * the tracker moving, not the athlete.
 */
export const MAX_PLAUSIBLE_SPEED_MS = 10;

export interface PathSample {
  x: number;
  z: number;
  /** Seconds since the previous sample */
  dt: number;
  /** False when head tracking is lost or the pose is not to be trusted */
  valid: boolean;
}

export class PathTracker {
  private anchorX: number = 0;
  private anchorZ: number = 0;
  private anchored: boolean = false;

  /** Metres credited so far */
  private travelled: number = 0;

  /** Samples rejected as implausible, for the log */
  private rejected: number = 0;

  get metres(): number { return this.travelled; }
  get rejectedSamples(): number { return this.rejected; }

  /**
   * Start again from nothing.
   *
   * Called when a station begins. The anchor is not set here: the first valid
   * sample sets it, so a station that starts during a tracking dropout does
   * not anchor to a position nobody was at.
   */
  reset(): void {
    this.anchored = false;
    this.travelled = 0;
    this.rejected = 0;
  }

  /**
   * Take a sample and return the metres it added.
   *
   * Returns zero for anything not credited - noise inside the threshold, an
   * invalid pose, or a jump too fast to be a person.
   */
  update(sample: PathSample): number {
    // Tracking is gone. Drop the anchor rather than freezing it: when the
    // pose comes back it will be wherever the athlete now is, and the gap
    // between the two is missing record, not distance covered.
    if (!sample.valid) {
      this.anchored = false;
      return 0;
    }

    if (!this.anchored) {
      this.anchorX = sample.x;
      this.anchorZ = sample.z;
      this.anchored = true;
      return 0;
    }

    var dx = sample.x - this.anchorX;
    var dz = sample.z - this.anchorZ;
    var cm = Math.sqrt(dx * dx + dz * dz);

    // Still inside the noise. Keep the anchor where it is - this is the whole
    // point: a head shaking in place never leaves the circle, and a slow walk
    // leaves it a step later than a fast one but leaves it just the same.
    if (cm < MOVEMENT_THRESHOLD_CM) return 0;

    // Too fast to be a person. Re-anchor without crediting: the athlete is
    // wherever the tracker now says, but they did not travel there.
    var seconds = sample.dt > 0 ? sample.dt : 1 / 60;
    if ((cm / 100) / seconds > MAX_PLAUSIBLE_SPEED_MS) {
      this.anchorX = sample.x;
      this.anchorZ = sample.z;
      this.rejected++;
      return 0;
    }

    this.anchorX = sample.x;
    this.anchorZ = sample.z;

    var metres = cm / 100;
    this.travelled += metres;
    return metres;
  }
}
