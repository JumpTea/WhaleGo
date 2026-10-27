import assert from 'node:assert/strict';
import test from 'node:test';
import { VOICE_FALLBACK, runVoiceBrain } from '../lib/voiceBrain.js';

function fakeContext({ prepareCall, stream }) {
  return {
    get(name) {
      if (name === 'llm') return { prepareCall, stream };
      if (name === 'sessionController') {
        return { modelCatalog: async () => ({ default: { provider: 'deepseek-official', model: 'deepseek-flash' } }) };
      }
      return undefined;
    },
  };
}

const chunks = (...texts) => (async function* gen() {
  for (const text of texts) yield { type: 'text-delta', text };
})();

test('voice brain streams through the registry prepareCall API', async () => {
  let seenConfig = null;
  let seenOptions = null;
  const ctx = fakeContext({
    prepareCall: async (config) => {
      seenConfig = config;
      return {
        stream: (options) => {
          seenOptions = options;
          return chunks('先看报错，', '再动手改。');
        },
      };
    },
  });
  const result = await runVoiceBrain({ ctx, question: '构建报 EPERM 怎么办？', timeoutMs: 2_000 });
  assert.equal(result.ok, true);
  assert.equal(result.text, '先看报错，再动手改。');
  assert.equal(seenConfig.provider, 'deepseek-official');
  assert.equal(seenConfig.model, 'deepseek-flash');
  assert.equal(seenOptions.model, 'deepseek-flash');
  assert.ok(Array.isArray(seenOptions.messages));
});

test('voice brain still supports hosts that expose llm.stream directly', async () => {
  const ctx = fakeContext({
    stream: (options) => {
      assert.equal(options.model, 'deepseek-flash');
      return chunks('直接流式。');
    },
  });
  const result = await runVoiceBrain({ ctx, question: '你好', timeoutMs: 2_000 });
  assert.equal(result.ok, true);
  assert.equal(result.text, '直接流式。');
});

test('voice brain falls back when the registry has no usable API', async () => {
  const ctx = fakeContext({});
  const result = await runVoiceBrain({ ctx, question: '你好', timeoutMs: 500 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'llm-unavailable');
  assert.equal(result.text, VOICE_FALLBACK);
});
