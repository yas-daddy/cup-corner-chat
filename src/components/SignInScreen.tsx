import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { storePlayerId, type Player } from "@/lib/identity";
import { Avatar } from "@/components/AvatarPicker";

export function SignInScreen({ onSignedIn }: { onSignedIn: (p: Player) => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggest, setSuggest] = useState<Player[] | null>(null);
  const [renaming, setRenaming] = useState<Player | null>(null);
  const [renameTo, setRenameTo] = useState("");

  useEffect(() => {
    supabase
      .from("players")
      .select("*")
      .order("display_name", { ascending: true })
      .then(({ data }) => setPlayers((data as Player[]) ?? []));
  }, []);

  const trimmed = filter.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return players;
    const q = trimmed.toLowerCase();
    return players.filter((p) => p.display_name.toLowerCase().includes(q));
  }, [players, trimmed]);

  function pick(p: Player) {
    storePlayerId(p.id);
    onSignedIn(p);
    navigate({ to: "/" });
  }

  async function continueAs(p: Player, newName: string) {
    const name = newName.trim();
    setBusy(true);
    if (name && name.toLowerCase() !== p.display_name.toLowerCase()) {
      const { data } = await supabase
        .from("players")
        .update({ display_name: name })
        .eq("id", p.id)
        .select()
        .single();
      setBusy(false);
      if (data) pick(data as Player);
      return;
    }
    setBusy(false);
    pick(p);
  }

  function tryCreate() {
    const name = trimmed;
    if (!name) return;
    const lower = name.toLowerCase();
    const exact = players.find((p) => p.display_name.toLowerCase() === lower);
    if (exact) {
      setSuggest([exact]);
      return;
    }
    const partial = players.filter(
      (p) =>
        p.display_name.toLowerCase().includes(lower) ||
        lower.includes(p.display_name.toLowerCase()),
    );
    if (partial.length > 0) {
      setSuggest(partial);
      return;
    }
    void doCreate(name);
  }

  async function doCreate(name: string) {
    setBusy(true);
    const { data, error } = await supabase
      .from("players")
      .insert({ display_name: name })
      .select()
      .single();
    setBusy(false);
    if (!error && data) pick(data as Player);
  }

  if (renaming) {
    return (
      <div className="px-5 py-10">
        <h1 className="text-2xl font-bold">{t("continue_as")}</h1>
        <p className="mt-1 text-sm text-ink-soft">Update the display name if you'd like.</p>
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
          <Avatar avatar={renaming.avatar} name={renaming.display_name} size={48} className="border border-border text-2xl" />
          <input
            autoFocus
            value={renameTo}
            onChange={(e) => setRenameTo(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-base outline-none focus:border-primary"
          />
        </div>
        <button
          disabled={busy || !renameTo.trim()}
          onClick={() => continueAs(renaming, renameTo)}
          className="mt-4 w-full rounded-2xl bg-primary py-3 font-semibold text-white disabled:opacity-50"
        >
          {t("lets_go")}
        </button>
        <button
          onClick={() => setRenaming(null)}
          className="mt-2 w-full rounded-2xl border border-border py-3 text-sm font-medium text-ink-soft"
        >
          ←
        </button>
      </div>
    );
  }

  if (suggest) {
    return (
      <div className="px-5 py-10">
        <h1 className="text-2xl font-bold">Did you mean…?</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {suggest.length === 1
            ? "A player with a similar name already exists."
            : "Some existing players look similar."}
        </p>
        <ul className="mt-4 space-y-2">
          {suggest.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => {
                  setRenameTo(trimmed || p.display_name);
                  setRenaming(p);
                  setSuggest(null);
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-start"
              >
                <Avatar avatar={p.avatar} name={p.display_name} size={36} className="border border-border text-xl" />
                <span className="flex-1 font-semibold">{p.display_name}</span>
                <span className="text-xs font-semibold text-primary">{t("continue_as")} →</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          disabled={busy}
          onClick={() => {
            setSuggest(null);
            void doCreate(trimmed);
          }}
          className="mt-4 w-full rounded-2xl bg-primary py-3 font-semibold text-white"
        >
          No — create "{trimmed}" as new
        </button>
        <button
          onClick={() => setSuggest(null)}
          className="mt-2 w-full rounded-2xl border border-border py-3 text-sm font-medium text-ink-soft"
        >
          ←
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-8">
      <div className="text-5xl">⚽️</div>
      <h1 className="mt-3 text-2xl font-bold">{t("signin_title")}</h1>
      <p className="mt-1 text-ink-soft">{t("pick_your_name")}</p>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t("search_players")}
        className="mt-5 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-primary"
      />

      <ul className="mt-3 space-y-2">
        {filtered.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => pick(p)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-start active:opacity-80"
            >
              <Avatar avatar={p.avatar} name={p.display_name} size={40} className="border border-border text-2xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.display_name}</p>
                <p className="text-[11px] text-ink-soft">
                  {t("joined")} {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>
            </button>
          </li>
        ))}
        {filtered.length === 0 && trimmed && (
          <li className="rounded-2xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-ink-soft">
            No match for "{trimmed}".
          </li>
        )}
      </ul>

      <div className="mt-8 border-t border-border pt-5">
        <p className="px-1 text-[11px] uppercase tracking-wider text-ink-soft">New here?</p>
        <button
          onClick={tryCreate}
          disabled={!trimmed || busy}
          className="mt-2 w-full rounded-2xl border border-border bg-white py-3 text-sm font-semibold text-secondary disabled:opacity-40"
        >
          {trimmed ? `Create new player "${trimmed}"` : "Type a name above to create a new player"}
        </button>
      </div>
    </div>
  );
}
