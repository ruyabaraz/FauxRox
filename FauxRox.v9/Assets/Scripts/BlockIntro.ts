// ============================================================================
// BlockIntro.ts — what is coming, said once, before it starts
// ============================================================================
// The middle of the screen was carrying the block's whole movement list for
// as long as the block lasted. The content was right and the timing was
// wrong: an athlete needs to know what a set holds before it begins, and
// after that they need the space, because what is in front of them is a room
// they are moving through.
//
// So the list becomes a card that appears at the start of a block, holds for
// a few seconds, and goes. What is left during the work is one short line
// saying which block this is, and the middle of the view is empty.
//
//   before a block   what is coming
//   during the work  what is happening now
//   underneath       how to do it, and what is next
//
// Pure: no Lens Studio imports. What it produces is text, and the panel
// decides where to put it.
// ============================================================================

import {
  SessionBlock,
  StationConfig,
  BlockScheme,
  hasRun,
  isRestStation,
  flattenBlocks,
  estimateMinutes,
  formatRunClock,
} from './SessionTypes';

import { RunningArchetype, RUNNING_TOPOLOGY } from './RunningArchetype';

/**
 * How long the card holds.
 *
 * Long enough to read three movement names, short enough that nobody is
 * waiting on it - it plays while the coach is saying the same thing out loud,
 * and it should not outlast them.
 */
export const BLOCK_INTRO_SECONDS = 3.0;

/** The fade at the end, so the card leaves rather than blinking out */
export const BLOCK_INTRO_FADE_SECONDS = 0.5;

/** The most movement names worth putting on a card somebody reads once */
export const MAX_INTRO_MOVES = 6;

export interface BlockIntroCard {
  /** 'WARM-UP · BLOCK 1/4' */
  eyebrow: string;
  /** One movement per line, in the order they are done */
  moves: string[];
  /** '4 ROUNDS · 3 MOVES · ~6 MIN' */
  footer: string;
  /** 'Get ready', or how the running should feel */
  cue: string;
}

/**
 * What this block is called.
 *
 * Empty for a plain block of work, because "WORK" is not a name and a made-up
 * one reads as a category the athlete should recognise. The block number
 * carries it in that case, which is what it is for.
 */
export function blockName(block: SessionBlock): string {
  if (!block) return '';

  if (block.scheme === BlockScheme.WARMUP) return 'WARM-UP';

  if (block.archetype) return archetypeName(block.archetype as RunningArchetype);

  if (block.scheme === BlockScheme.EMOM) return 'FINISHER';
  if (block.scheme === BlockScheme.LADDER) return 'LADDER';

  return '';
}

/** The archetype, in the words the athlete was offered it in */
function archetypeName(archetype: RunningArchetype): string {
  switch (archetype) {
    case 'EASY_BASE':        return 'EASY RUN';
    case 'HYROX_PACE':       return 'RACE PACE';
    case 'THRESHOLD':        return 'THRESHOLD';
    case 'VO2':              return 'INTERVALS';
    case 'SPEED_REPETITION': return 'SPEED';
    default:                 return '';
  }
}

/**
 * Where a block sits among the blocks that are the session.
 *
 * A warm-up is not one of them. It is what happens before the session, and
 * numbering it made a three-block workout announce itself as four - so the
 * athlete finished the first real block and was told they were a quarter of
 * the way through something they had barely started.
 *
 * A warm-up comes back with an index of -1, which every line reads as "no
 * number", and the blocks after it are counted from one among themselves.
 */
export function workingPositionOf(
  blocks: SessionBlock[],
  blockIndex: number
): { index: number; count: number } {
  var all = blocks || [];
  var count = 0;
  var index = -1;

  for (var i = 0; i < all.length; i++) {
    if (!all[i] || all[i].scheme === BlockScheme.WARMUP) continue;

    if (i === blockIndex) index = count;
    count++;
  }

  return { index: index, count: count };
}

/**
 * The line that stays up while the work is happening.
 *
 * Short on purpose. Everything else the athlete needs at that moment is the
 * movement in front of them, the clock, and the room.
 */
export function blockEyebrow(
  block: SessionBlock,
  index: number,
  count: number
): string {
  var name = blockName(block);
  var position = index >= 0 && count > 1 ? (index + 1) + '/' + count : '';

  if (name && position) return name + ' · ' + position;
  if (name) return name;
  return position ? 'BLOCK ' + position : '';
}

/**
 * The movements, in the order they are done.
 *
 * A run counts as one of them - in a running block it is the whole block, and
 * a card that listed only the walk between repetitions would be describing
 * the rest.
 */
export function introMoves(block: SessionBlock): string[] {
  var out: string[] = [];
  if (!block) return out;

  if (hasRun(block.run)) out.push(runMoveLine(block));

  var items: StationConfig[] = block.items || [];
  for (var i = 0; i < items.length && out.length < MAX_INTRO_MOVES; i++) {
    var item = items[i];
    if (!item || isRestStation(item)) continue;

    var name = (item.name || '').toUpperCase();
    if (!name) continue;

    // A round repeats its movements; the card lists the round.
    if (out.indexOf(name) < 0) out.push(name);
  }

  return out;
}

function runMoveLine(block: SessionBlock): string {
  var run = block.run;
  if (!run) return '';

  return run.kind === 'TIME'
    ? formatRunClock(run.seconds) + ' RUN'
    : run.metres + 'M RUN';
}

/**
 * How much of it there is.
 *
 * Two things, and not a third: how many times round, and how long it takes.
 * A count of the movements was there too and it was counting the list
 * printed directly above it - "3 MOVES" under three movements is the card
 * reading itself back.
 */
export function introFooter(block: SessionBlock): string {
  if (!block) return '';

  var parts: string[] = [];

  if (block.rounds > 1) parts.push(block.rounds + ' ROUNDS');

  var minutes = blockMinutes(block);
  if (minutes > 0) parts.push('~' + minutes + ' MIN');

  return parts.join(' · ');
}

/** Roughly how long this block takes, in whole minutes */
export function blockMinutes(block: SessionBlock): number {
  if (!block) return 0;

  try {
    return estimateMinutes(flattenBlocks([block]));
  } catch (e) {
    return 0;
  }
}

/**
 * What to have in mind while doing it.
 *
 * A running block says how it should feel, because that is the prescription
 * when there is no pace target and half the prescription when there is.
 * Everything else says the only thing that is true of every block: it is
 * about to start.
 */
export function introCue(block: SessionBlock): string {
  if (block && block.archetype) {
    var topology = RUNNING_TOPOLOGY[block.archetype as RunningArchetype];
    if (topology && topology.effortShort) return topology.effortShort;
  }

  return 'Get ready';
}

export function blockIntroCard(
  block: SessionBlock,
  index: number,
  count: number
): BlockIntroCard {
  return {
    eyebrow: introEyebrow(block, index, count),
    moves: introMoves(block),
    footer: introFooter(block),
    cue: introCue(block),
  };
}

/** The card's own heading, which says BLOCK where the short line does not */
export function introEyebrow(
  block: SessionBlock,
  index: number,
  count: number
): string {
  var name = blockName(block);
  var position = index >= 0 && count > 1
    ? 'BLOCK ' + (index + 1) + '/' + count
    : '';

  if (name && position) return name + ' · ' + position;
  if (name) return name;
  return position;
}

/** The moves as one block of text, for a panel with a single field for them */
export function introBody(card: BlockIntroCard): string {
  return card && card.moves ? card.moves.join('\n') : '';
}

/**
 * Whether there is anything worth stopping the athlete to read.
 *
 * A block of one movement with no name and no shape is the athlete arriving
 * at a station, and they can see it. Putting a card in front of them for it
 * would make the card mean nothing by the third time.
 */
export function worthIntroducing(card: BlockIntroCard): boolean {
  if (!card) return false;
  return card.moves.length > 0 && (card.eyebrow !== '' || card.moves.length > 1);
}

/**
 * The two lines the active panel shows, decided together.
 *
 * Together, because they were deciding separately and arriving at the same
 * number: the block position appeared on both, and the round appeared on
 * neither when only one of them was wired. One function, one place it can be
 * wrong.
 *
 * Where there is a line for the position it takes both the position and the
 * round - "BLOCK 1/3 · ROUND 1/4" is where somebody is, in one line - and
 * the block line above it is left with the name, which is the one thing
 * neither of the numbers says.
 *
 * Where there is no such line, the block line carries the position itself,
 * exactly as it did, and the round has nowhere to go.
 */
export function blockLines(
  block: SessionBlock,
  index: number,
  count: number,
  roundIndex: number,
  roundCount: number,
  hasProgressLine: boolean
): { label: string; progress: string } {
  if (!hasProgressLine) {
    return { label: blockEyebrow(block, index, count), progress: '' };
  }

  var parts: string[] = [];
  if (index >= 0 && count > 1) parts.push('BLOCK ' + (index + 1) + '/' + count);
  if (roundCount > 1) parts.push('ROUND ' + roundIndex + '/' + roundCount);

  return { label: blockName(block), progress: parts.join(' · ') };
}

/**
 * How opaque the card is, this many seconds in.
 *
 * One function so the fade cannot disagree with the moment it disappears:
 * zero means gone, and the panel can stop drawing it on the same frame.
 */
export function introOpacity(elapsedSeconds: number): number {
  if (elapsedSeconds < 0) return 0;
  if (elapsedSeconds >= BLOCK_INTRO_SECONDS) return 0;

  var fadeStarts = BLOCK_INTRO_SECONDS - BLOCK_INTRO_FADE_SECONDS;
  if (elapsedSeconds <= fadeStarts) return 1;

  return (BLOCK_INTRO_SECONDS - elapsedSeconds) / BLOCK_INTRO_FADE_SECONDS;
}
