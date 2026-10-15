// Creates an admin account and (with --demo) a few approved demo listings in Bangkok.
// Usage: npm run db:seed            -> admin only
//        npm run db:seed -- --demo  -> admin + demo owner + demo listings
// Env: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (defaults are for local dev only).
import bcrypt from "bcryptjs";
import pg from "pg";

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";
const demo = process.argv.includes("--demo");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

async function upsertUser(email, password, name, role) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
     RETURNING id`,
    [email, hash, name, role],
  );
  return rows[0].id;
}

try {
  const adminId = await upsertUser(adminEmail, adminPassword, "Admin", "admin");
  console.log(`Admin ready: ${adminEmail} / ${adminPassword}  (change this outside local dev)`);

  if (demo) {
    const ownerId = await upsertUser("owner@example.com", "owner1234", "Demo Owner", "user");
    const spots = [
      ["ลานจอดสยามสแควร์", "Siam Square Soi 3, Pathum Wan, Bangkok", 13.7455, 100.5342, 6, 10, 40, 10],
      ["บ้านจอดรถ อารีย์", "Soi Ari 1, Phaya Thai, Bangkok", 13.7794, 100.5446, 2, 4, 30, 10],
      ["ที่จอดใกล้ BTS อโศก", "Sukhumvit 21, Watthana, Bangkok", 13.7377, 100.5604, 4, 0, 50, 0],
    ];
    for (const [title, address, lat, lng, cars, motos, carPrice, motoPrice] of spots) {
      const exists = await client.query("SELECT 1 FROM listings WHERE title = $1 AND owner_id = $2", [
        title,
        ownerId,
      ]);
      if (exists.rowCount) continue;
      const { rows } = await client.query(
        `INSERT INTO listings
           (owner_id, title, description, address, location, car_capacity, motorcycle_capacity,
            car_price_per_hour, moto_price_per_hour, status, reviewed_by, reviewed_at)
         VALUES ($1, $2, 'Demo listing', $3, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
                 $6, $7, $8, $9, 'approved', $10, now())
         RETURNING id`,
        [ownerId, title, address, lat, lng, cars, motos, carPrice, motoPrice, adminId],
      );
      // Open every day 06:00-22:00 (Asia/Bangkok).
      for (let d = 0; d < 7; d++) {
        await client.query(
          `INSERT INTO listing_availability (listing_id, day_of_week, start_hour, end_hour)
           VALUES ($1, $2, 6, 22)`,
          [rows[0].id, d],
        );
      }
    }
    console.log("Demo data ready. Demo owner: owner@example.com / owner1234");
  }
} finally {
  await client.end();
}
