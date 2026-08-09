import { getSelectedChat, state } from '../../core/state.js';
import { escapeHtml, formatZonedDateTime } from '../../core/ui.js';

const LOGGER_TIMEZONE_KEY = 'logger-timezone';

export function createDeletionLogModule({ api, showToast }) {
  const logList = document.getElementById('deletion-log-list');
  const logEmpty = document.getElementById('deletion-log-empty');
  const refreshBtn = document.getElementById('logger-refresh-btn');
  const timezoneSelect = document.getElementById('logger-timezone');

  /** @type {any[]} */
  let logs = [];
  /** @type {number} */
  let retentionHours = 48;

  function resolveTimezone() {
    const saved = localStorage.getItem(LOGGER_TIMEZONE_KEY);
    if (saved) return saved;

    const chat = getSelectedChat();
    if (chat?.silence?.schedule?.timezone) {
      return chat.silence.schedule.timezone;
    }

    return state.timezones[0] ?? 'Europe/Moscow';
  }

  function formatDeletedAt(timestamp) {
    return formatZonedDateTime(timestamp, timezoneSelect.value || resolveTimezone());
  }

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
      const errorLine = item.success
        ? ''
        : `<p class="item-card-meta log-error">${escapeHtml(item.errorMessage ?? 'Неизвестная ошибка')}</p>`;

      card.innerHTML = `
        <div class="item-card-header">
          <div>
            <p class="item-card-title">${escapeHtml(item.sourceLabel)}${escapeHtml(detail)}</p>
            <p class="item-card-meta">${escapeHtml(formatDeletedAt(item.deletedAt))} · ${escapeHtml(statusLabel)} · ${escapeHtml(userLine)}</p>
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

    if (!timezoneSelect.value) {
      timezoneSelect.value = resolveTimezone();
    }

    const data = await api(`/chats/${chat.id}/deletion-logs`);
    logs = data.logs ?? [];
    retentionHours = data.retentionHours ?? 48;
    render();
  }

  function loadMeta(timezones, defaultTimezone) {
    timezoneSelect.innerHTML = timezones
      .map((zone) => `<option value="${zone}">${zone}</option>`)
      .join('');

    const saved = localStorage.getItem(LOGGER_TIMEZONE_KEY);
    timezoneSelect.value = saved || defaultTimezone || timezones[0] || 'Europe/Moscow';
  }

  function init() {
    refreshBtn.addEventListener('click', () => {
      void load().catch((error) => showToast(error.message, true));
    });

    timezoneSelect.addEventListener('change', () => {
      localStorage.setItem(LOGGER_TIMEZONE_KEY, timezoneSelect.value);
      render();
    });
  }

  return {
    init,
    load,
    loadMeta,
    retentionHours: () => retentionHours,
  };
}
