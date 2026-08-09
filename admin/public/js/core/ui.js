export function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function formatZonedDateTime(timestamp, timezone) {
  return new Date(timestamp).toLocaleString('ru-RU', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatSilence(chat) {
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

export function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function buildHourMinuteOptions() {
  const hours = Array.from({ length: 24 }, (_, hour) => {
    const value = String(hour).padStart(2, '0');
    return `<option value="${value}">${value}</option>`;
  }).join('');
  const minutes = Array.from({ length: 60 }, (_, minute) => {
    const value = String(minute).padStart(2, '0');
    return `<option value="${value}">${value}</option>`;
  }).join('');
  return { hours, minutes };
}

export function fillTimeSelects(selects, { hours, minutes }) {
  for (const select of selects) {
    if (select.id.includes('hour') || select.getAttribute('aria-label')?.includes('Час')) {
      select.innerHTML = hours;
    } else {
      select.innerHTML = minutes;
    }
  }
}

export function createToast(toastEl) {
  return function showToast(message, isError = false) {
    toastEl.textContent = message;
    toastEl.classList.toggle('error', isError);
    toastEl.classList.remove('hidden');

    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 3200);
  };
}
