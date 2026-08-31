// ============================================================================
// SpeechLifecycle.ts — who is allowed to be talking, and when
// ============================================================================
// The coach was hearing itself. From the log:
//
//   User: How am I doing right now?
//   AI response complete
//   Starting continuous listening...
//   User: Great guest. This is a tough workout. Keep pushing.
//
// "Great, Guest" is the coach addressing the athlete by the profile name it
// was given. Its own reply came back through the microphone, was transcribed
// as the athlete, cut off its own audio mid-sentence, and was sent to the
// model as a new question.
//
// Two independent faults, and this module holds the rule for each.
//
// ── The gate ────────────────────────────────────────────────────────────────
//
// Listening reopened on turnComplete, which is the model finishing
// GENERATION. The audio it generated is still in the output queue and still
// playing, for seconds. So the microphone opened into the middle of the
// coach's own sentence.
//
// There is no callback for "playback finished" - and isPlaying() cannot
// stand in for one, because the output component is started with play(-1) and
// therefore reports true from initialisation onwards. But the length is
// arithmetic: every frame is raw PCM16 at a known rate, so a byte count is a
// duration, and the queue's end is knowable exactly.
//
// This deliberately gives up true barge-in. While the coach is speaking, the
// athlete cannot interrupt it by voice - in the editor there is no echo
// cancellation between the speaker and the microphone, so a real interruption
// and the coach's own voice are the same signal and cannot be told apart. A
// coach that argues with itself is far worse than one that finishes its
// sentence first, and the athlete still has the coach toggle and the wrist
// STOP button, neither of which goes through the microphone.
//
// ── The turn ────────────────────────────────────────────────────────────────
//
// The same utterance was sent twice:
//
//   User started speaking          <- once
//   User finished speaking         <- twice, no second start
//   User: Can you stop the race? ...
//   Sending to Gemini...
//   User: Can you stop the race? ...
//   Sending to Gemini...
//
// One start, two finals, identical text. Nothing recorded that a turn had
// already been answered, so a second final for the same turn went straight
// through.
//
// Pure: no Lens Studio imports, so it can be tested outside the editor.
// ============================================================================

/**
 * The rate the output track is initialised at.
 *
 * The one place this number lives. AICoach passes it to
 * DynamicAudioOutput.initialize, and the queue arithmetic below reads the
 * same constant - so the two cannot drift into disagreeing about how long a
 * given number of bytes takes to play.
 */
export const OUTPUT_SAMPLE_RATE = 24000;

/** PCM16 is two bytes a sample; the model returns mono */
export const OUTPUT_BYTES_PER_SECOND = OUTPUT_SAMPLE_RATE * 2 * 1;

/**
 * Silence after the coach stops before the microphone reopens.
 *
 * Covers the tail of the speaker and the room, which arrive slightly after
 * the last sample is handed to the audio component.
 */
export const REOPEN_COOLDOWN_SECONDS = 0.4;

/** The coach has not spoken at all, so it finished speaking long ago */
const NEVER_SPOKE = Number.NEGATIVE_INFINITY;

export class SpeechGate {

  /**
   * When the queued audio will have finished playing, in getTime() seconds.
   *
   * Starts in the infinite past rather than at zero: a coach that has not
   * spoken yet stopped speaking infinitely long ago, and is listening. Zero
   * would have meant deaf for the first fraction of a second of the Lens,
   * which is exactly when the athlete is most likely to say something.
   */
  private speechEndsAt: number = NEVER_SPOKE;

  /** The listening session currently open; each one answers at most once */
  private turnId: number = 0;
  private answeredTurn: number = -1;

  // ── Output ────────────────────────────────────────────────────────────────

  /**
   * A frame of the coach's voice has been queued.
   *
   * Extends the deadline rather than replacing it: frames arrive faster than
   * they play, so the queue is a backlog and each one lands after the last.
   */
  queueAudio(byteLength: number, now: number): void {
    var seconds = byteLength / OUTPUT_BYTES_PER_SECOND;
    var from = Math.max(now, this.speechEndsAt);

    this.speechEndsAt = from + seconds;
  }

  /**
   * The queue was thrown away - the athlete muted, or the coach was cut off.
   *
   * Without this the gate keeps counting down audio that will never play, and
   * the coach stays deaf for the length of a sentence nobody heard.
   */
  interrupt(now: number): void {
    this.speechEndsAt = Math.min(this.speechEndsAt, now);
  }

  /** True while the coach's own voice is still in the room */
  isSpeaking(now: number): boolean {
    return now < this.speechEndsAt;
  }

  /** When the microphone may reopen */
  reopensAt(): number {
    return this.speechEndsAt + REOPEN_COOLDOWN_SECONDS;
  }

  /** Seconds to wait before reopening, never negative */
  reopenDelay(now: number): number {
    return Math.max(0, this.reopensAt() - now);
  }

  /**
   * Whether a transcription may be treated as the athlete.
   *
   * The cooldown counts here too: a syllable arriving 100ms after the last
   * sample is the tail of the coach, not a new question.
   */
  acceptsInput(now: number): boolean {
    return now >= this.reopensAt();
  }

  // ── Turns ─────────────────────────────────────────────────────────────────

  /**
   * A listening session has opened.
   *
   * The turn belongs to the ASR session rather than to the athlete starting
   * to speak. An utterance short enough to arrive as a single final event
   * never raises a start, and tying the turn to the start would drop it.
   */
  openTurn(): number {
    this.turnId++;
    return this.turnId;
  }

  /**
   * Claim this turn's one answer.
   *
   * Returns true exactly once per open turn. The caller must call this
   * BEFORE stopping transcription: stopping can itself deliver a last final
   * event, and a guard set afterwards is set too late to stop it.
   */
  claimFinal(): boolean {
    if (this.turnId === this.answeredTurn) return false;

    this.answeredTurn = this.turnId;
    return true;
  }

  /** True when this turn has already been answered */
  get isTurnAnswered(): boolean {
    return this.turnId === this.answeredTurn;
  }

  get currentTurn(): number {
    return this.turnId;
  }

  /** Back to silence - the coach was switched off */
  reset(): void {
    this.speechEndsAt = NEVER_SPOKE;
    this.answeredTurn = this.turnId;
  }
}
