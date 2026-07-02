import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { flagFromCode } from "@/lib/flags";
import { SquadList } from "@/components/SquadList";
import type { SquadPlayer } from "@/components/PlayerRow";

const sb = supabase as unknown as { from: (t: string) => any };

// Collapsible section on the match detail page showing both teams' squads
// side-by-side. Default state: collapsed — squad lists are long and the
// average visitor came here for the score.
export function MatchSquadsPanel({
  homeCode,
  awayCode,
  homeTeam,
  awayTeam,
}: {
  homeCode: string;
  awayCode: string;
  homeTeam: string;
  awayTeam: string;
}) {
  const { t, tc } = useI18n();
  const [open, setOpen] = useState(false);
  const [homeSquad, setHomeSquad] = useState<SquadPlayer[]>([]);
  const [awaySquad, setAwaySquad] = useState<SquadPlayer[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Only fetch after the user expands, so the page load stays snappy.
    if (!open || loaded) return;
    let active = true;
    (async () => {
      const codes = [homeCode, awayCode].filter(Boolean);
      if (codes.length === 0) {
        setLoaded(true);
        return;
      }
      const { data } = await sb
        .from("squad_players")
        .select("id, team_code, full_name, display_name, jersey_number, position, club, club_country_code, image_url, captain")
        .in("team_code", codes);
      if (!active) return;
      const rows = (data as SquadPlayer[] | null) ?? [];
      setHomeSquad(rows.filter((r) => r.team_code === homeCode));
      setAwaySquad(rows.filter((r) => r.team_code === awayCode));
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [open, loaded, homeCode, awayCode]);

  const totalPlayers = homeSquad.length + awaySquad.length;

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-3 py-3 text-left"
      >
        <span className="flex items-center gap-2 font-bold">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span>{t("squads_title") ?? "Squads"}</span>
        </span>
        {loaded && open && totalPlayers > 0 && (
          <span className="text-xs text-ink-soft tabular-nums">{totalPlayers} players</span>
        )}
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SquadColumn code={homeCode} team={homeTeam} players={homeSquad} tc={tc} />
          <SquadColumn code={awayCode} team={awayTeam} players={awaySquad} tc={tc} />
        </div>
      )}
    </section>
  );
}

function SquadColumn({
  code,
  team,
  players,
  tc,
}: {
  code: string;
  team: string;
  players: SquadPlayer[];
  tc: (s: string) => string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="text-xl leading-none">{flagFromCode(code)}</span>
        <p className="font-semibold">{tc(team)}</p>
      </div>
      <SquadList players={players} compact />
    </div>
  );
}
