/**
 * Demostración sin conexión del motor: parsea, propaga, inspecciona y criba.
 * Uso: `npm run demo`
 *
 * @module scripts/demo
 */

import { readFile } from 'node:fs/promises';
import {
  Propagator,
  deriveOrbitMetrics,
  ommToElementSet,
  parseTleText,
  screenConjunctions,
  temeToGeodetic,
} from '../src/index';

const fmt = (n: number, d = 1): string => n.toFixed(d).padStart(10);

const text = (await readFile('data/validation/sgp4-verification.tle', 'utf8')) +
  (await readFile('data/historical/iss-2008.tle', 'utf8'));
const { records, errors } = parseTleText(text);
console.log(`\n1) PARSER: ${records.length} TLE válidos, ${errors.length} con error\n`);

console.log('2) INSPECTOR DE METADATOS (en la época de cada TLE)');
console.log('   NORAD  Nombre            Régimen  Período(min) Incl(°)  Perigeo(km) Apogeo(km)');
for (const es of records) {
  const p = Propagator.fromElementSet(es);
  const m = deriveOrbitMetrics(es, p.satrec, es.epoch);
  console.log(`   ${String(es.noradId).padStart(5)}  ${es.name.padEnd(16)}  ${m.regime.padEnd(6)} ${fmt(m.periodMin)} ${fmt(m.inclinationDeg, 2)} ${fmt(m.perigeeAltKm)} ${fmt(m.apogeeAltKm)}`);
}

const iss = records.find((r) => r.noradId === 25544)!;
const issProp = Propagator.fromElementSet(iss);
console.log('\n3) PROPAGACIÓN SGP4 — ISS cada 15 min desde su época (2008-09-20)');
for (let k = 0; k <= 4; k++) {
  const t = new Date(iss.epoch.getTime() + k * 15 * 60000);
  const r = issProp.propagate(t);
  if (!r.ok) continue;
  const g = temeToGeodetic(r.state.positionTeme, t);
  console.log(`   ${t.toISOString()}  lat ${fmt(g.latitudeDeg, 2)}°  lon ${fmt(g.longitudeDeg, 2)}°  alt ${fmt(g.altitudeKm)} km`);
}

console.log('\n4) CRIBADO DE CONJUNCIONES — par SINTÉTICO que cruza nodos (demostración del algoritmo)');
const base = { EPOCH: '2026-10-31T00:00:00', MEAN_MOTION: 15.5, ECCENTRICITY: 0.0005, RA_OF_ASC_NODE: 40, ARG_OF_PERICENTER: 0, MEAN_ANOMALY: 0, BSTAR: 0 };
const a = ommToElementSet({ ...base, OBJECT_NAME: 'SYNTH PRIMARIO', NORAD_CAT_ID: 900001, INCLINATION: 51.6 });
const b = ommToElementSet({ ...base, OBJECT_NAME: 'SYNTH DEB', NORAD_CAT_ID: 900002, INCLINATION: 97.5, OBJECT_TYPE: 'DEB' });
const wrap = (es: typeof a) => { const p = Propagator.fromElementSet(es); return { propagator: p, metrics: deriveOrbitMetrics(es, p.satrec, es.epoch) }; };
const res = screenConjunctions(wrap(a), [wrap(b)], { start: new Date('2026-10-30T23:50:00Z'), durationMin: 180, thresholdKm: 50 });
for (const c of res.conjunctions) {
  console.log(`   TCA ${c.tca.toISOString()}  fallo ${fmt(c.missDistanceKm, 3)} km  v_rel ${fmt(c.relativeSpeedKmS, 2)} km/s  RIC(${c.ric.radialKm.toFixed(2)}, ${c.ric.inTrackKm.toFixed(2)}, ${c.ric.crossTrackKm.toFixed(2)})`);
}
console.log(`   Estadísticas: ${JSON.stringify(res.stats)}\n`);
