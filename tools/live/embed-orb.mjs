/** Embed the baked orb sky into the client as a data URI. */
import { readFileSync, writeFileSync } from 'node:fs';

const b64 = readFileSync(new URL('./orb-sky.b64', import.meta.url), 'utf8').trim();
const file = new URL('../../lib/client.js', import.meta.url);
const source = readFileSync(file, 'utf8');
const next = source.replace(/const ORB_SKY = (["'])[^"']*\1;/, `const ORB_SKY = "data:image/webp;base64,${b64}";`);
if (next === source) throw new Error('ORB_SKY placeholder not found');
writeFileSync(file, next);
console.log(JSON.stringify({ bytes: b64.length, replaced: true }));
