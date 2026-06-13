import { createContext, useContext, useEffect, useState } from "react";

export type Lang = "en" | "fa";

type Dict = Record<string, string>;

const EN: Dict = {
  app_name: "WC26 Predictor",
  signin_title: "Welcome 👋",
  signin_subtitle: "Enter your first name to join the league.",
  first_name: "Your first name",
  lets_go: "Let's go",
  already_playing: "Already playing? Pick your name",
  pick_your_name: "Pick your name",
  continue_as: "Continue as",
  create_new: "Create new player",
  search_players: "Search players…",
  joined: "joined",
  home: "Picks",
  leaderboard: "Leaderboard",
  my_picks: "My Picks",
  upcoming: "Upcoming",
  live: "Live",
  finished: "Finished",
  results: "Results",

  locked: "Locked",
  saved: "Saved",
  not_predicted: "Not predicted",
  refresh: "Refresh match data",
  refreshing: "Refreshing…",
  no_matches: "No matches yet — tap Refresh to load fixtures.",
  no_picks: "You haven't made any predictions yet.",
  empty_leaderboard: "No players yet.",
  total_points: "Total points",
  correct_results: "Correct results",
  exact_scores: "Exact scores",
  predictions: "Predictions",
  rank: "#",
  player: "Player",
  pts: "pts",
  settings: "Settings",
  language: "Language",
  change_name: "Change name",
  avatar: "Avatar",

  save: "Save",
  scoring_title: "How scoring works",
  scoring_body: "+3 for the correct result (win / draw / loss). +5 bonus for the exact score. Exact = 8 points.",
  predicted: "Predicted",
  actual: "Actual",
  earned: "Earned",
  vs: "vs",
  group: "Group",
  stage: "Stage",
  kickoff: "Kickoff",
  loading: "Loading…",
  error_generic: "Something went wrong. Please try again.",
  language_en: "English",
  language_fa: "فارسی",
  feed: "Feed",
  feed_subtitle: "What other players are up to",
  no_activity: "No activity yet.",
  no_comments: "No comments yet.",
  write_a_comment: "Write a comment…",
  match_discussion: "Match discussion",
  on_pick_of: "on the pick of",
  ai_tag: "AI",
  karim_daily_title: "Daily wrap",
  load_more: "Load more",
  more_comments: "more",
  final: "FT",
  activity_predicted: "made a pick",
  activity_updated_pick: "updated a pick",
  activity_exact_score: "nailed the exact score",
  activity_correct_result: "got the result right",
  activity_no_points: "scored zero on this one",
  pick_avatar_title: "Pick your avatar",
  pick_avatar_sub: "Choose an emoji so other players can spot you in the feed.",
  notifications: "Notifications",
  no_notifications: "You're all caught up.",
  someone: "Someone",
  notif_liked: "liked your pick",
  notif_commented: "commented on your pick",
  notif_replied: "replied in a thread you're in",
  notif_result_exact: "You nailed the exact score! +8",
  notif_result_correct: "You got the result right. +3",
  notif_result_none: "Result is in — no points this time.",
  champion_title: "Competition Champion Prediction",
  champion_sub: "Pick the nation you think will lift the trophy.",
  champion_no_pick: "No champion picked yet.",
  pick_champion: "Pick champion",
  change: "Change",
  search_team: "Search team…",
  no_results: "No results.",
  champion_locks_in: "Locks in",
  champion_locked: "Locked — kickoff has begun.",
  champion_hidden_until_lock: "Hidden until June 20",

  d_short: "d",
  h_short: "h",
};

const FA: Dict = {
  app_name: "پیش‌بینی جام جهانی ۲۰۲۶",
  signin_title: "خوش آمدید 👋",
  signin_subtitle: "برای پیوستن به لیگ نام کوچک خود را وارد کنید.",
  first_name: "نام کوچک شما",
  lets_go: "بزن بریم",
  already_playing: "قبلاً ثبت‌نام کرده‌اید؟ نام خود را انتخاب کنید",
  pick_your_name: "نام خود را انتخاب کنید",
  continue_as: "ادامه به‌عنوان",
  create_new: "ایجاد کاربر جدید",
  search_players: "جستجوی بازیکنان…",
  joined: "پیوسته در",
  home: "پیش‌بینی‌ها",
  leaderboard: "جدول امتیازات",
  my_picks: "پیش‌بینی‌های من",
  upcoming: "آینده",
  live: "زنده",
  finished: "تمام‌شده",
  results: "نتایج",

  locked: "قفل شده",
  saved: "ذخیره شد",
  not_predicted: "پیش‌بینی نشده",
  refresh: "به‌روزرسانی بازی‌ها",
  refreshing: "در حال به‌روزرسانی…",
  no_matches: "هنوز بازی‌ای نیست — برای بارگذاری روی به‌روزرسانی بزنید.",
  no_picks: "هنوز هیچ پیش‌بینی‌ای نکرده‌اید.",
  empty_leaderboard: "هنوز بازیکنی نیست.",
  total_points: "مجموع امتیاز",
  correct_results: "نتایج درست",
  exact_scores: "نتیجه دقیق",
  predictions: "پیش‌بینی‌ها",
  rank: "#",
  player: "بازیکن",
  pts: "امتیاز",
  settings: "تنظیمات",
  language: "زبان",
  change_name: "تغییر نام",
  avatar: "آواتار",

  save: "ذخیره",
  scoring_title: "روش امتیازدهی",
  scoring_body: "+۳ برای نتیجه درست (برد/تساوی/باخت). +۵ امتیاز اضافی برای نتیجه دقیق. دقیق = ۸ امتیاز.",
  predicted: "پیش‌بینی شما",
  actual: "نتیجه واقعی",
  earned: "امتیاز",
  vs: "مقابل",
  group: "گروه",
  stage: "مرحله",
  kickoff: "شروع",
  loading: "در حال بارگذاری…",
  error_generic: "مشکلی پیش آمد. دوباره تلاش کنید.",
  language_en: "English",
  language_fa: "فارسی",
  feed: "فید",
  feed_subtitle: "فعالیت‌های دیگر بازیکنان",
  no_activity: "هنوز فعالیتی نیست.",
  no_comments: "هنوز نظری نیست.",
  write_a_comment: "نظر بنویسید…",
  match_discussion: "گفتگوی بازی",
  on_pick_of: "روی پیش‌بینی",
  ai_tag: "هوش مصنوعی",
  karim_daily_title: "خلاصه روز",
  load_more: "بیشتر",
  more_comments: "بیشتر",
  final: "پایان",
  activity_predicted: "پیش‌بینی کرد",
  activity_updated_pick: "پیش‌بینی را به‌روز کرد",
  activity_exact_score: "نتیجه دقیق را زد",
  activity_correct_result: "نتیجه را درست زد",
  activity_no_points: "امتیازی نگرفت",
  pick_avatar_title: "آواتار خود را انتخاب کنید",
  pick_avatar_sub: "یک ایموجی انتخاب کنید تا بازیکنان دیگر شما را در فید بشناسند.",
  notifications: "اعلان‌ها",
  no_notifications: "همه چیز خوانده شده است.",
  someone: "یک نفر",
  notif_liked: "پیش‌بینی شما را پسندید",
  notif_commented: "روی پیش‌بینی شما نظر گذاشت",
  notif_replied: "در گفتگویی که شما هم بودید پاسخ داد",
  notif_result_exact: "نتیجه دقیق را زدید! ۸+",
  notif_result_correct: "نتیجه را درست زدید. ۳+",
  notif_result_none: "نتیجه آمد — این بار امتیازی نگرفتید.",
  champion_title: "پیش‌بینی قهرمان مسابقات",
  champion_sub: "تیمی را که فکر می‌کنید قهرمان می‌شود انتخاب کنید.",
  champion_no_pick: "هنوز قهرمانی انتخاب نشده.",
  pick_champion: "انتخاب قهرمان",
  change: "تغییر",
  search_team: "جستجوی تیم…",
  no_results: "نتیجه‌ای نیست.",
  champion_locks_in: "قفل می‌شود تا",
  champion_locked: "قفل شده — مسابقات شروع شده است.",
  d_short: "روز",
  h_short: "ساعت",
};

// Country name translations (Farsi). Default to English name otherwise.
const COUNTRY_FA: Record<string, string> = {
  "United States": "ایالات متحده",
  USA: "ایالات متحده",
  Canada: "کانادا",
  Mexico: "مکزیک",
  Argentina: "آرژانتین",
  Brazil: "برزیل",
  Uruguay: "اروگوئه",
  Colombia: "کلمبیا",
  Ecuador: "اکوادور",
  Paraguay: "پاراگوئه",
  Chile: "شیلی",
  Peru: "پرو",
  Bolivia: "بولیوی",
  Venezuela: "ونزوئلا",
  France: "فرانسه",
  Spain: "اسپانیا",
  Germany: "آلمان",
  England: "انگلستان",
  Italy: "ایتالیا",
  Netherlands: "هلند",
  Portugal: "پرتغال",
  Belgium: "بلژیک",
  Croatia: "کرواسی",
  Switzerland: "سوئیس",
  Denmark: "دانمارک",
  Austria: "اتریش",
  Poland: "لهستان",
  Norway: "نروژ",
  Sweden: "سوئد",
  Wales: "ولز",
  Scotland: "اسکاتلند",
  Türkiye: "ترکیه",
  Turkey: "ترکیه",
  Serbia: "صربستان",
  Japan: "ژاپن",
  "Korea Republic": "کره جنوبی",
  "South Korea": "کره جنوبی",
  "IR Iran": "ایران",
  Iran: "ایران",
  "Saudi Arabia": "عربستان سعودی",
  Australia: "استرالیا",
  Qatar: "قطر",
  Uzbekistan: "ازبکستان",
  Jordan: "اردن",
  "United Arab Emirates": "امارات متحده عربی",
  Iraq: "عراق",
  Oman: "عمان",
  Morocco: "مراکش",
  Senegal: "سنگال",
  Tunisia: "تونس",
  Algeria: "الجزایر",
  Egypt: "مصر",
  Ghana: "غنا",
  Nigeria: "نیجریه",
  Cameroon: "کامرون",
  "Ivory Coast": "ساحل عاج",
  "Côte d'Ivoire": "ساحل عاج",
  "Cape Verde": "کیپ ورد",
  "South Africa": "آفریقای جنوبی",
  Mali: "مالی",
  Jamaica: "جامائیکا",
  Panama: "پاناما",
  "Costa Rica": "کاستاریکا",
  Honduras: "هندوراس",
  Curaçao: "کوراسائو",
  Haiti: "هائیتی",
  Suriname: "سورینام",
  "New Zealand": "نیوزیلند",
};

export function translateCountry(name: string | null | undefined, lang: Lang): string {
  if (!name) return "";
  if (lang === "fa") return COUNTRY_FA[name] ?? name;
  return name;
}

const DICTS: Record<Lang, Dict> = { en: EN, fa: FA };

export function t(key: keyof typeof EN | string, lang: Lang): string {
  return DICTS[lang][key] ?? EN[key] ?? key;
}

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
export function toLocaleDigits(value: string | number, lang: Lang): string {
  const s = String(value);
  if (lang !== "fa") return s;
  return s.replace(/[0-9]/g, (d) => FA_DIGITS[parseInt(d, 10)]);
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void };
export const I18nContext = createContext<Ctx>({ lang: "en", setLang: () => {} });

export function useI18n() {
  const ctx = useContext(I18nContext);
  return {
    lang: ctx.lang,
    setLang: ctx.setLang,
    t: (k: string) => t(k, ctx.lang),
    tc: (name?: string | null) => translateCountry(name, ctx.lang),
    n: (v: string | number) => toLocaleDigits(v, ctx.lang),
    dir: ctx.lang === "fa" ? ("rtl" as const) : ("ltr" as const),
  };
}

export function useLangBootstrap(): Ctx {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const stored = (typeof window !== "undefined" && (localStorage.getItem("wc26.lang") as Lang)) || "en";
    setLangState(stored);
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("wc26.lang", l);
  };
  return { lang, setLang };
}
