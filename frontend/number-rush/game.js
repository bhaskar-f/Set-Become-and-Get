(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const ui = {
    welcome: $("welcome"),
    game: $("game"),
    result: $("result"),
    start: $("start"),
    again: $("again"),
    score: $("score"),
    combo: $("combo"),
    level: $("level"),
    time: $("time"),
    progress: $("progress"),
    clock: $("time").parentElement,
    best: $("best"),
    welcomeBest: $("welcomeBest"),
    equation: $("equation"),
    answers: $("answers"),
    feedback: $("feedback"),
    count: $("questionCount"),
    overlay: $("pauseOverlay"),
  };
  const stored = NumberRushStorage.read();
  let best = stored.best,
    state = "ready",
    score = 0,
    streak = 0,
    highCombo = 0,
    correct = 0,
    incorrect = 0,
    questionNo = 0,
    question = null,
    locked = false,
    remaining = 30000,
    startedAt = 0,
    raf = 0,
    lastLevel = 1;
  const format = (value) => String(value).padStart(3, "0");
  function renderLevel(level) {
    ui.level.replaceChildren(document.createTextNode(`0${level} `));
    const label = document.createElement("small");
    label.textContent = level === 1 ? "easy" : level === 2 ? "medium" : "hard";
    ui.level.append(label);
  }
  function show(screen) {
    ui.welcome.hidden = screen !== "welcome";
    ui.game.hidden = screen !== "game";
    ui.result.hidden = screen !== "result";
  }
  function startGame() {
    cancelAnimationFrame(raf);
    score = 0;
    streak = 0;
    highCombo = 0;
    correct = 0;
    incorrect = 0;
    questionNo = 0;
    remaining = 30000;
    lastLevel = 1;
    locked = false;
    state = "playing";
    ui.score.textContent = format(0);
    ui.combo.textContent = "—";
    renderLevel(1);
    ui.best.textContent = format(best);
    ui.overlay.hidden = true;
    show("game");
    nextQuestion();
    startedAt = performance.now();
    tick();
  }
  function nextQuestion() {
    if (state !== "playing") return;
    question = NumberRushQuestions.makeQuestion(correct);
    questionNo++;
    ui.count.textContent = `QUESTION ${String(questionNo).padStart(2, "0")}`;
    ui.equation.replaceChildren(document.createTextNode(`${question.a} `));
    const op = document.createElement("span");
    op.textContent = `${question.op} `;
    ui.equation.append(op, document.createTextNode(`${question.b} `));
    const equals = document.createElement("b");
    equals.textContent = "=";
    ui.equation.append(equals, document.createTextNode(" ?"));
    ui.feedback.textContent = "CHOOSE THE ANSWER";
    ui.feedback.classList.remove("bad");
    ui.answers.replaceChildren();
    question.choices.forEach((value, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer";
      button.dataset.index = index;
      button.setAttribute("aria-label", `Answer ${index + 1}: ${value}`);
      const key = document.createElement("kbd");
      key.textContent = index + 1;
      button.append(key, document.createTextNode(String(value)));
      button.addEventListener("click", () => answer(index));
      ui.answers.append(button);
    });
  }
  function answer(index) {
    if (
      state !== "playing" ||
      locked ||
      remaining - (performance.now() - startedAt) <= 0
    )
      return;
    locked = true;
    const chosen = question.choices[index],
      buttons = [...ui.answers.children],
      hit = chosen === question.answer;
    buttons[index].classList.add(hit ? "correct" : "wrong");
    if (hit) {
      correct++;
      streak++;
      highCombo = Math.max(highCombo, streak);
      const bonus = Math.min(25, Math.max(0, (streak - 1) * 5));
      score += 10 + bonus;
      ui.score.textContent = format(score);
      ui.combo.textContent = streak > 1 ? `${streak}×` : "—";
      ui.feedback.textContent =
        streak >= 3
          ? `✦ ${streak} IN A ROW · +${10 + bonus}`
          : `CORRECT · +${10 + bonus}`;
      ui.feedback.classList.remove("bad");
      const level = NumberRushQuestions.levelFor(correct);
      if (level > lastLevel) {
        lastLevel = level;
        renderLevel(level);
        ui.level.classList.remove("level-up");
        void ui.level.offsetWidth;
        ui.level.classList.add("level-up");
      }
    } else {
      incorrect++;
      streak = 0;
      ui.combo.textContent = "—";
      ui.feedback.textContent = `NOT QUITE · ${question.answer}`;
      ui.feedback.classList.add("bad");
    }
    setTimeout(() => {
      if (state === "playing") {
        locked = false;
        nextQuestion();
      }
    }, 430);
  }
  function tick() {
    if (state !== "playing") return;
    const elapsed = performance.now() - startedAt;
    const left = Math.max(0, remaining - elapsed);
    ui.time.textContent = (left / 1000).toFixed(1);
    ui.progress.style.width = `${left / 300}%`;
    ui.clock.classList.toggle("urgent", left < 10000);
    if (left <= 0) {
      finish();
      return;
    }
    raf = requestAnimationFrame(tick);
  }
  function pause() {
    if (state !== "playing") return;
    remaining = Math.max(0, remaining - (performance.now() - startedAt));
    cancelAnimationFrame(raf);
    state = "paused";
    locked = true;
    ui.overlay.hidden = false;
  }
  function resume() {
    if (state !== "paused") return;
    ui.overlay.hidden = true;
    state = "playing";
    locked = false;
    startedAt = performance.now();
    tick();
  }
  function finish() {
    if (state === "over") return;
    state = "over";
    cancelAnimationFrame(raf);
    remaining = 0;
    ui.time.textContent = "0.0";
    ui.progress.style.width = "0%";
    locked = true;
    const isBest = score > best;
    best = Math.max(best, score);
    NumberRushStorage.write({
      best,
      games: NumberRushStorage.read().games + 1,
    });
    $("finalScore").textContent = score;
    $("accuracy").textContent =
      `${correct + incorrect ? Math.round((correct / (correct + incorrect)) * 100) : 0}%`;
    $("correct").textContent = correct;
    $("highCombo").textContent = `${highCombo}×`;
    $("newBest").hidden = !isBest;
    $("resultTitle").textContent =
      score >= 100
        ? "Unstoppable."
        : score >= 50
          ? "Nice run."
          : "Good warm-up.";
    show("result");
    ui.welcomeBest.textContent = format(best);
  }
  function exit() {
    if (state === "playing" || state === "paused") {
      if (!confirm("Leave this run? Your score will not be saved.")) return;
    }
    location.href = "/";
  }
  ui.start.addEventListener("click", startGame);
  ui.again.addEventListener("click", startGame);
  $("resume").addEventListener("click", resume);
  $("pause").addEventListener("click", () =>
    state === "paused" ? resume() : pause(),
  );
  $("exit").addEventListener("click", exit);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (state === "playing") pause();
      else if (state === "paused") resume();
      return;
    }
    if ((event.key === " " || event.key === "Enter") && state === "ready") {
      event.preventDefault();
      startGame();
      return;
    }
    if (state === "playing" && /^[1-4]$/.test(event.key)) {
      event.preventDefault();
      answer(Number(event.key) - 1);
    }
  });
  function network() {
    const online = navigator.onLine;
    const badge = $("network");
    badge.textContent = online ? "READY OFFLINE" : "OFFLINE MODE";
    badge.classList.toggle("offline", !online);
  }
  window.addEventListener("online", network);
  window.addEventListener("offline", network);
  network();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing") pause();
  });
  ui.welcomeBest.textContent = format(best);
})();
