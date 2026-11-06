-- AlterTable
ALTER TABLE "public"."pixie" ADD COLUMN "show_title" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "show_sender" BOOLEAN NOT NULL DEFAULT true;
