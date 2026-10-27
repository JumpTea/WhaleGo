import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

/** Evaluate the browser module against a minimal module loader stub. */
function loadClient() {
  let factory;
  const slots = [];
  const requests = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (value) => [value, () => {}],
    useEffect: () => {},
  };
  const window = {
    __ModuleLoader__: {
      load: ({ id, factory: fn }) => {
        factory = fn;
      },
    },
  };
  const require = (name) => {
    if (name === 'react') return React;
    throw new Error(`unexpected require: ${name}`);
  };
  // eslint-disable-next-line no-new-func
  new Function('window', 'fetch', source)(window, (url) => {
    requests.push(String(url));
    return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
  });
  const mod = factory(require);
  return { mod, slots, requests };
}

test('client half registers a voice card slot', () => {
  const { mod } = loadClient();
  assert.equal(typeof mod.apply, 'function');
  assert.deepEqual(mod.inject, ['slots']);
});

test('apply registers on assistant-actions and is idempotent per ctx', () => {
  const { mod } = loadClient();
  const registered = [];
  const ctx = {
    slots: {
      inject: (name, register) => {
        registered.push(name);
        register();
      },
      register: (definition, component) => {
        registered.push(['register', definition.name, typeof component]);
      },
    },
  };
  mod.apply(ctx);
  assert.deepEqual(registered[0], 'conversation.chat.assistant-actions');
  assert.deepEqual(registered[1], ['register', 'conversation.chat.assistant-actions', 'function']);
});
