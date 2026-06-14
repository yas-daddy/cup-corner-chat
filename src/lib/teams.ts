// 48 confirmed/expected World Cup 2026 nations. Names match the football-data.org
// "name" field; fallbacks added. Keys are upper-cased name; values are ISO alpha-2.
const RAW: Record<string, string> = {
  "United States": "US",
  USA: "US",
  Canada: "CA",
  Mexico: "MX",
  Argentina: "AR",
  Brazil: "BR",
  Uruguay: "UY",
  Colombia: "CO",
  Ecuador: "EC",
  Paraguay: "PY",
  Chile: "CL",
  Peru: "PE",
  Bolivia: "BO",
  Venezuela: "VE",
  France: "FR",
  Spain: "ES",
  Germany: "DE",
  England: "ENG",
  Italy: "IT",
  Netherlands: "NL",
  Portugal: "PT",
  Belgium: "BE",
  Croatia: "HR",
  Switzerland: "CH",
  Denmark: "DK",
  Austria: "AT",
  Poland: "PL",
  Norway: "NO",
  Sweden: "SE",
  Wales: "WLS",
  Scotland: "SCT",
  Republic: "IE",
  Türkiye: "TR",
  Turkey: "TR",
  Serbia: "RS",
  Japan: "JP",
  "Korea Republic": "KR",
  "South Korea": "KR",
  "IR Iran": "IR",
  Iran: "IR",
  "Saudi Arabia": "SA",
  Australia: "AU",
  Qatar: "QA",
  Uzbekistan: "UZ",
  Jordan: "JO",
  "United Arab Emirates": "AE",
  Iraq: "IQ",
  Oman: "OM",
  Morocco: "MA",
  Senegal: "SN",
  Tunisia: "TN",
  Algeria: "DZ",
  Egypt: "EG",
  Ghana: "GH",
  Nigeria: "NG",
  Cameroon: "CM",
  "Ivory Coast": "CI",
  "Côte d'Ivoire": "CI",
  "Cape Verde": "CV",
  "Cape Verde Islands": "CV",
  "Cabo Verde": "CV",
  "Bosnia-Herzegovina": "BA",
  "Bosnia and Herzegovina": "BA",
  Czechia: "CZ",
  "Czech Republic": "CZ",
  "Congo DR": "CD",
  "DR Congo": "CD",
  "Democratic Republic of the Congo": "CD",
  "South Africa": "ZA",
  Mali: "ML",
  Jamaica: "JM",
  Panama: "PA",
  "Costa Rica": "CR",
  Honduras: "HN",
  Curaçao: "CW",
  Haiti: "HT",
  Suriname: "SR",
  "New Zealand": "NZ",
};

const MAP = new Map<string, string>();
for (const [k, v] of Object.entries(RAW)) MAP.set(k.toLowerCase(), v);

export function codeForTeam(name?: string | null): string | null {
  if (!name) return null;
  return MAP.get(name.toLowerCase()) ?? null;
}

// The DB sometimes stores "GB" (Union Jack) for UK home nations. Resolve the
// most specific code possible for a team, preferring the stored code when it
// is concrete, and falling back to the team name mapping otherwise.
export function resolveTeamCode(code: string | null | undefined, name?: string | null): string | null {
  if (code && code.toUpperCase() !== "GB") return code;
  const mapped = codeForTeam(name);
  if (mapped && mapped !== "GB") return mapped;
  return code ?? mapped ?? null;
}
