-- Backfill linked_match_id on espn_matches using (home_code, away_code, date)
-- when name-based linking previously failed.
UPDATE public.espn_matches em
SET linked_match_id = m.id
FROM public.matches m
WHERE em.linked_match_id IS NULL
  AND em.home_code IS NOT NULL AND em.away_code IS NOT NULL
  AND m.home_code = em.home_code
  AND m.away_code = em.away_code
  AND date_trunc('day', m.kickoff_at) = date_trunc('day', em.kickoff_at);

-- Propagate is_knockout + advanced_side from every linked espn_matches row
-- onto public.matches. The emit_match_finished_activities trigger fires on
-- is_knockout / advanced_side changes and re-emits feed points automatically.
UPDATE public.matches m
SET is_knockout = COALESCE(em.is_knockout, false),
    advanced_side = em.advanced_side
FROM public.espn_matches em
WHERE em.linked_match_id = m.id
  AND (m.is_knockout IS DISTINCT FROM COALESCE(em.is_knockout, false)
       OR m.advanced_side IS DISTINCT FROM em.advanced_side);