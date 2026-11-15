/**
 * Configuración de Vite (servidor de desarrollo y empaquetador de la web).
 *
 * - `root: 'web'`: la app vive en `web/`; el motor (`src/`) se importa por ruta relativa.
 * - `base: './'`: rutas relativas, para que el sitio funcione igual en
 *   `https://usuario.github.io/orbitwatch/` que en la raíz de un dominio.
 * - Los workers se empaquetan como módulos ES.
 */
import { createLogger, defineConfig } from 'vite';

/*
 * satellite.js incluye una versión WebAssembly que hace `await import("node:module")`
 * SÓLO si detecta que corre en Node. En el navegador esa rama nunca se ejecuta y además
 * no la usamos (Vite la elimina del paquete final). Vite igual avisa al verla; filtramos
 * ese aviso concreto para que no parezca un error.
 */
const logger = createLogger();
const warn = logger.warn.bind(logger);
logger.warn = (msg, options) => {
  if (msg.includes('externalized for browser compatibility') && msg.includes('satellite.js/wasm-build')) return;
  if (msg.includes('cesium/Cesium.js') && msg.includes('without type="module"')) return; // se carga a propósito como script clásico
  warn(msg, options);
};

export default defineConfig({
  root: 'web',
  base: './',
  publicDir: 'public',
  customLogger: logger,
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
  },
  worker: { format: 'es' },
  server: { port: 5173, open: false },
});
