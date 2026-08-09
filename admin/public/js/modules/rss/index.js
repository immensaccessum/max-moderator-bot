import { getSelectedChat } from '../../core/state.js';
import { escapeHtml } from '../../core/ui.js';

export function createRssModule({ api, showToast }) {
  const feedList = document.getElementById('rss-list');
  const feedEmpty = document.getElementById('rss-empty');
  const feedForm = document.getElementById('rss-form');
  const feedFormTitle = document.getElementById('rss-form-title');
  const feedTitleInput = document.getElementById('rss-title');
  const feedUrlInput = document.getElementById('rss-url');
  const feedIntervalInput = document.getElementById('rss-interval');
  const feedDescriptionInput = document.getElementById('rss-include-description');
  const feedPostLatestInput = document.getElementById('rss-post-latest');
  const feedPostLatestRow = document.getElementById('rss-post-latest-row');
  const feedEnabledInput = document.getElementById('rss-enabled');
  const feedSubmitBtn = document.getElementById('rss-submit-btn');
  const feedCancelBtn = document.getElementById('rss-cancel-btn');

  /** @type {any[]} */
  let feeds = [];
  /** @type {number | null} */
  let editingFeedId = null;

  function resetForm() {
    editingFeedId = null;
    feedForm.reset();
    feedIntervalInput.value = '15';
    feedEnabledInput.checked = true;
    feedDescriptionInput.checked = false;
    feedPostLatestInput.checked = false;
    feedPostLatestRow.classList.remove('hidden');
    feedFormTitle.textContent = 'Новая RSS-лента';
    feedSubmitBtn.textContent = 'Добавить';
    feedCancelBtn.classList.add('hidden');
  }

  function fillForm(item) {
    editingFeedId = item.id;
    feedTitleInput.value = item.title ?? '';
    feedUrlInput.value = item.feedUrl ?? '';
    feedIntervalInput.value = String(item.pollIntervalMinutes ?? 15);
    feedDescriptionInput.checked = Boolean(item.includeDescription);
    feedEnabledInput.checked = item.enabled;
    feedPostLatestRow.classList.add('hidden');
    feedFormTitle.textContent = 'Редактирование RSS-ленты';
    feedSubmitBtn.textContent = 'Сохранить';
    feedCancelBtn.classList.remove('hidden');
    feedForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function render() {
    feedList.innerHTML = '';
    feedEmpty.classList.toggle('hidden', feeds.length > 0);

    for (const item of feeds) {
      const card = document.createElement('article');
      card.className = `item-card${item.enabled ? '' : ' is-disabled'}`;
      const title = item.title?.trim() || item.feedUrl;
      const lastPosted = item.lastPosted ? `Последний пост: ${item.lastPosted}` : 'Ещё не публиковалось';
      const lastChecked = item.lastChecked ? `Проверка: ${item.lastChecked}` : 'Ещё не проверялось';
      const maxFailures = item.maxConsecutiveFailures ?? 5;
      const failureCount = item.failureCount ?? 0;
      const autoDisabled = !item.enabled && failureCount >= maxFailures;
      const failureLine =
        failureCount > 0
          ? `<p class="item-card-meta${autoDisabled ? ' log-error' : ''}">Ошибок подряд: ${failureCount} из ${maxFailures}${autoDisabled ? ' · автоотключена' : ''}</p>`
          : '';
      const errorLine = item.lastError
        ? `<p class="item-card-meta log-error">${escapeHtml(item.lastError)}</p>`
        : '';

      card.innerHTML = `
        <div class="item-card-header">
          <div>
            <p class="item-card-title">${escapeHtml(title)}</p>
            <p class="item-card-meta">Каждые ${item.pollIntervalMinutes} мин · ${item.includeDescription ? 'с описанием' : 'только заголовок и ссылка'}</p>
            <p class="item-card-meta">${escapeHtml(lastPosted)}</p>
            <p class="item-card-meta">${escapeHtml(lastChecked)}</p>
            ${failureLine}
            ${errorLine}
          </div>
        </div>
        <p class="item-card-preview">${escapeHtml(item.feedUrl)}</p>
        <div class="item-card-actions"></div>
      `;

      const actions = card.querySelector('.item-card-actions');
      const testBtn = document.createElement('button');
      testBtn.type = 'button';
      testBtn.className = 'btn secondary';
      testBtn.textContent = 'Тест';
      testBtn.addEventListener('click', () => {
        void testFeed(item);
      });

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'btn secondary';
      toggleBtn.textContent = item.enabled ? 'Выключить' : 'Включить';
      toggleBtn.addEventListener('click', () => {
        void toggleEnabled(item);
      });

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn ghost';
      editBtn.textContent = 'Изменить';
      editBtn.addEventListener('click', () => fillForm(item));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn ghost danger';
      deleteBtn.textContent = 'Удалить';
      deleteBtn.addEventListener('click', () => {
        void deleteFeed(item.id);
      });

      actions.append(testBtn, toggleBtn, editBtn, deleteBtn);
      feedList.appendChild(card);
    }
  }

  async function load() {
    const chat = getSelectedChat();
    if (!chat) return;

    const data = await api(`/chats/${chat.id}/rss-feeds`);
    feeds = data.feeds ?? [];
    render();
  }

  async function save(event) {
    event.preventDefault();
    const chat = getSelectedChat();
    if (!chat) return;

    const body = {
      title: feedTitleInput.value.trim() || null,
      feedUrl: feedUrlInput.value.trim(),
      pollIntervalMinutes: Number(feedIntervalInput.value),
      includeDescription: feedDescriptionInput.checked,
      enabled: feedEnabledInput.checked,
      postLatestOnAdd: !editingFeedId && feedPostLatestInput.checked,
    };

    try {
      if (editingFeedId) {
        await api(`/chats/${chat.id}/rss-feeds/${editingFeedId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        showToast('RSS-лента сохранена');
      } else {
        await api(`/chats/${chat.id}/rss-feeds`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        showToast('RSS-лента добавлена');
      }
      resetForm();
      await load();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function testFeed(item) {
    const chat = getSelectedChat();
    if (!chat) return;

    try {
      const data = await api(`/chats/${chat.id}/rss-feeds/${item.id}/test`, {
        method: 'POST',
      });
      await load();
      const title = data.title?.trim() || 'запись';
      showToast(`Тестовый пост отправлен: ${title}`);
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function toggleEnabled(item) {
    const chat = getSelectedChat();
    if (!chat) return;

    try {
      await api(`/chats/${chat.id}/rss-feeds/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !item.enabled }),
      });
      await load();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function deleteFeed(id) {
    const chat = getSelectedChat();
    if (!chat) return;
    if (!window.confirm('Удалить эту RSS-ленту?')) return;

    try {
      await api(`/chats/${chat.id}/rss-feeds/${id}`, { method: 'DELETE' });
      if (editingFeedId === id) {
        resetForm();
      }
      await load();
      showToast('RSS-лента удалена');
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function init() {
    feedForm.addEventListener('submit', (event) => {
      void save(event);
    });
    feedCancelBtn.addEventListener('click', resetForm);
  }

  return {
    init,
    load,
    reset: resetForm,
  };
}
