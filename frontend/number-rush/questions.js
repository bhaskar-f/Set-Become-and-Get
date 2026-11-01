(function (root) {
  "use strict";
  const previous = new Set();
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  function levelFor(correct) {
    return correct >= 16 ? 3 : correct >= 6 ? 2 : 1;
  }
  function makeQuestion(correct) {
    const level = levelFor(correct);
    let a, b, op;
    if (level === 1) {
      op = Math.random() < 0.5 ? "+" : "−";
      a = rand(2, 20);
      b = rand(1, 20);
      if (op === "−" && b > a) [a, b] = [b, a];
    } else if (level === 2) {
      op = ["+", "−", "×", "÷"][rand(0, 3)];
      if (op === "+") {
        a = rand(15, 90);
        b = rand(10, 90);
      }
      if (op === "−") {
        a = rand(30, 120);
        b = rand(5, a);
      }
      if (op === "×") {
        a = rand(3, 12);
        b = rand(3, 12);
      }
      if (op === "÷") {
        b = rand(2, 12);
        a = b * rand(2, 12);
      }
    } else {
      op = ["+", "−", "×", "÷"][rand(0, 3)];
      if (op === "+") {
        a = rand(100, 600);
        b = rand(80, 500);
      }
      if (op === "−") {
        a = rand(150, 800);
        b = rand(20, a);
      }
      if (op === "×") {
        a = rand(12, 35);
        b = rand(11, 30);
      }
      if (op === "÷") {
        b = rand(3, 24);
        a = b * rand(5, 40);
      }
    }
    const answer =
      op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : a / b;
    const key = `${a}${op}${b}`;
    if (previous.has(key)) return makeQuestion(correct);
    previous.add(key);
    if (previous.size > 40) previous.clear();
    const choices = new Set([answer]);
    while (choices.size < 4) {
      const spread = Math.max(5, Math.ceil(Math.abs(answer) * 0.22));
      const value = answer + rand(-spread, spread);
      if (value !== answer) choices.add(value);
    }
    return {
      a,
      b,
      op,
      answer,
      choices: [...choices].sort(() => Math.random() - 0.5),
      level,
    };
  }
  root.NumberRushQuestions = { makeQuestion, levelFor };
})(window);
