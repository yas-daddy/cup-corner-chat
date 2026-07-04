-- Drop the squads feature. The Wikipedia parser was flaky in practice and
-- the lineups panel already covers the "who's actually playing" case, so
-- the standalone squad list adds noise without value.
--
-- No app code references squad_players anymore (see the same commit).
DROP TABLE IF EXISTS public.squad_players CASCADE;
