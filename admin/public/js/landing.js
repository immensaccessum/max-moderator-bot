const REFRESH_MS = 60_000;

function formatNumber(value) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function formatCheckedAt(timestamp) {
  return new Date(timestamp).toLocaleString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function createLanding() {
  const landingScreen = document.getElementById('landing-screen');
  const statusDot = document.getElementById('landing-status-dot');
  const statusText = document.getElementById('landing-status-text');
  const versionEl = document.getElementById('landing-version');
  const uptimeEl = document.getElementById('landing-uptime');
  const checkedAtEl = document.getElementById('landing-checked-at');
  const statChats = document.getElementById('stat-chats');
  const statSilence = document.getElementById('stat-silence');
  const statRss = document.getElementById('stat-rss');
  const statTriggers = document.getElementById('stat-triggers');
  const statAutoposts = document.getElementById('stat-autoposts');

  /** @type {ReturnType<typeof setInterval> | null} */
  let refreshTimer = null;

  function renderStats(data) {
    statusDot.classList.toggle('is-online', data.status === 'ok');
    statusText.textContent = data.status === 'ok' ? 'Бот работает' : 'Нет связи';
    versionEl.textContent = `v${data.version}`;
    uptimeEl.textContent = data.uptimeLabel;
    checkedAtEl.textContent = `Обновлено в ${formatCheckedAt(data.checkedAt)}`;

    statChats.textContent = formatNumber(data.stats.chats);
    statSilence.textContent = formatNumber(data.stats.silenceActive);
    statRss.textContent = formatNumber(data.stats.rssFeeds);
    statTriggers.textContent = formatNumber(data.stats.triggers);
    statAutoposts.textContent = formatNumber(data.stats.autoposts);
  }

  async function loadStats() {
    try {
      const response = await fetch('/api/public/status');
      if (!response.ok) {
        throw new Error('status failed');
      }
      const data = await response.json();
      renderStats(data);
    } catch {
      statusDot.classList.remove('is-online');
      statusText.textContent = 'Не удалось получить статус';
      checkedAtEl.textContent = 'Повторим через минуту';
    }
  }

  function show() {
    landingScreen.classList.remove('hidden');
    void loadStats();
    refreshTimer = setInterval(() => {
      void loadStats();
    }, REFRESH_MS);
  }

  function hide() {
    landingScreen.classList.add('hidden');
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  return { show, hide, loadStats };
}
