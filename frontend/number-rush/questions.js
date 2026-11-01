(function (root) {
  "use strict";

  const STARTING_TIME_MS = 60_000;
  const MAX_TIME_MS = 60_000;
  const LEVELS = [
    { min: 0, name: "BASIC", description: "Simple addition and subtraction." },
    { min: 5, name: "INTERMEDIATE", description: "Multiplication, division and larger numbers." },
    { min: 10, name: "ADVANCED", description: "Three-number mixed expressions." },
    { min: 15, name: "EXPERT", description: "Multi-step expressions with operator precedence." },
    { min: 20, name: "MASTER", description: "Brackets and powers." },
  ];
  const previousQuestion = { expression: "" };
  const randomInt = (min, max, random = Math.random) => Math.floor(random() * (max - min + 1)) + min;
  const oneOf = (items, random = Math.random) => items[randomInt(0, items.length - 1, random)];
  const number = value => ({ type: "number", value });
  const binary = (op, left, right) => ({ type: "binary", op, left: typeof left === "number" ? number(left) : left, right: typeof right === "number" ? number(right) : right });

  function levelFor(correctAnswers) {
    const count = Math.max(0, Number(correctAnswers) || 0);
    if (count >= 20) return 5;
    if (count >= 15) return 4;
    if (count >= 10) return 3;
    if (count >= 5) return 2;
    return 1;
  }

  function evaluate(tree) {
    if (!tree || typeof tree !== "object") throw new TypeError("Invalid arithmetic expression.");
    if (tree.type === "number") {
      if (!Number.isSafeInteger(tree.value)) throw new RangeError("Expression numbers must be safe integers.");
      return tree.value;
    }
    if (tree.type !== "binary") throw new TypeError("Unknown expression node.");
    const left = evaluate(tree.left);
    const right = evaluate(tree.right);
    let result;
    switch (tree.op) {
      case "+": result = left + right; break;
      case "−": result = left - right; break;
      case "×": result = left * right; break;
      case "÷":
        if (right === 0) throw new RangeError("Division by zero is not allowed.");
        if (left % right !== 0) throw new RangeError("Division must produce an integer.");
        result = left / right;
        break;
      case "^":
        if (right < 0 || right > 4) throw new RangeError("Exponent is outside the supported range.");
        result = left ** right;
        break;
      default: throw new TypeError("Unknown arithmetic operator.");
    }
    if (!Number.isSafeInteger(result)) throw new RangeError("Expression result is outside the supported range.");
    return result;
  }

  const precedence = { "+": 1, "−": 1, "×": 2, "÷": 2, "^": 3 };
  const symbols = { "+": "+", "−": "−", "×": "×", "÷": "÷", "^": "^" };
  function render(tree, parentPrecedence = 0, side = "left") {
    if (tree.type === "number") return String(tree.value);
    const current = precedence[tree.op];
    if (tree.op === "^") {
      const base = render(tree.left, current, "left");
      const power = evaluate(tree.right);
      const superscript = { 2: "²", 3: "³", 4: "⁴" }[power];
      return `${base}${superscript || `^${power}`}`;
    }
    const left = render(tree.left, current, "left");
    const rightPrecedence = current + (["−", "÷"].includes(tree.op) ? 1 : side === "right" ? 1 : 0);
    let right = render(tree.right, rightPrecedence, "right");
    let value = `${left} ${symbols[tree.op]} ${right}`;
    if (current < parentPrecedence || (side === "right" && current === parentPrecedence && ["−", "÷"].includes(tree.op))) value = `(${value})`;
    return value;
  }

  function makeTree(level, random = Math.random) {
    if (level === 1) {
      const op = oneOf(["+", "−"], random);
      const a = randomInt(8, 35, random);
      const b = randomInt(3, op === "+" ? 35 : a, random);
      return binary(op, a, b);
    }
    if (level === 2) {
      const kind = oneOf(["×", "÷", "+", "−"], random);
      if (kind === "×") return binary("×", randomInt(6, 24, random), randomInt(3, 12, random));
      if (kind === "÷") { const divisor = randomInt(3, 12, random); return binary("÷", divisor * randomInt(5, 18, random), divisor); }
      const a = randomInt(25, 110, random);
      const b = kind === "+" ? randomInt(15, 90, random) : randomInt(8, a, random);
      return binary(kind, a, b);
    }
    if (level === 3) {
      switch (randomInt(0, 3, random)) {
        case 0: return binary("+", randomInt(10, 45, random), binary("×", randomInt(2, 9, random), randomInt(2, 9, random)));
        case 1: return binary("+", binary("−", randomInt(35, 80, random), randomInt(8, 25, random)), randomInt(4, 18, random));
        case 2: { const divisor = randomInt(3, 9, random); return binary("+", binary("÷", divisor * randomInt(4, 12, random), divisor), randomInt(3, 18, random)); }
        default: return binary("−", binary("×", randomInt(6, 12, random), randomInt(4, 10, random)), randomInt(4, 20, random));
      }
    }
    if (level === 4) {
      switch (randomInt(0, 3, random)) {
        case 0: { const divisor = randomInt(3, 9, random); return binary("+", binary("÷", divisor * randomInt(6, 16, random), divisor), binary("×", randomInt(3, 12, random), randomInt(2, 8, random))); }
        case 1: return binary("−", binary("+", randomInt(25, 80, random), binary("×", randomInt(3, 12, random), randomInt(3, 10, random))), randomInt(4, 25, random));
        case 2: { const divisor = randomInt(2, 8, random); return binary("−", binary("×", randomInt(8, 22, random), randomInt(3, 9, random)), binary("÷", divisor * randomInt(2, 10, random), divisor)); }
        default: return binary("+", binary("−", randomInt(100, 150, random), randomInt(10, 35, random)), binary("×", randomInt(2, 7, random), randomInt(2, 6, random)));
      }
    }
    switch (randomInt(0, 3, random)) {
      case 0: {
        const b = randomInt(2, 5, random), c = randomInt(2, 5, random), multiple = randomInt(1, 5, random);
        return binary("+", binary("÷", b * c * multiple, binary("×", b, c)), binary("^", randomInt(2, 10, random), 2));
      }
      case 1: {
        const divisor = randomInt(2, 5, random), b = randomInt(2, 10, random), a = divisor * randomInt(6, 12, random) - b;
        return binary("×", binary("÷", binary("+", a, b), divisor), binary("^", randomInt(2, 4, random), 2));
      }
      case 2: { const divisor = randomInt(2, 8, random); return binary("+", binary("^", binary("+", randomInt(2, 4, random), randomInt(2, 4, random)), 2), binary("÷", divisor * randomInt(2, 12, random), divisor)); }
      default: return binary("+", binary("^", binary("−", randomInt(7, 16, random), randomInt(2, 6, random)), 2), randomInt(3, 20, random));
    }
  }

  function fallbackTree(level, variant) {
    const examples = {
      1: [binary("+", 8, 5), binary("−", 17, 9), binary("+", 12, 14)],
      2: [binary("×", 12, 4), binary("÷", 72, 8), binary("+", 25, 16)],
      3: [binary("+", 12, binary("×", 8, 3)), binary("+", binary("−", 45, 12), 7), binary("+", binary("÷", 48, 6), 9)],
      4: [binary("+", binary("÷", 48, 6), binary("×", 7, 3)), binary("−", binary("+", 25, binary("÷", 36, 4)), 3), binary("−", binary("×", 18, 2), binary("÷", 24, 6))],
      5: [binary("+", binary("÷", 36, binary("×", 3, 2)), binary("^", 7, 2)), binary("×", binary("÷", binary("+", 15, 9), 3), binary("^", 4, 2)), binary("+", binary("^", binary("+", 2, 3), 2), binary("÷", 18, 3))],
    };
    return examples[level][variant % examples[level].length];
  }

  function shuffle(values, random = Math.random) {
    for (let index = values.length - 1; index > 0; index--) {
      const swap = randomInt(0, index, random);
      [values[index], values[swap]] = [values[swap], values[index]];
    }
    return values;
  }

  function makeQuestion(correctAnswers, random = Math.random) {
    const level = levelFor(correctAnswers);
    let tree, expression;
    for (let attempt = 0; attempt < 40; attempt++) {
      tree = makeTree(level, random);
      expression = render(tree);
      if (expression !== previousQuestion.expression) break;
    }
    if (expression === previousQuestion.expression) {
      for (let variant = 0; variant < 4; variant++) {
        tree = fallbackTree(level, variant);
        expression = render(tree);
        if (expression !== previousQuestion.expression) break;
      }
    }
    previousQuestion.expression = expression;
    const answer = evaluate(tree);
    const choices = new Set([answer]);
    const distractors = shuffle([1, -1, 2, -2, 3, -3, 5, -5, 8, -8, 10, -10].map(delta => answer + delta), random);
    for (const value of distractors) { if (Number.isSafeInteger(value)) choices.add(value); if (choices.size === 4) break; }
    return { tree, expression, answer, choices: shuffle([...choices], random), level };
  }

  function resetQuestionHistory() { previousQuestion.expression = ""; }

  function createTimer(now = () => performance.now()) {
    let remainingMs = STARTING_TIME_MS;
    let elapsedActiveMs = 0;
    let segmentStartedAt = null;
    let running = false;

    function accrue(at) {
      if (!running) return;
      const delta = Math.max(0, at - segmentStartedAt);
      const counted = Math.min(delta, remainingMs);
      elapsedActiveMs += counted;
      remainingMs = Math.max(0, remainingMs - delta);
      segmentStartedAt = at;
      if (remainingMs === 0) { running = false; segmentStartedAt = null; }
    }
    function snapshot(at = now()) {
      const delta = running ? Math.max(0, at - segmentStartedAt) : 0;
      const counted = Math.min(delta, remainingMs);
      return {
        remainingMs: Math.max(0, remainingMs - delta),
        elapsedActiveMs: elapsedActiveMs + counted,
        running,
      };
    }
    return {
      start(at = now()) { if (!running && remainingMs > 0) { running = true; segmentStartedAt = at; } return snapshot(at); },
      pause(at = now()) { accrue(at); running = false; segmentStartedAt = null; return snapshot(at); },
      resume(at = now()) { return this.start(at); },
      adjust(deltaMs, at = now()) {
        const wasRunning = running;
        accrue(at);
        if (!wasRunning || remainingMs === 0) return snapshot(at);
        remainingMs = Math.min(MAX_TIME_MS, Math.max(0, remainingMs + deltaMs));
        if (remainingMs === 0) { running = false; segmentStartedAt = null; }
        else { running = true; segmentStartedAt = at; }
        return snapshot(at);
      },
      finish(at = now()) { accrue(at); running = false; segmentStartedAt = null; remainingMs = 0; return snapshot(at); },
      snapshot,
      reset() { remainingMs = STARTING_TIME_MS; elapsedActiveMs = 0; segmentStartedAt = null; running = false; return snapshot(); },
    };
  }

  function performanceSummary({ correct = 0, incorrect = 0, elapsedActiveMs = 0, score = 0, highestLevel = 1, personalBest = 0 } = {}) {
    const totalAnswered = correct + incorrect;
    return {
      score,
      totalAnswered,
      correct,
      incorrect,
      accuracy: totalAnswered ? Math.round((correct / totalAnswered) * 1000) / 10 : 0,
      startingTimeSeconds: STARTING_TIME_MS / 1000,
      totalTimePlayedSeconds: Math.round(elapsedActiveMs / 1000),
      finalRemainingSeconds: 0,
      highestLevel,
      personalBest,
    };
  }

  const api = { STARTING_TIME_MS, MAX_TIME_MS, LEVELS, levelFor, evaluate, render, makeQuestion, resetQuestionHistory, createTimer, performanceSummary, scoreForAnswer: correct => correct ? 10 : 0 };
  root.NumberRushEngine = api;
  root.NumberRushQuestions = { makeQuestion, levelFor };
})(window);
