-- CreateTable
CREATE TABLE "public"."boot_events" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pixie_id" INTEGER NOT NULL,
    "reset_reason" INTEGER NOT NULL,
    "reset_reason_str" TEXT,
    "is_error" BOOLEAN NOT NULL DEFAULT false,
    "boot_count" INTEGER,
    "fw_version" SMALLINT,
    "hw_version" TEXT,
    "free_heap" INTEGER,
    "crash_task" TEXT,
    "crash_pc" TEXT,
    "crash_exc_cause" INTEGER,
    "crash_backtrace" TEXT,

    CONSTRAINT "boot_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boot_events_pixie_id_created_at_idx" ON "public"."boot_events"("pixie_id", "created_at");

-- CreateIndex
CREATE INDEX "boot_events_created_at_idx" ON "public"."boot_events"("created_at");

-- AddForeignKey
ALTER TABLE "public"."boot_events" ADD CONSTRAINT "boot_events_pixie_id_fkey" FOREIGN KEY ("pixie_id") REFERENCES "public"."pixie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
