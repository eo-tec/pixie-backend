ALTER TABLE "public"."photos" ADD COLUMN IF NOT EXISTS "is_animation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."photos" ADD COLUMN IF NOT EXISTS "animation_frames" INTEGER;
ALTER TABLE "public"."photos" ADD COLUMN IF NOT EXISTS "animation_fps" INTEGER;
