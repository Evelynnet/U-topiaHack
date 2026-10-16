"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage, postJson } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useI18n } from "@/i18n/provider";

interface ActiveBooking {
  id: string;
  title: string;
  address: string;
  vehicleType: "car" | "motorcycle";
  startAt: string;
  endAt: string;
  totalPrice: number;
  pricePerHour: number;
}

function secondsLeft(endAt: string): number {
  return Math.max(0, Math.floor((new Date(endAt).getTime() - Date.now()) / 1000));
}

function formatCountdown(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export default function ParkingDashboard() {
  const { t } = useI18n();
  const router = useRouter();
  const [booking, setBooking] = useState<ActiveBooking | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<{ booking: ActiveBooking | null }>("/api/bookings/active");
      setBooking(d.booking);
      if (d.booking) setSecs(secondsLeft(d.booking.endAt));
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!booking) return;
    const id = setInterval(() => {
      setSecs((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [booking]);

  function accrued(): number {
    if (!booking) return 0;
    const elapsed = (Date.now() - new Date(booking.startAt).getTime()) / 3_600_000;
    return Math.round(booking.pricePerHour * elapsed * 100) / 100;
  }

  async function handleLeave() {
    if (!booking) return;
    setLeaving(true);
    try {
      await postJson(`/api/bookings/${booking.id}/cancel`);
      router.push("/");
    } catch (err) {
      setError(errorMessage(t, err));
      setLeaving(false);
    }
  }

  if (booking === undefined) {
    return (
      <div className="page">
        <p className="muted">{t.common.loading}</p>
      </div>
    );
  }

  if (booking === null) {
    return (
      <div className="page" style={{ textAlign: "center", paddingTop: 60 }}>
        <p style={{ fontSize: 48 }}>🅿️</p>
        <h2>ไม่ได้จอดรถอยู่ในขณะนี้</h2>
        <p className="muted">เมื่อคุณเริ่มจอด ข้อมูลจะแสดงที่นี่</p>
        <button className="btn" onClick={() => router.push("/")}>
          กลับหน้าแผนที่
        </button>
      </div>
    );
  }

  const isOvertime = secs === 0;

  return (
    <div className="page" style={{ maxWidth: 480, margin: "0 auto" }}>
      <h1>🅿️ กำลังจอดอยู่</h1>
      {error && <div className="alert error">{error}</div>}

      {/* Countdown */}
      <div className="card" style={{ textAlign: "center", padding: "32px 24px" }}>
        <p className="muted" style={{ marginBottom: 8 }}>เวลาที่เหลือ</p>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: isOvertime ? "var(--danger, #e53e3e)" : "var(--accent)",
            letterSpacing: 2,
          }}
        >
          {isOvertime ? "หมดเวลา" : formatCountdown(secs)}
        </div>
        {isOvertime && (
          <p className="muted" style={{ marginTop: 8, color: "var(--danger, #e53e3e)" }}>
            เกินเวลาที่จองไว้แล้ว กรุณาออกจากที่จอดโดยเร็ว
          </p>
        )}
      </div>

      {/* ข้อมูลที่จอด */}
      <div className="card">
        <h2 style={{ marginBottom: 4 }}>{booking.title}</h2>
        <p className="muted">{booking.address}</p>
        <hr style={{ margin: "12px 0", border: "none", borderTop: "1px solid var(--border)" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <p className="muted" style={{ marginBottom: 2, fontSize: 13 }}>ประเภทยานพาหนะ</p>
            <p style={{ fontWeight: 600 }}>
              {booking.vehicleType === "car" ? "🚗 รถยนต์" : "🏍️ มอเตอร์ไซค์"}
            </p>
          </div>
          <div>
            <p className="muted" style={{ marginBottom: 2, fontSize: 13 }}>เวลาเข้า</p>
            <p style={{ fontWeight: 600 }}>
              {new Date(booking.startAt).toLocaleTimeString("th-TH", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div>
            <p className="muted" style={{ marginBottom: 2, fontSize: 13 }}>เวลาสิ้นสุดที่จอง</p>
            <p style={{ fontWeight: 600 }}>
              {new Date(booking.endAt).toLocaleTimeString("th-TH", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div>
            <p className="muted" style={{ marginBottom: 2, fontSize: 13 }}>ราคาต่อชั่วโมง</p>
            <p style={{ fontWeight: 600 }}>{formatMoney(booking.pricePerHour)}</p>
          </div>
        </div>
      </div>

      {/* ราคาที่ใช้ไปแล้ว */}
      <div className="card" style={{ background: "var(--surface-alt, #f8f9fa)" }}>
        <div className="spread">
          <div>
            <p className="muted" style={{ marginBottom: 2 }}>ราคาที่ใช้ไปแล้ว (ประมาณ)</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>
              {formatMoney(accrued())}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p className="muted" style={{ marginBottom: 2 }}>ราคาเต็ม</p>
            <p style={{ fontWeight: 600 }}>{formatMoney(booking.totalPrice)}</p>
          </div>
        </div>
      </div>

      {/* ปุ่มออก */}
      <button
        className="btn"
        style={{
          width: "100%",
          marginTop: 8,
          background: "var(--danger, #e53e3e)",
          fontSize: 18,
          padding: "16px",
        }}
        disabled={leaving}
        onClick={handleLeave}
      >
        {leaving ? "กำลังดำเนินการ..." : "🚪 ออกจากที่จอดแล้ว"}
      </button>
    </div>
  );
}
