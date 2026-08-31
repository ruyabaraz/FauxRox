// ============================================================================
// EffortCue.ts — how hard, in the only language we can honestly use
// ============================================================================
// The sessions prescribe geometry - metres, reps, seconds - and say nothing
// about intensity. Eight times four hundred metres is an easy tempo run at one
// pace and a VO2max session at another; the same prescription, a different
// workout, and the athlete has no way to tell which one they were given.
//
// A pace target would be the real answer and this is not it. Pace has to be
// anchored to the athlete's own threshold, which means either asking them for
// a recent time or deriving it from their measured run splits, and until one
// of those exists any number here would be invented.
//
// What can be said honestly is the effort. RPE is the athlete's own reading of
// their own body: it needs no sensor, it travels across fitness levels without
// adjustment - a seven out of ten is a seven for everybody, which is the whole
// point of the scale - and it is what a coach says out loud when they cannot
// stand next to you.
//
// It carries no number into the duration model. The session is exactly as long
// as it was before; the athlete simply knows what to bring to it.
//
// Pure: no Lens Studio imports.
// ============================================================================

import { Focus } from './AdaptiveSessionGenerator';

export interface EffortCue {
  /** One line for the panel */
  short: string;
  /** What the coach says, once, when the working set starts */
  spoken: string;
}

const CUES: { [K in Focus]: EffortCue } = {
  RUNNING: {
    short: 'RPE 7/10 — controlled hard',
    spoken: 'Controlled hard, about seven out of ten. Every interval the ' +
            'same speed as the first - if the last one is slower, the first ' +
            'one was too fast.',
  },

  ENGINE: {
    short: 'RPE 7–8/10 — hard but repeatable',
    spoken: 'Seven to eight out of ten. Hard, but you have to be able to do ' +
            'it again - hold the shape when it starts to hurt.',
  },

  STRENGTH: {
    // Reps in reserve rather than RPE: for loaded work the athlete is
    // choosing a weight, and "leave two in the tank" is the instruction that
    // actually picks one.
    short: 'Leave 2–3 reps in reserve',
    spoken: 'Pick a load you could stop two or three reps short of failing ' +
            'with. Heavy enough to be work, light enough to keep the shape.',
  },

  MIXED: {
    short: 'RPE 7/10 — race effort',
    spoken: 'Race effort, about seven out of ten. Sustainable - do not ' +
            'sprint the first round and pay for it in the fourth.',
  },
};

export function effortCueFor(focus: Focus): EffortCue {
  return CUES[focus] || CUES.MIXED;
}

/**
 * The cue on one line, for the session summary the athlete reads before
 * pressing start.
 */
export function effortLine(focus: Focus): string {
  return effortCueFor(focus).short;
}
