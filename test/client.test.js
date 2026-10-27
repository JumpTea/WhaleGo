import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

/** Evaluate the browser module against a minimal module loader stub. */
function loadClient({ document } = {}) {
  let factory;
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (value) => [value, () => {}],
    useEffect: () => {},
    useRef: (value) => ({ current: value }),
    useCallback: (fn) => fn,
    Fragment: 'fragment',
  };
  const window = {
    __ModuleLoader__: {
      load: ({ factory: fn }) => {
        factory = fn;
      },
    },
  };
  const mounted = [];
  const require = (name) => {
    if (name === 'react') return React;
    if (name === 'react-dom/client') {
      return { createRoot: (host) => ({ render: (node) => mounted.push({ host, node }) }) };
    }
    throw new Error(`unexpected require: ${name}`);
  };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', source)(window, document);
  return { mod: factory(require), mounted };
}

function fakeDocument() {
  const appended = [];
  return {
    appended,
    documentElement: { dataset: {} },
    head: { appendChild: () => {} },
    body: { appendChild: (node) => appended.push(node) },
    getElementById: () => null,
    createElement: (tag) => ({ tag, id: '', textContent: '', remove() {} }),
  };
}

test('client half exports apply and asks for the slots service', () => {
  const { mod } = loadClient();
  assert.equal(typeof mod.apply, 'function');
  assert.deepEqual(mod.inject, ['slots']);
});

test('apply is inert without a DOM (server side import)', () => {
  const { mod, mounted } = loadClient();
  assert.doesNotThrow(() => mod.apply({}));
  assert.equal(mounted.length, 0);
});

test('apply mounts the floating voice panel into the page', () => {
  const document = fakeDocument();
  const { mod, mounted } = loadClient({ document });
  mod.apply({});
  assert.equal(document.documentElement.dataset.whalegoClient, '1');
  assert.equal(document.appended.length, 1);
  assert.equal(document.appended[0].id, 'whalego-voice-host');
  assert.equal(mounted.length, 1);
});
