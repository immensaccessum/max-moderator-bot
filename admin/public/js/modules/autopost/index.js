import { getSelectedChat } from '../../core/state.js';
import { escapeHtml } from '../../core/ui.js';

export function createAutopostModule({ api, showToast }) {
  const autopostList = document.getElementById('autopost-list');
  const autopostEmpty = document.getElementById('autopost-empty');
  const autopostForm = document.getElementById('autopost-form');
  const autopostFormTitle = document.getElementById('autopost-form-title');
  const autopostTitleInput = document.getElementById('autopost-title');
  const autopostMessageInput = document.getElementById('autopost-message');
  const autopostScheduleType = document.getElementById('autopost-schedule-type');
  const autopostWeeklyFields = document.getElementById('autopost-weekly-fields');
  const autopostTimeFields = document.getElementById('autopost-time-fields');
  const autopostIntervalFields = document.getElementById('autopost-interval-fields');
  const autopostWeekday = document.getElementById('autopost-weekday');
  const autopostHour = document.getElementById('autopost-hour');
  const autopostMinute = document.getElementById('autopost-minute');
  const autopostInterval = document.getElementById('autopost-interval');
  const autopostTimezoneSelect = document.getElementById('autopost-timezone');
  const autopostEnabledInput = document.getElementById('autopost-enabled');
  const autopostSubmitBtn = document.getElementById('autopost-submit-btn');
  const autopostCancelBtn = document.getElementById('autopost-cancel-btn');

  /** @type {any[]} */
  let autoposts = [];
  /** @type {number | null} */
  let editingAutopostId = null;

  function updateFormVisibility() {
    const type = autopostScheduleType.value;
    autopostWeeklyFields.classList.toggle('hidden', type !== 'weekly');
    autopostTimeFields.classList.toggle('hidden', type === 'interval');
    autopostIntervalFields.classList.toggle('hidden', type !== 'interval');
  }

  function resetForm() {
    editingAutopostId = null;
    autopostForm.reset();
    autopostEnabledInput.checked = true;
    autopostScheduleType.value = 'daily';
    autopostHour.value = '10';
    autopostMinute.value = '00';
    autopostWeekday.value = '1';
    autopostInterval.value = '120';

    const chat = getSelectedChat();
    if (autopostTimezoneSelect.options.length > 0) {
      autopostTimezoneSelect.value =
        chat?.silence?.schedule?.timezone ?? autopostTimezoneSelect.options[0].value;
    }

    autopostFormTitle.textContent = 'Новое расписание';
    autopostSubmitBtn.textContent = 'Добавить';
    autopostCancelBtn.classList.add('hidden');
    updateFormVisibility();
  }

  function fillForm(item) {
    editingAutopostId = item.id;
    autopostTitleInput.value = item.title ?? '';
    autopostMessageInput.value = item.messageText ?? '';
    autopostScheduleType.value = item.scheduleType;
    autopostWeekday.value = String(item.weekday ?? 1);
    autopostHour.value = String(item.hour ?? 10).padStart(2, '0');
    autopostMinute.value = String(item.minute ?? 0).padStart(2, '0');
    autopostInterval.value = String(item.intervalMinutes ?? 120);
    autopostTimezoneSelect.value = item.timezone;
    autopostEnabledInput.checked = item.enabled;
    autopostFormTitle.textContent = 'Редактирование расписания';
    autopostSubmitBtn.textContent = 'Сохранить';
    autopostCancelBtn.classList.remove('hidden');
    updateFormVisibility();
    autopostForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function render() {
    autopostList.innerHTML = '';
    autopostEmpty.classList.toggle('hidden', autoposts.length > 0);

    for (const item of autoposts) {
      const card = document.createElement('article');
      card.className = `item-card${item.enabled ? '' : ' is-disabled'}`;
      const title = item.title?.trim() || item.scheduleLabel;
      const lastPosted = item.lastPosted ? `Последний пост: ${item.lastPosted}` : 'Ещё не отправлялось';

      card.innerHTML = `
        <div class="item-card-header">
          <div>
            <p class="item-card-title">${escapeHtml(title)}</p>
            <p class="item-card-meta">${escapeHtml(item.scheduleLabel)} · ${escapeHtml(item.timezone)}</p>
            <p class="item-card-meta">${escapeHtml(lastPosted)}</p>
          </div>
        </div>
        <p class="item-card-preview">${escapeHtml(item.messageText)}</p>
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
        void deleteAutopost(item.id);
      });

      actions.append(toggleBtn, editBtn, deleteBtn);
      autopostList.appendChild(card);
    }
  }

  function getPayload() {
    const scheduleType = autopostScheduleType.value;
    const payload = {
      title: autopostTitleInput.value.trim() || null,
      messageText: autopostMessageInput.value.trim(),
      scheduleType,
      timezone: autopostTimezoneSelect.value,
      enabled: autopostEnabledInput.checked,
    };

    if (scheduleType === 'interval') {
      payload.intervalMinutes = Number(autopostInterval.value);
      payload.weekday = null;
      payload.hour = null;
      payload.minute = null;
    } else {
      payload.hour = Number(autopostHour.value);
      payload.minute = Number(autopostMinute.value);
      payload.intervalMinutes = null;
      payload.weekday = scheduleType === 'weekly' ? Number(autopostWeekday.value) : null;
    }

    return payload;
  }

  async function load() {
    const chat = getSelectedChat();
    if (!chat) {
      autoposts = [];
      render();
      return;
    }

    const data = await api(`/chats/${chat.id}/autoposts`);
    autoposts = data.autoposts ?? [];
    render();
  }

  async function save(event) {
    event.preventDefault();
    const chat = getSelectedChat();
    if (!chat) return;

    const payload = getPayload();
    if (!payload.messageText) {
      showToast('Введите текст сообщения', true);
      return;
    }

    try {
      if (editingAutopostId) {
        await api(`/chats/${chat.id}/autoposts/${editingAutopostId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast('Расписание обновлено');
      } else {
        await api(`/chats/${chat.id}/autoposts`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Расписание добавлено');
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
      await api(`/chats/${chat.id}/autoposts/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !item.enabled }),
      });
      await load();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function deleteAutopost(id) {
    const chat = getSelectedChat();
    if (!chat) return;
    if (!window.confirm('Удалить это расписание?')) return;

    try {
      await api(`/chats/${chat.id}/autoposts/${id}`, { method: 'DELETE' });
      if (editingAutopostId === id) {
        resetForm();
      }
      await load();
      showToast('Расписание удалено');
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function loadMeta(timezones) {
    autopostTimezoneSelect.innerHTML = timezones
      .map((zone) => `<option value="${zone}">${zone}</option>`)
      .join('');
    resetForm();
  }

  function init() {
    autopostScheduleType.addEventListener('change', updateFormVisibility);
    autopostForm.addEventListener('submit', (event) => {
      void save(event);
    });
    autopostCancelBtn.addEventListener('click', resetForm);
  }

  return {
    init,
    load,
    loadMeta,
    reset: resetForm,
    getTimeSelects: () => [autopostHour, autopostMinute],
  };
}
