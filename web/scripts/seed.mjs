// Creates the admin account and, with --demo, mock accounts + sample parking spaces around Bangkok.
//
//   npm run db:seed            -> admin only (use this for production)
//   npm run db:seed -- --demo  -> + demo user, demo owner, 6 approved spaces, 1 pending space
//
// Env: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (defaults are for local dev only).
// Safe to run again: existing accounts/spaces are left alone.
import bcrypt from "bcryptjs";
import pg from "pg";

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";
const demo = process.argv.includes("--demo");

const accounts = [{ email: adminEmail, password: adminPassword, name: "Admin", role: "admin" }];
if (demo) {
  accounts.push(
    { email: "demo@example.com", password: "demo1234", name: "Demo User", role: "user" },
    { email: "owner@example.com", password: "owner1234", name: "Demo Owner", role: "user" },
  );
}

// [title, address, lat, lng, cars, motorcycles, car ฿/h, moto ฿/h, open hour, close hour, closed days, status, full-for-next-3h]
const spots = [
  ["ลานจอดสยามสแควร์", "Siam Square Soi 3, Pathum Wan, Bangkok", 13.7455, 100.5342, 6, 10, 40, 10, 6, 22, [], "approved", false],
  ["บ้านจอดรถ อารีย์", "Soi Ari 1, Phaya Thai, Bangkok", 13.7794, 100.5446, 2, 4, 30, 10, 7, 21, [], "approved", false],
  ["ที่จอดใกล้ BTS อโศก", "Sukhumvit 21, Watthana, Bangkok", 13.7377, 100.5604, 4, 0, 50, 0, 0, 24, [], "approved", false],
  ["ลานจอดทองหล่อ", "Thong Lo Soi 10, Watthana, Bangkok", 13.7306, 100.5788, 1, 3, 60, 15, 8, 23, [], "approved", true],
  ["ที่จอดข้างสวนจตุจักร", "Kamphaeng Phet 3, Chatuchak, Bangkok", 13.8003, 100.5529, 8, 12, 25, 8, 6, 20, [0], "approved", false],
  ["ลานจอดสีลม", "Silom Soi 4, Bang Rak, Bangkok", 13.7279, 100.5316, 5, 5, 45, 12, 7, 22, [0, 6], "approved", false],
  ["ที่จอดบ้านสวน บางนา (รอตรวจสอบ)", "Bang Na-Trat Rd, Bang Na, Bangkok", 13.6685, 100.6043, 3, 2, 35, 10, 8, 20, [], "pending", false],
];

function photo(label, hue) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},70%,55%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},70%,35%)"/>` +
    `</linearGradient></defs><rect width="640" height="480" fill="url(#g)"/>` +
    `<text x="320" y="280" font-family="sans-serif" font-size="190" font-weight="700" fill="white" fill-opacity=".9" text-anchor="middle">P</text>` +
    `<text x="320" y="430" font-family="sans-serif" font-size="30" fill="white" fill-opacity=".85" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

async function upsertUser({ email, password, name, role }) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
     RETURNING id, (xmax = 0) AS inserted`,
    [email, hash, name, role],
  );
  return rows[0];
}

try {
  const ids = {};
  for (const account of accounts) {
    const { id, inserted } = await upsertUser(account);
    ids[account.email] = id;
    console.log(
      inserted
        ? `Created ${account.role}: ${account.email} / ${account.password}`
        : `Already exists (password unchanged): ${account.email}`,
    );
  }
  if (!demo) {
    console.log("Change the admin password before going live.");
  } else {
    const adminId = ids[adminEmail];
    const ownerId = ids["owner@example.com"];
    const renterId = ids["demo@example.com"];
    const nextHour = new Date((Math.floor(Date.now() / 3_600_000) + 1) * 3_600_000);

    for (const [title, address, lat, lng, cars, motos, carPrice, motoPrice, open, close, closedDays, status, fullSoon] of spots) {
      const exists = await client.query("SELECT 1 FROM listings WHERE title = $1 AND owner_id = $2", [title, ownerId]);
      if (exists.rowCount) continue;

      const approved = status === "approved";
      const { rows } = await client.query(
        `INSERT INTO listings
           (owner_id, title, description, address, location, car_capacity, motorcycle_capacity,
            car_price_per_hour, moto_price_per_hour, status, reviewed_by, reviewed_at)
         VALUES ($1, $2, 'Demo listing', $3, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
                 $6, $7, $8, $9, $10::listing_status, $11, $12)
         RETURNING id`,
        [ownerId, title, address, lat, lng, cars, motos, carPrice, motoPrice, status, approved ? adminId : null, approved ? new Date() : null],
      );
      const listingId = rows[0].id;

      for (let d = 0; d < 7; d++) {
        if (closedDays.includes(d)) continue;
        await client.query(
          `INSERT INTO listing_availability (listing_id, day_of_week, start_hour, end_hour) VALUES ($1, $2, $3, $4)`,
          [listingId, d, open, close],
        );
      }
      if (approved) {
        const hue = Math.round((lat * 1000 + lng * 100) % 360);
        for (const [i, label] of ["Entrance", "Parking area", "Street view"].entries()) {
          await client.query(`INSERT INTO listing_photos (listing_id, url, sort_order) VALUES ($1, $2, $3)`, [
            listingId,
            photo(label, hue + i * 25),
            i,
          ]);
        }
      }
      if (fullSoon) {
        // Fills the only car space for the next 3 hours so the map shows a red "full" pin.
        const end = new Date(nextHour.getTime() + 3 * 3_600_000);
        await client.query(
          `INSERT INTO bookings (listing_id, user_id, vehicle_type, start_at, end_at, total_price, commission)
           VALUES ($1, $2, 'car', $3, $4, $5, $6)`,
          [listingId, renterId, nextHour, end, carPrice * 3, Math.round(carPrice * 3 * 0.15 * 100) / 100],
        );
      }
    }
    console.log("Demo spaces ready (6 approved on the map, 1 pending for the admin to review).");
  }
} finally {
  await client.end();
}
