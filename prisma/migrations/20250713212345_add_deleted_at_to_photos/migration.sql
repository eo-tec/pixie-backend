-- CreateEnum
CREATE TYPE "public"."FriendStatus" AS ENUM ('pending', 'canceled', 'accepted');

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
CREATE TABLE "public"."photo_groups" (
    "id" SERIAL NOT NULL,
    "photo_id" INTEGER NOT NULL,
    "group_id" INTEGER,

    CONSTRAINT "photo_groups_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "pixie_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "username" TEXT NOT NULL,
    "password" TEXT,
    "telegram_id" TEXT,
    "picture" TEXT,
    "user_id" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "public"."photo_visible_by_users" (
    "id" SERIAL NOT NULL,
    "photo_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_visible_by_users_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "group_suscriber_id_key" ON "public"."group_suscriber"("id");

-- CreateIndex
CREATE UNIQUE INDEX "groups_id_key" ON "public"."groups"("id");

-- CreateIndex
CREATE UNIQUE INDEX "spotify_credentials_user_id_key" ON "public"."spotify_credentials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "urls_keyURL_key" ON "public"."urls"("keyURL");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_id_key" ON "public"."users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "friends_user_id_1_user_id_2_key" ON "public"."friends"("user_id_1", "user_id_2");

-- CreateIndex
CREATE UNIQUE INDEX "photo_visible_by_users_photo_id_user_id_key" ON "public"."photo_visible_by_users"("photo_id", "user_id");

-- AddForeignKey
ALTER TABLE "public"."group_suscriber" ADD CONSTRAINT "group_suscriber_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."group_suscriber" ADD CONSTRAINT "group_suscriber_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."groups" ADD CONSTRAINT "groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."photo_groups" ADD CONSTRAINT "photo_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."photo_groups" ADD CONSTRAINT "photo_groups_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."photos" ADD CONSTRAINT "photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pixie" ADD CONSTRAINT "pixie_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."spotify_credentials" ADD CONSTRAINT "spotify_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."friends" ADD CONSTRAINT "friends_user_id_1_fkey" FOREIGN KEY ("user_id_1") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."friends" ADD CONSTRAINT "friends_user_id_2_fkey" FOREIGN KEY ("user_id_2") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_photos" ADD CONSTRAINT "private_photos_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_photos" ADD CONSTRAINT "private_photos_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."photo_visible_by_users" ADD CONSTRAINT "photo_visible_by_users_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."photo_visible_by_users" ADD CONSTRAINT "photo_visible_by_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."drawings" ADD CONSTRAINT "drawings_pixie_id_fkey" FOREIGN KEY ("pixie_id") REFERENCES "public"."pixie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."drawing_sessions" ADD CONSTRAINT "drawing_sessions_pixie_id_fkey" FOREIGN KEY ("pixie_id") REFERENCES "public"."pixie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."drawing_sessions" ADD CONSTRAINT "drawing_sessions_drawing_id_fkey" FOREIGN KEY ("drawing_id") REFERENCES "public"."drawings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
