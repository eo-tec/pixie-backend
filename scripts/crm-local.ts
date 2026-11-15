/**
 * CRM en local: servidor mínimo con solo el router de /admin (sin MQTT, Minio
 * ni Telegram) y datos de ejemplo, para trabajar en la web /admin sin tocar
 * producción.
 *
 *   DATABASE_URL=postgresql://crm:crm@localhost:54329/crm_utf8 \
 *   ADMIN_API_KEY=local-dev-key PORT=3010 \
 *   npx ts-node --transpile-only scripts/crm-local.ts [--seed]
 *
 * Se niega a arrancar si DATABASE_URL no apunta a localhost. --seed borra las
 * tablas del CRM (y los beta_orders/pixie de prueba) y las rellena con la
 * situación real de los betas y el recuento de stock a 14 nov 2026 (emails y
 * direcciones de ejemplo).
 */
import express from 'express';
import cors from 'cors';

const url = process.env.DATABASE_URL ?? '';
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
})();
if (!['localhost', '127.0.0.1'].includes(host)) {
  console.error(`[crm-local] DATABASE_URL tiene que ser local (ahora: ${host || 'vacía'}). No arranco.`);
  process.exit(1);
}
process.env.ADMIN_API_KEY ||= 'local-dev-key';

// Después de comprobar la URL: prisma lee DATABASE_URL al importarse.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const prisma = require('../src/services/prisma').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const crmService = require('../src/services/crm.service');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { adminRouter } = require('../src/routes/admin/admin.routes');

async function seed() {
  const { syncBetaOrder, changeOrderStatus, addStockMovement, versionByName } = crmService;

  await prisma.$executeRawUnsafe(
    `TRUNCATE "public"."customer_events", "public"."stock_movements", "public"."units", "public"."orders",
       "public"."bom_items", "public"."parts", "public"."frame_versions", "public"."customers" RESTART IDENTITY CASCADE`,
  );
  await prisma.beta_orders.deleteMany({ where: { stripe_session_id: { startsWith: 'cs_local_' } } });
  await prisma.pixie.deleteMany({ where: { name: { startsWith: 'local-' } } });

  const beta = await versionByName('beta');
  await prisma.frame_versions.update({
    where: { id: beta.id },
    data: { hw_version: 'v2', notes: 'Unidades beta (PCB v2). Mismo hardware que se envía a los beta testers.' },
  });

  // Recuento real de Álvaro (14 nov 2026), DESPUÉS de montar los Frames de
  // Tavis, Ebo y Marc. Carcasa: sin dato todavía (counted_at null).
  // Mínimos: inventados.
  const parts: [string, number | null, number][] = [
    ['PCB', 6, 3],
    ['Panel y conectores', 0, 3],
    ['Carcasa', null, 3],
    ['Caja', 46, 5],
    ['Espumas', 0, 5],
    ['Cable USB', 20, 5],
  ];
  const countedAt = new Date('2026-11-14T12:00:00Z');
  for (const [name, qty, min] of parts) {
    const p = await prisma.parts.create({ data: { name, min_qty: min } });
    await prisma.bom_items.create({ data: { version_id: beta.id, part_id: p.id, qty: 1 } });
    if (qty !== null) {
      if (qty) await addStockMovement({ part_id: p.id, delta: qty, reason: 'ajuste', note: 'Recuento 14 nov' });
      await prisma.parts.update({ where: { id: p.id }, data: { counted_at: countedAt } });
    }
  }

  // David: entregado a primeros de noviembre, antes del webhook de Stripe.
  const david = await prisma.customers.create({
    data: {
      email: 'david.adamson@example.com',
      name: 'David Adamson',
      country: 'PT',
      city: 'Leiria',
      language: 'en',
      status: 'beta_tester',
      created_at: new Date('2026-10-27T10:00:00Z'),
    },
  });
  const davidOrder = await prisma.orders.create({
    data: { customer_id: david.id, version_id: beta.id, quantity: 1, created_at: new Date('2026-10-27T10:00:00Z') },
  });
  await prisma.customer_events.create({
    data: { customer_id: david.id, order_id: davidOrder.id, type: 'order', title: `Pedido #${davidOrder.id} creado`, created_at: new Date('2026-10-27T10:00:00Z') },
  });

  // Pedidos de Stripe (como los crea el webhook)
  const stripe = [
    { email: 'tavis.gustafson@example.com', name: 'Tavis Gustafson', country: 'US', city: 'Portland', state: 'OR', postal: '97214', q: 1, cents: 8900, cur: 'usd', at: '2026-11-07T18:20:00Z', locale: 'en' },
    { email: 'ebo.nelissen@example.com', name: 'Ebo Nelissen', country: 'NL', city: 'Velp', postal: '6881', q: 1, cents: 7900, cur: 'eur', at: '2026-11-10T09:45:00Z', locale: 'en' },
    { email: 'alejandro.sebastian@example.com', name: 'Alejandro Sebastián', country: 'ES', city: 'Alsasua', postal: '31800', q: 2, cents: 15800, cur: 'eur', at: '2026-11-12T11:05:00Z', locale: 'es' },
    { email: 'marc.lund@example.com', name: 'Marc Lund', country: 'PT', city: 'Porto', postal: '4000', q: 1, cents: 8900, cur: 'eur', at: '2026-11-12T20:30:00Z', locale: 'en' },
  ];
  const ids: Record<string, number> = {};
  for (const s of stripe) {
    const row = await prisma.beta_orders.create({
      data: {
        stripe_session_id: `cs_local_${s.email.split('@')[0]}`,
        email: s.email,
        name: s.name,
        shipping: { name: s.name, address: { city: s.city, state: s.state ?? null, postal_code: s.postal, country: s.country, line1: '(dirección de ejemplo)' } },
        country: s.country,
        quantity: s.q,
        amount_cents: s.cents,
        currency: s.cur,
        locale: s.locale,
        created_at: new Date(s.at),
        received_email_sent_at: new Date(s.at),
      },
    });
    const { order } = await syncBetaOrder(row);
    ids[s.name] = order.id;
  }

  // Montados antes del CRM: las piezas ya no están en el recuento, así que se
  // marcan como descontadas para que no se resten otra vez. Las unidades (SN)
  // las crea el cambio de estado; la MAC aún no se sabe.
  const builtBefore = [davidOrder.id, ids['Tavis Gustafson'], ids['Ebo Nelissen'], ids['Marc Lund']];
  await prisma.orders.updateMany({ where: { id: { in: builtBefore } }, data: { parts_deducted_at: countedAt } });

  // Avance real a 14 nov: David entregado; Tavis, Ebo y Marc montados (salen
  // el lunes 16); Alejandro pendiente (sale la semana que viene).
  await changeOrderStatus(davidOrder.id, { status: 'fabricado' });
  await changeOrderStatus(davidOrder.id, { status: 'enviado' });
  await changeOrderStatus(davidOrder.id, { status: 'recibido', note: 'Entregado a primeros de noviembre' });

  for (const name of ['Tavis Gustafson', 'Ebo Nelissen']) {
    await changeOrderStatus(ids[name], { status: 'fabricado', note: 'Montado (antes del CRM)' });
    await changeOrderStatus(ids[name], { status: 'qc' });
  }
  await changeOrderStatus(ids['Marc Lund'], { status: 'fabricado', note: 'Montado (antes del CRM)' });
  await prisma.orders.updateMany({
    where: { id: { in: [ids['Tavis Gustafson'], ids['Ebo Nelissen'], ids['Marc Lund']] } },
    data: { ship_by: new Date('2026-11-16') },
  });
  await prisma.orders.update({ where: { id: ids['Alejandro Sebastián'] }, data: { ship_by: new Date('2026-11-23'), notes: 'Sale la semana que viene' } });

  const tavis = await prisma.customers.findUnique({ where: { email: 'tavis.gustafson@example.com' } });
  await prisma.customers.update({ where: { id: tavis.id }, data: { tags: ['EE. UU.'] } });
  await prisma.customer_events.create({
    data: { customer_id: tavis.id, type: 'note', title: 'Envío', body: 'Sale el lunes 16 de noviembre por Correos Paq Light Internacional.' },
  });
  console.log('[crm-local] datos cargados');
}
async function main() {
  if (process.argv.includes('--seed')) await seed();
  const app = express();
  app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'X-Admin-Key'] }));
  app.use(express.json());
  app.use('/admin', adminRouter);
  const port = Number(process.env.PORT || 3010);
  app.listen(port, () => console.log(`[crm-local] http://localhost:${port}/admin/crm  (clave: ${process.env.ADMIN_API_KEY})`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
