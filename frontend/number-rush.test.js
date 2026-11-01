const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function engine() {
  const context = { window: {}, Math, performance: { now: () => 0 } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'number-rush', 'questions.js'), 'utf8'), context);
  return context.window.NumberRushEngine;
}

function seeded(seed = 0x5eed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function leaves(tree) {
  return tree.type === 'number' ? [tree.value] : [...leaves(tree.left), ...leaves(tree.right)];
}

function operators(tree, into = []) {
  if (tree.type === 'binary') { into.push(tree.op); operators(tree.left, into); operators(tree.right, into); }
  return into;
}

function assertIntegerDivision(tree, api) {
  if (tree.type !== 'binary') return;
  if (tree.op === '÷') {
    const divisor = api.evaluate(tree.right);
    assert.notEqual(divisor, 0);
    assert.equal(api.evaluate(tree.left) % divisor, 0);
  }
  assertIntegerDivision(tree.left, api);
  assertIntegerDivision(tree.right, api);
}

test('five difficulty levels use stable correct-answer thresholds', () => {
  const { levelFor } = engine();
  assert.deepEqual([0, 4, 5, 9, 10, 14, 15, 19, 20, 200].map(levelFor), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});

test('each difficulty has a distinct expression structure and correct integer answers', () => {
  const api = engine(); const random = seeded();
  for (let level = 1; level <= 5; level++) {
    api.resetQuestionHistory();
    const generated = Array.from({ length: 80 }, () => api.makeQuestion([0, 5, 10, 15, 20][level - 1], random));
    for (const question of generated) {
      assert.equal(question.level, level);
      assert.equal(question.answer, api.evaluate(question.tree));
      assert.equal(Number.isInteger(question.answer), true);
      assert.equal(question.choices.length, 4);
      assert.equal(new Set(question.choices).size, 4);
      assert.equal(question.choices.filter(value => value === question.answer).length, 1);
      for (const value of leaves(question.tree)) assert.ok(Number.isSafeInteger(value));
      for (const op of operators(question.tree)) {
        assert.ok(['+', '−', '×', '÷', '^'].includes(op));
      }
      assertIntegerDivision(question.tree, api);
    }
    for (let i = 1; i < generated.length; i++) assert.notEqual(generated[i].expression, generated[i - 1].expression);
    if (level === 1) assert.ok(generated.every(q => leaves(q.tree).length === 2 && operators(q.tree).every(op => ['+', '−'].includes(op))));
    if (level === 3) assert.ok(generated.every(q => leaves(q.tree).length === 3 && operators(q.tree).length === 2));
    if (level === 4) assert.ok(generated.every(q => leaves(q.tree).length === 4 && operators(q.tree).length === 3));
    if (level === 5) assert.ok(generated.every(q => operators(q.tree).includes('^')));
  }
});

test('expression evaluation respects precedence, brackets and integer-division constraints', () => {
  const { evaluate, render } = engine();
  const n = value => ({ type: 'number', value });
  const b = (op, left, right) => ({ type: 'binary', op, left, right });
  const mixed = b('+', n(12), b('×', n(8), n(3)));
  assert.equal(evaluate(mixed), 36);
  assert.equal(render(mixed), '12 + 8 × 3');
  const bracketed = b('+', b('÷', n(36), b('×', n(3), n(2))), b('^', n(7), n(2)));
  assert.equal(evaluate(bracketed), 55);
  assert.equal(render(bracketed), '36 ÷ (3 × 2) + 7²');
  assert.throws(() => evaluate(b('÷', n(8), n(0))), /zero/);
  assert.throws(() => evaluate(b('÷', n(7), n(2))), /integer/);
});

test('question generation avoids an immediate repeat even with a fixed random source', () => {
  const api = engine();
  const first = api.makeQuestion(0, () => 0);
  const second = api.makeQuestion(0, () => 0);
  assert.notEqual(first.expression, second.expression);
});

test('timer starts at 60 seconds, applies time changes and never crosses its bounds', () => {
  const api = engine(); let now = 0;
  const timer = api.createTimer(() => now);
  assert.equal(timer.snapshot().remainingMs, 60_000);
  timer.start();
  now = 10_000;
  let snap = timer.adjust(3_000);
  assert.equal(snap.remainingMs, 53_000);
  assert.equal(snap.elapsedActiveMs, 10_000);
  now = 11_000;
  snap = timer.adjust(-2_000);
  assert.equal(snap.remainingMs, 50_000);
  assert.equal(snap.elapsedActiveMs, 11_000);
  now = 12_000;
  timer.pause();
  now = 50_000;
  assert.equal(timer.snapshot().remainingMs, 49_000);
  assert.equal(timer.snapshot().elapsedActiveMs, 12_000);
  timer.resume();
  now = 51_000;
  assert.equal(timer.snapshot().remainingMs, 48_000);
  timer.adjust(50_000);
  assert.equal(timer.snapshot().remainingMs, 60_000);
  now = 52_000;
  timer.adjust(-100_000);
  assert.equal(timer.snapshot().remainingMs, 0);
  assert.equal(timer.snapshot().running, false);
  assert.equal(timer.snapshot().elapsedActiveMs, 14_000);
});

test('elapsed gameplay time uses monotonic active time and excludes pauses', () => {
  const api = engine(); let now = 0;
  const timer = api.createTimer(() => now);
  timer.start();
  now = 15_000;
  timer.pause();
  now = 90_000;
  assert.equal(timer.snapshot().elapsedActiveMs, 15_000);
  timer.resume();
  now = 105_000;
  assert.equal(timer.snapshot().elapsedActiveMs, 30_000);
  const done = timer.finish();
  assert.equal(done.remainingMs, 0);
  assert.equal(done.elapsedActiveMs, 30_000);
});

test('score is independent of timer changes and performance statistics handle zero answers', () => {
  const api = engine();
  assert.equal(api.scoreForAnswer(true), 10);
  assert.equal(api.scoreForAnswer(false), 0);
  const empty = api.performanceSummary();
  assert.equal(empty.totalAnswered, 0);
  assert.equal(empty.accuracy, 0);
  const summary = api.performanceSummary({ correct: 19, incorrect: 5, elapsedActiveMs: 78_200, score: 340, highestLevel: 4, personalBest: 850 });
  assert.deepEqual({ total: summary.totalAnswered, correct: summary.correct, incorrect: summary.incorrect, accuracy: summary.accuracy, start: summary.startingTimeSeconds, played: summary.totalTimePlayedSeconds, level: summary.highestLevel, best: summary.personalBest },
    { total: 24, correct: 19, incorrect: 5, accuracy: 79.2, start: 60, played: 78, level: 4, best: 850 });
});

test('local storage retains existing personal best and safely handles unavailable storage', () => {
  const memory = new Map([['setbget:number-rush:v1', JSON.stringify({ best: 85, games: 3 })]]);
  const context = { window: {}, localStorage: { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'number-rush', 'storage.js'), 'utf8'), context);
  assert.equal(context.window.NumberRushStorage.read().best, 85);
  context.window.NumberRushStorage.write({ best: 120, games: 4 });
  assert.deepEqual(JSON.parse(memory.get('setbget:number-rush:v1')), { best: 120, games: 4, muted: true });
  const blocked = { window: {}, localStorage: { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'number-rush', 'storage.js'), 'utf8'), blocked);
  assert.equal(blocked.window.NumberRushStorage.read().best, 0);
  assert.doesNotThrow(() => blocked.window.NumberRushStorage.write({ best: 10 }));
});
