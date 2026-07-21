-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN "language" TEXT DEFAULT 'en';

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN "notification_prefs" JSONB NOT NULL DEFAULT '{"friend_photos":true,"friendships":true,"frame_activity":true,"reminders":true}';
