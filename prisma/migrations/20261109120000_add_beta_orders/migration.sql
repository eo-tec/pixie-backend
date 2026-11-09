-- CreateTable
CREATE TABLE "public"."beta_orders" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripe_session_id" TEXT NOT NULL,
    "stripe_payment_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "shipping" JSONB,
    "country" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount_cents" INTEGER,
    "currency" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" TEXT NOT NULL DEFAULT 'received',
    "tracking_number" TEXT,
    "tracking_url" TEXT,
    "shipped_at" TIMESTAMPTZ(6),
    "received_email_sent_at" TIMESTAMPTZ(6),
    "shipped_email_sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "beta_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "beta_orders_stripe_session_id_key" ON "public"."beta_orders"("stripe_session_id");

-- CreateIndex
CREATE INDEX "beta_orders_status_created_at_idx" ON "public"."beta_orders"("status", "created_at");
