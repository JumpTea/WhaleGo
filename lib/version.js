import { readFileSync } from 'node:fs';

let version = '0.1.0';
try {
  version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version ?? version;
} catch {
  /* keep the source version */
}

export const VERSION = version;
