import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Customized } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { LeaderRow } from "@/lib/types";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

type Activity = {
  actor_id: string;
  match_id: string;
  points: number | null;
};

type MatchRow = { id: string; kickoff_at: string };

type Point = { day: string; dayLabel: string } & Record<string, number>;

export function LeaderboardChart({ players }: { players: LeaderRow[] }) {
  const { t, lang } = useI18n();
  const top = useMemo(() => players.slice(0, 8), [players]);
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (top.length === 0) return;
    const ids = top.map((p) => p.player_id);
    void supabase
      .from("feed_activities")
      .select("actor_id,match_id,points")
      .eq("kind", "points_awarded")
      .in("actor_id", ids)
      .then(({ data }) => setActivities((data as Activity[] | null) ?? []));
  }, [top]);

  useEffect(() => {
    if (!activities || activities.length === 0) {
      setMatches({});
      return;
    }
    const ids = Array.from(new Set(activities.map((a) => a.match_id)));
    void supabase
      .from("matches")
      .select("id,kickoff_at")
      .in("id", ids)
      .then(({ data }) => {
        const m: Record<string, string> = {};
        ((data as MatchRow[] | null) ?? []).forEach((row) => {
          m[row.id] = row.kickoff_at;
        });
        setMatches(m);
      });
  }, [activities]);

  const data = useMemo<Point[]>(() => {
    if (!activities) return [];
    // bucket per day per player
    const dayMap = new Map<string, Map<string, number>>(); // day -> playerId -> pts that day
    for (const a of activities) {
      const ko = matches[a.match_id];
      if (!ko) continue;
      const day = ko.slice(0, 10); // YYYY-MM-DD UTC
      if (!dayMap.has(day)) dayMap.set(day, new Map());
      const inner = dayMap.get(day)!;
      inner.set(a.actor_id, (inner.get(a.actor_id) ?? 0) + (a.points ?? 0));
    }
    const days = Array.from(dayMap.keys()).sort();
    const fmt = new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en-US", {
      month: "short",
      day: "numeric",
    });
    const cum: Record<string, number> = {};
    top.forEach((p) => (cum[p.player_id] = 0));
    const out: Point[] = [];
    for (const day of days) {
      const inner = dayMap.get(day)!;
      top.forEach((p) => {
        cum[p.player_id] += inner.get(p.player_id) ?? 0;
      });
      const row: Point = {
        day,
        dayLabel: fmt.format(new Date(day + "T12:00:00Z")),
        ...cum,
      } as Point;
      out.push(row);
    }
    return out;
  }, [activities, matches, top, lang]);

  if (top.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
        {t("empty_leaderboard")}
      </div>
    );
  }
  if (activities === null) {
    return <div className="px-4 py-10 text-center text-ink-soft">{t("loading")}</div>;
  }
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
        {t("chart_empty")}
      </div>
    );
  }

  return (
    <div
      className="relative rounded-2xl border border-border bg-surface p-3"
      onClick={() => setActiveId(null)}
    >
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 16, right: 40, left: 0, bottom: 8 }}>
            <XAxis
              dataKey="dayLabel"
              tick={{ fill: "var(--ink-soft)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              tick={{ fill: "var(--ink-soft)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              width={32}
              allowDecimals={false}
            />
            {top.map((p, i) => {
              const color = COLORS[i % COLORS.length];
              const dim = activeId !== null && activeId !== p.player_id;
              return (
                <Line
                  key={p.player_id}
                  type="monotone"
                  dataKey={p.player_id}
                  stroke={color}
                  strokeWidth={activeId === p.player_id ? 3 : 2}
                  strokeOpacity={dim ? 0.18 : 1}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                  onClick={(_, e) => {
                    (e as unknown as { stopPropagation: () => void })?.stopPropagation?.();
                    setActiveId(p.player_id);
                  }}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
            <Customized
              component={(props: unknown) => (
                <EndAvatars
                  {...(props as { yAxisMap: Record<string, { scale: (v: number) => number }>; xAxisMap: Record<string, { scale: (v: string) => number }>; offset: { left: number } }) }
                  data={data}
                  top={top}
                  activeId={activeId}
                  onPick={(id) => setActiveId(id)}
                />
              )}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {activeId && (() => {
        const p = top.find((x) => x.player_id === activeId);
        if (!p) return null;
        const i = top.indexOf(p);
        return (
          <div
            className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border bg-bg px-3 py-1 text-xs font-semibold shadow"
            style={{ borderColor: COLORS[i % COLORS.length], color: "var(--ink)" }}
          >
            {p.display_name} · {p.total_points}
          </div>
        );
      })()}
    </div>
  );
}

function EndAvatars({
  yAxisMap,
  xAxisMap,
  data,
  top,
  activeId,
  onPick,
}: {
  yAxisMap: Record<string, { scale: (v: number) => number }>;
  xAxisMap: Record<string, { scale: (v: string) => number }>;
  data: Point[];
  top: LeaderRow[];
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  if (!data.length) return null;
  const yAxis = Object.values(yAxisMap)[0];
  const xAxis = Object.values(xAxisMap)[0];
  if (!yAxis || !xAxis) return null;
  const last = data[data.length - 1];
  const cx = xAxis.scale(last.dayLabel);
  return (
    <g>
      {top.map((p, i) => {
        const v = (last[p.player_id] as number) ?? 0;
        const cy = yAxis.scale(v);
        const color = COLORS[i % COLORS.length];
        const dim = activeId !== null && activeId !== p.player_id;
        return (
          <g
            key={p.player_id}
            transform={`translate(${cx}, ${cy})`}
            opacity={dim ? 0.25 : 1}
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              onPick(p.player_id);
            }}
          >
            <circle r={13} fill="var(--bg)" stroke={color} strokeWidth={2} />
            {p.avatar ? (
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={14}
                y={1}
              >
                {p.avatar}
              </text>
            ) : (
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                fontWeight={700}
                fill="var(--ink)"
                y={1}
              >
                {(p.display_name || "?").trim().charAt(0).toUpperCase()}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
