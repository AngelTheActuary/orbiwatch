/**
 * Copia CesiumJS ya compilado (`node_modules/cesium/Build/Cesium`, ~23 MB) a
 * `web/public/cesium/`, desde donde Vite lo sirve tal cual.
 *
 * ¿Por qué no un CDN? Así el sitio funciona sin depender de terceros, sin internet en
 * clase y con la misma versión exacta que dice `package.json`.
 *
 * Se ejecuta solo antes de `npm run dev` y `npm run build`. Si ya está copiado con la
 * misma versión, no hace nada.
 *
 * @module scripts/copy-cesium
 */

import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const SRC = 'node_modules/cesium/Build/Cesium';
const DEST = 'web/public/cesium';
const STAMP = `${DEST}/.version`;

const { version } = JSON.parse(await readFile('node_modules/cesium/package.json', 'utf8')) as { version: string };
const current = existsSync(STAMP) ? (await readFile(STAMP, 'utf8')).trim() : null;

if (current === version) {
  console.log(`CesiumJS ${version} ya está en ${DEST}`);
} else {
  if (!existsSync(SRC)) throw new Error(`No existe ${SRC}. Ejecuta "npm install".`);
  await rm(DEST, { recursive: true, force: true });
  await cp(SRC, DEST, { recursive: true });
  await writeFile(STAMP, version);
  console.log(`CesiumJS ${version} copiado a ${DEST}`);
}
