-- ============================================================================
-- 001_race_history_config_key.sql
-- ============================================================================
-- Records the course tuning a race was run under.
--
-- Personal baselines in the Coach's Verdict are only meaningful across races
-- run with the same station volumes. Change burpeeReps or runDistance in the
-- CourseManager inspector and every earlier race becomes a different
-- measurement, even though the station names are unchanged.
--
-- CloudManager.getConfigKey() produces the value. Rows written before this
-- migration have NULL and are deliberately treated as incompatible: we cannot
-- know which tuning they used, so they are excluded from baselines rather than
-- assumed to match.
--
-- Safe to run more than once. The Lens works without it - saves fall back to
-- writing no key and every baseline stays modelled.
-- ============================================================================

alter table public.race_history
  add column if not exists config_key text;

comment on column public.race_history.config_key is
  'Course tuning fingerprint from CourseManager.getConfigKey(). NULL means the race predates this column and is not comparable.';

-- Baseline lookups filter by user and tuning, newest first.
create index if not exists race_history_user_config_idx
  on public.race_history (user_id, config_key, created_at desc);
