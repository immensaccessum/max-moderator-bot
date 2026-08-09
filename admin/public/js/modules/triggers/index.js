import { getSelectedChat } from '../../core/state.js';
import { escapeHtml } from '../../core/ui.js';

const ACTION_LABELS = {
  reply: 'Ответить в чат',
  delete: 'Удалить сообщение',
  delete_reply: 'Удалить и ответить',
};

const MATCH_LABELS = {
  contains: 'содержит',
  exact: 'точное',
  regex: 'regex',
};

const MAX_RESPONSE_LENGTH = 1000;

export function createTriggersModule({ api, showToast }) {
  const triggerList = document.getElementById('trigger-list');
  const triggerEmpty = document.getElementById('trigger-empty');
  const triggerForm = document.getElementById('trigger-form');
  const triggerFormTitle = document.getElementById('trigger-form-title');
  const triggerKeyInput = document.getElementById('trigger-key');
  const triggerKeyHint = document.getElementById('trigger-key-hint');
  const triggerAction = document.getElementById('trigger-action');
  const triggerResponseBlock = document.getElementById('trigger-response-block');
  const triggerResponseInput = document.getElementById('trigger-response');
  const triggerResponseCounter = document.getElementById('trigger-response-counter');
  const triggerAutoDeleteReplyInput = document.getElementById('trigger-auto-delete-reply');
  const triggerMatchType = document.getElementById('trigger-match-type');
  const triggerCaseSensitiveInput = document.getElementById('trigger-case-sensitive');
  const triggerEnabledInput = document.getElementById('trigger-enabled');
  const triggerSubmitBtn = document.getElementById('trigger-submit-btn');
  const triggerCancelBtn = document.getElementById('trigger-cancel-btn');

  /** @type {any[]} */
  let triggers = [];
  /** @type {number | null} */
  let editingTriggerId = null;

  function updateResponseCounter() {
    const length = triggerResponseInput.value.length;
    triggerResponseCounter.textContent = `${length} / ${MAX_RESPONSE_LENGTH}`;
    triggerResponseCounter.classList.toggle('is-over', length > MAX_RESPONSE_LENGTH);
  }

  function updateFormVisibility() {
    const needsResponse = triggerAction.value !== 'delete';
    triggerResponseBlock.classList.toggle('hidden', !needsResponse);
    triggerResponseInput.required = needsResponse;

    const isRegex = triggerMatchType.value === 'regex';
    triggerKeyHint.classList.toggle('hidden', !isRegex);
    triggerKeyInput.placeholder = isRegex
      ? 'Например: ^продано$|sold\\b'
      : 'Например: Продано';
  }

  function resetForm() {
    editingTriggerId = null;
    triggerForm.reset();
    triggerEnabledInput.checked = true;
    triggerAutoDeleteReplyInput.checked = false;
    triggerMatchType.value = 'contains';
    triggerAction.value = 'reply';
    triggerFormTitle.textContent = 'Новый триггер';
    triggerSubmitBtn.textContent = 'Добавить';
    triggerCancelBtn.classList.add('hidden');
    updateFormVisibility();
    updateResponseCounter();
  }

  function fillForm(item) {
    editingTriggerId = item.id;
    triggerKeyInput.value = item.keyPhrase;
    triggerAction.value = item.action ?? 'reply';
    triggerResponseInput.value = item.responseText ?? '';
    triggerMatchType.value = item.matchType;
    triggerCaseSensitiveInput.checked = item.caseSensitive;
    triggerAutoDeleteReplyInput.checked = Boolean(item.autoDeleteReply);
    triggerEnabledInput.checked = item.enabled;
    triggerFormTitle.textContent = 'Редактирование триггера';
    triggerSubmitBtn.textContent = 'Сохранить';
    triggerCancelBtn.classList.remove('hidden');
    updateFormVisibility();
    updateResponseCounter();
    triggerForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderPreview(item) {
    if (item.action === 'delete') {
      return 'Сообщение удаляется без ответа';
    }
    if (item.responseText?.trim()) {
      return item.responseText;
    }
    return '—';
  }

  function render() {
    triggerList.innerHTML = '';
    triggerEmpty.classList.toggle('hidden', triggers.length > 0);

    for (const item of triggers) {
      const card = document.createElement('article');
      card.className = `item-card${item.enabled ? '' : ' is-disabled'}`;
      const matchLabel = MATCH_LABELS[item.matchType] ?? MATCH_LABELS.contains;
      const caseLabel = item.caseSensitive ? ', с учётом регистра' : '';
      const actionLabel = item.actionLabel ?? ACTION_LABELS[item.action] ?? ACTION_LABELS.reply;
      const autoDeleteLabel =
        item.autoDeleteReply && item.action !== 'delete' ? ' · ответ 1 мин' : '';

      card.innerHTML = `
        <div class="item-card-header">
          <div>
            <p class="item-card-title">${escapeHtml(item.keyPhrase)}</p>
            <p class="item-card-meta">${escapeHtml(actionLabel)} · ${escapeHtml(matchLabel)}${escapeHtml(caseLabel)}${escapeHtml(autoDeleteLabel)}</p>
          </div>
        </div>
        <p class="item-card-preview">${escapeHtml(renderPreview(item))}</p>
        <div class="item-card-actions"></div>
      `;

      const actions = card.querySelector('.item-card-actions');
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = `btn secondary toggle-btn ${item.enabled ? 'on' : 'off'}`;
      toggleBtn.textContent = item.enabled ? 'Включено' : 'Выключено';
      toggleBtn.addEventListener('click', () => {
        void toggleEnabled(item);
      });

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn secondary';
      editBtn.textContent = 'Изменить';
      editBtn.addEventListener('click', () => fillForm(item));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn danger';
      deleteBtn.textContent = 'Удалить';
      deleteBtn.addEventListener('click', () => {
        void deleteTrigger(item.id);
      });

      actions.append(toggleBtn, editBtn, deleteBtn);
      triggerList.appendChild(card);
    }
  }

  async function load() {
    const chat = getSelectedChat();
    if (!chat) {
      triggers = [];
      render();
      return;
    }

    const data = await api(`/chats/${chat.id}/triggers`);
    triggers = data.triggers ?? [];
    render();
  }

  async function save(event) {
    event.preventDefault();
    const chat = getSelectedChat();
    if (!chat) return;

    const action = triggerAction.value;
    const payload = {
      keyPhrase: triggerKeyInput.value.trim(),
      responseText: triggerResponseInput.value.trim(),
      action,
      matchType: triggerMatchType.value,
      caseSensitive: triggerCaseSensitiveInput.checked,
      autoDeleteReply: action !== 'delete' && triggerAutoDeleteReplyInput.checked,
      enabled: triggerEnabledInput.checked,
    };

    if (!payload.keyPhrase) {
      showToast('Укажите ключевую фразу', true);
      return;
    }

    if (action !== 'delete' && !payload.responseText) {
      showToast('Укажите текст ответа', true);
      return;
    }

    if (action !== 'delete' && payload.responseText.length > MAX_RESPONSE_LENGTH) {
      showToast(`Текст ответа не длиннее ${MAX_RESPONSE_LENGTH} символов`, true);
      return;
    }

    try {
      if (editingTriggerId) {
        await api(`/chats/${chat.id}/triggers/${editingTriggerId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast('Триггер обновлён');
      } else {
        await api(`/chats/${chat.id}/triggers`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Триггер добавлен');
      }

      resetForm();
      await load();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function toggleEnabled(item) {
    const chat = getSelectedChat();
    if (!chat) return;

    try {
      await api(`/chats/${chat.id}/triggers/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !item.enabled }),
      });
      await load();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function deleteTrigger(id) {
    const chat = getSelectedChat();
    if (!chat) return;
    if (!window.confirm('Удалить этот триггер?')) return;

    try {
      await api(`/chats/${chat.id}/triggers/${id}`, { method: 'DELETE' });
      if (editingTriggerId === id) {
        resetForm();
      }
      await load();
      showToast('Триггер удалён');
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function init() {
    triggerAction.addEventListener('change', updateFormVisibility);
    triggerMatchType.addEventListener('change', updateFormVisibility);
    triggerResponseInput.addEventListener('input', updateResponseCounter);
    triggerForm.addEventListener('submit', (event) => {
      void save(event);
    });
    triggerCancelBtn.addEventListener('click', resetForm);
    updateFormVisibility();
    updateResponseCounter();
  }

  return {
    init,
    load,
    reset: resetForm,
  };
}
