-- AlterTable
ALTER TABLE "public"."pixie" ADD COLUMN     "schedule_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "schedule_off_hour" INTEGER DEFAULT 22,
ADD COLUMN     "schedule_off_minute" INTEGER DEFAULT 0,
ADD COLUMN     "schedule_on_hour" INTEGER DEFAULT 8,
ADD COLUMN     "schedule_on_minute" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "timezone_offset" INTEGER DEFAULT 0;
