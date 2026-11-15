/**
 * Verificación previa: se ejecuta sola antes de `npm run dev`, `build`, `fetch:sample`, etc.
 * Está escrita en JavaScript puro (sin dependencias) para funcionar incluso ANTES de
 * `npm install`, que es justo cuando hace falta.
 *
 * Revisa: versión de Node.js y que las dependencias estén instaladas.
 */

import { existsSync } from 'node:fs';

const errors = [];

// Vite 8 exige Node 20.19+ o 22.12+.
const [major, minor] = process.versions.node.split('.').map(Number);
const nodeOk = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22;
if (!nodeOk) {
  errors.push(
    `Tu Node.js es ${process.versions.node}; se necesita 20.19 o superior (recomendado 22 LTS).\n` +
      '     Fedora:  sudo dnf install nodejs22   (o usa https://github.com/nvm-sh/nvm)\n' +
      '     Ubuntu:  https://nodejs.org/en/download',
  );
}

const required = ['tsx', 'vite', 'cesium', 'satellite.js', 'typescript', 'vitest'];
const missing = required.filter((p) => !existsSync(`node_modules/${p}/package.json`));
if (missing.length > 0) {
  errors.push(
    `Faltan dependencias: ${missing.join(', ')}.\n` +
      '     Ejecuta UNA vez, dentro de la carpeta del proyecto:\n\n' +
      '         npm install\n\n' +
      '     (descarga ~150 MB en node_modules/; el zip no las incluye a propósito)',
  );
}

if (errors.length > 0) {
  console.error('\n⛔ OrbitWatch no puede arrancar todavía:\n');
  for (const e of errors) console.error(`  • ${e}\n`);
  process.exit(1);
}
