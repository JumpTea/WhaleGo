import assert from 'node:assert/strict';
import test from 'node:test';
import { splitSpeakable } from '../lib/prompts.js';

test('speech boundaries release a sentence before the answer finishes', () => {
  const first = splitSpeakable('我想想。后面的答案还在生成', 0);
  assert.deepEqual(first.segments, ['我想想。']);
  const later = splitSpeakable('我想想。后面的答案还在生成', first.cursor, { final: true });
  assert.deepEqual(later.segments, ['后面的答案还在生成']);
});

test('speech segments respect a Unicode-safe maximum length', () => {
  const source = `${'鲸'.repeat(35)}😀${'语'.repeat(8)}`;
  const split = splitSpeakable(source, 0, { final: true, maxLength: 36 });
  assert.equal(split.segments.join(''), source);
  assert.ok(split.segments.every((segment) => Array.from(segment).length <= 36));
  assert.equal(split.cursor, Array.from(source).length);
});

test('final answer flushes a last phrase without sentence punctuation', () => {
  const split = splitSpeakable('先答结论。补充说明', 5, { final: true });
  assert.deepEqual(split.segments, ['补充说明']);
  assert.equal(split.cursor, Array.from('先答结论。补充说明').length);
});
