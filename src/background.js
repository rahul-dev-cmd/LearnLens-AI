const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";

// ── Get API Key ─────────────────────────────────────────
async function getApiKey() {
  const result = await chrome.storage.local.get("apiKey");
  return result.apiKey || null;
}

// ── Call AI ─────────────────────────────────────────────
async function callAI(systemPrompt, userMessage) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("NO_API_KEY");

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ]
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ── Prompts ─────────────────────────────────────────────
const SUMMARY_PROMPT = `
You are a learning assistant.

Return ONLY valid JSON:

{
  "summary": "3-5 sentence summary",
  "takeaways": ["point1","point2","point3","point4","point5"]
}
`;

const QUIZ_PROMPT = `
You are a learning assistant.

Generate 5 questions:
- 3 MCQ
- 2 short answer

Return ONLY valid JSON:

{
  "questions":[
    {
      "type":"mcq",
      "question":"...",
      "options":["A","B","C","D"],
      "answer":"...",
      "explanation":"..."
    }
  ]
}
`;

// ── Message Listener ────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Save API key
  if (message.action === "saveApiKey") {
    chrome.storage.local.set({ apiKey: message.apiKey }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Check API key
  if (message.action === "checkApiKey") {
    getApiKey().then((key) => {
      sendResponse({ hasKey: !!key });
    });
    return true;
  }

  // Summarize
  if (message.action === "summarize") {
    (async () => {
      try {
        const trimmed = message.content.slice(0, 12000);

        const text = await callAI(
          SUMMARY_PROMPT,
          `Title: ${message.title}\n\nContent:\n${trimmed}`
        );

        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error("AI returned invalid JSON. Try again.");
        }

        sendResponse({
          success: true,
          data: parsed
        });

      } catch (err) {
        sendResponse({
          success: false,
          error: err.message
        });
      }
    })();

    return true; // ✅ CRITICAL
  }

  // Generate Quiz
  if (message.action === "generateQuiz") {
    (async () => {
      try {
        const trimmed = message.content.slice(0, 12000);

        const text = await callAI(
          QUIZ_PROMPT,
          `Title: ${message.title}\n\nContent:\n${trimmed}`
        );

        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error("AI returned invalid JSON. Try again.");
        }

        sendResponse({
          success: true,
          data: parsed
        });

      } catch (err) {
        sendResponse({
          success: false,
          error: err.message
        });
      }
    })();

    return true; // ✅ CRITICAL
  }

});