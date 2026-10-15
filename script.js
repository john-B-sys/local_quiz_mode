/*
 * Local Quiz: Serious Mode + Review Mode
 * All mode-specific UI and styling are created here; index.html does not need edits.
 * Expected question shape: { id, question, options, answer, explanation }
 *
 * Review Mode scoring: only questions answered correctly on the FIRST try count.
 * Missed questions appear as clickable numbers (live strip + results screen) for rechecking.
 */

const progress = document.querySelector("#progress");
const questionLabel = document.querySelector("#question-label");
const questionTitle = document.querySelector("#question-title");
const optionsContainer = document.querySelector("#options");
const message = document.querySelector("#message");
const previousButton = document.querySelector("#previous-btn");
const nextButton = document.querySelector("#next-btn");
const quizCard = document.querySelector(".quiz-card");
const topbar = document.querySelector(".topbar");
const optionsForm = document.querySelector("#options-form");

const SERIOUS_TIME_LIMIT_SECONDS = 60 * 60;
const PASS_RATE = 0.75;
const QUESTIONS_PER_QUIZ = 120; // Default number of questions per attempt (random pick). Can be changed on the menu.

let allQuestions = [];
let quizQuestions = [];
let currentIndex = 0;
let mode = null;
let timerInterval = null;
let secondsRemaining = SERIOUS_TIME_LIMIT_SECONDS;
let quizFinished = false;
let cameFromResults = false; // true when rechecking a missed question from the results screen
let chosenQuestionCount = null; // remembered between attempts; null = use QUESTIONS_PER_QUIZ

// Maps use question IDs rather than shuffled indexes so navigation remains reliable.
let selectedAnswers = new Map();
let reviewAttempts = new Map();
let reviewCompleted = new Set();
let reviewMissed = new Set(); // question IDs answered wrong at least once in Review Mode

injectStyles();
showModeMenu("Choose a quiz mode to begin.");
loadQuestions();

async function loadQuestions() {
  try {
    const response = await fetch("./questions.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("questions.json must contain a non-empty JSON array.");
    }
    allQuestions = data.filter((q) => q && q.id !== undefined && q.id !== null);
    if (allQuestions.length === 0) {
      throw new Error("No questions with valid IDs were found.");
    }
    progress.textContent = `${allQuestions.length} questions available`;
    showModeMenu("Choose a quiz mode to begin.");
    progress.textContent = `${allQuestions.length} questions available`;
    questionLabel.textContent = "Ready";
    questionTitle.textContent = "Choose a mode to start";
    message.textContent = "";
    setModeButtonsEnabled(true);
  } catch (error) {
    progress.textContent = "Unable to load questions";
    questionLabel.textContent = "Setup needed";
    questionTitle.textContent = "Could not load questions.json";
    optionsContainer.replaceChildren();
    message.textContent =
      "Run this folder through a local server (not by opening index.html directly), and check that questions.json is valid. " +
      error.message;
    previousButton.disabled = true;
    nextButton.disabled = true;
    setModeButtonsEnabled(false);
  }
}

function injectStyles() {
  const style = document.createElement("style");
  style.id = "quiz-mode-styles";
  style.textContent = `
    .quiz-mode-menu { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; margin:20px 0; }
    .quiz-mode-card { border:1px solid #d1d5db; border-radius:14px; padding:20px; background:var(--card-bg,#fff); color:inherit; }
    .quiz-mode-card h3 { margin:0 0 8px; }
    .quiz-mode-card p { line-height:1.5; }
    .quiz-mode-button, .quiz-action-button { border:0; border-radius:9px; padding:12px 16px; font:inherit; font-weight:650; cursor:pointer; }
    .quiz-mode-button { width:100%; margin-top:8px; background:#2563eb; color:#fff; }
    .quiz-mode-button.review { background:#15803d; }
    .quiz-mode-button:disabled { opacity:.45; cursor:not-allowed; }
    .quiz-timer { font-weight:750; font-variant-numeric:tabular-nums; }
    .quiz-option-correct { border:2px solid #16a34a !important; background:#dcfce7 !important; color:#14532d !important; }
    .quiz-option-wrong { border:2px solid #dc2626 !important; background:#fee2e2 !important; color:#7f1d1d !important; }
    .quiz-option-locked { cursor:not-allowed; }
    .quiz-explanation { margin-top:16px; border-left:4px solid #16a34a; border-radius:6px; padding:12px 14px; background:#f0fdf4; color:#14532d; line-height:1.55; }
    .quiz-results { border:1px solid #d1d5db; border-radius:14px; padding:22px; margin-top:18px; }
    .quiz-result-score { font-size:clamp(2rem,5vw,3.2rem); font-weight:800; margin:8px 0; }
    .quiz-pass { color:#15803d; font-weight:750; }
    .quiz-fail { color:#dc2626; font-weight:750; }
    .quiz-small-note { color:#6b7280; font-size:.92rem; }
    .quiz-count-row { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin:14px 0 4px; }
    .quiz-count-row input { width:90px; padding:8px 10px; border:1px solid #d1d5db; border-radius:8px; font:inherit; }
    .quiz-toolbar { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; margin:12px 0; }
    .quiz-action-button { background:#e5e7eb; color:#111827; }
    .quiz-action-button.primary { background:#2563eb; color:white; }
    .quiz-action-button:disabled { opacity:.45; cursor:not-allowed; }
    .quiz-missed-nav { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:10px 0; }
    .quiz-missed-chip { min-width:42px; height:42px; border:2px solid #dc2626; border-radius:10px; background:#fee2e2; color:#7f1d1d; font:inherit; font-weight:750; cursor:pointer; }
    .quiz-missed-chip:hover { background:#fecaca; }
    .quiz-missed-chip.current { background:#dc2626; color:#fff; }
    #options .option { transition:background .15s,border-color .15s; }
    @media (prefers-color-scheme: dark) {
      .quiz-mode-card,.quiz-results { background: #dcecfc; border-color: #111827; }
      .quiz-option-correct { background:#14532d !important; color:#dcfce7 !important; }
      .quiz-option-wrong { background:#7f1d1d !important; color:#fee2e2 !important; }
      .quiz-explanation { background:#052e16; color:#dcfce7; }
      .quiz-action-button { background:#374151; color:#f9fafb; }
      .quiz-missed-chip { background:#7f1d1d; color:#fee2e2; }
      .quiz-missed-chip.current { background:#dc2626; color:#fff; }
    }
  `;
  document.head.append(style);
}

function showModeMenu(note = "Choose a quiz mode to begin.") {
  stopTimer();
  mode = null;
  quizFinished = false;
  cameFromResults = false;
  const oldMenu = document.querySelector("#quiz-mode-menu");
  if (oldMenu) oldMenu.remove();
  const oldResults = document.querySelector("#quiz-results");
  if (oldResults) oldResults.remove();
  const oldNav = document.querySelector("#quiz-missed-nav");
  if (oldNav) oldNav.hidden = true;

  if (topbar) topbar.hidden = true;
  if (quizCard) quizCard.hidden = true;

  const main = document.querySelector("main") || document.body;
  let menu = document.querySelector("#quiz-mode-menu");
  if (!menu) {
    menu = document.createElement("section");
    menu.id = "quiz-mode-menu";
    menu.className = "quiz-mode-menu-wrap";
    menu.style.maxWidth = "900px";
    menu.style.margin = "32px auto";
    menu.style.padding = "0 16px";
    main.prepend(menu);
  }
  menu.replaceChildren();

  const heading = document.createElement("h1");
  heading.textContent = "Quiz Mode";
  const description = document.createElement("p");
  description.textContent = note;
  const count = document.createElement("p");
  count.className = "quiz-small-note";
  count.id = "quiz-count-note";

  const countRow = document.createElement("div");
  countRow.className = "quiz-count-row";
  const countLabel = document.createElement("label");
  countLabel.htmlFor = "quiz-count-input";
  countLabel.textContent = "Number of questions:";
  const countInput = document.createElement("input");
  countInput.type = "number";
  countInput.id = "quiz-count-input";
  countInput.min = "1";
  countInput.max = String(Math.max(1, allQuestions.length));
  countInput.step = "1";
  countInput.value = String(
    allQuestions.length ? Math.min(chosenQuestionCount ?? QUESTIONS_PER_QUIZ, allQuestions.length) : 1
  );
  countInput.disabled = allQuestions.length === 0;
  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = "quiz-action-button";
  allButton.textContent = "All";
  allButton.disabled = allQuestions.length === 0;
  allButton.addEventListener("click", () => {
    countInput.value = String(allQuestions.length);
    updateCountNote();
  });
  countInput.addEventListener("input", updateCountNote);
  countRow.append(countLabel, countInput, allButton);

  const cards = document.createElement("div");
  cards.className = "quiz-mode-menu";

  const seriousCard = createModeCard(
    "Serious Mode",
    "60-minute timer. No hints, explanations, or answer feedback while taking the quiz. Your final score appears when you finish or time runs out.",
    "Start Serious Mode",
    "",
    () => startQuiz("serious")
  );
  const reviewCard = createModeCard(
    "Review Mode",
    "No timer. Wrong answers turn red. Keep trying until you select the correct answer, then read the explanation. Only first-try correct answers count toward your score, and you can recheck the ones you missed.",
    "Start Review Mode",
    "review",
    () => startQuiz("review")
  );
  cards.append(seriousCard, reviewCard);
  menu.append(heading, description, count, countRow, cards);
  updateCountNote();
  setModeButtonsEnabled(allQuestions.length > 0);
}

// Reads the question-count input and clamps it to a valid whole number.
function getSelectedCount() {
  const input = document.querySelector("#quiz-count-input");
  const total = allQuestions.length;
  const fallback = Math.min(QUESTIONS_PER_QUIZ, total);
  const parsed = input ? parseInt(input.value, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), total);
}

function updateCountNote() {
  const note = document.querySelector("#quiz-count-note");
  if (!note) return;
  if (!allQuestions.length) {
    note.textContent = "Loading question bank…";
    return;
  }
  const count = getSelectedCount();
  note.textContent = `${allQuestions.length} questions available · This attempt: ${count} · Passing score: ${Math.ceil(count * PASS_RATE)} correct (${Math.round(PASS_RATE * 100)}%)`;
}

function createModeCard(title, details, buttonText, extraClass, onStart) {
  const card = document.createElement("div");
  card.className = "quiz-mode-card";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = details;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `quiz-mode-button ${extraClass}`.trim();
  button.dataset.modeStart = "true";
  button.textContent = buttonText;
  button.disabled = allQuestions.length === 0;
  button.addEventListener("click", onStart);
  card.append(heading, paragraph, button);
  return card;
}

function setModeButtonsEnabled(enabled) {
  document.querySelectorAll("[data-mode-start='true']").forEach((button) => {
    button.disabled = !enabled;
  });
}

function startQuiz(selectedMode) {
  if (!allQuestions.length) return;
  const count = getSelectedCount();
  chosenQuestionCount = count;
  mode = selectedMode;
  quizFinished = false;
  cameFromResults = false;
  currentIndex = 0;
  selectedAnswers = new Map();
  reviewAttempts = new Map();
  reviewCompleted = new Set();
  reviewMissed = new Set();
  // Fresh random order (and a fresh random subset if fewer than all) for each attempt, in both modes.
  quizQuestions = shuffleArray([...allQuestions]).slice(0, count).map(shuffleOptions);
  secondsRemaining = SERIOUS_TIME_LIMIT_SECONDS;

  const menu = document.querySelector("#quiz-mode-menu");
  if (menu) menu.hidden = true;
  if (topbar) topbar.hidden = false;
  if (quizCard) quizCard.hidden = false;

  let toolbar = document.querySelector("#quiz-toolbar");
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.id = "quiz-toolbar";
    toolbar.className = "quiz-toolbar";
    if (quizCard) quizCard.prepend(toolbar);
  }
  toolbar.replaceChildren();
  const modeLabel = document.createElement("strong");
  modeLabel.textContent = mode === "serious" ? "Serious Mode" : "Review Mode";
  toolbar.append(modeLabel);
  if (mode === "serious") {
    const timer = document.createElement("span");
    timer.id = "quiz-timer";
    timer.className = "quiz-timer";
    timer.setAttribute("aria-live", "polite");
    toolbar.append(timer);
    updateTimerDisplay();
    timerInterval = setInterval(tickTimer, 1000);
  } else {
    const untimed = document.createElement("span");
    untimed.textContent = "No timer";
    untimed.className = "quiz-small-note";
    toolbar.append(untimed);
  }

  renderQuestion();
}

function shuffleArray(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

// Returns a copy of the question with its options in random order.
// The correct answer is converted to the option TEXT first, so it still
// matches after the letters (A, B, C...) are reassigned.
function shuffleOptions(question) {
  const original = getOptions(question);
  if (original.length < 2) return question;

  // Keep the original order for "All of the above", "Both A and B", etc.
  const orderDependent = original.some(([, value]) =>
    /\b(above|below|both|all of|none of|neither)\b/i.test(String(value))
  );
  if (orderDependent) return question;

  const correctTexts = original
    .filter(([key, value]) => isCorrectAnswer(question, key, value))
    .map(([, value]) => value);

  const shuffledTexts = shuffleArray(original.map(([, value]) => value));

  return {
    ...question,
    options: shuffledTexts, // becomes an array, so letters are reassigned a, b, c...
    answer: correctTexts.length > 1 ? correctTexts : correctTexts[0],
  };
}

function getOptions(question) {
  if (Array.isArray(question.options)) {
    return question.options.map((value, index) => [String.fromCharCode(97 + index), value]);
  }
  if (question.options && typeof question.options === "object") {
    return Object.entries(question.options);
  }
  return [];
}

function getQuestionKey(question) {
  return String(question.id);
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[.)]$/, "");
}

function isCorrectAnswer(question, optionKey, optionValue) {
  const answer = question.answer ?? question.correctAnswer ?? question.correct_answer;
  if (answer === undefined || answer === null) return false;
  if (Array.isArray(answer)) {
    return answer.some((candidate) => isAnswerMatch(candidate, optionKey, optionValue));
  }
  return isAnswerMatch(answer, optionKey, optionValue);
}

function isAnswerMatch(answer, optionKey, optionValue) {
  const normalizedAnswer = normalize(answer);
  return normalizedAnswer === normalize(optionKey) ||
    normalizedAnswer === normalize(optionValue) ||
    normalizedAnswer === normalize(`${optionKey}.`) ||
    normalizedAnswer === normalize(`${optionKey})`);
}

function renderQuestion() {
  if (quizFinished || !quizQuestions.length) return;
  const question = quizQuestions[currentIndex];
  if (!question) return;
  const questionKey = getQuestionKey(question);
  const savedAnswer = selectedAnswers.get(questionKey);
  const completed = reviewCompleted.has(questionKey);

  progress.textContent = `Question ${currentIndex + 1} of ${quizQuestions.length}`;
  questionLabel.textContent = `Question ${currentIndex + 1}`;
  questionTitle.textContent = question.question ?? "Untitled question";
  message.textContent = "";
  optionsContainer.replaceChildren();

  const options = getOptions(question);
  options.forEach(([key, value]) => {
    const label = document.createElement("label");
    label.className = "option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = `question-${questionKey}`;
    input.value = key;
    input.checked = savedAnswer === key;
    input.disabled = mode === "review" && completed;

    const text = document.createElement("span");
    text.className = "option-text";
    const letter = document.createElement("span");
    letter.className = "option-letter";
    letter.textContent = `${String(key).toUpperCase()}.`;
    text.append(letter, document.createTextNode(` ${String(value)}`));
    label.append(input, text);

    if (mode === "review") {
      const attempts = reviewAttempts.get(questionKey) || new Set();
      if (attempts.has(key) && !isCorrectAnswer(question, key, value)) {
        label.classList.add("quiz-option-wrong");
      }
      if (completed && isCorrectAnswer(question, key, value)) {
        label.classList.add("quiz-option-correct");
      }
    }

    input.addEventListener("change", () => handleAnswer(question, key, value));
    optionsContainer.append(label);
  });

  previousButton.disabled = currentIndex === 0 || quizFinished;
  nextButton.disabled = quizFinished;
  nextButton.textContent = currentIndex === quizQuestions.length - 1 ? "Finish Quiz" : "Next →";

  if (mode === "review" && completed) {
    showExplanation(question);
  } else if (mode === "review") {
    message.textContent = "Choose the correct answer to unlock the next question.";
  }

  renderMissedNav();
}

function handleAnswer(question, key, value) {
  if (quizFinished) return;
  const questionKey = getQuestionKey(question);
  selectedAnswers.set(questionKey, key); // The selected answer at finish counts; it can be changed in Serious Mode.
  message.textContent = "";

  if (mode === "serious") {
    // No correctness feedback, hints, or explanations during the exam.
    return;
  }

  if (reviewCompleted.has(questionKey)) return;
  let attempts = reviewAttempts.get(questionKey);
  if (!attempts) {
    attempts = new Set();
    reviewAttempts.set(questionKey, attempts);
  }
  attempts.add(key);

  if (isCorrectAnswer(question, key, value)) {
    reviewCompleted.add(questionKey);
    renderQuestion();
  } else {
    reviewMissed.add(questionKey); // A mistake means this question won't count as correct.
    renderQuestion();
    message.textContent = "Not quite. The selected answer is marked red. Try again.";
  }
}

function showExplanation(question) {
  const explanationText = question.explanation ?? question.explain ?? question.rationale;
  if (!explanationText) return;
  const explanation = document.createElement("div");
  explanation.className = "quiz-explanation";
  const heading = document.createElement("strong");
  heading.textContent = "Explanation";
  const body = document.createElement("p");
  body.style.margin = "8px 0 0";
  body.textContent = String(explanationText);
  explanation.append(heading, body);
  quizCard.append(explanation);
}

function clearExplanation() {
  document.querySelectorAll(".quiz-explanation").forEach((element) => element.remove());
}

/* ---------- Missed-question navigation (Review Mode) ---------- */

function goToQuestion(index) {
  currentIndex = index;
  clearExplanation();
  renderQuestion();
}

// Builds clickable number buttons for missed questions only (e.g. 4  5).
function createMissedButtons(onPick) {
  const fragment = document.createDocumentFragment();
  quizQuestions.forEach((question, index) => {
    if (!reviewMissed.has(getQuestionKey(question))) return;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "quiz-missed-chip";
    chip.textContent = String(index + 1);
    chip.title = `Go to question ${index + 1}`;
    chip.dataset.index = String(index);
    chip.addEventListener("click", () => onPick(index));
    fragment.append(chip);
  });
  return fragment;
}

// Live strip inside the quiz card: shows only the question numbers you missed.
function renderMissedNav() {
  let nav = document.querySelector("#quiz-missed-nav");
  if (!nav) {
    nav = document.createElement("div");
    nav.id = "quiz-missed-nav";
    nav.className = "quiz-missed-nav";
    const toolbar = document.querySelector("#quiz-toolbar");
    if (toolbar) toolbar.after(nav);
    else quizCard.prepend(nav);
  }
  nav.replaceChildren();

  if (mode !== "review" || (reviewMissed.size === 0 && !cameFromResults)) {
    nav.hidden = true;
    return;
  }
  nav.hidden = false;

  if (reviewMissed.size > 0) {
    const label = document.createElement("span");
    label.className = "quiz-small-note";
    label.textContent = "Missed:";
    nav.append(label, createMissedButtons(goToQuestion));
    nav.querySelectorAll(".quiz-missed-chip").forEach((chip) => {
      if (Number(chip.dataset.index) === currentIndex) chip.classList.add("current");
    });
  }

  if (cameFromResults) {
    const back = document.createElement("button");
    back.type = "button";
    back.className = "quiz-action-button primary";
    back.textContent = "Back to Results";
    back.addEventListener("click", () => finishQuiz("completed"));
    nav.append(back);
  }
}

// Opens a missed question from the results screen.
function recheckFromResults(index) {
  const results = document.querySelector("#quiz-results");
  if (results) results.hidden = true;
  quizFinished = false;
  cameFromResults = true;
  if (topbar) topbar.hidden = false;
  if (quizCard) quizCard.hidden = false;
  goToQuestion(index);
}

/* ---------- Navigation buttons ---------- */

previousButton.addEventListener("click", () => {
  if (quizFinished || currentIndex <= 0) return;
  currentIndex--;
  clearExplanation();
  renderQuestion();
});

nextButton.addEventListener("click", () => {
  if (quizFinished) return;
  const question = quizQuestions[currentIndex];
  const questionKey = getQuestionKey(question);

  if (mode === "review" && !reviewCompleted.has(questionKey)) {
    message.textContent = "Select the correct answer before moving to the next question.";
    return;
  }
  if (mode === "serious" && !selectedAnswers.has(questionKey)) {
    message.textContent = "Select an answer before moving to the next question.";
    return;
  }

  if (currentIndex < quizQuestions.length - 1) {
    currentIndex++;
    clearExplanation();
    renderQuestion();
  } else {
    finishQuiz("completed");
  }
});

/* ---------- Timer ---------- */

function tickTimer() {
  if (quizFinished || mode !== "serious") return;
  secondsRemaining--;
  updateTimerDisplay();
  if (secondsRemaining <= 0) {
    finishQuiz("time");
  }
}

function updateTimerDisplay() {
  const timer = document.querySelector("#quiz-timer");
  if (!timer) return;
  const minutes = Math.floor(Math.max(0, secondsRemaining) / 60);
  const seconds = Math.max(0, secondsRemaining) % 60;
  timer.textContent = `Time remaining: ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  if (secondsRemaining <= 300) timer.style.color = "#dc2626";
}

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/* ---------- Results ---------- */

function finishQuiz(reason) {
  if (quizFinished) return;
  quizFinished = true;
  cameFromResults = false;
  stopTimer();
  clearExplanation();
  const missedNav = document.querySelector("#quiz-missed-nav");
  if (missedNav) missedNav.hidden = true;

  let correct = 0;
  let answered = 0;
  quizQuestions.forEach((question) => {
    const key = getQuestionKey(question);

    // Review Mode: only first-try correct answers count. Any mistake = not counted.
    if (mode === "review") {
      if (reviewCompleted.has(key)) {
        answered++;
        if (!reviewMissed.has(key)) correct++;
      }
      return;
    }

    const selectedKey = selectedAnswers.get(key);
    if (selectedKey === undefined) return;
    answered++;
    const option = getOptions(question).find(([optionKey]) => optionKey === selectedKey);
    if (option && isCorrectAnswer(question, option[0], option[1])) correct++;
  });

  const total = quizQuestions.length;
  const percentage = total ? (correct / total) * 100 : 0;
  const required = Math.ceil(total * PASS_RATE);
  const passed = correct >= required;

  if (topbar) topbar.hidden = true;
  if (quizCard) quizCard.hidden = true;
  const menu = document.querySelector("#quiz-mode-menu");
  if (menu) menu.hidden = true;

  let results = document.querySelector("#quiz-results");
  if (!results) {
    results = document.createElement("section");
    results.id = "quiz-results";
    results.className = "quiz-results";
    results.style.maxWidth = "760px";
    results.style.margin = "32px auto";
    results.style.padding = "24px";
    document.querySelector("main")?.prepend(results);
  }
  results.hidden = false;
  results.replaceChildren();

  const heading = document.createElement("h1");
  heading.textContent = reason === "time" ? "Time's Up" : "Quiz Results";
  const modeText = document.createElement("p");
  modeText.textContent = `${mode === "serious" ? "Serious Mode" : "Review Mode"} · ${reason === "time" ? "Time limit reached; quiz stopped automatically." : "Quiz completed."}`;
  const score = document.createElement("div");
  score.className = "quiz-result-score";
  score.textContent = `${correct} / ${total}`;
  const percent = document.createElement("p");
  percent.textContent = `Score: ${percentage.toFixed(1)}%`;
  const status = document.createElement("p");
  status.className = passed ? "quiz-pass" : "quiz-fail";
  status.textContent = passed ? "PASS" : "FAIL";
  const details = document.createElement("p");
  details.textContent = mode === "review"
    ? `First-try correct: ${correct} of ${total} · Required to pass: ${required} correct (${Math.round(PASS_RATE * 100)}%)`
    : `Answered: ${answered} of ${total} · Required to pass: ${required} correct (${Math.round(PASS_RATE * 100)}%)`;

  // Review Mode only: clickable list of the questions you missed.
  let missedSection = null;
  if (mode === "review" && reviewMissed.size > 0) {
    missedSection = document.createElement("div");
    missedSection.style.margin = "16px 0";
    const missedTitle = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = "Questions to recheck";
    missedTitle.append(strong, document.createTextNode(" (click a number):"));
    const missedRow = document.createElement("div");
    missedRow.className = "quiz-missed-nav";
    missedRow.append(createMissedButtons(recheckFromResults));
    missedSection.append(missedTitle, missedRow);
  } else if (mode === "review") {
    missedSection = document.createElement("p");
    missedSection.className = "quiz-pass";
    missedSection.textContent = "Perfect run: no mistakes!";
  }

  const retryButton = document.createElement("button");
  retryButton.type = "button";
  retryButton.className = "quiz-action-button primary";
  retryButton.textContent = "Try Again";
  retryButton.addEventListener("click", () => {
    results.hidden = true;
    showModeMenu("Choose a mode for your next attempt. Question order will be shuffled again.");
  });
  const menuButton = document.createElement("button");
  menuButton.type = "button";
  menuButton.className = "quiz-action-button";
  menuButton.style.marginLeft = "8px";
  menuButton.textContent = "Mode Menu";
  menuButton.addEventListener("click", () => {
    results.hidden = true;
    showModeMenu();
  });

  results.append(heading, modeText, score, percent, status, details);
  if (missedSection) results.append(missedSection);
  results.append(retryButton, menuButton);
}