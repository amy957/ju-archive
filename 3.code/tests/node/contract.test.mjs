/**
 * M0-7 · 批次 B1 · 契约层等价测试（node:test）
 *
 * 被测对象：src/contract/registry.ts、src/contract/lifecycle.ts
 * 对齐基准：canonical v2.0-t3.html:1319-1339（J.register / J.require / J.lifecycle）
 * 运行：node --test test/contract.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { register, require as juRequire, JU_REGISTRY } from '../src/contract/registry.ts';
import { add, on, dispose } from '../src/contract/lifecycle.ts';

test('register / require 正常往返取值', () => {
  const payload = { a: 1, b: ['x'] };
  register('m07.spec.payload', payload);
  assert.equal(juRequire('m07.spec.payload'), payload);
  register('m07.spec.num', 42);
  assert.equal(juRequire('m07.spec.num'), 42);
  assert.ok(JU_REGISTRY.has('m07.spec.num'));
});

test('require 缺失抛错消息逐字等于 "JU.require missing: xxx"', () => {
  assert.throws(
    () => juRequire('m07.spec.absent'),
    (err) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, 'JU.require missing: m07.spec.absent');
      return true;
    }
  );
});

test('lifecycle.add 正序执行：已登记 disposer 全部执行且各执行一次', () => {
  dispose();
  const log = [];
  add(() => log.push('a'));
  add(() => log.push('b'));
  dispose();
  assert.equal(log.length, 2);
  assert.deepEqual(log.slice().sort(), ['a', 'b']);
});

test('lifecycle.dispose 逆序执行（栈语义 pop）', () => {
  dispose();
  const log = [];
  add(() => log.push('a'));
  add(() => log.push('b'));
  add(() => log.push('c'));
  dispose();
  assert.deepEqual(log, ['c', 'b', 'a']);
});

test('单个 disposer 抛错不阻断后续 disposer', () => {
  dispose();
  const log = [];
  const warns = [];
  const origWarn = console.warn;
  console.warn = (...args) => warns.push(args);
  try {
    add(() => log.push('first'));
    add(() => {
      throw new Error('boom');
    });
    add(() => log.push('third'));
    dispose();
  } finally {
    console.warn = origWarn;
  }
  assert.deepEqual(log, ['third', 'first']);
  assert.equal(warns.length, 1);
  assert.equal(warns[0][0], '[JU.lifecycle]');
  assert.ok(warns[0][1] instanceof Error);
  assert.equal(warns[0][1].message, 'boom');
});

test('lifecycle.on：addEventListener 调用一次，dispose 后 removeEventListener 调用一次', () => {
  dispose();
  const calls = { add: 0, remove: 0, lastType: null, lastHandler: null, lastOpts: undefined };
  const target = {
    addEventListener(type, handler, opts) {
      calls.add += 1;
      calls.lastType = type;
      calls.lastHandler = handler;
      calls.lastOpts = opts;
    },
    removeEventListener(type, handler, opts) {
      calls.remove += 1;
      assert.equal(type, calls.lastType);
      assert.equal(handler, calls.lastHandler);
      assert.equal(opts, calls.lastOpts);
    },
  };
  const handler = () => {};
  on(target, 'click', handler, { once: true });
  assert.equal(calls.add, 1);
  assert.equal(calls.remove, 0);
  dispose();
  assert.equal(calls.add, 1);
  assert.equal(calls.remove, 1);
  dispose();
  assert.equal(calls.remove, 1);
});
