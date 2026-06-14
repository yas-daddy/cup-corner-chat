import { buildPushPayload, type PushSubscription, type PushMessage } from "@block65/webcrypto-web-push";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function getVapid() {
  const publicKey =
    "BBHOkbPMfMrLv4y41ETQeyBeD1PbsETAMgsq-HEl-PVJ05a6B2ONLgr4UjFDbnPMD7eimhdPz6ol7ghILR93a9k";
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!privateKey || !subject) {
    throw new Error("VAPID_PRIVATE_KEY / VAPID_SUBJECT not configured");
  }
  return { publicKey, privateKey, subject };
}

export type StoredSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function sendPush(
  sub: StoredSubscription,
  payload: PushPayload,
): Promise<{ ok: boolean; status: number; dead: boolean }> {
  const vapid = getVapid();
  const subscription: PushSubscription = {
    endpoint: sub.endpoint,
    expirationTime: null,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  };
  const message: PushMessage = {
    data: payload as unknown as PushMessage["data"],
    options: { ttl: 60 * 60 * 24 },
  };
  const built = await buildPushPayload(message, subscription, vapid);
  try {
    const res = await fetch(sub.endpoint, {
      method: built.method,
      headers: built.headers,
      body: built.body,
    });
    const dead = res.status === 404 || res.status === 410;
    return { ok: res.ok, status: res.status, dead };
  } catch (e) {
    console.error("push send failed", sub.endpoint, e);
    return { ok: false, status: 0, dead: false };
  }
}

export async function sendPushToPlayers(
  playerIds: string[],
  payload: PushPayload,
): Promise<void> {
  if (playerIds.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, player_id")
    .in("player_id", playerIds);
  if (!subs || subs.length === 0) return;
  const results = await Promise.allSettled(
    subs.map((s) =>
      sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        payload,
      ),
    ),
  );
  const dead: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.dead) dead.push(subs[i].endpoint);
  });
  if (dead.length) {
    await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", dead);
  }
}
