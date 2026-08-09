import { getSelectedChat, updateChatInList } from '../../core/state.js';
import { autoResizeTextarea } from '../../core/ui.js';

export function createSilenceModule({ api, showToast, onChatUpdated }) {
  const silenceBadge = document.getElementById('silence-badge');
  const silenceStatus = document.getElementById('silence-status');
  const durationGrid = document.getElementById('duration-grid');
  const silenceBlock = document.getElementById('silence-block');
  const manualModeHint = document.getElementById('manual-mode-hint');
  const scheduleBlock = document.getElementById('schedule-block');
  const scheduleModeHint = document.getElementById('schedule-mode-hint');
  const customDurationForm = document.getElementById('custom-duration-form');
  const customMinutesInput = document.getElementById('custom-minutes');
  const disableSilenceBtn = document.getElementById('disable-silence-btn');
  const openSuffixInput = document.getElementById('open-suffix');
  const closedSuffixInput = document.getElementById('closed-suffix');
  const saveMessagesBtn = document.getElementById('save-messages-btn');
  const scheduleEnabledInput = document.getElementById('schedule-enabled');
  const scheduleWeekendsEnabledInput = document.getElementById('schedule-weekends-enabled');
  const scheduleStartHour = document.getElementById('schedule-start-hour');
  const scheduleStartMinute = document.getElementById('schedule-start-minute');
  const scheduleEndHour = document.getElementById('schedule-end-hour');
  const scheduleEndMinute = document.getElementById('schedule-end-minute');
  const scheduleTimezoneSelect = document.getElementById('schedule-timezone');
  const scheduleStatus = document.getElementById('schedule-status');
  const scheduleSaveStatus = document.getElementById('schedule-save-status');

  let syncingScheduleForm = false;
  let scheduleSaveInFlight = false;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let scheduleSaveTimer;

  const scheduleTimeSelects = [
    scheduleStartHour,
    scheduleStartMinute,
    scheduleEndHour,
    scheduleEndMinute,
  ];

  function setScheduleSaveStatus(text, status = 'saved') {
    scheduleSaveStatus.textContent = text;
    scheduleSaveStatus.classList.remove('saving', 'error');
    if (status === 'saving') scheduleSaveStatus.classList.add('saving');
    if (status === 'error') scheduleSaveStatus.classList.add('error');
  }

  function setScheduleTimeSelects(startMinutes, endMinutes) {
    scheduleStartHour.value = String(Math.floor(startMinutes / 60)).padStart(2, '0');
    scheduleStartMinute.value = String(startMinutes % 60).padStart(2, '0');
    scheduleEndHour.value = String(Math.floor(endMinutes / 60)).padStart(2, '0');
    scheduleEndMinute.value = String(endMinutes % 60).padStart(2, '0');
  }

  function getScheduleStartMinutes() {
    return Number(scheduleStartHour.value) * 60 + Number(scheduleStartMinute.value);
  }

  function getScheduleEndMinutes() {
    return Number(scheduleEndHour.value) * 60 + Number(scheduleEndMinute.value);
  }

  function resizeSuffixTextareas() {
    autoResizeTextarea(openSuffixInput);
    autoResizeTextarea(closedSuffixInput);
  }

  function renderDurationButtons(chat) {
    durationGrid.innerHTML = '';
    const manualBlocked = chat.silence.manualBlocked;

    for (const preset of chat.silence.durationPresets) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'duration-btn';
      button.disabled = manualBlocked;
      button.textContent = preset.label;
      button.addEventListener('click', () => {
        if (preset.minutes === null) {
          void setSilence({ forever: true });
        } else {
          void setSilence({ minutes: preset.minutes });
        }
      });
      durationGrid.appendChild(button);
    }
  }

  function updateModeLocks(chat) {
    const manualBlocked = chat.silence.manualBlocked;
    const scheduleBlocked = chat.silence.schedule.blocked;

    silenceBlock.classList.toggle('is-disabled', manualBlocked);
    scheduleBlock.classList.toggle('is-disabled', scheduleBlocked);

    customMinutesInput.disabled = manualBlocked;
    disableSilenceBtn.disabled = !chat.silence.enabled;

    scheduleEnabledInput.disabled = scheduleBlocked;
    scheduleWeekendsEnabledInput.disabled = scheduleBlocked;
    for (const select of scheduleTimeSelects) {
      select.disabled = scheduleBlocked;
    }
    scheduleTimezoneSelect.disabled = scheduleBlocked;

    if (manualBlocked) {
      manualModeHint.textContent =
        'Сейчас чат закрыт по расписанию. Ручную тишину включить нельзя.';
    } else if (chat.silence.enabled) {
      manualModeHint.textContent = 'Ручная тишина активна.';
    } else if (chat.silence.schedule.enabled) {
      manualModeHint.textContent =
        'Расписание включено, чат открыт — можно закрыть вручную.';
    } else {
      manualModeHint.textContent = 'Можно включить вручную, пока чат открыт.';
    }

    if (scheduleBlocked) {
      scheduleModeHint.textContent =
        'Активна ручная тишина. Сначала выключите её, чтобы включить расписание.';
    } else if (chat.silence.schedule.enabled) {
      scheduleModeHint.textContent =
        'Расписание включено. Сообщение в чат — в минуту начала и окончания.';
    } else {
      scheduleModeHint.textContent =
        'Например: с 21:00 до 09:00. Изменения сохраняются автоматически.';
    }
  }

  function render(chat) {
    if (!chat) return;

    syncingScheduleForm = true;
    try {
      silenceStatus.textContent = formatSilenceStatus(chat);

      const isActive = chat.silence.active;
      silenceBadge.textContent = isActive ? 'Тишина включена' : 'Тишина выключена';
      silenceBadge.classList.toggle('on', isActive);
      silenceBadge.classList.toggle('off', !isActive);

      updateModeLocks(chat);

      openSuffixInput.value = chat.silence.openSuffix ?? '';
      closedSuffixInput.value = chat.silence.closedSuffix ?? '';
      resizeSuffixTextareas();

      if (!scheduleSaveInFlight) {
        scheduleEnabledInput.checked = chat.silence.schedule.enabled;
        scheduleWeekendsEnabledInput.checked = chat.silence.schedule.weekendsEnabled;
        setScheduleTimeSelects(
          chat.silence.schedule.startMinutes,
          chat.silence.schedule.endMinutes,
        );
        scheduleTimezoneSelect.value = chat.silence.schedule.timezone;
      }

      scheduleStatus.textContent = chat.silence.schedule.enabled
        ? `Сейчас: ${chat.silence.schedule.active ? 'закрыт по расписанию' : 'открыт'} (${chat.silence.schedule.timezone})`
        : 'Расписание выключено';
      setScheduleSaveStatus(
        chat.silence.schedule.enabled
          ? '✓ Расписание включено и сохранено'
          : 'Расписание выключено',
      );

      renderDurationButtons(chat);
    } finally {
      syncingScheduleForm = false;
    }
  }

  function formatSilenceStatus(chat) {
    const { silence } = chat;
    if (silence.schedule?.enabled) {
      const weekends = silence.schedule.weekendsEnabled ? ', сб–вс' : '';
      const label = `${silence.schedule.start}–${silence.schedule.end}${weekends}`;
      return silence.schedule.active ? `${label} (закрыт)` : `${label} (открыт)`;
    }
    if (silence.enabled) {
      if (!silence.untilMs) return 'Ручная: постоянно';
      return `Ручная: до ${new Date(silence.untilMs).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
    return 'Выключен';
  }

  async function setSilence(body) {
    const chat = getSelectedChat();
    if (!chat) return;

    try {
      const updated = await api(`/chats/${chat.id}/silence`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      updateChatInList(updated);
      onChatUpdated(updated);
      showToast('Режим тишины обновлён');
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function saveMessages() {
    const chat = getSelectedChat();
    if (!chat) return;

    try {
      const updated = await api(`/chats/${chat.id}/silence/config`, {
        method: 'PATCH',
        body: JSON.stringify({
          openSuffix: openSuffixInput.value.trim() || null,
          closedSuffix: closedSuffixInput.value.trim() || null,
        }),
      });
      updateChatInList(updated);
      onChatUpdated(updated);
      showToast('Приписки сохранены');
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function getSchedulePayload() {
    return {
      enabled: scheduleEnabledInput.checked,
      weekendsEnabled: scheduleWeekendsEnabledInput.checked,
      startMinutes: getScheduleStartMinutes(),
      endMinutes: getScheduleEndMinutes(),
      timezone: scheduleTimezoneSelect.value,
    };
  }

  async function saveScheduleConfig() {
    const chat = getSelectedChat();
    if (!chat || syncingScheduleForm || scheduleSaveInFlight) return;

    scheduleSaveInFlight = true;
    setScheduleSaveStatus('Сохранение...', 'saving');

    try {
      const updated = await api(`/chats/${chat.id}/silence/config`, {
        method: 'PATCH',
        body: JSON.stringify({ schedule: getSchedulePayload() }),
      });
      updateChatInList(updated);
      onChatUpdated(updated);
      setScheduleSaveStatus('✓ Расписание сохранено');
    } catch (error) {
      setScheduleSaveStatus(error.message, 'error');
      showToast(error.message, true);
    } finally {
      scheduleSaveInFlight = false;
    }
  }

  async function toggleScheduleEnabled() {
    const chat = getSelectedChat();
    if (!chat) {
      showToast('Сначала выберите чат слева', true);
      scheduleEnabledInput.checked = !scheduleEnabledInput.checked;
      return;
    }
    if (syncingScheduleForm || scheduleSaveInFlight) return;

    const previousEnabled = chat.silence.schedule.enabled;
    scheduleSaveInFlight = true;
    setScheduleSaveStatus('Сохранение...', 'saving');

    try {
      const updated = await api(`/chats/${chat.id}/silence/config`, {
        method: 'PATCH',
        body: JSON.stringify({ schedule: getSchedulePayload() }),
      });
      updateChatInList(updated);
      onChatUpdated(updated);
      setScheduleSaveStatus(
        updated.silence.schedule.enabled ? '✓ Расписание включено' : '✓ Расписание выключено',
      );
      showToast(updated.silence.schedule.enabled ? 'Расписание включено' : 'Расписание выключено');
    } catch (error) {
      scheduleEnabledInput.checked = previousEnabled;
      setScheduleSaveStatus(error.message, 'error');
      showToast(error.message, true);
    } finally {
      scheduleSaveInFlight = false;
    }
  }

  function queueScheduleTimesSave() {
    if (syncingScheduleForm || scheduleSaveInFlight) return;
    window.clearTimeout(scheduleSaveTimer);
    scheduleSaveTimer = window.setTimeout(() => {
      void saveScheduleConfig();
    }, 400);
  }

  async function loadMeta(timezones) {
    scheduleTimezoneSelect.innerHTML = timezones
      .map((zone) => `<option value="${zone}">${zone}</option>`)
      .join('');
  }

  function init() {
    customDurationForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (customMinutesInput.disabled) return;
      const minutes = Number(customMinutesInput.value);
      if (!Number.isInteger(minutes) || minutes <= 0) {
        showToast('Введите количество минут', true);
        return;
      }
      await setSilence({ minutes });
      customMinutesInput.value = '';
    });

    disableSilenceBtn.addEventListener('click', () => {
      void setSilence({ enabled: false });
    });
    saveMessagesBtn.addEventListener('click', () => {
      void saveMessages();
    });
    openSuffixInput.addEventListener('input', () => autoResizeTextarea(openSuffixInput));
    closedSuffixInput.addEventListener('input', () => autoResizeTextarea(closedSuffixInput));

    scheduleEnabledInput.addEventListener('change', () => {
      void toggleScheduleEnabled();
    });
    scheduleWeekendsEnabledInput.addEventListener('change', () => {
      void saveScheduleConfig();
    });
    for (const select of scheduleTimeSelects) {
      select.addEventListener('change', queueScheduleTimesSave);
    }
    scheduleTimezoneSelect.addEventListener('change', queueScheduleTimesSave);
  }

  return {
    init,
    render,
    loadMeta,
    getTimeSelects: () => scheduleTimeSelects,
  };
}
