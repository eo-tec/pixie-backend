import { Request, Response } from 'express';
import prisma from '../../services/prisma';

// Validación de demanda tipo Prelaunch.com. La landing (frame64.fun) es la
// única que llama aquí, desde su servidor y con la clave de admin, después
// de descartar bots y visitas internas. El dashboard de la landing lee
// /stats con la misma clave.

const PAGES = new Set(['home', 'reserve']);
const KINDS = new Set(['declined', 'reserved']);
const EXIT_REASONS = new Set(['price', 'understand', 'not_for_me', 'other']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value: unknown, max = 200): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().slice(0, max);
  return v || undefined;
}

function utmFields(utm: unknown) {
  const u = (utm && typeof utm === 'object' ? utm : {}) as Record<string, unknown>;
  return {
    utm_source: str(u.utm_source),
    utm_medium: str(u.utm_medium),
    utm_campaign: str(u.utm_campaign),
    utm_content: str(u.utm_content),
    utm_term: str(u.utm_term),
  };
}

/** Una visita por visitante y página: recargar no infla el embudo. */
export async function recordVisit(req: Request, res: Response) {
  const visitorId = str(req.body?.visitor_id, 64);
  const page = str(req.body?.page, 16);
  if (!visitorId || !page || !PAGES.has(page)) {
    res.status(400).json({ error: 'visitor_id and page are required' });
    return;
  }
  const utm = utmFields(req.body?.utm);
  try {
    await prisma.prelaunch_visits.upsert({
      where: { visitor_id_page: { visitor_id: visitorId, page } },
      create: {
        visitor_id: visitorId,
        page,
        lang: str(req.body?.lang, 8),
        utm_source: utm.utm_source,
        utm_campaign: utm.utm_campaign,
        utm_content: utm.utm_content,
      },
      update: {},
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[prelaunch] visit', err);
    res.status(500).json({ error: 'internal' });
  }
}

/**
 * Alta del email. Si ya existía devuelve el mismo token y no toca el
 * origen: el primer contacto es el que cuenta para atribuir el anuncio.
 */
export async function createLead(req: Request, res: Response) {
  const email = str(req.body?.email)?.toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'invalid email' });
    return;
  }
  try {
    const lead = await prisma.prelaunch_leads.upsert({
      where: { email },
      create: {
        email,
        visitor_id: str(req.body?.visitor_id, 64),
        lang: str(req.body?.lang, 8),
        source: str(req.body?.source, 64),
        ...utmFields(req.body?.utm),
      },
      update: {},
      select: { token: true, reserved_at: true, refunded_at: true },
    });
    res.json({
      token: lead.token,
      reserved: !!lead.reserved_at && !lead.refunded_at,
    });
  } catch (err) {
    console.error('[prelaunch] lead', err);
    res.status(500).json({ error: 'internal' });
  }
}

/** Marca un paso del lead (vio la página de reserva, dijo "No, gracias"). */
export async function markStep(req: Request, res: Response) {
  const token = str(req.body?.token, 64);
  const step = str(req.body?.step, 16);
  const field =
    step === 'reserve_view' ? 'reserve_viewed_at' : step === 'decline' ? 'declined_at' : null;
  if (!token || !field) {
    res.status(400).json({ error: 'token and a valid step are required' });
    return;
  }
  try {
    // Solo la primera vez: así se puede medir el tiempo hasta cada paso.
    const updated = await prisma.prelaunch_leads.updateMany({
      where: { token, [field]: null },
      data: { [field]: new Date() },
    });
    res.json({ ok: true, updated: updated.count });
  } catch (err) {
    console.error('[prelaunch] step', err);
    res.status(500).json({ error: 'internal' });
  }
}

/**
 * Por qué cierra el popup del email sin apuntarse. Sin lead: va ligado al
 * visitante, una respuesta por visitante (la landing solo pregunta una vez).
 */
export async function saveExitSurvey(req: Request, res: Response) {
  const visitorId = str(req.body?.visitor_id, 64);
  const reason = str(req.body?.reason, 16);
  if (!visitorId || !reason || !EXIT_REASONS.has(reason)) {
    res.status(400).json({ error: 'visitor_id and a valid reason are required' });
    return;
  }
  const utm = utmFields(req.body?.utm);
  const data = {
    reason,
    text: str(req.body?.text, 1000),
    lang: str(req.body?.lang, 8),
    utm_source: utm.utm_source,
    utm_campaign: utm.utm_campaign,
    utm_content: utm.utm_content,
  };
  try {
    await prisma.prelaunch_exit_surveys.upsert({
      where: { visitor_id: visitorId },
      create: { visitor_id: visitorId, ...data },
      update: data,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[prelaunch] exit', err);
    res.status(500).json({ error: 'internal' });
  }
}

/** Una respuesta por lead y tipo de encuesta; reenviarla la sustituye. */
export async function saveSurvey(req: Request, res: Response) {
  const token = str(req.body?.token, 64);
  const kind = str(req.body?.kind, 16);
  const answers = req.body?.answers;
  if (!token || !kind || !KINDS.has(kind) || !answers || typeof answers !== 'object') {
    res.status(400).json({ error: 'token, kind and answers are required' });
    return;
  }
  if (JSON.stringify(answers).length > 5000) {
    res.status(413).json({ error: 'answers too large' });
    return;
  }
  try {
    const lead = await prisma.prelaunch_leads.findUnique({
      where: { token },
      select: { id: true },
    });
    if (!lead) {
      res.status(404).json({ error: 'unknown token' });
      return;
    }
    await prisma.prelaunch_survey_responses.upsert({
      where: { lead_id_kind: { lead_id: lead.id, kind } },
      create: { lead_id: lead.id, kind, answers },
      update: { answers, created_at: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[prelaunch] survey', err);
    res.status(500).json({ error: 'internal' });
  }
}

/**
 * Pago del depósito, desde el webhook de Stripe de la landing. Se une por
 * el token (client_reference_id) y, si no viene, por el email: alguien
 * puede pagar con el enlace sin haber pasado por el formulario.
 */
export async function recordReservation(req: Request, res: Response) {
  const token = str(req.body?.token, 64);
  const email = str(req.body?.email)?.toLowerCase();
  const sessionId = str(req.body?.session_id, 255);
  if (!sessionId || (!token && !email)) {
    res.status(400).json({ error: 'session_id and token or email are required' });
    return;
  }
  const data = {
    reserved_at: new Date(),
    refunded_at: null,
    amount_cents: Number.isInteger(req.body?.amount_cents) ? req.body.amount_cents : null,
    currency: str(req.body?.currency, 8),
    stripe_session_id: sessionId,
    stripe_payment_id: str(req.body?.payment_id, 255),
  };
  try {
    // Stripe reintenta los webhooks: la misma sesión no cuenta dos veces.
    const already = await prisma.prelaunch_leads.findUnique({
      where: { stripe_session_id: sessionId },
      select: { id: true },
    });
    if (already) {
      res.json({ ok: true, duplicate: true });
      return;
    }

    let lead = token
      ? await prisma.prelaunch_leads.findUnique({ where: { token }, select: { id: true } })
      : null;
    if (!lead && email) {
      lead = await prisma.prelaunch_leads.upsert({
        where: { email },
        create: { email, source: 'stripe-direct' },
        update: {},
        select: { id: true },
      });
    }
    if (!lead) {
      res.status(404).json({ error: 'lead not found' });
      return;
    }
    await prisma.prelaunch_leads.update({ where: { id: lead.id }, data });
    res.json({ ok: true });
  } catch (err) {
    console.error('[prelaunch] reservation', err);
    res.status(500).json({ error: 'internal' });
  }
}

/** Reembolso hecho desde Stripe: la reserva deja de contar. */
export async function recordRefund(req: Request, res: Response) {
  const paymentId = str(req.body?.payment_id, 255);
  if (!paymentId) {
    res.status(400).json({ error: 'payment_id is required' });
    return;
  }
  try {
    const updated = await prisma.prelaunch_leads.updateMany({
      where: { stripe_payment_id: paymentId, refunded_at: null },
      data: { refunded_at: new Date() },
    });
    res.json({ ok: true, updated: updated.count });
  } catch (err) {
    console.error('[prelaunch] refund', err);
    res.status(500).json({ error: 'internal' });
  }
}

type Row = {
  key: string;
  visits_home: number;
  visits_reserve: number;
  leads: number;
  reserve_views: number;
  declined: number;
  reservations: number;
  refunded: number;
};

const emptyRow = (key: string): Row => ({
  key,
  visits_home: 0,
  visits_reserve: 0,
  leads: 0,
  reserve_views: 0,
  declined: 0,
  reservations: 0,
  refunded: 0,
});

/** `from` (por defecto, hace 30 días) y `to` opcional, en ISO; null si alguno no es una fecha. */
function dateRange(req: Request): { from: Date; to?: Date } | null {
  const fromParam = str(req.query.from as string, 32);
  const toParam = str(req.query.to as string, 32);
  const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 30 * 864e5);
  const to = toParam ? new Date(toParam) : undefined;
  if (Number.isNaN(from.getTime()) || (to && Number.isNaN(to.getTime()))) return null;
  return { from, to };
}

/**
 * Embudo entre `from` (por defecto, 30 días) y `to` (por defecto, ahora), total y por utm_content (la
 * creatividad), más las respuestas de las encuestas en bruto: el dashboard
 * conoce las preguntas y las agrega él.
 */
export async function getStats(req: Request, res: Response) {
  const range = dateRange(req);
  if (!range) {
    res.status(400).json({ error: 'invalid from or to' });
    return;
  }
  const { from, to } = range;
  const created_at = { gte: from, ...(to && { lt: to }) };
  try {
    const [visits, leads, exits] = await Promise.all([
      prisma.prelaunch_visits.groupBy({
        by: ['page', 'utm_content'],
        where: { created_at },
        _count: { _all: true },
      }),
      prisma.prelaunch_leads.findMany({
        // Las pruebas del equipo (?internal=1) y los bots no son demanda.
        where: {
          created_at,
          OR: [{ source: null }, { source: { notIn: ['internal', 'bot'] } }],
        },
        select: {
          created_at: true,
          lang: true,
          source: true,
          utm_content: true,
          reserve_viewed_at: true,
          declined_at: true,
          reserved_at: true,
          refunded_at: true,
          surveys: { select: { kind: true, answers: true, created_at: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.prelaunch_exit_surveys.findMany({
        where: { created_at },
        select: { reason: true, text: true, utm_content: true, created_at: true },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const total = emptyRow('total');
    const byAd = new Map<string, Row>();
    const row = (content: string | null) => {
      const key = content || '(sin utm)';
      if (!byAd.has(key)) byAd.set(key, emptyRow(key));
      return byAd.get(key)!;
    };

    for (const v of visits) {
      const field = v.page === 'reserve' ? 'visits_reserve' : 'visits_home';
      total[field] += v._count._all;
      row(v.utm_content)[field] += v._count._all;
    }

    const surveys: { kind: string; answers: unknown; created_at: Date; utm_content: string | null }[] = [];
    for (const l of leads) {
      for (const r of [total, row(l.utm_content)]) {
        r.leads++;
        if (l.reserve_viewed_at) r.reserve_views++;
        if (l.declined_at) r.declined++;
        if (l.reserved_at) r.reservations++;
        if (l.reserved_at && l.refunded_at) r.refunded++;
      }
      for (const s of l.surveys) surveys.push({ ...s, utm_content: l.utm_content });
    }

    // Emails recuperados al enseñar el precio en la encuesta de salida.
    const recovered = leads.filter((l) => l.source === 'exit-price').length;

    res.json({
      from: from.toISOString(),
      to: to?.toISOString() ?? null,
      total,
      exits,
      recovered,
      by_ad: [...byAd.values()].sort((a, b) => b.leads - a.leads),
      surveys,
    });
  } catch (err) {
    console.error('[prelaunch] stats', err);
    res.status(500).json({ error: 'internal' });
  }
}

/**
 * Lista de leads para el CRM de la landing: cada email con su origen, su
 * recorrido por el embudo y sus respuestas. Incluye las pruebas internas
 * marcadas como tales (el dashboard las oculta por defecto). Se cruza con
 * las visitas del mismo navegador para saber de qué anuncio llegó la primera
 * vez, aunque al apuntarse ya no trajera UTM. El token no sale de aquí: es
 * lo que une el pago con el lead.
 */
export async function listLeads(req: Request, res: Response) {
  const range = dateRange(req);
  if (!range) {
    res.status(400).json({ error: 'invalid from or to' });
    return;
  }
  const { from, to } = range;
  try {
    const leads = await prisma.prelaunch_leads.findMany({
      where: { created_at: { gte: from, ...(to && { lt: to }) } },
      select: {
        id: true,
        created_at: true,
        email: true,
        visitor_id: true,
        lang: true,
        source: true,
        utm_source: true,
        utm_medium: true,
        utm_campaign: true,
        utm_content: true,
        utm_term: true,
        reserve_viewed_at: true,
        declined_at: true,
        reserved_at: true,
        refunded_at: true,
        amount_cents: true,
        currency: true,
        stripe_payment_id: true,
        surveys: { select: { kind: true, answers: true, created_at: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const visitorIds = [...new Set(leads.map((l) => l.visitor_id).filter((v): v is string => !!v))];
    const [visits, exits] = visitorIds.length
      ? await Promise.all([
          prisma.prelaunch_visits.findMany({
            where: { visitor_id: { in: visitorIds } },
            select: { visitor_id: true, page: true, created_at: true, utm_source: true, utm_campaign: true, utm_content: true },
            orderBy: { created_at: 'asc' },
          }),
          prisma.prelaunch_exit_surveys.findMany({
            where: { visitor_id: { in: visitorIds } },
            select: { visitor_id: true, reason: true, text: true, created_at: true },
          }),
        ])
      : [[], []];

    const visitsBy = new Map<string, typeof visits>();
    for (const v of visits) {
      if (!visitsBy.has(v.visitor_id)) visitsBy.set(v.visitor_id, []);
      visitsBy.get(v.visitor_id)!.push(v);
    }
    const exitBy = new Map(exits.map((e) => [e.visitor_id, e]));

    res.json({
      from: from.toISOString(),
      to: to?.toISOString() ?? null,
      leads: leads.map(({ visitor_id, ...l }) => {
        const own = visitor_id ? visitsBy.get(visitor_id) ?? [] : [];
        const first = own[0];
        const exit = visitor_id ? exitBy.get(visitor_id) : undefined;
        return {
          ...l,
          first_visit: first
            ? {
                created_at: first.created_at,
                utm_source: first.utm_source,
                utm_campaign: first.utm_campaign,
                utm_content: first.utm_content,
              }
            : null,
          pages: own.map((v) => v.page),
          exit_survey: exit ? { reason: exit.reason, text: exit.text, created_at: exit.created_at } : null,
        };
      }),
    });
  } catch (err) {
    console.error('[prelaunch] leads', err);
    res.status(500).json({ error: 'internal' });
  }
}
