function detectPageType() {
  const url = window.location.href;
  if (url.includes("youtube.com/watch")) return "youtube";
  if (document.contentType === "application/pdf") return "pdf";
  return "article";
}

async function getYouTubeTranscript() {
  try {
    const moreActionsBtn = document.querySelector('button[aria-label="More actions"]');
    if (moreActionsBtn) {
      moreActionsBtn.click();
      await sleep(800);
      const menuItems = document.querySelectorAll("tp-yt-paper-item, ytd-menu-service-item-renderer");
      for (const item of menuItems) {
        if (item.textContent.toLowerCase().includes("transcript")) {
          item.click();
          await sleep(1200);
          break;
        }
      }
    }

    const segments = document.querySelectorAll("ytd-transcript-segment-renderer");
    if (segments.length > 0) {
      return Array.from(segments)
        .map((s) => s.querySelector(".segment-text")?.textContent?.trim() || "")
        .filter(Boolean)
        .join(" ");
    }

    const title = document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent || "";
    const description =
      document.querySelector("#description-inline-expander")?.textContent ||
      document.querySelector("#description")?.textContent || "";
    const chapters = extractChapters();

    if (title || description) {
      return `Video Title: ${title}\n\nDescription: ${description}\n\n${chapters}`.trim();
    }

    return null;
  } catch (err) {
    console.error("Transcript extraction failed:", err);
    return null;
  }
}

function extractChapters() {
  const chapters = document.querySelectorAll("ytd-macro-markers-list-item-renderer");
  if (chapters.length === 0) return "";
  return "Chapters: " + Array.from(chapters).map((c) => c.textContent?.trim()).filter(Boolean).join(", ");
}

function getArticleText() {
  const noiseSelectors = [
    "nav", "header", "footer", "aside", ".sidebar", ".advertisement",
    ".cookie-banner", "script", "style", "noscript", ".nav", ".menu",
    "[role='navigation']", "[role='banner']", "[role='complementary']"
  ];

  const cloned = document.body.cloneNode(true);
  noiseSelectors.forEach((sel) => cloned.querySelectorAll(sel).forEach((el) => el.remove()));

  const mainSelectors = ["main", "article", "[role='main']", ".post-content", ".article-body", ".entry-content", ".content"];
  for (const sel of mainSelectors) {
    const el = cloned.querySelector(sel);
    if (el && el.innerText?.trim().length > 300) return cleanText(el.innerText);
  }

  return cleanText(cloned.innerText);
}

function getPDFText() {
  const textLayers = document.querySelectorAll(".textLayer span, .text-layer span");
  if (textLayers.length > 0) {
    return cleanText(Array.from(textLayers).map((s) => s.textContent).join(" "));
  }
  return null;
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 12000);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPageMeta() {
  return {
    type: detectPageType(),
    title: document.title || document.querySelector("h1")?.textContent?.trim() || "Untitled",
    url: window.location.href,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "getPageInfo") {
    sendResponse(getPageMeta());
    return true;
  }

  if (message.action === "extractContent") {
    const type = detectPageType();

    if (type === "youtube") {
      getYouTubeTranscript().then((text) => {
        sendResponse({ type: "youtube", content: text, title: document.title });
      });
      return true;
    }

    if (type === "pdf") {
      sendResponse({ type: "pdf", content: getPDFText(), title: document.title });
      return true;
    }

    sendResponse({ type: "article", content: getArticleText(), title: document.title });
    return true;
  }
});