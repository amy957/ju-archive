/* fix27-2：spec 登记强制检查——tests/v21-review*-*.spec.ts 中 reviewNN-NN 命名的用例必须登记在 gate-manifest.e2e_specs */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(path.join(project, 'gate-manifest.json'), 'utf8'));
const registered = new Set(manifest.e2e_specs || []);
const SCOPED = /^v21-review.*-.*\.spec\.ts$/;
const SERIAL = /review\d+-\d+/;
const missing = readdirSync(path.join(project, 'tests'))
  .filter((f) => f.endsWith('.spec.ts') && SCOPED.test(f) && SERIAL.test(f))
  .map((f) => `tests/${f}`)
  .filter((rel) => !registered.has(rel))
  .sort();
if (missing.length) {
  for (const rel of missing) console.log(`请登记 ${rel} 到 gate-manifest.json e2e_specs`);
  process.exit(1);
}
console.log(`spec registration OK: ${registered.size} registered e2e specs`);
