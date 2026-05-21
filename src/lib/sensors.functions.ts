import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SensorReading = {
  t: string;
  temp: number;
  hum: number;
};

export type LatestSensorPayload = {
  latest: { temp: number; hum: number; status: string; updatedAt: string } | null;
  series: SensorReading[];
  source: "db" | "empty" | "error";
  error?: string;
};

/**
 * Beklenen tablo şeması:
 *   CREATE TABLE sensor_olcumleri (
 *     id       serial PRIMARY KEY,
 *     sicaklik numeric NOT NULL,
 *     nem      numeric NOT NULL,
 *     zaman    timestamptz NOT NULL DEFAULT now()
 *   );
 */
export const getLatestSensorData = createServerFn({ method: "GET" }).handler(
  async (): Promise<LatestSensorPayload> => {
    try {
      const { data: rows, error } = await supabaseAdmin
        .from("sensor_olcumleri")
        .select("zaman, sicaklik, nem")
        .order("zaman", { ascending: false })
        .limit(30);

      if (error) throw error;
      if (!rows) return { latest: null, series: [], source: "empty" };

      if (rows.length === 0) {
        return { latest: null, series: [], source: "empty" };
      }

      const ordered = [...rows].reverse();
      const series: SensorReading[] = ordered.map((r) => ({
        t: new Date(r.zaman).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        temp: Number(r.sicaklik),
        hum: Number(r.nem),
      }));

      const last = rows[0];
      return {
        latest: {
          temp: Number(last.sicaklik),
          hum: Number(last.nem),
          status: "Aktif",
          updatedAt: new Date(last.zaman).toISOString(),
        },
        series,
        source: "db",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bilinmeyen hata";
      console.error("getLatestSensorData failed:", message);
      return { latest: null, series: [], source: "error", error: message };
    }
  },
);