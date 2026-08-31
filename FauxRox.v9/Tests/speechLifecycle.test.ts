// ============================================================================
// speechLifecycle.test.ts — the coach must not answer itself
// ============================================================================
// Reconstructed from the log, twice over.
//
// The coach heard its own voice:
//
//   User: How am I doing right now?
//   AI response complete
//   Starting continuous listening...
//   User: Great guest. This is a tough workout. Keep pushing.
//
// "Great, Guest" is the coach using the profile name it was given. Its reply
// came back through the microphone as a question.
//
// And it answered the same question twice:
//
//   User started speaking      <- once
//   User finished speaking     <- twice
//   Sending to Gemini...       <- twice
// ============================================================================

import {
  SpeechGate,
  OUTPUT_SAMPLE_RATE,
  OUTPUT_BYTES_PER_SECOND,
  REOPEN_COOLDOWN_SECONDS,
} from '../Assets/Scripts/SpeechLifecycle';

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

/** One second of the coach's voice, in bytes */
const ONE_SECOND = OUTPUT_BYTES_PER_SECOND;

// ── The arithmetic ──────────────────────────────────────────────────────────

describe('a byte count is a duration', () => {
  // The output track is started with play(-1), so isPlaying() is true from
  // initialisation onwards and can never say when the coach stops. The frame
  // is raw PCM16 at a known rate, so its length is arithmetic instead.
  check('the rate is the one the output is initialised at',
    OUTPUT_SAMPLE_RATE === 24000);
  check('PCM16 mono is two bytes a sample',
    OUTPUT_BYTES_PER_SECOND === OUTPUT_SAMPLE_RATE * 2);

  const gate = new SpeechGate();
  gate.queueAudio(ONE_SECOND, 100);
  check('one second of audio ends one second later',
    Math.abs(gate.reopensAt() - (101 + REOPEN_COOLDOWN_SECONDS)) < 1e-9,
    gate.reopensAt());
});

describe('frames queue behind each other, they do not replace each other', () => {
  // Frames arrive far faster than they play, so the queue is a backlog. If
  // each frame reset the deadline to "now plus this frame", a two-second
  // reply delivered in ten frames would look like it ends after the last
  // frame's length alone.
  const gate = new SpeechGate();

  gate.queueAudio(ONE_SECOND, 100);
  gate.queueAudio(ONE_SECOND, 100);
  gate.queueAudio(ONE_SECOND, 100.05);

  check('three seconds of audio takes three seconds',
    Math.abs(gate.reopensAt() - (103 + REOPEN_COOLDOWN_SECONDS)) < 1e-9,
    gate.reopensAt());

  // A frame arriving after the queue has drained starts from now, not from
  // the stale deadline
  gate.queueAudio(ONE_SECOND, 200);
  check('a later reply starts from when it arrives',
    Math.abs(gate.reopensAt() - (201 + REOPEN_COOLDOWN_SECONDS)) < 1e-9,
    gate.reopensAt());
});

// ── The loopback ────────────────────────────────────────────────────────────

describe('nothing is heard while the coach is talking', () => {
  const gate = new SpeechGate();
  gate.queueAudio(ONE_SECOND * 2, 100);   // a two-second reply

  check('not at the start',   gate.acceptsInput(100) === false);
  check('not in the middle',  gate.acceptsInput(101) === false);
  check('not on the last sample', gate.acceptsInput(102) === false);

  // The tail of the speaker and the room arrive slightly after the last
  // sample is handed over, so the cooldown counts as the coach too
  check('not during the cooldown', gate.acceptsInput(102.2) === false);
  check('and only afterwards',
    gate.acceptsInput(102 + REOPEN_COOLDOWN_SECONDS + 0.01) === true);

  check('the coach knows it is speaking', gate.isSpeaking(101) === true);
  check('and knows when it has stopped', gate.isSpeaking(102.5) === false);
});

describe('a fresh gate hears everything', () => {
  const gate = new SpeechGate();
  check('silence accepts input at once', gate.acceptsInput(0) === true);
  check('and is not speaking', gate.isSpeaking(0) === false);
  check('with no delay to wait out', gate.reopenDelay(0) === 0);
});

// ── Interruption ────────────────────────────────────────────────────────────

describe('a discarded queue is not still playing', () => {
  // The athlete mutes, or the coach is cut off. Without shortening the
  // deadline the gate counts down audio that will never be heard, and the
  // coach stays deaf for the length of a sentence nobody heard.
  const gate = new SpeechGate();
  gate.queueAudio(ONE_SECOND * 5, 100);

  check('five seconds are queued', gate.acceptsInput(103) === false);

  gate.interrupt(101);

  check('interrupting ends it there', gate.isSpeaking(101) === false);
  check('and the wait is only the cooldown',
    Math.abs(gate.reopenDelay(101) - REOPEN_COOLDOWN_SECONDS) < 1e-9,
    gate.reopenDelay(101));
  check('so input is accepted again shortly after',
    gate.acceptsInput(101 + REOPEN_COOLDOWN_SECONDS + 0.01) === true);

  // Interrupting silence must not push the deadline forward
  const quiet = new SpeechGate();
  quiet.interrupt(500);
  check('interrupting silence changes nothing',
    quiet.isSpeaking(500) === false);
});

describe('the delay to wait is never negative', () => {
  const gate = new SpeechGate();
  gate.queueAudio(ONE_SECOND, 100);
  check('long after the reply, no wait at all', gate.reopenDelay(500) === 0);
});

// ── Turns ───────────────────────────────────────────────────────────────────

describe('one listening session answers exactly once', () => {
  const gate = new SpeechGate();
  gate.openTurn();

  check('the first final is answered', gate.claimFinal() === true);

  // The reported bug: stopTranscribing() delivers one more final event, and
  // the same utterance reached Gemini twice.
  check('the second is not', gate.claimFinal() === false);
  check('nor the third', gate.claimFinal() === false);
  check('and the turn knows it is spent', gate.isTurnAnswered === true);
});

describe('the next listening session gets its own answer', () => {
  const gate = new SpeechGate();

  gate.openTurn();
  check('turn one answers', gate.claimFinal() === true);
  check('and stops there', gate.claimFinal() === false);

  gate.openTurn();
  check('turn two answers', gate.claimFinal() === true);
  check('and stops there too', gate.claimFinal() === false);

  gate.openTurn();
  check('turn three answers', gate.claimFinal() === true);
});

describe('an utterance too short to raise a start is still answered', () => {
  // The turn belongs to the ASR session, not to the athlete starting to
  // speak. A one-word reply can arrive as a single final with no preceding
  // partial, and a turn opened on the start event would throw it away.
  const gate = new SpeechGate();
  gate.openTurn();

  check('a lone final is answered', gate.claimFinal() === true);
});

describe('an orphan final belonging to no open turn is dropped', () => {
  const gate = new SpeechGate();

  gate.openTurn();
  gate.claimFinal();

  // The listening session is over; a final arriving now belongs to a turn
  // that has already been answered
  check('a late final after the answer is dropped', gate.claimFinal() === false);
});

// ── Switching the coach off ─────────────────────────────────────────────────

describe('turning the coach off leaves no stale deadline', () => {
  const gate = new SpeechGate();
  gate.openTurn();
  gate.queueAudio(ONE_SECOND * 10, 100);

  gate.reset();

  check('the queue is forgotten', gate.isSpeaking(101) === false);
  check('the open turn is closed', gate.isTurnAnswered === true);
  check('so nothing left over answers', gate.claimFinal() === false);

  // And switching back on works from a clean slate
  gate.openTurn();
  check('a new session answers again', gate.claimFinal() === true);
});

// ── The two rules are independent ───────────────────────────────────────────

describe('the gate and the turn do not interfere', () => {
  const gate = new SpeechGate();

  gate.openTurn();
  gate.queueAudio(ONE_SECOND, 100);

  // Being deaf is about the speaker; having answered is about the turn
  check('deaf but unanswered', gate.acceptsInput(100) === false &&
                               gate.isTurnAnswered === false);

  gate.claimFinal();
  check('answered does not reopen the ear', gate.acceptsInput(100) === false);

  gate.openTurn();
  check('a new turn does not reopen the ear either',
    gate.acceptsInput(100) === false);
  check('but it can be answered',
    gate.isTurnAnswered === false);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
