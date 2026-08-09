import { clearToken, createApi, persistToken } from './core/api.js';
import { state } from './core/state.js';
import { createTabs } from './core/tabs.js';
import { buildHourMinuteOptions, createToast, escapeHtml, fillTimeSelects, formatSilence } from './core/ui.js';
import { createAutopostModule } from './modules/autopost/index.js';
import { createDeletionLogModule } from './modules/deletion-log/index.js';
import { createSilenceModule } from './modules/silence/index.js';
import { createTriggersModule } from './modules/triggers/index.js';

export function createShell() {
  const loadingScreen = document.getElementById('loading-screen');
  const loginScreen = document.getElementById('login-screen');
  const mainScreen = document.getElementById('main-screen');
  const loginForm = document.getElementById('login-form');
  const tokenInput = document.getElementById('token-input');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const userInfo = document.getElementById('user-info');
  const syncBtn = document.getElementById('sync-btn');
  const chatList = document.getElementById('chat-list');
  const chatListEmpty = document.getElementById('chat-list-empty');
  const chatCount = document.getElementById('chat-count');
  const chatPanel = document.getElementById('chat-panel');
  const emptyPanel = document.getElementById('empty-panel');
  const panelTitle = document.getElementById('panel-title');
  const panelSubtitle = document.getElementById('panel-subtitle');
  const toast = document.getElementById('toast');
  const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
  const tabPanels = {
    silence: document.getElementById('tab-silence'),
    autopost: document.getElementById('tab-autopost'),
    triggers: document.getElementById('tab-triggers'),
    logger: document.getElementById('tab-logger'),
  };

  const showToast = createToast(toast);

  function logout() {
    if (state.miniAppMode) {
      window.WebApp?.close?.();
      return;
    }

    clearToken();
    state.selectedChatId = null;
    state.chats = [];
    showLogin();
  }

  const api = createApi(logout);

  function onChatUpdated(chat) {
    renderChatList();
    renderSelectedChat(chat);
  }

  const silenceModule = createSilenceModule({ api, showToast, onChatUpdated });
  const autopostModule = createAutopostModule({ api, showToast });
  const triggersModule = createTriggersModule({ api, showToast });
  const deletionLogModule = createDeletionLogModule({ api, showToast });

  function showLoading() {
    loadingScreen.classList.remove('hidden');
    loginScreen.classList.add('hidden');
    mainScreen.classList.add('hidden');
  }

  function showLogin() {
    loadingScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    mainScreen.classList.add('hidden');
  }

  function showMain() {
    loadingScreen.classList.add('hidden');
    loginScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    logoutBtn.classList.toggle('hidden', state.miniAppMode);

    if (state.miniAppMode && state.currentUser?.displayName) {
      userInfo.textContent = `Вы вошли как ${state.currentUser.displayName}`;
      userInfo.classList.remove('hidden');
    } else {
      userInfo.classList.add('hidden');
      userInfo.textContent = '';
    }
  }

  function renderChatList() {
    chatList.innerHTML = '';
    chatCount.textContent = String(state.chats.length);
    chatListEmpty.classList.toggle('hidden', state.chats.length > 0);

    for (const chat of state.chats) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `chat-item${chat.id === state.selectedChatId ? ' active' : ''}`;
      button.innerHTML = `
        <div class="chat-item-title">${escapeHtml(chat.title ?? `Чат #${chat.id}`)}</div>
        <div class="chat-item-meta">${formatSilence(chat)}</div>
      `;
      button.addEventListener('click', () => {
        void selectChat(chat.id);
      });
      chatList.appendChild(button);
    }
  }

  function renderSelectedChat(chat = state.chats.find((item) => item.id === state.selectedChatId)) {
    if (!chat) {
      chatPanel.classList.add('hidden');
      emptyPanel.classList.remove('hidden');
      return;
    }

    chatPanel.classList.remove('hidden');
    emptyPanel.classList.add('hidden');
    panelTitle.textContent = chat.title ?? `Чат #${chat.id}`;
    panelSubtitle.textContent = `ID: ${chat.id}`;
    silenceModule.render(chat);
  }

  async function loadMeta() {
    const { hours, minutes } = buildHourMinuteOptions();
    fillTimeSelects(
      [...silenceModule.getTimeSelects(), ...autopostModule.getTimeSelects()],
      { hours, minutes },
    );

    const data = await api('/meta');
    state.timezones = data.timezones ?? [];
    await silenceModule.loadMeta(state.timezones);
    autopostModule.loadMeta(state.timezones);
  }

  async function loadChats() {
    const data = await api('/chats');
    state.chats = data.chats ?? [];
    renderChatList();
    renderSelectedChat();
  }

  async function selectChat(chatId) {
    state.selectedChatId = chatId;
    renderChatList();
    renderSelectedChat();
    autopostModule.reset();
    triggersModule.reset();
    await Promise.all([autopostModule.load(), triggersModule.load(), deletionLogModule.load()]);
  }

  async function syncChats() {
    syncBtn.disabled = true;
    try {
      const data = await api('/chats/sync', { method: 'POST' });
      state.chats = data.chats ?? [];
      renderChatList();
      renderSelectedChat();
      showToast(`Синхронизировано чатов: ${data.synced ?? 0}`);
    } catch (error) {
      showToast(error.message, true);
    } finally {
      syncBtn.disabled = false;
    }
  }

  async function loadProfile() {
    try {
      const data = await api('/me');
      if (data.user) {
        state.currentUser = data.user;
      }
    } catch {
      state.currentUser = null;
    }
  }

  const { setActiveTab } = createTabs({
    tabButtons,
    tabPanels,
    onChange: (tab) => {
      if (tab === 'logger') {
        void deletionLogModule.load().catch((error) => showToast(error.message, true));
      }
    },
  });

  async function bootstrap() {
    const webApp = window.WebApp;
    if (webApp?.initData) {
      state.miniAppMode = true;
      state.initData = webApp.initData;
      showLoading();
      webApp.ready?.();
      webApp.expand?.();

      try {
        await api('/health');
        await loadProfile();
        showMain();
        try {
          await Promise.all([loadMeta(), loadChats()]);
        } catch (loadError) {
          showToast(
            loadError instanceof Error
              ? loadError.message
              : 'Не удалось загрузить данные чатов',
            true,
          );
        }
      } catch (error) {
        showLogin();
        loginError.textContent =
          error instanceof Error
            ? error.message
            : 'Не удалось войти через MAX. Откройте админку из бота.';
        loginError.classList.remove('hidden');
      }
      return;
    }

    if (!state.token) {
      showLogin();
      return;
    }

    try {
      await api('/health');
      showMain();
      await Promise.all([loadMeta(), loadChats()]);
    } catch {
      logout();
    }
  }

  function init() {
    silenceModule.init();
    autopostModule.init();
    triggersModule.init();
    deletionLogModule.init();
    setActiveTab('silence');

    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      loginError.classList.add('hidden');

      const token = tokenInput.value.trim();
      if (!token) return;

      try {
        persistToken(token);
        await api('/health');
        showMain();
        await Promise.all([loadMeta(), loadChats()]);
      } catch (error) {
        clearToken();
        loginError.textContent = error.message;
        loginError.classList.remove('hidden');
      }
    });

    logoutBtn.addEventListener('click', logout);
    syncBtn.addEventListener('click', () => {
      void syncChats();
    });
  }

  return { init, bootstrap };
}
