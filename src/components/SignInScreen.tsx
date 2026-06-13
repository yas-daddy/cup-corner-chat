import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { storePlayerId, type Player } from "@/lib/identity";

export function SignInScreen({ onSignedIn }: { onSignedIn: (p: Player) => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [matches, setMatches] = useState<Player[] | null>(null);
  const [browseAll, setBrowseAll] = useState(false);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!browseAll) return;
    supabase
      .from("players")
      .select("*")
      .order("display_name", { ascending: true })
      .then(({ data }) => setAllPlayers((data as Player[]) ?? []));
  }, [browseAll]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const { data: existing } = await supabase
      .from("players")
      .select("*")
      .ilike("display_name", trimmed);
    if (existing && existing.length > 0) {
      setMatches(existing as Player[]);
      setBusy(false);
      return;
    }
    const { data: created, error } = await supabase
      .from("players")
      .insert({ display_name: trimmed })
      .select()
      .single();
    setBusy(false);
    if (!error && created) {
      const p = created as Player;
      storePlayerId(p.id);
      onSignedIn(p);
      navigate({ to: "/" });
    }
  }

  async function pick(p: Player) {
    storePlayerId(p.id);
    onSignedIn(p);
    navigate({ to: "/" });
  }

  async function createNew(displayName: string) {
    setBusy(true);
    const { data, error } = await supabase
      .from("players")
      .insert({ display_name: displayName })
      .select()
      .single();
    setBusy(false);
    if (!error && data) pick(data as Player);
  }

  if (browseAll) {
    const filtered = allPlayers.filter((p) =>
      p.display_name.toLowerCase().includes(filter.toLowerCase()),
    );
    return (
      <div className="px-5 py-8">
        <h1 className="text-2xl font-bold">{t("pick_your_name")}</h1>
        <input
          autoFocus
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("search_players")}
          className="mt-4 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-primary"
        />
        <ul className="mt-3 space-y-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => pick(p)}
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-start"
              >
                <span className="font-semibold">{p.display_name}</span>
                <span className="text-xs text-ink-soft">
                  {t("joined")} {new Date(p.created_at).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={() => setBrowseAll(false)}
          className="mt-6 w-full rounded-2xl border border-border py-3 text-sm font-medium text-ink-soft"
        >
          ← {t("signin_title")}
        </button>
      </div>
    );
  }

  if (matches) {
    return (
      <div className="px-5 py-8">
        <h1 className="text-2xl font-bold">{t("continue_as")}…</h1>
        <ul className="mt-4 space-y-2">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => pick(p)}
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-start"
              >
                <span className="font-semibold">{p.display_name}</span>
                <span className="text-xs text-ink-soft">
                  {t("joined")} {new Date(p.created_at).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button
          disabled={busy}
          onClick={() => createNew(name.trim())}
          className="mt-4 w-full rounded-2xl bg-primary py-3 font-semibold text-white"
        >
          {t("create_new")}
        </button>
        <button
          onClick={() => setMatches(null)}
          className="mt-2 w-full rounded-2xl border border-border py-3 text-sm font-medium text-ink-soft"
        >
          ←
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-12">
      <div className="text-5xl">⚽️</div>
      <h1 className="mt-4 text-3xl font-bold">{t("signin_title")}</h1>
      <p className="mt-2 text-ink-soft">{t("signin_subtitle")}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("first_name")}
          className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-lg outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!name.trim() || busy}
          className="w-full rounded-2xl bg-primary py-3 text-lg font-semibold text-white disabled:opacity-50"
        >
          {t("lets_go")}
        </button>
      </form>

      <button
        onClick={() => setBrowseAll(true)}
        className="mt-6 w-full rounded-2xl border border-border py-3 text-sm font-medium text-secondary"
      >
        {t("already_playing")}
      </button>
    </div>
  );
}
