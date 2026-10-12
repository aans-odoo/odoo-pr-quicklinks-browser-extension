(() => {
  const ATTR = 'data-branch-copy-injected';
  const RUNBOT_SEARCH_URL = 'https://runbot.odoo.com/runbot/rd-1?search=';
  const TASK_URL = 'https://www.odoo.com/odoo/project/974/tasks/';
  const RUNBOT_ERROR_URL = 'https://runbot.odoo.com/odoo/error/';

  const TASK_REGEX = /\btask[#:\-_ ]?\s*(\d+)\b/i;
  const RUNBOT_ERROR_REGEX = /\brunbot[#:\-_ ]?\s*(\d+)\b/i;

  function extractBranchName(fullText) {
    const colonIdx = fullText.indexOf(':');
    if (colonIdx !== -1) return fullText.slice(colonIdx + 1).trim();
    return fullText.trim();
  }

  function extractId(text, regex) {
    if (!text) return null;
    const m = text.match(regex);
    return m ? m[1] : null;
  }

  function findIds() {
    let taskId = null, runbotErrorId = null;

    const descEl = document.querySelector('.markdown-body');
    if (descEl) {
      const text = descEl.innerText;
      taskId = taskId || extractId(text, TASK_REGEX);
      runbotErrorId = runbotErrorId || extractId(text, RUNBOT_ERROR_REGEX);
    }

    if (!taskId || !runbotErrorId) {
      const commitSelectors = [
        '.TimelineItem-body .markdown-title',
        '.js-commits-list-item .commit-title',
        'a.markdown-title',
        '[data-component="commit-row"] a',
        '.commit .commit-title',
      ];
      for (const sel of commitSelectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const text = el.innerText || el.textContent;
          taskId = taskId || extractId(text, TASK_REGEX);
          runbotErrorId = runbotErrorId || extractId(text, RUNBOT_ERROR_REGEX);
          if (taskId && runbotErrorId) break;
        }
        if (taskId && runbotErrorId) break;
      }
    }

    return { taskId, runbotErrorId };
  }

  function applyCommitMessageGuides() {
    const selectors = [
      '.extended-commit-description-container',
    ];

    const seen = new WeakSet();

    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);

        const commitContext = el.closest('.TimelineItem, .js-timeline-item, .js-commit-row, .commit, [data-component="commit-row"], .prc-Timeline-TimelineBody-tjOtb');
        if (!commitContext) return;

        const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text || text.length < 20) return;

        const looksLikeCommitMessage =
          /This commit adds:|Task-|website_blog|website_event|website_sale|website_hr_recruitment|website_event_track/i.test(text) ||
          /\[IMP\]|\*:\s*website_/.test(text);

        if (!looksLikeCommitMessage) return;

        if (el.hasAttribute('data-commit-guide')) return;

        const guide = document.createElement('div');
        guide.setAttribute('data-commit-guide', 'true');
        guide.setAttribute('aria-hidden', 'true');
        guide.style.cssText = `
          position: absolute;
          top: 0;
          bottom: 0;
          left: 72ch;
          width: 1px;
          background: rgba(96, 165, 250, 0.7);
          pointer-events: none;
          box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.2);
          z-index: 2;
        `;

        const baseStyle = window.getComputedStyle(el);
        if (baseStyle.position === 'static') {
          el.style.position = 'relative';
        }

        if (text.length > 72) {
          guide.style.background = 'rgba(248, 113, 113, 0.9)';
          guide.style.boxShadow = '0 0 0 1px rgba(248, 113, 113, 0.25)';
        }

        if (!el.querySelector('[data-commit-guide="true"]')) {
          el.appendChild(guide);
        }
      });
    }
  }

  function createButton({ attr, title, svgPath, color, onClick }) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute(ATTR, attr);
    btn.setAttribute('aria-label', title);

    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border: none;
      border-radius: 6px;
      background: transparent;
      cursor: pointer;
      color: inherit;
      opacity: 1;
      transition: background 0.15s, color 0.15s;
      vertical-align: middle;
      margin-left: 2px;
      position: relative;
    `;

    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="vertical-align:text-bottom">${svgPath}</svg>`;

    const tooltip = document.createElement('span');
    tooltip.textContent = title;
    tooltip.style.cssText = `
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      background: #1b1f23;
      color: #fff;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      padding: 4px 8px;
      border-radius: 6px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      z-index: 9999;
    `;
    btn.appendChild(tooltip);

    btn.addEventListener('mouseenter', () => {
      btn.style.color = color || 'inherit';
      btn.style.background = 'var(--bgColor-neutral-muted, rgba(175,184,193,0.2))';
      tooltip.style.opacity = '1';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.color = 'inherit';
      btn.style.background = 'transparent';
      tooltip.style.opacity = '0';
    });

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const { text, successMsg, successColor } = onClick();
      if (text) {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
      }
      const originalText = tooltip.textContent;
      tooltip.textContent = successMsg;
      btn.style.color = successColor;
      setTimeout(() => {
        tooltip.textContent = originalText;
        btn.style.color = 'inherit';
      }, 1500);
    });

    return btn;
  }

  // ── Icons ──────────────────────────────────────────────────────────────────

  const BRANCH_SVG = `<path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm0 2.122a2.25 2.25 0 1 0-1.5 0v.878A2.25 2.25 0 0 0 5.75 8.5h1.5v2.128a2.251 2.251 0 1 0 1.5 0V8.5h1.5a2.25 2.25 0 0 0 2.25-2.25v-.878a2.25 2.25 0 1 0-1.5 0v.878a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 5 6.25v-.878zm3.75 7.378a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm3-8.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z"/>`;

  const RUNBOT_SEARCH_SVG = `<path d="M14.064 0h.186C15.216 0 16 .784 16 1.75v.186a8.752 8.752 0 0 1-2.564 6.186l-.458.459-.001.001c-.314.313-.641.615-.978.903v3.207c0 .608-.315 1.172-.833 1.49l-2.774 1.707a.75.75 0 0 1-1.11-.418l-.954-3.102a1.214 1.214 0 0 1-.145-.123L3.754 9.816a1.218 1.218 0 0 1-.124-.145L.528 8.717a.75.75 0 0 1-.418-1.11l1.71-2.774A1.748 1.748 0 0 1 3.31 4h3.204c.288-.338.59-.665.904-.979l.459-.458A8.749 8.749 0 0 1 14.064 0ZM8.938 3.623h-.002l-.458.458c-.76.76-1.437 1.598-2.02 2.5l-1.5 2.317 2.143 2.143 2.317-1.5c.902-.583 1.74-1.26 2.499-2.02l.459-.458a7.25 7.25 0 0 0 2.123-5.127V1.75a.25.25 0 0 0-.25-.25h-.186a7.249 7.249 0 0 0-5.125 2.123ZM3.56 14.56c-.732.732-2.334 1.045-3.005 1.148a.234.234 0 0 1-.265-.265c.103-.671.416-2.273 1.15-3.003a1.502 1.502 0 1 1 2.12 2.12Zm6.94-9.935a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"/>`;

  const TASK_SVG = `<path d="M2 1.75C2 .784 2.784 0 3.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 12.25 16h-8.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 7.75 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Zm-5.5 8.563 3.22-3.22a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06Z"/>`;

  const RUNBOT_ERROR_SVG = `<path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>`;

  // ── Button factories ───────────────────────────────────────────────────────

  function createBranchCopyButton(branchName) {
    return createButton({
      attr: 'branch',
      title: 'Copy branch name',
      svgPath: BRANCH_SVG,
      color: '#3fb950',
      onClick: () => ({ text: branchName, successMsg: '✓ Copied!', successColor: '#3fb950' }),
    });
  }

  function createRunbotSearchButton(branchName) {
    const url = RUNBOT_SEARCH_URL + branchName;
    return createButton({
      attr: 'runbot-search',
      title: 'Open branch in Runbot',
      svgPath: RUNBOT_SEARCH_SVG,
      color: '#f78166',
      onClick: () => { window.open(url, '_blank'); return { text: '', successMsg: '🚀 Opened!', successColor: '#f78166' }; },
    });
  }

  function createTaskButton(taskId) {
    const url = TASK_URL + taskId;
    return createButton({
      attr: 'task',
      title: `Open task #${taskId}`,
      svgPath: TASK_SVG,
      color: '#a371f7',
      onClick: () => { window.open(url, '_blank'); return { text: '', successMsg: '✓ Opened!', successColor: '#a371f7' }; },
    });
  }

  function createRunbotErrorButton(errorId) {
    const url = RUNBOT_ERROR_URL + errorId;
    return createButton({
      attr: 'runbot-error',
      title: `Open Runbot error #${errorId}`,
      svgPath: RUNBOT_ERROR_SVG,
      color: '#e3b341',
      onClick: () => { window.open(url, '_blank'); return { text: '', successMsg: '⚠ Opened!', successColor: '#e3b341' }; },
    });
  }

  // ── Page scanning ──────────────────────────────────────────────────────────

  function getBranchNameFromPage() {
    const links = [...document.querySelectorAll('a.prc-BranchName-BranchName-CMTaU')];
    if (!links.length) return null;
    return extractBranchName(links[links.length - 1].textContent.trim());
  }

  // ── Injection ──────────────────────────────────────────────────────────────

  function injectIntoRoot(root, branchName, taskId, runbotErrorId) {
    const copyBtns = root.querySelectorAll('button[data-component="IconButton"]:not([' + ATTR + '])');
    for (const btn of copyBtns) {
      const parent = btn.parentElement;
      if (!parent) continue;

      const tooltips = parent.querySelectorAll('[role="tooltip"], [data-component="Tooltip"]');
      let match = false;
      for (const tip of tooltips) {
        if (tip.textContent.includes('Copy head branch name')) { match = true; break; }
      }
      if (!match) continue;

      if (!branchName) {
        const links = parent.querySelectorAll('a.prc-BranchName-BranchName-CMTaU');
        if (!links.length) continue;
        branchName = extractBranchName(links[links.length - 1].textContent.trim());
      }
      if (!branchName) continue;

      // Insert right-to-left (afterend reverses order):
      // Final visual order: [GH copy] [branch] [runbot search] [task?] [runbot error?]
      if (runbotErrorId) btn.insertAdjacentElement('afterend', createRunbotErrorButton(runbotErrorId));
      if (taskId)        btn.insertAdjacentElement('afterend', createTaskButton(taskId));
      btn.insertAdjacentElement('afterend', createRunbotSearchButton(branchName));
      btn.insertAdjacentElement('afterend', createBranchCopyButton(branchName));

      return branchName;
    }
    return null;
  }

  function injectButtons() {
    document.querySelectorAll('[' + ATTR + ']').forEach(el => el.remove());

    applyCommitMessageGuides();

    let branchName = getBranchNameFromPage();
    const { taskId, runbotErrorId } = findIds();

    const mainHeader = document.querySelector('.prc-PageHeader-Description-w-ejP');
    if (mainHeader) {
      const found = injectIntoRoot(mainHeader, branchName, taskId, runbotErrorId);
      if (found) branchName = found;
    }

    if (!branchName) return;

    const prStickyHeader = document.querySelector('[class*="StickyPullRequestHeader-module__prHeader"]');
    if (prStickyHeader) injectIntoRoot(prStickyHeader, branchName, taskId, runbotErrorId);

    const filesToolbar = document.querySelector('[class*="PullRequestFilesToolbar-module__toolbar"]');
    if (filesToolbar) injectIntoRoot(filesToolbar, branchName, taskId, runbotErrorId);
  }

  injectButtons();

  let debounceTimer = null;
  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some(m =>
      Array.from(m.addedNodes).some(n => n.nodeType === 1 && !n.hasAttribute(ATTR))
    );
    if (!relevant) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      observer.disconnect();
      injectButtons();
      observer.observe(document.body, { childList: true, subtree: true });
    }, 500);
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
