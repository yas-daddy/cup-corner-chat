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

const DAILY_SYSTEM = `You are Karim, an AI football pundit writing a daily World Cup recap for a private prediction league.
Rules:
- 3-5 short sentences, max 90 words total.
- Reference at least one actual match result (teams + score) and name players who nailed exact scores or got embarrassed.
- Always mention the day's top scorer and the overall leader by name if given.
- Confident, witty, mildly roasty British football-banter tone. No emojis, no hashtags, no markdown.
- Don't introduce yourself or sign off. Just deliver the recap.`;

export type MatchResult = {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  exactWinners: string[]; // display names who got 8 pts
  zeroCount: number; // how many players got 0 pts on this match
  totalPicks: number;
};

export async function writeDailySummary(input: {
  dayLabel: string;
  topScorerName: string | null;
  topScorerPts: number;
  finishedMatches: number;
  newPicks: number;
  leaderName: string | null;
  leaderPts: number;
  matches: MatchResult[];
  biggestUpset: MatchResult | null;
}): Promise<string> {
  const matchLines = input.matches.map((m) => {
    const exact = m.exactWinners.length
      ? `Exact score by: ${m.exactWinners.join(", ")}.`
      : "Nobody got the exact score.";
    return `${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam} — ${exact} ${m.zeroCount}/${m.totalPicks} picks got zero.`;
  });

  const upsetLine = input.biggestUpset
    ? `Biggest upset of the day: ${input.biggestUpset.homeTeam} ${input.biggestUpset.homeScore}-${input.biggestUpset.awayScore} ${input.biggestUpset.awayTeam} (${input.biggestUpset.zeroCount}/${input.biggestUpset.totalPicks} predictors wrong).`
    : "";

  const parts = [
    `Day: ${input.dayLabel}.`,
    `Finished matches: ${input.finishedMatches}. New picks logged: ${input.newPicks}.`,
    ...matchLines,
    upsetLine,
    input.topScorerName
      ? `Top scorer of the day: ${input.topScorerName} with ${input.topScorerPts} pts.`
      : "Nobody scored anything today.",
    input.leaderName
      ? `Overall leader: ${input.leaderName} on ${input.leaderPts} pts.`
      : "",
  ].filter(Boolean).join(" ");

  return chat(DAILY_SYSTEM, parts, 280);
}
