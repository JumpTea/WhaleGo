/**
 * The vendored dsh-orb surface: a package that boots, not just files on disk.
 *
 * These checks are static on purpose. They assert the three things a runtime
 * failure would otherwise report only after a 240 MB Electron download: the
 * host entry can find its own dependencies, the profile patch inserts every
 * entry the bundle promises, and the browser half really rides inside
 * WhaleGo's single module instead of registering a second one.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');
const pkg = JSON.parse(read('package.json'));
const patch = read('cordis.patch.yml');
const client = read('lib', 'client.js');
const orbClient = read('vendor', 'dsh-orb', 'client.js');

/** Every file the profile resolves through an exports subpath. */
const ENTRY_FILES = [
  ['orb-host', 'vendor/dsh-orb/dist/host/index.js'],
  ['orb-computer-use', 'vendor/dsh-orb/dist/computer-use/index.js'],
  ['orb-computer-use/code-agent', 'vendor/dsh-orb/dist/computer-use/code-agent.js'],
  ['orb-computer-use/code-agent-registry', 'vendor/dsh-orb/dist/computer-use/code-agent-registry.js'],
  ['orb-settings', 'vendor/dsh-orb/lib/index.js'],
];

test('the vendored package keeps the layout its host resolves against', () => {
  // ownPackageRoot() is import.meta.url two levels up, so dist/host/index.js
  // must sit directly under the package root that owns node_modules.
  for (const file of ['LICENSE', 'package.json', 'client.js', 'lib/index.js', 'lib/index.d.ts']) {
    assert.ok(existsSync(join(root, 'vendor', 'dsh-orb', file)), `vendor/dsh-orb/${file} is missing`);
  }
  const modules = join(root, 'vendor', 'dsh-orb', 'node_modules');
  for (const name of ['koffi', 'node-cpal', 'sherpa-onnx-node', 'zod', 'pinyin-pro']) {
    assert.ok(existsSync(join(modules, name)), `vendor/dsh-orb/node_modules/${name} is missing`);
  }
  assert.ok(existsSync(join(modules, '@koromix')), 'vendor/dsh-orb/node_modules/@koromix is missing');
});

test('each orb export points at a file that exists', () => {
  for (const [subpath, file] of ENTRY_FILES) {
    assert.equal(pkg.exports[`./${subpath}`], `./${file}`, `exports["./${subpath}"] drifted`);
    const full = join(root, file);
    assert.ok(existsSync(full), `${file} is missing`);
    assert.ok(statSync(full).size > 0, `${file} is empty`);
  }
  assert.equal(pkg.exports['./client'], './lib/client.js');
});

test('the host entry can find its own package root and native images', () => {
  const host = read('vendor', 'dsh-orb', 'dist', 'host', 'index.js');
  // ownPackageRoot(): fileURLToPath(new URL("../../", import.meta.url))
  assert.match(host, /new URL\("\.\.\/\.\.\/", url\)/, 'ownPackageRoot no longer walks two levels up');
  assert.match(host, /node_modules/, 'the host no longer looks for node_modules at the package root');
  const native = join(root, 'vendor', 'dsh-orb', 'dist', 'helper');
  assert.ok(existsSync(native), 'the helper directory is missing');
  assert.ok(existsSync(join(native, 'lib', 'main.js')), 'the helper main process is missing');
  assert.ok(existsSync(join(native, 'preload.cjs')), 'the helper preload is missing');
});

test('the patch inserts the voice plugin and every orb entry under whalego ids', () => {
  const expected = new Map([
    ['whalego', 'whalego'],
    ['whalego-preset-computer-use', '@deepseek-ai/dsh-agent-preset'],
    ['whalego-orb-code-agent-registry', 'whalego/orb-computer-use/code-agent-registry'],
    ['whalego-orb-host', 'whalego/orb-host'],
    ['whalego-ui-settings-orb', 'whalego/orb-settings'],
  ]);
  for (const [id, name] of expected) {
    const block = new RegExp(`- id: ${id}\\n\\s+name: '?${name.replace(/[/.@-]/g, '\\$&')}'?\\n?`, 'm');
    assert.match(patch, block, `patch entry ${id} -> ${name} is missing`);
  }
  // The preset keeps the upstream id, so the agent-preset registry sees one
  // Computer Use preset rather than a WhaleGo-specific duplicate.
  assert.match(patch, /config:\n\s+id: computer-use\n/, 'the preset lost its upstream id');
  assert.match(patch, /name: 'whalego\/orb-computer-use'/, 'the GUI tool row is missing');
  assert.match(patch, /name: 'whalego\/orb-computer-use\/code-agent'/, 'the code-agent tool row is missing');
  assert.match(patch, /autoStart: true/, 'the ball host is not configured to start the helper');
});

test('one package, one browser module: the orb UI rides inside WhaleGo', () => {
  const registrations = client.match(/__ModuleLoader__\.load\(/g) ?? [];
  assert.equal(registrations.length, 1, 'a second module registration would collide with the one-package-one-module rule');
  assert.match(client, /id: 'whalego'/, 'the module id is no longer whalego');
  assert.equal((client.match(/const __orbUi = \(\(\) => \{/g) ?? []).length, 1);
  assert.match(client, /__orbUi\.apply\(ctx\)/, 'apply() no longer starts the orb UI');
  assert.match(client, /BEGIN vendored dsh-orb client/, 'the vendored block lost its marker');
  assert.match(client, /END vendored dsh-orb client/, 'the vendored block lost its end marker');
  // The embedded factory must not drag a second copy of the module system in.
  assert.equal((client.match(/__ModuleLoader__/g) ?? []).length, 1);
  // dsh-orb's own registration lives only in the vendored file now.
  assert.equal((orbClient.match(/__ModuleLoader__\.load\(/g) ?? []).length, 1);
});

test('the embedded orb half keeps the upstream settings surface', () => {
  assert.match(client, /const SECTION_ID = 'orb'/, 'the settings section id drifted');
  assert.match(client, /ctx\.slots\.register\(\{\n\s+name: 'settings\.section'/, 'the settings section is no longer registered');
  assert.match(client, /id: SECTION_ID/, 'the section no longer registers under SECTION_ID');
  assert.match(client, /dsh-orb-settings-style/, 'the settings stylesheet is missing');
  for (const label of ['悬浮球', 'Spoken commands', 'voice']) {
    assert.ok(client.includes(label), `the settings surface lost ${label}`);
  }
});

test('the orb UI only requires what WhaleGo already materializes', () => {
  // A require() of a package the host does not seed throws at materialization
  // time, deep inside the settings render — the failure this test exists for.
  const body = client.slice(client.indexOf('BEGIN vendored dsh-orb client'));
  const requires = [...body.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(requires)], ['react'], 'the orb UI grew a dependency WhaleGo cannot require');
});

test('versions agree between the module and the package', () => {
  assert.equal(pkg.version, '0.10.0');
  assert.match(client, /const CLIENT_BUILD = '0\.10\.0'/);
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(pkg.dsh.client.platform, 'web');
});

test('the vendored license and notices travel with the code', () => {
  const license = read('vendor', 'dsh-orb', 'LICENSE');
  assert.match(license, /MIT License/);
  const notices = read('vendor', 'dsh-orb', 'THIRD-PARTY-NOTICES.md');
  assert.match(notices, /sherpa-onnx|koffi/i, 'the third-party notices lost their dependency list');
});
