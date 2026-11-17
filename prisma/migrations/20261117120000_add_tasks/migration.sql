-- Lista de tareas de Álvaro y del puesto de mando para la pantalla Tareas de
-- /admin (sustituye a campaign/TAREAS.md). Solo crea tipos y una tabla nuevos:
-- no toca nada existente.

-- CreateEnum
CREATE TYPE "public"."TaskOwner" AS ENUM ('alvaro', 'agente');

-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('pending', 'done');

-- CreateTable
CREATE TABLE "public"."tasks" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "due_date" DATE,
    "due_text" TEXT,
    "owner" "public"."TaskOwner" NOT NULL DEFAULT 'alvaro',
    "origin" TEXT,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'pending',
    "done_at" TIMESTAMPTZ(6),
    "notes" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_status_due_date_idx" ON "public"."tasks"("status", "due_date");
