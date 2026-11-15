/**
 * Construye `web/public/data/catalog.json` a partir de lo descargado por `fetch:sample`.
 *
 * Une tres fuentes y deja UN registro OMM por objeto, con su tipo y estado:
 * - `active.omm.json`        → satélites activos (GROUP=active): tipo PAY, estado "+".
 * - `debris.omm.json`        → grupos de escombros: tipo DEB.
 * - `relevant-objects.*`     → la lista curada, cruzada con el SATCAT (tipo y estado reales).
 *
 * Uso: `npm run fetch:sample && npm run build:catalog`
 *
 * @module scripts/build-catalog
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import type { RawOmm } from '../src/core/omm';

const DIR = 'data/sample';
const OUT = 'web/public/data/catalog.json';

async function readJson(file: string): Promise<RawOmm[]> {
  const path = `${DIR}/${file}`;
  if (!existsSync(path)) return [];
  return JSON.parse(await readFile(path, 'utf8')) as RawOmm[];
}

const byId = new Map<number, RawOmm>();
const put = (r: RawOmm, extra: RawOmm): void => {
  const id = Number(r['NORAD_CAT_ID']);
  if (!Number.isFinite(id)) return;
  const prev = byId.get(id);
  // Si hay duplicados, gana la época más reciente; los metadatos se combinan.
  if (!prev || String(r['EPOCH']) >= String(prev['EPOCH'])) byId.set(id, { ...prev, ...r, ...extra });
};

for (const r of await readJson('active.omm.json')) put(r, { OBJECT_TYPE: 'PAY', OPS_STATUS_CODE: '+' });
for (const r of await readJson('debris.omm.json')) put(r, { OBJECT_TYPE: r['OBJECT_TYPE'] ?? 'DEB' });

const satcat = new Map((await readJson('relevant-objects.satcat.json')).map((s) => [Number(s['NORAD_CAT_ID']), s]));
for (const r of await readJson('relevant-objects.omm.json')) {
  const s = satcat.get(Number(r['NORAD_CAT_ID']));
  put(r, s ? { OBJECT_TYPE: s['OBJECT_TYPE'], OPS_STATUS_CODE: s['OPS_STATUS_CODE'] } : {});
}

if (byId.size === 0) {
  console.error(`No hay datos en ${DIR}/. Ejecuta primero "npm run fetch:sample" (requiere internet).`);
  process.exit(1);
}

// La fecha de generación es la de la descarga más reciente (no "ahora"): es lo honesto.
const files = ['active.omm.json', 'debris.omm.json', 'relevant-objects.omm.json'].map((f) => `${DIR}/${f}`).filter(existsSync);
const newest = Math.max(...(await Promise.all(files.map(async (f) => (await stat(f)).mtimeMs))));

const KEEP = ['OBJECT_NAME', 'OBJECT_ID', 'NORAD_CAT_ID', 'EPOCH', 'MEAN_MOTION', 'ECCENTRICITY', 'INCLINATION', 'RA_OF_ASC_NODE',
  'ARG_OF_PERICENTER', 'MEAN_ANOMALY', 'BSTAR', 'MEAN_MOTION_DOT', 'MEAN_MOTION_DDOT', 'ELEMENT_SET_NO', 'REV_AT_EPOCH',
  'CLASSIFICATION_TYPE', 'OBJECT_TYPE', 'OPS_STATUS_CODE'];
const records = [...byId.values()].map((r) => Object.fromEntries(KEEP.filter((k) => r[k] !== undefined && r[k] !== null).map((k) => [k, r[k]])));

await mkdir('web/public/data', { recursive: true });
await writeFile(OUT, JSON.stringify({ generatedAt: new Date(newest).toISOString(), source: 'CelesTrak', records }));
console.log(`${records.length} objetos → ${OUT}`);
