// ============================================================================
// RunningSchedule.ts — which of the legal sessions to give somebody today
// ============================================================================
// Two questions that look like one:
//
//   legality    what IS this archetype, and can this session hold it?
//   scheduling  which one should this athlete be given today?
//
// The first is a property of the archetype and the request and lives in
// RunningArchetype.ts. This is the second, and it is not physiology - it is a
// policy about somebody's recent weeks, and it needs their history, which is
// nothing to do with what a threshold session is.
//
// Kept apart so that legality can be tested without a history at all, and
// this can be tested without building a single session.
//
// What it deliberately does NOT do is impose a weekly distribution. The
// polarised eighty-twenty finding is about an athlete's whole training week,
// and this app sees the sessions it generates and nothing else - somebody
// running four times a week outside it would be scheduled against a picture
// that is mostly missing. What can be claimed from what we actually know is
// narrower and still worth having: do not stack two hard days back to back,
// and do not hand somebody the same session twice running.
//
// Pure: no Lens Studio imports.
// ============================================================================

import {
  RunningArchetype,
  RUNNING_TOPOLOGY,
} from './RunningArchetype';

/**
 * How much a session takes out of the athlete, for scheduling purposes.
 *
 * Two bands rather than five. The distinctions between a threshold session, a
 * maximal aerobic one and a set of speed repetitions matter enormously for
 * what they train and not at all for the question being asked here, which is
 * whether the athlete should be doing something hard today at all. Inventing
 * a finer ranking would be inventing precision.
 */
export type SessionIntensity = 'EASY' | 'QUALITY';

const INTENSITY: { [K in RunningArchetype]: SessionIntensity } = {
  EASY_BASE:        'EASY',
  HYROX_PACE:       'QUALITY',
  THRESHOLD:        'QUALITY',
  VO2:              'QUALITY',
  SPEED_REPETITION: 'QUALITY',
};

export function intensityOf(archetype: RunningArchetype): SessionIntensity {
  return INTENSITY[archetype] || 'QUALITY';
}

/**
 * How long a quality session keeps the next one away. Hours.
 *
 * A v1 coaching policy, and not a physiological law. Forty-eight hours is the
 * ordinary spacing between quality sessions in endurance programming, but
 * recovery depends on the athlete, the session and the week around it, none
 * of which this knows - so this is a decision with a reason, not a finding.
 *
 * Twenty-four is also defensible and was not chosen: at that width somebody
 * doing a maximal aerobic session on Monday evening could be handed a
 * threshold session on Tuesday evening, and whether they were would turn on
 * a few minutes either side of the boundary.
 *
 * What makes any value usable is that it is checked against a real elapsed
 * time rather than assumed. A session yesterday and a session three weeks ago
 * are different situations, and a rule that could not tell them apart would
 * be refusing hard sessions to somebody who has not trained since.
 *
 * One constant, one comparison, one place. Changing the policy is changing
 * this number.
 */
export const QUALITY_RECOVERY_WINDOW_HOURS = 48;

export interface SchedulingContext {
  /** Archetypes from previous sessions, most recent first */
  recent?: RunningArchetype[];
  /**
   * Hours since the last completed session.
   *
   * Undefined when it is not known - a log written before this was recorded.
   * Treated as long ago rather than as recent: with no evidence the athlete
   * trained yesterday, refusing them a hard session would be a guess against
   * their interest.
   */
  hoursSinceLast?: number;
}

/**
 * Narrow the legal archetypes to the ones worth giving today.
 *
 * Every rule here degrades rather than empties. A filter that removed the
 * last candidate would leave nothing to build, and the fallback for that -
 * something, anything - is how a policy quietly becomes the opposite of
 * itself. Where a rule cannot be honoured it is skipped, and the session is
 * the one the athlete asked for.
 */
export function scheduleRunning(
  candidates: RunningArchetype[],
  context?: SchedulingContext
): RunningArchetype[] {
  var out = candidates ? candidates.slice() : [];
  if (out.length <= 1 || !context) return out;

  var recent = context.recent || [];
  var last = recent.length > 0 ? recent[0] : null;
  if (!last) return out;

  // The one hard rule, and the only one here with a physiological claim
  // behind it: a quality session recently done leaves the athlete owing an
  // easy one, and a second hard session on top is how a training block
  // becomes an injury. Time-aware, because yesterday and three weeks ago are
  // not the same situation.
  if (intensityOf(last) === 'QUALITY' && recentQualitySessionWithinWindow(context)) {
    out = keepIfAnyLeft(out, function (a) { return intensityOf(a) === 'EASY'; });
  }

  // Then a preference, not a rule: another kind of quality session rather
  // than the same one again.
  //
  // This was a hard exclusion applied to every archetype, and the two rules
  // together produced a policy nobody wrote. Inside the recovery window they
  // forced strict alternation - a quality session, then the easy one because
  // quality was blocked, then a quality one because the easy one had just
  // been done - fifty-fifty, which is exactly the global distribution we had
  // agreed not to bake in. Outside the window they did the opposite: an easy
  // run could never follow an easy run, so the draw came out ninety-three per
  // cent quality.
  //
  // Both came from excluding EASY_BASE for having just been done. Two easy
  // runs in a row is ordinary endurance training, and the argument for
  // varying the stimulus is an argument about hard sessions.
  //
  // Applied after the safety rule rather than instead of it, so that a tier
  // holding nothing but quality sessions - where the safety rule has no easy
  // option to fall back on and skips itself - still gets a different hard
  // session rather than the same one an hour later.
  if (intensityOf(last) === 'QUALITY') {
    out = keepIfAnyLeft(out, function (a) {
      return a !== last || intensityOf(a) === 'EASY';
    });
  }

  return out;
}

/**
 * Whether the last quality session is recent enough to still be owed for.
 *
 * A product and coaching policy, not a law: recovery depends on the athlete,
 * the session and the week around it, none of which this knows. What makes it
 * usable is that it is checked against a real elapsed time rather than
 * assumed, and skipped entirely when there is none - a log with no timestamp
 * is a log that cannot say whether the session was yesterday, and holding
 * somebody back on a guess is worse than not holding them back.
 */
export function recentQualitySessionWithinWindow(
  context: SchedulingContext
): boolean {
  if (!context || context.hoursSinceLast === undefined) return false;
  return context.hoursSinceLast < QUALITY_RECOVERY_WINDOW_HOURS;
}

/** Apply a filter, unless it would leave nothing */
function keepIfAnyLeft(
  candidates: RunningArchetype[],
  keep: (a: RunningArchetype) => boolean
): RunningArchetype[] {
  var kept: RunningArchetype[] = [];

  for (var i = 0; i < candidates.length; i++) {
    if (keep(candidates[i])) kept.push(candidates[i]);
  }

  return kept.length > 0 ? kept : candidates;
}

/** True when this is one of the five - a log may hold anything */
export function isRunningArchetype(value: string): boolean {
  return !!value && RUNNING_TOPOLOGY[value as RunningArchetype] !== undefined;
}
