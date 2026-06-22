-- AlterTable
ALTER TABLE "public"."pixie" ADD COLUMN     "firmware_version" SMALLINT,
ADD COLUMN     "firmware_version_updated_at" TIMESTAMPTZ(6);
