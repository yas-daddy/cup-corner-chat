// Server-only helpers for the Karim AI bot. Calls Lovable AI Gateway directly
// over fetch — kept tiny on purpose; we don't need the full AI SDK for two
// short text completions per day.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

async function chat(system: string, user: string, max = 80): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: MODEL,
      max_completion_tokens: max,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lovable AI ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const out = data.choices?.[0]?.message?.content?.trim() ?? "";
  // Strip any leading/trailing quotes Gemini sometimes adds
  return out.replace(/^["'`]+|["'`]+$/g, "").trim();
}

const ROAST_SYSTEM = `You are Karim, an AI football pundit. You roast bad World Cup predictions.
Rules:
- 1 sentence, max 20 words. Punchy, savage, FUNNY.
- Mock the PICK, never the person.
- No emojis. No hashtags. No quotes around your reply.
- British football-banter tone. Slightly mean. Never slurs, never personal.`;

export async function roastPrediction(input: {
  playerName: string;
  homeTeam: string;
  awayTeam: string;
  predHome: number;
  predAway: number;
  finalHome: number;
  finalAway: number;
}): Promise<string> {
  const prompt = `${input.playerName} predicted ${input.homeTeam} ${input.predHome}-${input.predAway} ${input.awayTeam}. It actually finished ${input.finalHome}-${input.finalAway}. They got ZERO points. Roast the pick.`;
  return chat(ROAST_SYSTEM, prompt, 80);
}

const DAILY_SYSTEM = `You are Karim, an AI football pundit writing a daily World Cup recap.
Rules:
- 2-4 short sentences, max 60 words total.
- Mention the top scorer of the day and the current leader by name if given.
- Confident, witty, mildly roasty. No emojis, no hashtags, no markdown.
- Don't introduce yourself. Just deliver the recap.`;

export async function writeDailySummary(input: {
  dayLabel: string;
  topScorerName: string | null;
  topScorerPts: number;
  finishedMatches: number;
  newPicks: number;
  leaderName: string | null;
  leaderPts: number;
}): Promise<string> {
  const parts = [
    `Day: ${input.dayLabel}.`,
    `Finished matches: ${input.finishedMatches}.`,
    `New picks logged: ${input.newPicks}.`,
    input.topScorerName
      ? `Top scorer of the day: ${input.topScorerName} with ${input.topScorerPts} pts.`
      : "Nobody scored anything today.",
    input.leaderName
      ? `Overall leader: ${input.leaderName} on ${input.leaderPts} pts.`
      : "",
  ].filter(Boolean).join(" ");
  return chat(DAILY_SYSTEM, parts, 180);
}
