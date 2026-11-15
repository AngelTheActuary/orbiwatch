/**
 * Descarga datos reales y vigentes de CelesTrak para la app.
 *
 * Uso: `npm run fetch:sample`
 *
 * Presupuesto de peticiones (por qué este script es "buen ciudadano"):
 * - 1 petición GP por cada objeto de la lista curada (12). CelesTrak acepta UN solo
 *   número en CATNR; las listas con comas responden "Invalid query".
 * - 1 petición SATCAT por objeto (12), para conocer su tipo y estado operativo.
 * - 1 petición GP por grupo de escombros (4) y 1 del grupo `active` (~10 000+ satélites).
 * Total: 29 peticiones, en serie y con una pausa de 1 s entre ellas. Todo queda en
 * caché (`.cache/`, 2 h para GP y 12 h para SATCAT): correrlo otra vez antes de que
 * venza no genera ninguna petición nueva.
 *
 * Errores:
 * - HTTP distinto de 200 → se abre el "circuit breaker" y el script se DETIENE.
 * - 200 con texto en vez de JSON (objeto sin datos, consulta mal hecha) → se avisa,
 *   se omite ese objeto y se sigue; si pasa 3 veces seguidas, se detiene (algo está mal).
 *
 * @module scripts/fetch-sample
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { CelestrakClient, CircuitOpenError, InvalidResponseError, type FetchResult } from '../src/ingest/celestrak';
import { FileCache } from '../src/ingest/fileCache';

interface RelevantList {
  objects: { noradId: number; name: string }[];
  debrisGroups: { group: string }[];
}

/** Pausa entre peticiones reales (no aplica a respuestas servidas desde caché). */
const POLITE_DELAY_MS = 1000;
/** Respuestas inválidas seguidas que toleramos antes de detenernos. */
const MAX_CONSECUTIVE_INVALID = 3;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const list = JSON.parse(await readFile('data/relevant-objects.json', 'utf8')) as RelevantList;
  const client = new CelestrakClient({
    cache: new FileCache('.cache/celestrak'),
    userAgent: 'OrbitWatch/0.1 (proyecto educativo de código abierto)',
  });

  let consecutiveInvalid = 0;
  let network = 0;

  /** Ejecuta una descarga con pausa cortés y tolerancia a respuestas sin datos. */
  async function polite(label: string, task: () => Promise<FetchResult>): Promise<unknown[] | null> {
    try {
      const res = await task();
      consecutiveInvalid = 0;
      if (!res.fromCache) {
        network++;
        await sleep(POLITE_DELAY_MS);
      }
      const rows = JSON.parse(res.body) as unknown[];
      console.log(`  ✓ ${label}: ${rows.length} registro(s)${res.fromCache ? ' (caché)' : ''}`);
      return rows;
    } catch (e) {
      if (e instanceof InvalidResponseError) {
        consecutiveInvalid++;
        network++;
        console.warn(`  ⚠ ${label}: sin datos (${e.bodyPreview || 'respuesta vacía'}). Se omite.`);
        if (consecutiveInvalid >= MAX_CONSECUTIVE_INVALID) {
          throw new Error(`${MAX_CONSECUTIVE_INVALID} respuestas inválidas seguidas: revisa las consultas antes de reintentar.`);
        }
        await sleep(POLITE_DELAY_MS);
        return null;
      }
      throw e;
    }
  }

  try {
    console.log('Objetos relevantes (GP + SATCAT):');
    const gp: unknown[] = [];
    const satcat: unknown[] = [];
    for (const o of list.objects) {
      const rows = await polite(`GP ${o.noradId} ${o.name}`, () => client.fetchGp({ CATNR: o.noradId }, 'JSON'));
      if (rows) gp.push(...rows);
      const meta = await polite(`SATCAT ${o.noradId}`, () => client.fetchSatcat({ CATNR: o.noradId }));
      if (meta) satcat.push(...meta);
    }

    console.log('Grupos de escombros:');
    const debris: unknown[] = [];
    for (const { group } of list.debrisGroups) {
      const rows = await polite(group, () => client.fetchGp({ GROUP: group }, 'JSON'));
      if (rows) debris.push(...rows.map((r) => ({ ...(r as object), OBJECT_TYPE: 'DEB', SOURCE_GROUP: group })));
    }

    console.log('Satélites activos:');
    const active = (await polite('active', () => client.fetchGp({ GROUP: 'active' }, 'JSON'))) ?? [];

    await mkdir('data/sample', { recursive: true });
    await writeFile('data/sample/relevant-objects.omm.json', JSON.stringify(gp));
    await writeFile('data/sample/relevant-objects.satcat.json', JSON.stringify(satcat));
    await writeFile('data/sample/debris.omm.json', JSON.stringify(debris));
    await writeFile('data/sample/active.omm.json', JSON.stringify(active));
    console.log(`\nListo → data/sample/ (${gp.length + debris.length + active.length} objetos; ${network} peticiones a la red).`);
  } catch (e) {
    if (e instanceof CircuitOpenError) {
      console.error('\n⛔ CelesTrak respondió con error y el script se detuvo para no ser bloqueado.');
      console.error(`   Motivo: ${e.message}`);
      console.error('   Revisa la causa antes de reintentar (política: https://celestrak.org/usage-policy.php).');
    } else {
      console.error(`\n⛔ ${(e as Error).message}`);
    }
    process.exitCode = 1;
  }
}

await main();
