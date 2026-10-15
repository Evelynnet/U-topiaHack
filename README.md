# ParkSpot — ระบบจองที่จอดรถ (Parking Agency)

เว็บแพลตฟอร์มที่ให้เจ้าของที่ปล่อยเช่าที่จอดรถ และให้ผู้ใช้ค้นหา/จองที่จอดบนแผนที่ โดยทีมงาน (Agency) เป็นตัวกลางตรวจสอบและอนุมัติรายการก่อนขึ้นระบบ รองรับภาษาไทย/อังกฤษ

## ฟีเจอร์ในเฟสแรก

- สมัครสมาชิก/เข้าสู่ระบบด้วยอีเมล + รหัสผ่าน (2 บทบาท: `user`, `admin`)
- หน้าแผนที่ (OpenStreetMap + Leaflet) แสดงที่จอดพร้อมจำนวนช่องว่างตามวัน/เวลา/ประเภทรถที่เลือก
- จองรายชั่วโมง (ยังไม่เก็บเงิน) พร้อมกันจองซ้อนด้วยการล็อกแถวใน transaction
- เจ้าของที่ส่งที่จอดเข้าระบบ: พิกัดบนแผนที่, รูป, พื้นที่, จำนวนรถยนต์/มอเตอร์ไซค์ที่จอดได้, ราคา, ตารางเวลาเปิดรายสัปดาห์
- แอดมินอนุมัติ/ปฏิเสธ และกำหนดค่าคอมมิชชั่น (%) ต่อรายการ (ค่าเริ่มต้น 15%)
- จุดเชื่อมต่อ AI สำหรับตรวจสอบรายการในอนาคต (`web/src/lib/ai`, ตอนนี้ปิดอยู่)

## โครงสร้าง (monorepo)

```
parking-agency/
├── db/migrations/     # SQL schema (PostgreSQL + PostGIS)
├── web/               # Next.js 15 + TypeScript (หน้าเว็บ + API ในโปรเจ็คเดียว)
│   ├── scripts/       # migrate.mjs, seed.mjs
│   └── src/
│       ├── app/[locale]/   # หน้าเว็บ (th/en)
│       ├── app/api/        # REST API (auth, listings, bookings, admin, uploads token)
│       ├── components/     # UI
│       ├── i18n/           # พจนานุกรมไทย/อังกฤษ
│       └── lib/            # db, auth, validation, ai
├── docs/              # ARCHITECTURE.md, ROADMAP.md
└── docker-compose.yml # PostgreSQL + PostGIS สำหรับพัฒนา
```

## เริ่มใช้งาน (ต้องมี Node.js 20.6+ และ Docker)

```bash
# 1) ติดตั้งแพ็กเกจ
npm run install:all

# 2) ตั้งค่า environment
cp web/.env.example web/.env.local
#    แก้ AUTH_SECRET เป็นสตริงสุ่มยาวๆ  (เช่น: openssl rand -base64 48)

# 3) เปิดฐานข้อมูล + สร้างตาราง
npm run db:up
npm run db:migrate

# 4) สร้างแอดมิน (+ ข้อมูลตัวอย่าง 3 จุดในกรุงเทพฯ ถ้าใส่ --demo)
npm run db:seed -- --demo

# 5) รัน
npm run dev        # http://localhost:3000
```

บัญชีตัวอย่างหลัง seed: `admin@example.com / admin1234` (แอดมิน), `owner@example.com / owner1234` (เจ้าของที่)
**เปลี่ยนรหัสผ่านแอดมินก่อนขึ้นใช้งานจริง** — ตั้งผ่าน `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`

## ขึ้น GitHub

```bash
git remote add origin git@github.com:<your-user>/parking-agency.git
git push -u origin main
```

## Deploy ขึ้น Vercel

1. **ฐานข้อมูล**: สร้าง Postgres ที่รองรับ PostGIS (เช่น Neon หรือ Supabase) แล้วเปิด extension: `CREATE EXTENSION IF NOT EXISTS postgis;` ใช้ connection string แบบ **pooled** และมี `?sslmode=require`
2. **สร้างตาราง** (รันจากเครื่องคุณ ชี้ไปที่ฐานออนไลน์):
   ```bash
   # ใส่ DATABASE_URL ของฐานออนไลน์ใน web/.env.local ชั่วคราว
   npm run db:migrate
   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='<รหัสผ่านจริง>' npm run db:seed
   ```
   (ไม่ต้องใส่ `--demo` บน production)
3. **Vercel**: Import repo จาก GitHub → ตั้ง **Root Directory = `web`** (Framework: Next.js)
4. **Blob**: ในโปรเจ็ค Vercel ไปที่ Storage → Create → **Blob** → เลือกความเป็น **Public** แล้วเชื่อมกับโปรเจ็ค (Vercel จะเพิ่ม `BLOB_READ_WRITE_TOKEN` ให้เอง)
5. **Environment Variables**: `DATABASE_URL`, `AUTH_SECRET` (สุ่มยาวๆ), และ `AI_PROVIDER=none`
6. Deploy

## หมายเหตุสำคัญ

- โค้ดชุดนี้ยังไม่เคยถูก build/รันจริงในสภาพแวดล้อมที่สร้าง (ติดตั้งแพ็กเกจไม่ได้) — ถ้า `npm run build` หรือ `npm run typecheck --prefix web` ฟ้อง error ให้แก้ตามที่แจ้ง
- แผนที่ใช้ tile ของ OpenStreetMap ซึ่งเหมาะกับช่วงพัฒนา/ทราฟฟิกน้อย ถ้าขึ้นใช้งานจริงควรใช้ผู้ให้บริการ tile ของตัวเองหรือแบบเสียเงิน ([นโยบาย](https://operations.osmfoundation.org/policies/tiles/))
- รูปที่อัปโหลดเก็บบน Vercel Blob (ต้องมี `BLOB_READ_WRITE_TOKEN`) — ถ้ารันในเครื่องโดยไม่มี token การอัปโหลดรูปจะล้มเหลว แต่ส่งรายการโดยไม่ใส่รูปได้ (ดึง token ลงเครื่องด้วย `vercel env pull web/.env.local`)

อ่านต่อ: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/ROADMAP.md](docs/ROADMAP.md)
