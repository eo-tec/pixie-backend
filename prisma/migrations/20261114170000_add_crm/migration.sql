-- CRM / ERP interno: clientes, timeline, pedidos con estados, unidades (SN),
-- versiones con su BOM, piezas y movimientos de stock. Solo crea tablas nuevas:
-- no toca las existentes (beta_orders, pixie, users, prelaunch_leads).

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('pendiente', 'fabricado', 'qc', 'enviado', 'recibido', 'incidencia');

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "city" TEXT,
    "language" TEXT,
    "status" TEXT NOT NULL DEFAULT 'cliente',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "origin" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "utm_term" TEXT,
    "notes" TEXT,
    "lead_id" INTEGER,
    "public_user_id" INTEGER,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customer_events" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'note',
    "title" TEXT,
    "body" TEXT,
    "author" TEXT NOT NULL DEFAULT 'Álvaro',
    "order_id" INTEGER,

    CONSTRAINT "customer_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."frame_versions" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "hw_version" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "frame_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."parts" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ud',
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "min_qty" INTEGER NOT NULL DEFAULT 0,
    "counted_at" TIMESTAMPTZ(6),
    "supplier" TEXT,
    "notes" TEXT,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bom_items" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "part_id" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_movements" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "part_id" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "author" TEXT NOT NULL DEFAULT 'Álvaro',
    "order_id" INTEGER,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_id" INTEGER NOT NULL,
    "version_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'pendiente',
    "amount_cents" INTEGER,
    "currency" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "beta_order_id" INTEGER,
    "shipping" JSONB,
    "tracking_number" TEXT,
    "tracking_url" TEXT,
    "notes" TEXT,
    "incidence_note" TEXT,
    "ship_by" DATE,
    "fabricado_at" TIMESTAMPTZ(6),
    "qc_at" TIMESTAMPTZ(6),
    "enviado_at" TIMESTAMPTZ(6),
    "recibido_at" TIMESTAMPTZ(6),
    "incidencia_at" TIMESTAMPTZ(6),
    "parts_deducted_at" TIMESTAMPTZ(6),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."units" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sn" TEXT NOT NULL,
    "mac" TEXT,
    "version_id" INTEGER NOT NULL,
    "firmware_version" SMALLINT,
    "status" TEXT NOT NULL DEFAULT 'montaje',
    "order_id" INTEGER,
    "pixie_id" INTEGER,
    "notes" TEXT,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "public"."customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_lead_id_key" ON "public"."customers"("lead_id");

-- CreateIndex
CREATE INDEX "customers_status_idx" ON "public"."customers"("status");

-- CreateIndex
CREATE INDEX "customer_events_customer_id_created_at_idx" ON "public"."customer_events"("customer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "frame_versions_name_key" ON "public"."frame_versions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "parts_name_key" ON "public"."parts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "bom_items_version_id_part_id_key" ON "public"."bom_items"("version_id", "part_id");

-- CreateIndex
CREATE INDEX "stock_movements_part_id_created_at_idx" ON "public"."stock_movements"("part_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_beta_order_id_key" ON "public"."orders"("beta_order_id");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "public"."orders"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "units_sn_key" ON "public"."units"("sn");

-- CreateIndex
CREATE UNIQUE INDEX "units_mac_key" ON "public"."units"("mac");

-- CreateIndex
CREATE UNIQUE INDEX "units_pixie_id_key" ON "public"."units"("pixie_id");

-- CreateIndex
CREATE INDEX "units_order_id_idx" ON "public"."units"("order_id");

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."prelaunch_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_public_user_id_fkey" FOREIGN KEY ("public_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_events" ADD CONSTRAINT "customer_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_events" ADD CONSTRAINT "customer_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bom_items" ADD CONSTRAINT "bom_items_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."frame_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bom_items" ADD CONSTRAINT "bom_items_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."frame_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_beta_order_id_fkey" FOREIGN KEY ("beta_order_id") REFERENCES "public"."beta_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."units" ADD CONSTRAINT "units_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."frame_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."units" ADD CONSTRAINT "units_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."units" ADD CONSTRAINT "units_pixie_id_fkey" FOREIGN KEY ("pixie_id") REFERENCES "public"."pixie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

