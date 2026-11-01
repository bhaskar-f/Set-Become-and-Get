(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const engine = window.NumberRushEngine;
  const ui = {
    welcome: $("welcome"), game: $("game"), result: $("result"), start: $("start"), again: $("again"),
    score: $("score"), level: $("level"), time: $("time"), progress: $("progress"), clock: $("time").parentElement,
    timeDelta: $("timeDelta"), best: $("best"), welcomeBest: $("welcomeBest"), equation: $("equation"), answers: $("answers"),
    feedback: $("feedback"), count: $("questionCount"), overlay: $("pauseOverlay"), levelToast: $("levelToast"),
    levelToastTitle: $("levelToastTitle"), levelToastDescription: $("levelToastDescription"), welcomeEyebrow: $("welcomeEyebrow"),
    welcomeHeading: $("welcomeHeading"), welcomeDescription: $("welcomeDescription"), welcomeStatus: $("welcomeStatus"), network: $("network"),
  };
  let best = NumberRushStorage.read().best;
  let timer = engine.createTimer();
  let state = "ready", score = 0, correct = 0, incorrect = 0, questionNo = 0, question = null;
  let highestLevel = 1, locked = false, answeredQuestion = false, raf = 0;
  let restoreAfterRound = null, restoreTimer = 0, connectionRestored = false, connectivityUnavailable = false;
  let timeDeltaTimer = 0, levelToastTimer = 0;
  const OFFLINE_ENTRY_KEY = "setbget:number-rush:offline-entry";
  const offlineLaunch = (() => {
    let marked = false, hasReturnTarget = false;
    try {
      marked = sessionStorage.getItem(OFFLINE_ENTRY_KEY) === "1";
      hasReturnTarget = Boolean(sessionStorage.getItem("setbget:offline:return-url"));
      sessionStorage.removeItem(OFFLINE_ENTRY_KEY);
    } catch (_) {}
    if (new URLSearchParams(location.search).get("offline") === "1") marked = true;
    return marked || hasReturnTarget || !navigator.onLine;
  })();
  connectivityUnavailable = offlineLaunch;
  const formatScore = value => String(value).padStart(3, "0");
  const formatLevel = level => `LEVEL ${String(level).padStart(2, "0")} — ${engine.LEVELS[level - 1].name}`;

  function setWelcomeMode(offline) {
    ui.welcomeEyebrow.textContent = offline ? "CONNECTION INTERRUPTED" : "THE 60-SECOND CHALLENGE";
    ui.welcomeHeading.textContent = offline ? "No internet? Play Number Rush." : "Think fast. Stay sharp.";
    ui.welcomeDescription.textContent = offline
      ? "Your connection is taking a break. Keep your mind active while you wait."
      : "Four choices. One right answer. How many can you clear before time runs out?";
    ui.start.textContent = offline ? "Play Number Rush →" : "Start your run →";
    ui.welcomeStatus.textContent = offline ? "OFFLINE · READY TO PLAY" : "NUMBER RUSH";
    ui.welcomeStatus.classList.toggle("is-offline", offline);
  }

  function renderLevel(level) {
    ui.level.replaceChildren(document.createTextNode(`${String(level).padStart(2, "0")} `));
    const label = document.createElement("small");
    label.textContent = engine.LEVELS[level - 1].name.toLowerCase();
    ui.level.append(label);
  }

  function show(screen) {
    ui.welcome.hidden = screen !== "welcome";
    ui.game.hidden = screen !== "game";
    ui.result.hidden = screen !== "result";
  }

  function updateClock(snapshot = timer.snapshot()) {
    const left = snapshot.remainingMs;
    ui.time.textContent = (left / 1000).toFixed(1);
    ui.progress.style.width = `${Math.max(0, Math.min(100, left / engine.MAX_TIME_MS * 100))}%`;
    ui.clock.classList.toggle("urgent", left < 10_000);
  }

  function animateTimeChange(delta) {
    clearTimeout(timeDeltaTimer);
    ui.clock.classList.remove("time-up", "time-down");
    void ui.clock.offsetWidth;
    const positive = delta > 0;
    ui.clock.classList.add(positive ? "time-up" : "time-down");
    ui.timeDelta.textContent = `${positive ? "+" : "−"}${Math.abs(delta) / 1000}s`;
    ui.timeDelta.classList.add("is-visible");
    timeDeltaTimer = setTimeout(() => {
      ui.clock.classList.remove("time-up", "time-down");
      ui.timeDelta.classList.remove("is-visible");
    }, 850);
  }

  function showLevelUp(level) {
    clearTimeout(levelToastTimer);
    const detail = engine.LEVELS[level - 1];
    ui.levelToastTitle.textContent = formatLevel(level);
    ui.levelToastDescription.textContent = detail.description;
    ui.levelToast.hidden = false;
    ui.levelToast.classList.remove("is-visible");
    void ui.levelToast.offsetWidth;
    ui.levelToast.classList.add("is-visible");
    levelToastTimer = setTimeout(() => {
      ui.levelToast.classList.remove("is-visible");
      ui.levelToast.hidden = true;
    }, 1450);
  }

  function startGame() {
    cancelAnimationFrame(raf);
    clearTimeout(restoreTimer);
    clearTimeout(timeDeltaTimer);
    clearTimeout(levelToastTimer);
    timer.reset();
    timer.start();
    score = 0; correct = 0; incorrect = 0; questionNo = 0; highestLevel = 1;
    locked = false; answeredQuestion = false; state = "playing";
    ui.score.textContent = formatScore(score);
    renderLevel(1);
    ui.best.textContent = formatScore(best);
    ui.overlay.hidden = true;
    ui.levelToast.hidden = true;
    show("game");
    nextQuestion();
    tick();
  }

  function nextQuestion() {
    if (state !== "playing") return;
    question = engine.makeQuestion(correct);
    questionNo++;
    locked = false;
    answeredQuestion = false;
    ui.count.textContent = `QUESTION ${String(questionNo).padStart(2, "0")}`;
    ui.equation.textContent = `${question.expression} = ?`;
    ui.equation.classList.toggle("long", question.expression.length > 22);
    ui.feedback.textContent = "CHOOSE THE ANSWER";
    ui.feedback.classList.remove("bad");
    ui.answers.replaceChildren();
    question.choices.forEach((value, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer";
      button.setAttribute("aria-label", `Answer ${index + 1}: ${value}`);
      const key = document.createElement("kbd");
      key.textContent = index + 1;
      button.append(key, document.createTextNode(String(value)));
      button.addEventListener("click", () => answer(index));
      ui.answers.append(button);
    });
  }

  function tick() {
    if (state !== "playing") return;
    const snapshot = timer.snapshot();
    updateClock(snapshot);
    if (snapshot.remainingMs <= 0) { finish(); return; }
    raf = requestAnimationFrame(tick);
  }

  function answer(index) {
    if (state !== "playing" || locked || answeredQuestion) return;
    if (timer.snapshot().remainingMs <= 0) { finish(); return; }
    locked = true;
    answeredQuestion = true;
    const chosen = question.choices[index];
    const buttons = [...ui.answers.children];
    const hit = chosen === question.answer;
    if (buttons[index]) buttons[index].classList.add(hit ? "correct" : "wrong");

    if (hit) {
      correct++;
      score += engine.scoreForAnswer(true);
      ui.score.textContent = formatScore(score);
      ui.feedback.textContent = "CORRECT · +10 POINTS";
      ui.feedback.classList.remove("bad");
      const newLevel = engine.levelFor(correct);
      if (newLevel > highestLevel) {
        highestLevel = newLevel;
        renderLevel(highestLevel);
        showLevelUp(highestLevel);
      }
      timer.adjust(3_000);
      animateTimeChange(3_000);
    } else {
      incorrect++;
      ui.feedback.textContent = `NOT QUITE · ${question.answer}`;
      ui.feedback.classList.add("bad");
      timer.adjust(-2_000);
      animateTimeChange(-2_000);
    }
    updateClock();
    if (timer.snapshot().remainingMs <= 0) { finish(); return; }
    setTimeout(() => {
      if (state === "playing") nextQuestion();
    }, 360);
  }

  function pause() {
    if (state !== "playing") return;
    updateClock(timer.pause());
    cancelAnimationFrame(raf);
    state = "paused";
    locked = true;
    ui.overlay.hidden = false;
  }

  function resume() {
    if (state !== "paused") return;
    state = "playing";
    timer.resume();
    ui.overlay.hidden = true;
    locked = answeredQuestion;
    if (answeredQuestion) nextQuestion();
    tick();
  }

  function finish() {
    if (state === "over") return;
    state = "over";
    cancelAnimationFrame(raf);
    const snapshot = timer.finish();
    updateClock(snapshot);
    locked = true;
    const isBest = score > best;
    best = Math.max(best, score);
    NumberRushStorage.write({ best, games: NumberRushStorage.read().games + 1 });
    const summary = engine.performanceSummary({ correct, incorrect, elapsedActiveMs: snapshot.elapsedActiveMs, score, highestLevel, personalBest: best });
    $("finalScore").textContent = String(summary.score);
    $("totalAnswered").textContent = String(summary.totalAnswered);
    $("correct").textContent = String(summary.correct);
    $("incorrect").textContent = String(summary.incorrect);
    $("accuracy").textContent = `${summary.accuracy}%`;
    $("startingTime").textContent = `${summary.startingTimeSeconds} sec`;
    $("timePlayed").textContent = `${summary.totalTimePlayedSeconds} sec`;
    $("finalRemaining").textContent = `${summary.finalRemainingSeconds} sec`;
    $("highestLevel").textContent = `Level ${summary.highestLevel}`;
    $("personalBest").textContent = String(summary.personalBest);
    $("newBest").hidden = !isBest;
    show("result");
    ui.welcomeBest.textContent = formatScore(best);
    if (restoreAfterRound && !connectivityUnavailable) {
      restoreTimer = setTimeout(() => {
        if (state === "over" && !connectivityUnavailable) location.replace(restoreAfterRound);
      }, 2200);
    }
  }

  function exit() {
    if (state === "playing" || state === "paused") {
      if (!confirm("Leave this run? Your score will not be saved.")) return;
    }
    location.href = "/";
  }

  function network() {
    if (connectionRestored) return;
    const online = navigator.onLine && !connectivityUnavailable;
    ui.network.hidden = online;
    ui.network.textContent = online ? "" : "OFFLINE";
    ui.network.classList.toggle("offline", !online);
  }

  ui.start.addEventListener("click", startGame);
  ui.again.addEventListener("click", startGame);
  $("resume").addEventListener("click", resume);
  $("pause").addEventListener("click", () => state === "paused" ? resume() : pause());
  $("exit").addEventListener("click", exit);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (state === "playing") pause(); else if (state === "paused") resume();
      return;
    }
    if ((event.key === " " || event.key === "Enter") && state === "ready") { event.preventDefault(); startGame(); return; }
    if (state === "playing" && /^[1-4]$/.test(event.key)) { event.preventDefault(); answer(Number(event.key) - 1); }
  });

  setWelcomeMode(offlineLaunch);
  window.addEventListener("online", network);
  window.addEventListener("offline", () => {
    window.NumberRushHandleConnectivityLost();
  });
  window.NumberRushHandleConnectivityLost = () => {
    connectionRestored = false;
    connectivityUnavailable = true;
    network();
    if (state === "ready") setWelcomeMode(true);
  };
  window.NumberRushHandleConnectionRestored = returnUrl => {
    connectionRestored = true;
    connectivityUnavailable = false;
    ui.network.hidden = false;
    ui.network.textContent = "CONNECTION RESTORED";
    ui.network.classList.remove("offline");
    setWelcomeMode(false);
    try {
      sessionStorage.removeItem(OFFLINE_ENTRY_KEY);
      const current = new URL(location.href);
      if (current.searchParams.get("offline") === "1") {
        current.searchParams.delete("offline");
        history.replaceState(history.state, "", `${current.pathname}${current.search}${current.hash}`);
      }
    } catch (_) {}
    if (returnUrl && (state === "playing" || state === "paused")) {
      restoreAfterRound = returnUrl;
      return true;
    }
    return false;
  };
  network();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing") pause();
  });
  ui.welcomeBest.textContent = formatScore(best);
  renderLevel(1);
})();
