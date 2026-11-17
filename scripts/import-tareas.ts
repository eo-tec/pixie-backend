/**
 * Importa campaign/TAREAS.md a la tabla `tasks` del CRM a través del API
 * (POST /admin/crm/tasks con la clave de admin), no tocando la BD directamente.
 *
 * Por defecto es un ENSAYO (dry-run): lee el fichero y enseña qué crearía, sin
 * escribir nada. Para crear las filas hay que pasar --apply y el API.
 *
 *   # Ensayo: solo leer y enseñar
 *   npx ts-node --transpile-only scripts/import-tareas.ts --file ../campaign/TAREAS.md
 *
 *   # Ensayo contra un API: además dice cuáles ya están (mismo título) y se saltarían
 *   ADMIN_API_KEY=... npx ts-node --transpile-only scripts/import-tareas.ts \
 *     --file ../campaign/TAREAS.md --api http://localhost:3010
 *
 *   # De verdad
 *   ADMIN_API_KEY=... npx ts-node --transpile-only scripts/import-tareas.ts \
 *     --file ../campaign/TAREAS.md --api http://localhost:3010 --apply
 *
 * Formato que entiende (el de TAREAS.md):
 *   ## Pendiente
 *   - [ ] Qué · para cuándo (AAAA-MM-DD, vacío o texto como «cada lunes») · quién (Álvaro o agente) · origen
 *   ## Hecho
 *   - [x] Qué · AAAA-MM-DD
 * El estado sale de la casilla ([ ] pendiente, [x] hecha). Los campos se
 * cuentan desde el final, así que un « · » dentro del texto no rompe nada.
 * Las hechas no dicen quién: van como «agente» (--done-owner alvaro para
 * cambiarlo). Repetir la importación no duplica: se salta lo que ya existe
 * con el mismo título y estado.
 */
import fs from 'fs';
import path from 'path';

type Owner = 'alvaro' | 'agente';

export interface ParsedTask {
  line: number;
  title: string;
  status: 'pending' | 'done';
  due_date: string | null;
  due_text: string | null;
  owner: Owner;
  origin: string | null;
  done_at: string | null;
  warnings: string[];
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TASK_RE = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/;

function parseOwner(s: string): Owner | null {
  const v = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
  if (v === 'alvaro') return 'alvaro';
  if (v === 'agente' || v === 'puesto de mando') return 'agente';
  return null;
}

function isDay(s: string): boolean {
  return DAY_RE.test(s) && !isNaN(Date.parse(`${s}T00:00:00Z`));
}

export function parseTareas(md: string, doneOwner: Owner = 'agente'): ParsedTask[] {
  const out: ParsedTask[] = [];
  md.split(/\r?\n/).forEach((raw, i) => {
    const m = TASK_RE.exec(raw);
    if (!m) return;
    const done = m[1] !== ' ';
    const parts = m[2].split(/\s·(?=\s|$)/).map((p) => p.replace(/\s+/g, ' ').trim());
    const warnings: string[] = [];
    const t: ParsedTask = {
      line: i + 1,
      title: '',
      status: done ? 'done' : 'pending',
      due_date: null,
      due_text: null,
      owner: done ? doneOwner : 'alvaro',
      origin: null,
      done_at: null,
      warnings,
    };

    if (done && parts.length >= 2 && parts.length < 4) {
      // - [x] Qué · AAAA-MM-DD
      const last = parts[parts.length - 1];
      if (isDay(last)) {
        t.done_at = `${last}T12:00:00.000Z`;
        parts.pop();
      } else warnings.push(`hecha sin fecha («${last}» no es AAAA-MM-DD): se pone la de hoy`);
      t.title = parts.join(' · ');
    } else if (parts.length >= 4) {
      // - [ ] Qué · para cuándo · quién · origen
      const origin = parts.pop()!;
      const who = parts.pop()!;
      const due = parts.pop()!;
      t.title = parts.join(' · ');
      t.origin = origin || null;
      const owner = parseOwner(who);
      if (owner) t.owner = owner;
      else if (who) warnings.push(`quién «${who}» no es Álvaro ni agente: se pone ${t.owner}`);
      else warnings.push(`sin quién: se pone ${t.owner}`);
      if (isDay(due)) t.due_date = due;
      else if (due) t.due_text = due;
      if (done) {
        warnings.push('hecha con formato de pendiente (sin fecha de cierre): se pone la de hoy');
      }
    } else {
      t.title = parts.join(' · ');
      warnings.push('no sigue el formato (faltan campos): solo se importa el texto');
    }
    if (!t.title) return;
    out.push(t);
  });
  return out;
}

// ---------------------------------------------------------------------------

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function findFile(): string {
  const given = arg('file');
  if (given) return path.resolve(given);
  // pixie-backend/scripts → frame/campaign/TAREAS.md
  const candidates = [path.resolve(__dirname, '../../campaign/TAREAS.md'), path.resolve(process.cwd(), '../campaign/TAREAS.md')];
  const found = candidates.find((c) => fs.existsSync(c));
  if (!found) {
    console.error('[import-tareas] No encuentro TAREAS.md; pásalo con --file');
    process.exit(1);
  }
  return found;
}

async function main() {
  const file = findFile();
  const apply = process.argv.includes('--apply');
  const api = arg('api')?.replace(/\/$/, '');
  const key = process.env.ADMIN_API_KEY ?? '';
  const doneOwner = parseOwner(arg('done-owner') ?? 'agente') ?? 'agente';
  if (apply && (!api || !key)) {
    console.error('[import-tareas] --apply necesita --api <url> y ADMIN_API_KEY');
    process.exit(1);
  }

  const tasks = parseTareas(fs.readFileSync(file, 'utf8'), doneOwner);
  console.log(`[import-tareas] ${file}: ${tasks.length} tareas (${tasks.filter((t) => t.status === 'pending').length} pendientes, ${tasks.filter((t) => t.status === 'done').length} hechas)`);

  // Lo que ya hay en el CRM (para no duplicar)
  let existing = new Set<string>();
  const call = async (p: string, init: { method?: string; body?: unknown } = {}) => {
    const res = await fetch(`${api}/admin/crm${p}`, {
      method: init.method ?? 'GET',
      headers: { 'X-Admin-Key': key, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${res.status} ${data.error ?? ''}`);
    return data;
  };
  if (api && key) {
    const { tasks: rows } = await call('/tasks?status=all');
    existing = new Set(rows.map((r: { title: string; status: string }) => `${r.status}|${r.title}`));
    console.log(`[import-tareas] ${api}: ya hay ${rows.length} tareas`);
  } else {
    console.log('[import-tareas] sin --api: no compruebo duplicados');
  }

  let created = 0;
  let skipped = 0;
  for (const t of tasks) {
    const dup = existing.has(`${t.status}|${t.title}`);
    const when = t.status === 'done' ? `hecha ${t.done_at?.slice(0, 10) ?? 'hoy'}` : t.due_date ?? t.due_text ?? 'sin fecha';
    const head = `${dup ? 'SALTA ' : apply ? 'CREA  ' : 'CREARÍA'} L${String(t.line).padEnd(3)} [${t.status === 'done' ? 'x' : ' '}] ${when.padEnd(11)} ${t.owner.padEnd(6)} ${t.title.slice(0, 90)}${t.title.length > 90 ? '…' : ''}`;
    console.log(head + (t.origin ? `  (origen: ${t.origin})` : ''));
    for (const w of t.warnings) console.log(`        ⚠ ${w}`);
    if (dup) {
      skipped++;
      continue;
    }
    if (apply) {
      await call('/tasks', {
        method: 'POST',
        body: {
          title: t.title,
          status: t.status,
          due_date: t.due_date,
          due_text: t.due_text,
          owner: t.owner,
          origin: t.origin,
          done_at: t.done_at,
        },
      });
      existing.add(`${t.status}|${t.title}`);
      created++;
    }
  }
  console.log(
    apply
      ? `[import-tareas] creadas ${created}, saltadas ${skipped} (ya estaban)`
      : `[import-tareas] ENSAYO: no se ha escrito nada. Crearía ${tasks.length - skipped}${skipped ? `, saltaría ${skipped}` : ''}. Para crearlas: --apply`,
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[import-tareas]', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
