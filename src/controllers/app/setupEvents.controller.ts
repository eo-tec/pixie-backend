import { Response } from "express";
import { AuthenticatedRequest } from "../../routes/private/checkUser";
import prisma from "../../services/prisma";

/**
 * Telemetría del asistente de instalación de la app.
 *
 * La app guarda los eventos en una cola local y los manda por lotes cuando
 * puede (durante la instalación el móvil puede quedarse sin red). Esto es
 * telemetría: se valida lo justo, se recorta todo y nunca se devuelve un error
 * que haga a la app reintentar en bucle por un evento mal formado; los eventos
 * inválidos se descartan y se cuentan.
 */

const MAX_EVENTS_PER_BATCH = 100;
const RETENTION_DAYS = 90;

const STEPS = new Set([
  "permissions",
  "scan",
  "connect",
  "networks",
  "wifi_send",
  "wifi_response",
  "registration_poll",
  "register",
  "name",
  "wizard",
]);
const OUTCOMES = new Set(["start", "ok", "error", "abandon", "info"]);

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.length > 0 ? v.slice(0, max) : null;

const int = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(-2147483648, Math.min(2147483647, Math.round(v))) : null;

const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

const date = (v: unknown): Date | null => {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** POST /api/setup-events  body: { events: SetupEvent[] } */
export async function postSetupEvents(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id ?? null;
  const raw = req.body?.events;

  if (!Array.isArray(raw)) {
    res.status(400).json({ error: "Se esperaba { events: [] }" });
    return;
  }

  const rows = raw
    .slice(0, MAX_EVENTS_PER_BATCH)
    .map((e: any) => {
      const step = str(e?.step, 40);
      const outcome = str(e?.outcome, 20);
      const attemptId = str(e?.attemptId, 64);
      if (!step || !outcome || !attemptId || !STEPS.has(step) || !OUTCOMES.has(outcome)) return null;
      return {
        attempt_id: attemptId,
        user_id: userId,
        client_ts: date(e.ts),
        mac: str(e.mac, 17),
        pixie_id: int(e.pixieId),
        mode: str(e.mode, 20),
        step,
        outcome,
        error_code: str(e.errorCode, 40),
        error_message: str(e.errorMessage, 500),
        duration_ms: int(e.durationMs),
        platform: str(e.platform, 10),
        os_version: str(e.osVersion, 20),
        app_version: str(e.appVersion, 30),
        update_id: str(e.updateId, 64),
        wifi_rssi: int(e.wifiRssi),
        wifi_secure: bool(e.wifiSecure),
        wifi_manual: bool(e.wifiManual),
        wifi_pass_len: int(e.wifiPassLen),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const dropped = Math.min(raw.length, MAX_EVENTS_PER_BATCH) - rows.length;

  try {
    if (rows.length > 0) await prisma.setup_events.createMany({ data: rows });
    const errors = rows.filter((r) => r.outcome === "error");
    for (const e of errors) {
      console.log(
        `[Setup] Error en ${e.step} (user ${userId}, mac ${e.mac ?? "?"}, ${e.platform ?? "?"}): ${e.error_code ?? ""} ${e.error_message ?? ""}`
      );
    }
    res.status(200).json({ stored: rows.length, dropped });
  } catch (error) {
    console.error("[Setup] Error guardando setup_events:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

// Purga diaria de eventos antiguos, igual que boot_events.
async function purgeOldSetupEvents(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000);
    const { count } = await prisma.setup_events.deleteMany({ where: { created_at: { lt: cutoff } } });
    if (count > 0) console.log(`[Setup] Purgados ${count} setup_events de más de ${RETENTION_DAYS} días`);
  } catch (err) {
    console.error("[Setup] Error purgando setup_events:", err);
  }
}
setInterval(purgeOldSetupEvents, 24 * 3600 * 1000).unref();
setTimeout(purgeOldSetupEvents, 90_000).unref();
