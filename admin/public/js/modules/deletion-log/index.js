import { getSelectedChat } from '../../core/state.js';
import { escapeHtml } from '../../core/ui.js';

export function createDeletionLogModule({ api, showToast }) {
  const logList = document.getElementById('deletion-log-list');
  const logEmpty = document.getElementById('deletion-log-empty');
  const refreshBtn = document.getElementById('logger-refresh-btn');

  /** @type {any[]} */
  let logs = [];
  /** @type {number} */
  let retentionHours = 48;

  function renderPreview(text) {
    if (!text?.trim()) return '—';
    return text;
  }

  function render() {
    logList.innerHTML = '';
    logEmpty.classList.toggle('hidden', logs.length > 0);

    for (const item of logs) {
      const card = document.createElement('article');
      card.className = `item-card log-card${item.success ? '' : ' log-card-failed'}`;

      const userLine = item.userLabel
        ? `${item.userLabel}${item.userId ? ` (${item.userId})` : ''}`
        : item.userId
          ? `ID ${item.userId}`
          : '—';

      const statusLabel = item.success ? 'Удалено' : 'Ошибка удаления';
      const detail = item.sourceDetail ? ` · ${item.sourceDetail}` : '';
      const errorLine = item.success ? '' : `<p class="item-card-meta log-error">${escapeHtml(item.errorMessage ?? 'Неизвестная ошибка')}</p>`;

      card.innerHTML = `
        <div class="item-card-header">
          <div>
            <p class="item-card-title">${escapeHtml(item.sourceLabel)}${escapeHtml(detail)}</p>
            <p class="item-card-meta">${escapeHtml(item.deleted)} · ${escapeHtml(statusLabel)} · ${escapeHtml(userLine)}</p>
          </div>
        </div>
        <p class="item-card-preview">${escapeHtml(renderPreview(item.messageText))}</p>
        ${errorLine}
      `;

      logList.appendChild(card);
    }
  }

  async function load() {
    const chat = getSelectedChat();
    if (!chat) {
      logs = [];
      render();
      return;
    }

    const data = await api(`/chats/${chat.id}/deletion-logs`);
    logs = data.logs ?? [];
    retentionHours = data.retentionHours ?? 48;
    render();
  }

  function init() {
    refreshBtn.addEventListener('click', () => {
      void load().catch((error) => showToast(error.message, true));
    });
  }

  return {
    init,
    load,
    retentionHours: () => retentionHours,
  };
}
