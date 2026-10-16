import { query } from "./db";

/** A person counts as a parking-space owner once they have submitted at least one space. */
export async function isListingOwner(userId: string): Promise<boolean> {
  const rows = await query<{ owner: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM listings WHERE owner_id = $1) AS owner`,
    [userId],
  );
  return rows[0]?.owner === true;
}
