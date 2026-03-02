-- CreateEnum
CREATE TYPE "public"."PixieTier" AS ENUM ('free', 'premium');

-- AlterTable
ALTER TABLE "public"."pixie" ADD COLUMN     "tier" "public"."PixieTier" NOT NULL DEFAULT 'premium';
