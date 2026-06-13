// AI roast/recap bot identity. Keep this id in sync with the seeded
// players row and the partial unique index on comments.
export const KARIM_ID = "ca710000-0000-4000-8000-000000000001";
export const KARIM_NAME = "Karim";
export const KARIM_AVATAR = "🤖";

export function isKarim(id: string | null | undefined) {
  return id === KARIM_ID;
}
