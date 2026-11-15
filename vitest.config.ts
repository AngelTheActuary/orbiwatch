import { defineConfig } from 'vitest/config';

// Las pruebas viven en tests/ (no en web/, que es la raíz de Vite).
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
