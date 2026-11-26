-- CreateTable
CREATE TABLE "public"."setup_events" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_ts" TIMESTAMPTZ(6),
    "attempt_id" TEXT NOT NULL,
    "user_id" INTEGER,
    "mac" TEXT,
    "pixie_id" INTEGER,
    "mode" TEXT,
    "step" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "error_code" TEXT,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "platform" TEXT,
    "os_version" TEXT,
    "app_version" TEXT,
    "update_id" TEXT,
    "wifi_rssi" INTEGER,
    "wifi_secure" BOOLEAN,
    "wifi_manual" BOOLEAN,
    "wifi_pass_len" INTEGER,

    CONSTRAINT "setup_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "setup_events_created_at_idx" ON "public"."setup_events"("created_at");

-- CreateIndex
CREATE INDEX "setup_events_attempt_id_idx" ON "public"."setup_events"("attempt_id");

-- CreateIndex
CREATE INDEX "setup_events_mac_created_at_idx" ON "public"."setup_events"("mac", "created_at");
