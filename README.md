# ParkSpot — ระบบจองที่จอดรถ (Parking Agency)

เว็บแพลตฟอร์มที่ให้เจ้าของที่ปล่อยเช่าที่จอดรถ และให้ผู้ใช้ค้นหา/จองที่จอดบนแผนที่ โดยทีมงาน (Agency) เป็นตัวกลางตรวจสอบและอนุมัติรายการก่อนขึ้นระบบ รองรับภาษาไทย/อังกฤษ

## ฟีเจอร์ในเฟสแรก

- **หน้าแรกคือแผนที่** (OpenStreetMap + Leaflet) เปิดดูได้โดยไม่ต้องล็อกอิน แสดงหมุดที่จอดพร้อมจำนวนช่องว่างตามวัน/เวลา/ประเภทรถที่เลือก (เขียว = ว่าง, แดง = เต็ม, เทา = ปิด)
- แถบข้างซ้าย: ช่องค้นหา + รายการที่จอด → กดเลือก (ในรายการหรือบนแผนที่) แล้วแผนที่ซูมเข้าจุดนั้นและแสดงรายละเอียด/รูป/ราคา → กด "จอง"
- ถ้ายังไม่ล็อกอิน การกด "ล็อกอิน", "จอง" หรือ "ลงทะเบียนที่จอดรถ" จะเด้ง **ป๊อปอัปล็อกอิน/สมัครสมาชิก** ทับหน้าที่เบลอพื้นหลัง ล็อกอินเสร็จแล้วทำรายการที่ค้างไว้ต่อให้อัตโนมัติ
- จองรายชั่วโมง พร้อมกันจองซ้อนด้วยการล็อกแถวใน transaction จากนั้นแสดงขั้น **รอยืนยัน → ชำระเงิน** (ตอนนี้เป็น placeholder ยังไม่มีการยืนยัน/ชำระเงินจริง และที่จอดถูกกันไว้ให้ทันทีที่กดจอง)
- หน้า **ลงทะเบียนที่จอดรถ** (แยกหน้า): รายละเอียด, ปักหมุด, จำนวนรถยนต์/มอเตอร์ไซค์ที่จอดได้, ตั้งราคา, รูป, เวลาเปิด → ส่งแล้วไปหน้า "รอยืนยัน" ระหว่างรอแอดมินอนุมัติ
- 2 บทบาท: `user`, `admin` (ผู้ใช้ทุกคนจองและปล่อยเช่าได้)
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

### บัญชีสมมติ (หลังรัน `npm run db:seed -- --demo`)

| บทบาท | อีเมล | รหัสผ่าน |
|---|---|---|
| ผู้ใช้ทั่วไป (ลูกค้า) | `demo@example.com` | `demo1234` |
| เจ้าของที่จอด (มีที่จอดตัวอย่าง 6 จุด + 1 จุดรอตรวจ) | `owner@example.com` | `owner1234` |
| แอดมิน (อนุมัติรายการ) | `admin@example.com` | `admin1234` |

ในป๊อปอัปล็อกอินจะมีปุ่มกรอกบัญชีเหล่านี้ให้อัตโนมัติเมื่อ `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true` (ค่าเริ่มต้นใน `.env.example` สำหรับเครื่องตัวเอง) — **ห้ามเปิดบน production** และเปลี่ยนรหัสผ่านแอดมินก่อนใช้งานจริงผ่าน `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`

ลองดู: ล็อกอินด้วย `demo@` แล้วเลือก "ลานจอดทองหล่อ" (ถูกจองเต็มใน 3 ชั่วโมงข้างหน้า จะเห็นหมุดแดง) · ล็อกอินด้วย `admin@` เข้าเมนู "แอดมิน" เพื่ออนุมัติที่จอดที่รอตรวจ

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
5. **Environment Variables**: `DATABASE_URL`, `AUTH_SECRET` (สุ่มยาวๆ), และ `AI_PROVIDER=none` — **อย่า**ตั้ง `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS` บน production
6. Deploy

## หมายเหตุสำคัญ

- โค้ดชุดนี้ยังไม่เคยถูก build/รันจริงในสภาพแวดล้อมที่สร้าง (ติดตั้งแพ็กเกจไม่ได้) — ถ้า `npm run build` หรือ `npm run typecheck --prefix web` ฟ้อง error ให้แก้ตามที่แจ้ง
- แผนที่ใช้ tile ของ OpenStreetMap ซึ่งเหมาะกับช่วงพัฒนา/ทราฟฟิกน้อย ถ้าขึ้นใช้งานจริงควรใช้ผู้ให้บริการ tile ของตัวเองหรือแบบเสียเงิน ([นโยบาย](https://operations.osmfoundation.org/policies/tiles/))
- รูปที่อัปโหลดเก็บบน Vercel Blob (ต้องมี `BLOB_READ_WRITE_TOKEN`) — ถ้ารันในเครื่องโดยไม่มี token การอัปโหลดรูปจะล้มเหลว แต่ส่งรายการโดยไม่ใส่รูปได้ (ดึง token ลงเครื่องด้วย `vercel env pull web/.env.local`)

อ่านต่อ: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/ROADMAP.md](docs/ROADMAP.md)
