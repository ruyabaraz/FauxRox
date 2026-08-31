// ============================================================================
// blockIntro.test.ts — what is coming, said once, before it starts
// ============================================================================
// The movement list used to sit in the middle of the view for as long as the
// block lasted. The content was right and the timing was wrong: an athlete
// needs to know what a set holds before it begins, and after that they need
// the space, because what is in front of them is a room they are moving
// through.
//
// So what is tested here is mostly what the card says and how briefly.
// ============================================================================

import {
  blockIntroCard,
  blockName,
  blockEyebrow,
  blockLines,
  workingPositionOf,
  introEyebrow,
  introMoves,
  introFooter,
  introCue,
  introBody,
  introOpacity,
  worthIntroducing,
  blockMinutes,
  BLOCK_INTRO_SECONDS,
  BLOCK_INTRO_FADE_SECONDS,
  MAX_INTRO_MOVES,
} from '../Assets/Scripts/BlockIntro';

import {
  SessionBlock,
  StationConfig,
  StationMode,
  BlockScheme,
  distanceRun,
  timedRun,
  makeRecoveryStation,
} from '../Assets/Scripts/SessionTypes';

import { RUNNING_TOPOLOGY } from '../Assets/Scripts/RunningArchetype';

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

function move(name: string, mode = StationMode.REPS, requirement = 12): StationConfig {
  return {
    name: name, mode: mode, requirement: requirement,
    instruction: 'do it', prefabType: name.replace(/ /g, '_'),
  };
}

function block(fields: Partial<SessionBlock>): SessionBlock {
  const base: SessionBlock = {
    label: '', scheme: BlockScheme.STRAIGHT, rounds: 1,
    items: [], restSeconds: 0, roundScales: [1],
  };

  for (const key in fields) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      (base as any)[key] = (fields as any)[key];
    }
  }

  return base;
}

const WARMUP = block({
  scheme: BlockScheme.WARMUP,
  items: [move("WORLD'S GREATEST STRETCH", StationMode.TIMED, 30),
          move('HIGH KNEE RUNS', StationMode.TIMED, 30),
          move('DYNAMIC QUAD STRETCH', StationMode.TIMED, 30)],
});

const STRENGTH = block({
  rounds: 4,
  items: [move('DB FRONT SQUAT'), move('FARMER CARRY', StationMode.DISTANCE, 40),
          move('WALL SIT', StationMode.TIMED, 45)],
});

const THRESHOLD = block({
  rounds: 5,
  archetype: 'THRESHOLD',
  run: distanceRun(1000),
  items: [makeRecoveryStation(45, 'REGULAR', 'FLOAT_JOG')],
});

const EASY = block({
  rounds: 1,
  archetype: 'EASY_BASE',
  run: timedRun(1500),
  items: [],
});

describe('the card says what the block is', () => {
  check('a warm-up is a warm-up', blockName(WARMUP) === 'WARM-UP');
  check('and an archetype is called what the athlete chose',
    blockName(THRESHOLD) === 'THRESHOLD' && blockName(EASY) === 'EASY RUN');
  check('a finisher is a finisher',
    blockName(block({ scheme: BlockScheme.EMOM, rounds: 8 })) === 'FINISHER');

  // "WORK" is not a name, and a made-up one reads as a category the athlete
  // should recognise. The block number carries it instead.
  check('a plain block of work is not given a name', blockName(STRENGTH) === '');
  check('and its heading is the number', introEyebrow(STRENGTH, 1, 4) === 'BLOCK 2/4');
  check('while a named one has both',
    introEyebrow(THRESHOLD, 0, 4) === 'THRESHOLD · BLOCK 1/4',
    introEyebrow(THRESHOLD, 0, 4));

  // The line that stays up during the work is the short one.
  check('the line during the work drops the word BLOCK',
    blockEyebrow(THRESHOLD, 0, 4) === 'THRESHOLD · 1/4',
    blockEyebrow(THRESHOLD, 0, 4));
  check('and a session of one block does not number it',
    blockEyebrow(THRESHOLD, 0, 1) === 'THRESHOLD', blockEyebrow(THRESHOLD, 0, 1));
});

describe('the movements, in the order they are done', () => {
  const moves = introMoves(WARMUP);
  check('all three of them', moves.length === 3, moves.join(' | '));
  check('in order, in capitals',
    moves[0] === "WORLD'S GREATEST STRETCH" && moves[2] === 'DYNAMIC QUAD STRETCH');

  // A run IS the block. A card listing only the walk between repetitions
  // would be describing the rest.
  const running = introMoves(THRESHOLD);
  check('a run is one of them', running[0] === '1000M RUN', running.join(' | '));
  check('and the recovery is not', running.indexOf('FLOAT') < 0, running.join(' | '));

  check('a timed run reads as a clock',
    introMoves(EASY)[0] === '25:00 RUN', introMoves(EASY)[0]);

  // A round repeats its movements; the card lists the round.
  const repeated = block({ rounds: 3, items: [move('BURPEE'), move('BURPEE')] });
  check('a movement done twice is listed once',
    introMoves(repeated).length === 1);

  const many: StationConfig[] = [];
  for (let i = 0; i < MAX_INTRO_MOVES + 4; i++) many.push(move('MOVE ' + i));
  check('and a card nobody could read is cut short',
    introMoves(block({ items: many })).length === MAX_INTRO_MOVES);
});

describe('how much of it there is', () => {
  const strength = introFooter(STRENGTH);
  check('a set says how many times round',
    strength.indexOf('4 ROUNDS') === 0, strength);
  check('and roughly how long it takes', strength.indexOf('MIN') > 0, strength);

  // "3 MOVES" under three movements is the card reading itself back.
  check('and does not count the list printed above it',
    strength.indexOf('MOVES') < 0 && introFooter(WARMUP).indexOf('MOVES') < 0,
    introFooter(WARMUP));

  // One round is not "1 ROUNDS".
  const single = introFooter(block({ rounds: 1, items: [move('PLANK', StationMode.TIMED, 60)] }));
  check('nothing is counted that does not need counting',
    single.indexOf('ROUNDS') < 0, single);

  check('a block takes a number of minutes', blockMinutes(STRENGTH) > 0,
    blockMinutes(STRENGTH));
  check('and nothing takes none', blockMinutes(null) === 0);
});

describe('what to have in mind while doing it', () => {
  // A running block says how it should feel, because that is the whole
  // prescription when there is no pace target.
  check('a threshold block says how it should feel',
    introCue(THRESHOLD) === RUNNING_TOPOLOGY.THRESHOLD.effortShort, introCue(THRESHOLD));
  check('and an easy run says its own thing',
    introCue(EASY) === RUNNING_TOPOLOGY.EASY_BASE.effortShort);

  check('and everything else says the only thing that is true of all of them',
    introCue(WARMUP) === 'Get ready' && introCue(STRENGTH) === 'Get ready');
});

describe('a card is worth stopping for, or it is not shown', () => {
  const card = blockIntroCard(WARMUP, 0, 4);
  check('a real block is worth it', worthIntroducing(card));
  check('and its body is one movement per line',
    introBody(card).split('\n').length === 3, introBody(card));

  // A card that appears for everything is one nobody reads by the third time.
  check('an empty block is not', !worthIntroducing(blockIntroCard(block({}), 0, 1)));
  check('and neither is nothing at all', !worthIntroducing(null));

  const lone = blockIntroCard(block({ items: [move('SLED PUSH', StationMode.DISTANCE, 20)] }), 0, 1);
  check('one unnamed movement in a session of one block is not either',
    !worthIntroducing(lone), lone.eyebrow + ' / ' + lone.moves.join(''));
  check('but the same movement as block three of five is',
    worthIntroducing(blockIntroCard(
      block({ items: [move('SLED PUSH', StationMode.DISTANCE, 20)] }), 2, 5)));
});

describe('it leaves rather than blinking out', () => {
  check('it is there when it goes up', introOpacity(0) === 1);
  check('and still there while it is being read',
    introOpacity(BLOCK_INTRO_SECONDS - BLOCK_INTRO_FADE_SECONDS) === 1);

  const midFade = introOpacity(BLOCK_INTRO_SECONDS - BLOCK_INTRO_FADE_SECONDS / 2);
  check('then half gone half way through the fade',
    Math.abs(midFade - 0.5) < 0.001, midFade);

  // Zero means gone, so the panel can stop drawing it on the same frame
  // rather than leaving something invisible in front of the room.
  check('and gone when it is gone', introOpacity(BLOCK_INTRO_SECONDS) === 0);
  check('and stays gone', introOpacity(BLOCK_INTRO_SECONDS + 10) === 0);
  check('and a clock that runs backwards shows nothing', introOpacity(-1) === 0);

  // Short enough that nobody is waiting on it: it plays while the coach is
  // saying the same thing out loud and should not outlast them.
  check('the whole thing is over in a few seconds',
    BLOCK_INTRO_SECONDS <= 4 && BLOCK_INTRO_FADE_SECONDS < BLOCK_INTRO_SECONDS);
});

describe('the same thing is not said three times on one screen', () => {
  // The card's heading while it is up, the line that stays up after it, and
  // the progress line. All three were carrying the block number, and each one
  // was right on its own, which is why nobody noticed.
  const card = introEyebrow(THRESHOLD, 0, 3);
  const active = blockLines(THRESHOLD, 0, 3, 2, 4, true);

  check('the card introduces the block', card === 'THRESHOLD · BLOCK 1/3', card);
  check('what is left after it says the name once',
    active.label === 'THRESHOLD', active.label);
  check('and the number once', active.progress === 'BLOCK 1/3 · ROUND 2/4',
    active.progress);
  check('and no line repeats another',
    active.label !== active.progress &&
    active.progress.indexOf(active.label) < 0);
});

describe('a warm-up is not a block', () => {
  // It is what happens before the session. Numbering it made a three-block
  // workout announce itself as four, so finishing the first real block looked
  // like being a quarter of the way through.
  const session = [WARMUP, STRENGTH, THRESHOLD, EASY];

  const warmup = workingPositionOf(session, 0);
  check('the warm-up has no number', warmup.index === -1, warmup.index);
  check('and is not counted among them', warmup.count === 3, warmup.count);

  check('the first real block is the first of three',
    workingPositionOf(session, 1).index === 0 &&
    workingPositionOf(session, 1).count === 3);
  check('and the last is the third',
    workingPositionOf(session, 3).index === 2);

  // Which is what the athlete reads.
  check('the warm-up says only what it is',
    blockEyebrow(WARMUP, warmup.index, warmup.count) === 'WARM-UP',
    blockEyebrow(WARMUP, warmup.index, warmup.count));
  check('and its card says only what it is',
    introEyebrow(WARMUP, warmup.index, warmup.count) === 'WARM-UP',
    introEyebrow(WARMUP, warmup.index, warmup.count));
  check('and nothing counts its rounds either',
    blockLines(WARMUP, warmup.index, warmup.count, 1, 1, true).progress === '',
    blockLines(WARMUP, warmup.index, warmup.count, 1, 1, true).progress);

  const first = workingPositionOf(session, 1);
  check('the block after it is BLOCK 1/3',
    introEyebrow(STRENGTH, first.index, first.count) === 'BLOCK 1/3',
    introEyebrow(STRENGTH, first.index, first.count));

  const second = workingPositionOf(session, 2);
  check('and the one after that is the second of three',
    blockEyebrow(THRESHOLD, second.index, second.count) === 'THRESHOLD · 2/3',
    blockEyebrow(THRESHOLD, second.index, second.count));

  // A session that warms itself up has no warm-up block to skip.
  const noWarmup = [THRESHOLD, EASY];
  check('a session with no warm-up counts from one',
    workingPositionOf(noWarmup, 0).index === 0 &&
    workingPositionOf(noWarmup, 0).count === 2);

  // One block of work is not "1/1".
  const alone = [WARMUP, EASY];
  const only = workingPositionOf(alone, 1);
  check('and one block of work is not numbered at all',
    blockEyebrow(EASY, only.index, only.count) === 'EASY RUN',
    blockEyebrow(EASY, only.index, only.count));

  check('nothing at all does not throw',
    workingPositionOf(null, 0).count === 0 &&
    workingPositionOf([], 0).index === -1);
});

describe('the two lines of the active panel, decided together', () => {
  // They were deciding separately and arriving at the same number: the block
  // position appeared on both.
  const session = [WARMUP, STRENGTH, THRESHOLD];
  const at = workingPositionOf(session, 1);

  const both = blockLines(STRENGTH, at.index, at.count, 1, 4, true);
  check('where somebody is, in one line',
    both.progress === 'BLOCK 1/2 · ROUND 1/4', both.progress);
  check('and the line above is left with the name, which the numbers do not say',
    both.label === '', both.label);

  const named = blockLines(THRESHOLD, 1, 2, 3, 5, true);
  check('a named block keeps its name up there',
    named.label === 'THRESHOLD' && named.progress === 'BLOCK 2/2 · ROUND 3/5',
    named.label + ' | ' + named.progress);

  // A warm-up is not a block and has no rounds worth counting.
  const warm = blockLines(WARMUP, -1, 2, 1, 1, true);
  check('the warm-up says only what it is',
    warm.label === 'WARM-UP' && warm.progress === '',
    warm.label + ' | ' + warm.progress);

  // With nowhere to put the second line, the first one carries the position
  // exactly as it always did.
  const alone = blockLines(THRESHOLD, 1, 2, 3, 5, false);
  check('and with no second line the first one carries it',
    alone.label === 'THRESHOLD · 2/2' && alone.progress === '',
    alone.label);

  check('one round is never counted',
    blockLines(STRENGTH, 0, 3, 1, 1, true).progress === 'BLOCK 1/3',
    blockLines(STRENGTH, 0, 3, 1, 1, true).progress);
  check('and one block is not either',
    blockLines(STRENGTH, 0, 1, 2, 4, true).progress === 'ROUND 2/4',
    blockLines(STRENGTH, 0, 1, 2, 4, true).progress);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
