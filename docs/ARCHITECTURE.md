# สถาปัตยกรรม

## ภาพรวม

```
Browser ── Next.js (React UI, Leaflet) ──┐
                                         ├─ Route handlers /api/*  ── PostgreSQL + PostGIS
Middleware (locale + route guard) ───────┘                         └─ Vercel Blob (รูป)
```

Next.js ตัวเดียวทำทั้งหน้าเว็บและ API (`web/src/app/api`) เพื่อให้เริ่มง่าย ถ้าอนาคตต้องแยกหลังบ้าน (เช่น ฝั่ง AI เป็น Python) ให้ย้ายตรรกะใน `web/src/lib` + route handlers ออกเป็นบริการแยกได้โดย schema/SQL ไม่ต้องเปลี่ยน

## รูปภาพ

เบราว์เซอร์อัปโหลดรูปตรงไปที่ Vercel Blob (public store) — `POST /api/uploads` ทำหน้าที่ออก token ให้เฉพาะผู้ที่ล็อกอิน (JPG/PNG/WebP ไม่เกิน 5 MB) ไฟล์จึงไม่ผ่านฟังก์ชัน และไม่ติดเพดาน ~4.5 MB ของ Vercel API รับเฉพาะ URL ที่ลงท้าย `.public.blob.vercel-storage.com` เก็บในตาราง `listing_photos`

## ข้อมูล (db/migrations/001_init.sql)

| ตาราง | หน้าที่ |
|---|---|
| `users` | บัญชี, `role` = `user` \| `admin` |
| `listings` | ที่จอดที่เจ้าของส่งมา, `location` เป็น PostGIS `geography(Point)`, `status` = `pending/approved/rejected`, `commission_rate`, `ai_review` (jsonb สำรองไว้สำหรับ AI) |
| `listing_photos` | รูปของที่จอด |
| `listing_availability` | ตารางเปิดรายสัปดาห์ (วัน + ชั่วโมงเริ่ม/จบ เวลา Asia/Bangkok) |
| `bookings` | การจองรายชั่วโมง, เก็บ `total_price` และ `commission` ณ ตอนจอง |

ฟังก์ชัน SQL:
- `listing_is_open(listing, start, end)` — ทุกชั่วโมงในช่วงที่ขอต้องอยู่ในตารางเปิดของเจ้าของ
- `listing_peak_usage(listing, start, end, vehicle)` — จำนวนการจองสูงสุดที่ซ้อนกันในชั่วโมงใดชั่วโมงหนึ่งของช่วง ช่องว่าง = ความจุ − ค่านี้ (แม่นยำกว่าการนับทุกการจองที่ทับช่วง)

## การจองและกันจองซ้อน

`POST /api/bookings` เปิด transaction → `SELECT ... FOR UPDATE` ล็อกแถวของที่จอด → เช็กว่าเปิดและยังไม่เต็ม → insert ดังนั้นสองคนที่จองช่องสุดท้ายพร้อมกันจะผ่านได้แค่คนเดียว

## การยืนยันตัวตน

อีเมล + รหัสผ่าน (bcrypt) → JWT (HS256, `jose`) ใน cookie `session` แบบ httpOnly, sameSite=lax, อายุ 7 วัน
- หน้าแรก (แผนที่) และ `GET /api/listings` เปิดสาธารณะ; การจอง การส่งที่จอด และอัปโหลดรูปต้องล็อกอิน
- ล็อกอิน/สมัครเป็นป๊อปอัป (`AuthProvider` + `AuthModal`) ไม่ใช่หน้าแยก: `requireLogin()` เปิดป๊อปอัปแล้วทำรายการที่ค้างต่อหลังล็อกอิน
- `middleware.ts` ตรวจ cookie เฉพาะ `/owner`, `/bookings`, `/admin` ถ้าไม่ได้ล็อกอินจะ redirect ไปหน้าแรกพร้อม `?login=1&next=...` เพื่อเปิดป๊อปอัป; URL เก่า `/map`, `/login`, `/register` redirect ไปหน้าแรก
- API ตรวจสิทธิ์ซ้ำเสมอผ่าน `requireUser()` / `requireAdmin()` — middleware ไม่ใช่ด่านเดียว

## หลายภาษา

URL ขึ้นต้นด้วย `/th` หรือ `/en` (middleware เลือกจาก cookie → `Accept-Language` → ไทย) พจนานุกรมอยู่ใน `web/src/i18n/dictionaries` โดย `en.ts` ถูกบังคับให้มีคีย์ตรงกับ `th.ts` ผ่านชนิดข้อมูล API ส่งกลับเป็นรหัสข้อผิดพลาด (`full`, `closed`, ...) ให้ UI แปลเอง

## ข้อจำกัดที่รู้อยู่แล้ว (เฟสแรก)

- ยังไม่มีการชำระเงิน — บันทึก `total_price`/`commission` ไว้เท่านั้น
- เจ้าของแก้ไข/ลบรายการหลังส่งแล้วไม่ได้ (ยังไม่มีหน้าแก้ไข)
- แผนที่โหลดที่จอดทั้งหมดที่อนุมัติแล้วในครั้งเดียว ถ้าเกินหลักพันควรเพิ่ม bounding-box query (`ST_MakeEnvelope` + GiST index ที่มีอยู่แล้ว)
- ยังไม่มี rate limiting, อีเมลยืนยัน, รีเซ็ตรหัสผ่าน
- ยังไม่มีเทสต์อัตโนมัติ
