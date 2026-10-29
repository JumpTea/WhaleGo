import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWrittenMessages, complexityOf, splitSpeakable } from '../lib/prompts.js';

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

test('casual greetings never trigger a written answer', () => {
  for (const line of ['你好', '在吗', '谢谢', '好的', '哈哈', '晚安']) {
    assert.equal(complexityOf(line), 'simple', line);
  }
});

test('strong words force the written answer even when short', () => {
  for (const line of ['对比一下', '帮我写个脚本', '报错了', '有什么区别', '推荐一个']) {
    assert.equal(complexityOf(line), 'complex', line);
  }
});

test('a long or question-shaped line is complex without a keyword', () => {
  assert.equal(complexityOf('这个大概是怎么回事呢'), 'complex');
  assert.equal(complexityOf('一二三四五六七八九十一二三四五六七八九十一二三四五'), 'complex');
});

test('a follow-up inherits the previous complexity', () => {
  assert.equal(complexityOf('那第二点呢', 'complex'), 'complex');
  assert.equal(complexityOf('那第二点呢', 'simple'), 'simple');
});

test('the written prompt is anchored to the spoken line', () => {
  const prompt = buildWrittenMessages({ question: '为什么天是蓝的', spoken: '因为瑞利散射。' });
  assert.match(prompt.system, /文字脑/);
  assert.match(prompt.messages[0].content[0].text, /因为瑞利散射/);
});
