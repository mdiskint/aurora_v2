(() => {
  const hostname = window.location.hostname;

  function detectSite() {
    if (hostname.includes('claude.ai')) return 'claude';
    return 'chatgpt';
  }

  // ── Boilerplate detection & stripping ────────────────────────────

  function isBoilerplate(text) {
    if (!text) return true;
    if (text.startsWith('HEARTH-ENABLED:')) return true;
    if (text.includes("CLAUDE'S OPERATING SYSTEM")) return true;
    if (text.startsWith('[AFFECT COMPLEMENT]')) return true;
    if (text.includes('[END AFFECT COMPLEMENT]')) return true;
    if (text.includes('\u2550\u2550\u2550')) return true; // ═══
    if (text.includes("Michael's Emotional Operating System")) return true;
    if (text.includes('PRIME DIRECTIVE\nYou are a thinking partner')) return true;
    return false;
  }

  function stripBoilerplate(text) {
    if (!text) return '';

    // Try stripping after last [END AFFECT COMPLEMENT] block
    const endAffectIdx = text.lastIndexOf('[END AFFECT COMPLEMENT]');
    if (endAffectIdx !== -1) {
      const after = text.slice(endAffectIdx + '[END AFFECT COMPLEMENT]'.length).trim();
      if (after.length >= 20) return after;
    }

    // Try stripping after last ═══ line
    const boxLineIdx = text.lastIndexOf('\u2550\u2550\u2550');
    if (boxLineIdx !== -1) {
      // Find next newline after the box line
      const nlAfter = text.indexOf('\n', boxLineIdx);
      if (nlAfter !== -1) {
        const after = text.slice(nlAfter + 1).trim();
        if (after.length >= 20) return after;
      }
    }

    // Try stripping after HEARTH-ENABLED block (find first double newline after it)
    if (text.startsWith('HEARTH-ENABLED:')) {
      const doubleNl = text.indexOf('\n\n');
      if (doubleNl !== -1) {
        const after = text.slice(doubleNl + 2).trim();
        if (after.length >= 20) return after;
      }
    }

    // Nothing salvageable
    return '';
  }

  function filterMessages(messages) {
    const filtered = [];
    for (const msg of messages) {
      let content = msg.content;

      if (isBoilerplate(content)) {
        // Try to extract real content
        content = stripBoilerplate(content);
        if (!content) continue; // Skip entirely
      }

      // Skip empty or whitespace-only messages
      if (!content.trim()) continue;

      filtered.push({ role: msg.role, content, index: filtered.length });
    }
    return filtered;
  }

  // ── Capture text selection before scraping ───────────────────────

  const selection = window.getSelection();
  const highlightText = (selection && selection.toString().trim()) || null;

  // ── ChatGPT scraper ──────────────────────────────────────────────

  function scrapeChatGPT() {
    // Title
    let title = document.title.replace(/^ChatGPT\s*[-—]\s*/, '').trim();
    if (!title || title === 'ChatGPT') {
      const activeSidebarH1 = document.querySelector('nav [class*="active"] h1, nav [class*="selected"] h1');
      if (activeSidebarH1) {
        title = activeSidebarH1.innerText.trim();
      }
    }
    if (!title || title === 'ChatGPT') {
      title = 'Untitled ChatGPT Conversation';
    }

    // Messages — primary: data-message-author-role attribute
    let messageEls = document.querySelectorAll('[data-message-author-role]');

    // Secondary fallback: article elements in main thread
    if (messageEls.length === 0) {
      messageEls = document.querySelectorAll('main article');
    }

    // Tertiary fallback: class-based message containers
    if (messageEls.length === 0) {
      messageEls = document.querySelectorAll('[class*="message"]');
    }

    const rawMessages = [];

    messageEls.forEach((el) => {
      let role = el.getAttribute('data-message-author-role');
      if (!role) {
        const text = el.className || '';
        if (text.includes('user')) {
          role = 'user';
        } else if (text.includes('assistant')) {
          role = 'assistant';
        } else {
          role = rawMessages.length % 2 === 0 ? 'user' : 'assistant';
        }
      }

      if (role !== 'user' && role !== 'assistant') return;

      const contentEl =
        el.querySelector('.markdown') ||
        el.querySelector('.whitespace-pre-wrap') ||
        el.querySelector('[class*="prose"]') ||
        el;

      const content = contentEl.innerText.trim();
      if (!content) return;

      rawMessages.push({ role, content, index: rawMessages.length });
    });

    const messages = filterMessages(rawMessages);
    return { source: 'chatgpt', title, messages, highlightText };
  }

  // ── Claude scraper ───────────────────────────────────────────────

  function scrapeClaude() {
    // Title
    let title = document.title.replace(/^Claude\s*[-—]\s*/, '').trim();
    if (!title || title === 'Claude') {
      title = 'Untitled Claude Conversation';
    }

    const rawMessages = [];

    // Try data-testid based selectors first (most stable)
    const humanTurns = document.querySelectorAll('[data-testid*="human-turn"], [data-testid*="user-message"]');
    const assistantTurns = document.querySelectorAll('[data-testid*="assistant-turn"], [data-is-streaming]');

    if (humanTurns.length > 0 || assistantTurns.length > 0) {
      const turns = [];

      humanTurns.forEach((el) => {
        turns.push({ el, role: 'user' });
      });

      assistantTurns.forEach((el) => {
        if (!Array.from(humanTurns).includes(el)) {
          turns.push({ el, role: 'assistant' });
        }
      });

      // Sort by DOM order
      turns.sort((a, b) => {
        const pos = a.el.compareDocumentPosition(b.el);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });

      turns.forEach(({ el, role }) => {
        const contentEl =
          el.querySelector('[class*="markdown"]') ||
          el.querySelector('[class*="prose"]') ||
          el.querySelector('p') ||
          el;

        const content = contentEl.innerText.trim();
        if (!content) return;

        rawMessages.push({ role, content, index: rawMessages.length });
      });
    }

    // Fallback: look for the conversation thread container and alternate turns
    if (rawMessages.length === 0) {
      const turnContainers = document.querySelectorAll(
        '[class*="conversation"] > div, [class*="thread"] > div, main > div > div > div'
      );

      turnContainers.forEach((el) => {
        const text = el.innerText.trim();
        if (!text || text.length < 2) return;

        const cls = (el.className || '') + ' ' + (el.getAttribute('data-testid') || '');
        let role;
        if (cls.includes('human') || cls.includes('user')) {
          role = 'user';
        } else if (cls.includes('assistant') || cls.includes('claude') || el.hasAttribute('data-is-streaming')) {
          role = 'assistant';
        } else {
          return;
        }

        rawMessages.push({ role, content: text, index: rawMessages.length });
      });
    }

    const messages = filterMessages(rawMessages);
    return { source: 'claude', title, messages, highlightText };
  }

  // ── Dispatch ─────────────────────────────────────────────────────

  const site = detectSite();
  if (site === 'claude') {
    return scrapeClaude();
  }
  return scrapeChatGPT();
})();
