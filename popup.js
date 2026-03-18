let state = {
  pageType: null,
  pageTitle: "",
  extractedContent: null,
  currentView: "idle",
  quizData: null,
  currentQuestion: 0,
  score: 0,
  answeredQuestions: new Set(),
};

const $ = (id) => document.getElementById(id);

const setupScreen   = $("setup-screen");
const mainScreen    = $("main-screen");
const loadingState  = $("loading-state");
const loadingText   = $("loading-text");
const errorState    = $("error-state");
const errorMessage  = $("error-message");
const summaryResult = $("summary-result");
const quizResult    = $("quiz-result");
const quizContainer = $("quiz-container");
const quizComplete  = $("quiz-complete");
const quizProgress  = $("quiz-progress");
const pageTypeBadge = $("page-type-badge");
const pageTitleText = $("page-title-text");
const summarizeBtn  = $("summarize-btn");
const quizBtn       = $("quiz-btn");
const settingsPanel = $("settings-panel");
const scoreValue    = $("score-value");

// Init 
async function init() {
  try {
    const hasKey = await sendToBackground({ action: "checkApiKey" });
    if (!hasKey?.hasKey) { show(setupScreen); return; }
    show(mainScreen);
    await detectPage();
  } catch {
    show(setupScreen);
  }
}

async function detectPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const info = await chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" });
    if (!info) throw new Error("No response");
    state.pageType = info.type;
    state.pageTitle = info.title;
    pageTitleText.textContent = truncate(info.title, 52);
    updateBadge(info.type);
  } catch {
    pageTitleText.textContent = "Go to a YouTube video or article";
    updateBadge("unknown");
  }
}

function updateBadge(type) {
  pageTypeBadge.className = "badge";
  const labels = { youtube: "YouTube", pdf: "PDF", article: "Article", unknown: "—" };
  const cls = { youtube: "yt", pdf: "pdf", article: "article" };
  pageTypeBadge.textContent = labels[type] || "—";
  if (cls[type]) pageTypeBadge.classList.add(cls[type]);
}

async function extractContent() {
  if (state.extractedContent) return state.extractedContent;
  setView("loading");
  loadingText.textContent = "Reading page content...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await chrome.tabs.sendMessage(tab.id, { action: "extractContent" });
    if (!result) throw new Error("Could not connect to page. Please refresh the page and try again.");
    if (!result.content) throw new Error("Could not extract content from this page.");
    state.extractedContent = result;
    return result;
  } catch (err) {
    throw new Error(err.message || "Extraction failed.");
  }
}

//  Summarize 
async function handleSummarize() {
  try {
    summarizeBtn.disabled = true;
    quizBtn.disabled = true;
    summarizeBtn.classList.add("active");

    const extracted = await extractContent();
    loadingText.textContent = "AI is summarizing...";
    setView("loading");

    const res = await sendToBackground({
      action: "summarize",
      content: extracted.content,
      type: extracted.type,
      title: extracted.title,
    });

    if (!res) throw new Error("No response received. Please reload the extension.");
    if (!res.success) throw new Error(res.error || "Summarization failed.");

    renderSummary(res.data);
    setView("summary");
  } catch (err) {
    showError(err.message);
  } finally {
    summarizeBtn.disabled = false;
    quizBtn.disabled = false;
    summarizeBtn.classList.remove("active");
  }
}

function renderSummary(data) {
  $("summary-text").textContent = data.summary;
  const list = $("takeaways-list");
  list.innerHTML = "";
  data.takeaways.forEach((t) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="takeaway-dot"></span><span>${t}</span>`;
    list.appendChild(li);
  });
}

//  Quiz
async function handleQuiz() {
  try {
    summarizeBtn.disabled = true;
    quizBtn.disabled = true;
    quizBtn.classList.add("active");

    const extracted = await extractContent();
    loadingText.textContent = "Generating quiz questions...";
    setView("loading");

    const res = await sendToBackground({
      action: "generateQuiz",
      content: extracted.content,
      type: extracted.type,
      title: extracted.title,
    });

    if (!res) throw new Error("No response received. Please reload the extension.");
    if (!res.success) throw new Error(res.error || "Quiz generation failed.");

    state.quizData = res.data.questions;
    state.currentQuestion = 0;
    state.score = 0;
    state.answeredQuestions = new Set();

    renderQuizQuestion();
    setView("quiz");
  } catch (err) {
    showError(err.message);
  } finally {
    summarizeBtn.disabled = false;
    quizBtn.disabled = false;
    quizBtn.classList.remove("active");
  }
}

function renderQuizQuestion() {
  const q = state.quizData[state.currentQuestion];
  const total = state.quizData.length;
  quizProgress.textContent = `${state.currentQuestion + 1} / ${total}`;
  quizComplete.classList.add("hidden");
  quizContainer.innerHTML = "";

  const card = document.createElement("div");
  card.className = "question-card";

  const tag = document.createElement("span");
  tag.className = "question-type-tag";
  tag.textContent = q.type === "mcq" ? "Multiple Choice" : "Short Answer";
  card.appendChild(tag);

  const qText = document.createElement("p");
  qText.className = "question-text";
  qText.textContent = q.question;
  card.appendChild(qText);

  if (q.type === "mcq") {
    const optionsDiv = document.createElement("div");
    optionsDiv.className = "mcq-options";
    q.options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "mcq-option";
      btn.textContent = opt;
      btn.addEventListener("click", () => handleMCQAnswer(btn, opt, q, optionsDiv));
      optionsDiv.appendChild(btn);
    });
    card.appendChild(optionsDiv);
  } else {
    const textarea = document.createElement("textarea");
    textarea.className = "short-answer-input";
    textarea.placeholder = "Type your answer here...";
    card.appendChild(textarea);

    const nextRow = document.createElement("div");
    nextRow.className = "next-btn-row";
    const checkBtn = document.createElement("button");
    checkBtn.className = "btn-next";
    checkBtn.textContent = "Check Answer";
    checkBtn.addEventListener("click", () =>
      handleShortAnswer(textarea.value, q, card, checkBtn)
    );
    nextRow.appendChild(checkBtn);
    card.appendChild(nextRow);
  }

  const explanation = document.createElement("div");
  explanation.className = "explanation-box";
  explanation.id = "explanation-box";
  card.appendChild(explanation);

  quizContainer.appendChild(card);
}

function handleMCQAnswer(btn, selected, q, optionsDiv) {
  if (state.answeredQuestions.has(state.currentQuestion)) return;
  state.answeredQuestions.add(state.currentQuestion);
  const allBtns = optionsDiv.querySelectorAll(".mcq-option");
  allBtns.forEach((b) => {
    b.disabled = true;
    if (b.textContent === q.answer) b.classList.add("correct");
  });
  if (selected !== q.answer) btn.classList.add("wrong");
  else state.score++;
  showExplanation(q.explanation);
  scheduleNextQuestion();
}

function handleShortAnswer(answer, q, card, btn) {
  if (state.answeredQuestions.has(state.currentQuestion)) return;
  state.answeredQuestions.add(state.currentQuestion);
  btn.disabled = true;
  btn.textContent = "Next →";
  btn.addEventListener("click", nextQuestion, { once: true });
  btn.disabled = false;
  if (answer.trim().length > 5) state.score++;
  showExplanation(`Model answer: ${q.answer}\n\n${q.explanation}`);
}

function showExplanation(text) {
  const box = $("explanation-box");
  if (!box) return;
  box.textContent = text;
  box.classList.add("visible");
}

function scheduleNextQuestion() { setTimeout(() => nextQuestion(), 1800); }

function nextQuestion() {
  state.currentQuestion++;
  if (state.currentQuestion >= state.quizData.length) showQuizComplete();
  else renderQuizQuestion();
}

function showQuizComplete() {
  quizContainer.innerHTML = "";
  quizProgress.textContent = "Done!";
  scoreValue.textContent = `${state.score} / ${state.quizData.length}`;
  quizComplete.classList.remove("hidden");
}

//  View Management 
function setView(view) {
  state.currentView = view;
  hide(loadingState);
  hide(errorState);
  hide(summaryResult);
  hide(quizResult);
  if (view === "loading") show(loadingState);
  if (view === "error")   show(errorState);
  if (view === "summary") show(summaryResult);
  if (view === "quiz")    show(quizResult);
}

function showError(msg) {
  if (msg === "NO_API_KEY") {
    errorMessage.textContent = "No API key found. Please add one in settings.";
  } else {
    errorMessage.textContent = msg;
  }
  setView("error");
}

function show(el) { if (el) el.classList.remove("hidden"); }
function hide(el) { if (el) el.classList.add("hidden"); }
function truncate(str, n) { return str && str.length > n ? str.slice(0, n) + "…" : str || ""; }

// Background Messenger 
function sendToBackground(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Runtime error:", chrome.runtime.lastError?.message);
          resolve(null);
          return;
        }
        resolve(response);
      });
    } catch (err) {
      console.error("Send error:", err);
      resolve(null);
    }
  });
}

//  Event Listeners
$("save-key-btn").addEventListener("click", async () => {
  const key = $("api-key-input").value.trim();
  if (key.length < 10) {
    alert("That doesn't look like a valid API key.");
    return;
  }
  await sendToBackground({ action: "saveApiKey", apiKey: key });
  hide(setupScreen);
  show(mainScreen);
  await detectPage();
});

summarizeBtn.addEventListener("click", handleSummarize);
quizBtn.addEventListener("click", handleQuiz);
$("quiz-from-summary-btn").addEventListener("click", handleQuiz);

$("retry-btn").addEventListener("click", () => {
  state.extractedContent = null;
  hide(errorState);
  setView("idle");
});

$("restart-quiz-btn").addEventListener("click", () => {
  state.currentQuestion = 0;
  state.score = 0;
  state.answeredQuestions = new Set();
  renderQuizQuestion();
  quizComplete.classList.add("hidden");
});

$("settings-btn").addEventListener("click", () => show(settingsPanel));
$("close-settings-btn").addEventListener("click", () => hide(settingsPanel));

$("update-key-btn").addEventListener("click", async () => {
  const key = $("settings-key-input").value.trim();
  if (key) {
    await sendToBackground({ action: "saveApiKey", apiKey: key });
    hide(settingsPanel);
    state.extractedContent = null;
  }
});

$("clear-key-btn").addEventListener("click", async () => {
  await chrome.storage.local.remove("apiKey");
  hide(mainScreen);
  hide(settingsPanel);
  show(setupScreen);
});

//  Boot
init();
