import { useMemo } from "react";
import { PlayerRow, type SquadPlayer } from "@/components/PlayerRow";
import { useI18n } from "@/lib/i18n";

const POS_ORDER: Array<"GK" | "D" | "M" | "F"> = ["GK", "D", "M", "F"];

const POS_LABEL: Record<"GK" | "D" | "M" | "F", string> = {
  GK: "Goalkeepers",
  D: "Defenders",
  M: "Midfielders",
  F: "Forwards",
};

export function SquadList({
  players,
  compact = false,
}: {
  players: SquadPlayer[];
  compact?: boolean;
}) {
  const { t } = useI18n();
  const byPos = useMemo(() => {
    const m = new Map<"GK" | "D" | "M" | "F" | "__none__", SquadPlayer[]>();
    for (const p of players) {
      const key = (p.position ?? "__none__") as "GK" | "D" | "M" | "F" | "__none__";
      const arr = m.get(key) ?? [];
      arr.push(p);
      m.set(key, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999));
    }
    return m;
  }, [players]);

  if (players.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
        {t("squad_no_data") ?? "Squad not published yet."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {POS_ORDER.map((pos) => {
        const list = byPos.get(pos) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={pos}>
            <h3
              className={`mb-2 px-1 font-bold uppercase tracking-wider text-ink-soft ${
                compact ? "text-[10px]" : "text-[11px]"
              }`}
            >
              {t(`squad_pos_${pos.toLowerCase()}`) ?? POS_LABEL[pos]}{" "}
              <span className="ml-1 tabular-nums opacity-70">({list.length})</span>
            </h3>
            <div className="space-y-1.5">
              {list.map((p) => (
                <PlayerRow key={p.id} p={p} compact={compact} />
              ))}
            </div>
          </section>
        );
      })}
      {(() => {
        const list = byPos.get("__none__") ?? [];
        if (list.length === 0) return null;
        return (
          <section>
            <h3
              className={`mb-2 px-1 font-bold uppercase tracking-wider text-ink-soft ${
                compact ? "text-[10px]" : "text-[11px]"
              }`}
            >
              {t("squad_pos_other") ?? "Other"}
            </h3>
            <div className="space-y-1.5">
              {list.map((p) => (
                <PlayerRow key={p.id} p={p} compact={compact} />
              ))}
            </div>
          </section>
        );
      })()}
    </div>
  );
}
