const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function engine() {
  const context = { window: {}, Math };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'number-rush', 'questions.js'), 'utf8'), context);
  return context.window.NumberRushQuestions;
}

test('difficulty advances at predictable correct answer thresholds', () => {
  const { levelFor } = engine();
  assert.equal(levelFor(0), 1);
  assert.equal(levelFor(5), 1);
  assert.equal(levelFor(6), 2);
  assert.equal(levelFor(15), 2);
  assert.equal(levelFor(16), 3);
});

test('generated questions have one answer among four distinct choices', () => {
  const { makeQuestion } = engine();
  for (let correct = 0; correct < 30; correct++) {
    const question = makeQuestion(correct);
    assert.equal(question.choices.length, 4);
    assert.equal(new Set(question.choices).size, 4);
    assert.equal(question.choices.filter(value => value === question.answer).length, 1);
    if (question.op === '÷') assert.equal(Number.isInteger(question.answer), true);
  }
});
