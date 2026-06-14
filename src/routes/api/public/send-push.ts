import { createFileRoute } from "@tanstack/react-router";

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  kind: "like" | "comment" | "reply" | "result";
  target_type: "prediction" | "activity" | "match";
  target_id: string;
  match_id: string | null;
  points: number | null;
};

function formatBody(
  kind: NotificationRow["kind"],
  actorName: string | null,
  points: number | null,
): { title: string; body: string } {
  const who = actorName || "Someone";
  if (kind === "like") return { title: "WC26", body: `${who} liked your pick` };
  if (kind === "comment") return { title: "WC26", body: `${who} commented on your pick` };
  if (kind === "reply") return { title: "WC26", body: `${who} replied in your thread` };
  // result
  if (points === 8) return { title: "WC26 — Result", body: "You nailed the exact score! +8" };
  if (points === 3) return { title: "WC26 — Result", body: "You got the result right. +3" };
  return { title: "WC26 — Result", body: "Result is in — no points this time." };
}

export const Route = createFileRoute("/api/public/send-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { notification_id } = (await request.json()) as { notification_id?: string };
          if (!notification_id) {
            return Response.json({ ok: false, error: "missing notification_id" }, { status: 400 });
          }
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: notif } = await supabaseAdmin
            .from("notifications")
            .select("*")
            .eq("id", notification_id)
            .maybeSingle<NotificationRow>();
          if (!notif) {
            return Response.json({ ok: false, error: "not found" }, { status: 404 });
          }

          let actorName: string | null = null;
          if (notif.actor_id) {
            const { data: actor } = await supabaseAdmin
              .from("players")
              .select("display_name")
              .eq("id", notif.actor_id)
              .maybeSingle();
            actorName = actor?.display_name ?? null;
          }
          const { title, body } = formatBody(notif.kind, actorName, notif.points);
          const url = notif.match_id ? `/matches/${notif.match_id}` : "/";

          const { sendPushToPlayers } = await import("@/lib/webpush.server");
          await sendPushToPlayers([notif.recipient_id], {
            title,
            body,
            url,
            tag: `notif:${notif.id}`,
          });
          return Response.json({ ok: true });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("send-push error", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
