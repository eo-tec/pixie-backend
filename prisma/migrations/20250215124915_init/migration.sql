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
    "user" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "id" SERIAL NOT NULL,
    "group" INTEGER,

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
    "group" INTEGER,

    CONSTRAINT "photo_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."photos" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
    "photo_url" TEXT,
    "username" TEXT,
    "title" TEXT,

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

    CONSTRAINT "pixie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."spotify_credentials" (
    "id" SERIAL NOT NULL,
    "user" INTEGER NOT NULL,
    "spotify_id" TEXT NOT NULL,
    "spotify_secret" TEXT NOT NULL,
    "spotify_token" TEXT,

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

-- CreateIndex
CREATE UNIQUE INDEX "group_suscriber_id_key" ON "public"."group_suscriber"("id");

-- CreateIndex
CREATE UNIQUE INDEX "groups_id_key" ON "public"."groups"("id");

-- CreateIndex
CREATE UNIQUE INDEX "urls_keyURL_key" ON "public"."urls"("keyURL");

-- AddForeignKey
ALTER TABLE "public"."group_suscriber" ADD CONSTRAINT "group_suscriber_group_fkey" FOREIGN KEY ("group") REFERENCES "public"."groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."group_suscriber" ADD CONSTRAINT "group_suscriber_user_fkey" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."groups" ADD CONSTRAINT "groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."photo_groups" ADD CONSTRAINT "photo_groups_group_fkey" FOREIGN KEY ("group") REFERENCES "public"."groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."photo_groups" ADD CONSTRAINT "photo_groups_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pixie" ADD CONSTRAINT "pixie_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."spotify_credentials" ADD CONSTRAINT "spotify_credentials_user_fkey" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
