-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."FriendStatus" AS ENUM ('pending', 'canceled', 'accepted');

-- CreateEnum
CREATE TYPE "public"."PixieTier" AS ENUM ('free', 'premium');

-- CreateEnum
CREATE TYPE "public"."ReactionType" AS ENUM ('like', 'laugh', 'wow', 'sad');

-- CreateEnum
CREATE TYPE "public"."ReportReason" AS ENUM ('inappropriate', 'spam', 'harassment', 'other');

-- CreateEnum
CREATE TYPE "public"."ReportStatus" AS ENUM ('pending', 'reviewed', 'actioned');

-- CreateTable
CREATE TABLE "public"."code_versions" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" SMALLINT NOT NULL,
    "url" TEXT NOT NULL,
    "comments" TEXT,

    CONSTRAINT "code_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_reports" (
    "id" SERIAL NOT NULL,
    "reporter_id" INTEGER NOT NULL,
    "photo_id" INTEGER,
    "reported_user_id" INTEGER,
    "reason" "public"."ReportReason" NOT NULL,
    "description" VARCHAR(500),
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."drawing_sessions" (
    "id" SERIAL NOT NULL,
    "pixie_id" INTEGER NOT NULL,
    "drawing_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "participants" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drawing_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."drawings" (
    "id" SERIAL NOT NULL,
    "pixie_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pixel_data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drawings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."friends" (
    "id" SERIAL NOT NULL,
    "user_id_1" INTEGER NOT NULL,
    "user_id_2" INTEGER NOT NULL,
    "status" "public"."FriendStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."group_suscriber" (
    "user_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "id" SERIAL NOT NULL,
    "group_id" INTEGER,

    CONSTRAINT "group_suscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."groups" (
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "name" TEXT NOT NULL,
    "created_by" INTEGER NOT NULL,
    "id" SERIAL NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."photo_comments" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photo_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "photo_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."photo_groups" (
    "id" SERIAL NOT NULL,
    "photo_id" INTEGER NOT NULL,
    "group_id" INTEGER,

    CONSTRAINT "photo_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."photo_hidden_by_users" (
    "id" SERIAL NOT NULL,
    "photo_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_hidden_by_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."photo_reactions" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photo_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" "public"."ReactionType" NOT NULL,

    CONSTRAINT "photo_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."photo_visible_by_users" (
    "id" SERIAL NOT NULL,
    "photo_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_visible_by_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."photos" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
    "photo_url" TEXT,
    "username" TEXT,
    "title" TEXT,
    "user_id" INTEGER,
    "photo_pixels" JSONB NOT NULL DEFAULT '{}',
    "deleted_at" TIMESTAMPTZ(6),
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_animation" BOOLEAN NOT NULL DEFAULT false,
    "animation_frames" INTEGER,
    "animation_fps" INTEGER,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "video_url" TEXT,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pixie" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "brightness" INTEGER DEFAULT 50,
    "pictures_on_queue" INTEGER DEFAULT 5,
    "name" TEXT,
    "mac" TEXT NOT NULL,
    "code" TEXT DEFAULT '0000',
    "secs_between_photos" INTEGER DEFAULT 60,
    "spotify_enabled" BOOLEAN NOT NULL DEFAULT false,
    "allow_draws" BOOLEAN NOT NULL DEFAULT false,
    "schedule_enabled" BOOLEAN NOT NULL DEFAULT false,
    "schedule_off_hour" INTEGER DEFAULT 22,
    "schedule_off_minute" INTEGER DEFAULT 0,
    "schedule_on_hour" INTEGER DEFAULT 8,
    "schedule_on_minute" INTEGER DEFAULT 0,
    "clock_enabled" BOOLEAN NOT NULL DEFAULT false,
    "current_photo_id" INTEGER,
    "current_song_id" TEXT,
    "current_song_name" TEXT,
    "photo_cursor" INTEGER NOT NULL DEFAULT 0,
    "max_photos" INTEGER NOT NULL DEFAULT 0,
    "mqtt_password" TEXT,
    "tier" "public"."PixieTier" NOT NULL DEFAULT 'free',

    CONSTRAINT "pixie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."playlist_items" (
    "id" SERIAL NOT NULL,
    "pixie_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "face_type" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."private_photos" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photo_url" TEXT NOT NULL,
    "sent_by" INTEGER NOT NULL,
    "received_by" INTEGER NOT NULL,
    "title" TEXT,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "private_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."spotify_credentials" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "spotify_id" TEXT NOT NULL,
    "spotify_secret" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "spotify_refresh_token" TEXT,

    CONSTRAINT "spotify_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."urls" (
    "id" SERIAL NOT NULL,
    "keyURL" TEXT NOT NULL,
    "valueURL" TEXT,

    CONSTRAINT "urls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_blocks" (
    "id" SERIAL NOT NULL,
    "blocker_id" INTEGER NOT NULL,
    "blocked_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "username" TEXT NOT NULL,
    "password" TEXT,
    "telegram_id" TEXT,
    "picture" TEXT,
    "user_id" TEXT,
    "bio" TEXT,
    "timezone_offset" INTEGER DEFAULT 0,
    "accepted_terms_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."waitlist" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "friends_user_id_1_user_id_2_key" ON "public"."friends"("user_id_1" ASC, "user_id_2" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "group_suscriber_id_key" ON "public"."group_suscriber"("id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "groups_id_key" ON "public"."groups"("id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "photo_hidden_by_users_photo_id_user_id_key" ON "public"."photo_hidden_by_users"("photo_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "photo_reactions_photo_id_user_id_key" ON "public"."photo_reactions"("photo_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "photo_visible_by_users_photo_id_user_id_key" ON "public"."photo_visible_by_users"("photo_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "playlist_items_pixie_id_position_key" ON "public"."playlist_items"("pixie_id" ASC, "position" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "spotify_credentials_user_id_key" ON "public"."spotify_credentials"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "urls_keyURL_key" ON "public"."urls"("keyURL" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_blocks_blocker_id_blocked_id_key" ON "public"."user_blocks"("blocker_id" ASC, "blocked_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_user_id_key" ON "public"."users"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_email_key" ON "public"."waitlist"("email" ASC);

-- AddForeignKey
ALTER TABLE "public"."content_reports" ADD CONSTRAINT "content_reports_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_reports" ADD CONSTRAINT "content_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_reports" ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."drawing_sessions" ADD CONSTRAINT "drawing_sessions_drawing_id_fkey" FOREIGN KEY ("drawing_id") REFERENCES "public"."drawings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."drawing_sessions" ADD CONSTRAINT "drawing_sessions_pixie_id_fkey" FOREIGN KEY ("pixie_id") REFERENCES "public"."pixie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."drawings" ADD CONSTRAINT "drawings_pixie_id_fkey" FOREIGN KEY ("pixie_id") REFERENCES "public"."pixie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."friends" ADD CONSTRAINT "friends_user_id_1_fkey" FOREIGN KEY ("user_id_1") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."friends" ADD CONSTRAINT "friends_user_id_2_fkey" FOREIGN KEY ("user_id_2") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_suscriber" ADD CONSTRAINT "group_suscriber_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."group_suscriber" ADD CONSTRAINT "group_suscriber_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."groups" ADD CONSTRAINT "groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."photo_comments" ADD CONSTRAINT "photo_comments_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."photo_comments" ADD CONSTRAINT "photo_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."photo_groups" ADD CONSTRAINT "photo_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."photo_groups" ADD CONSTRAINT "photo_groups_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."photo_hidden_by_users" ADD CONSTRAINT "photo_hidden_by_users_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."photo_hidden_by_users" ADD CONSTRAINT "photo_hidden_by_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."photo_reactions" ADD CONSTRAINT "photo_reactions_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."photo_reactions" ADD CONSTRAINT "photo_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."photo_visible_by_users" ADD CONSTRAINT "photo_visible_by_users_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."photo_visible_by_users" ADD CONSTRAINT "photo_visible_by_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."photos" ADD CONSTRAINT "photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pixie" ADD CONSTRAINT "pixie_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pixie" ADD CONSTRAINT "pixie_current_photo_id_fkey" FOREIGN KEY ("current_photo_id") REFERENCES "public"."photos"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."playlist_items" ADD CONSTRAINT "playlist_items_pixie_id_fkey" FOREIGN KEY ("pixie_id") REFERENCES "public"."pixie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_photos" ADD CONSTRAINT "private_photos_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_photos" ADD CONSTRAINT "private_photos_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."spotify_credentials" ADD CONSTRAINT "spotify_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

