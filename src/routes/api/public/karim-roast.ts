import { createFileRoute } from "@tanstack/react-router";

const KARIM_ID = "ca710000-0000-4000-8000-000000000001";

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

function authorize(request: Request) {
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
  const got =
    request.headers.get("apikey") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return !!expected && got === expected;
}

export const Route = createFileRoute("/api/public/karim-roast")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorize(request)) return unauthorized();
        // Karim roasts are disabled — daily wrap still runs via karim-daily.
        return Response.json({ skipped: "roasts disabled" });
      },

    },
  },
});
