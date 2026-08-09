import { state, TOKEN_KEY } from './state.js';

export function getAuthHeaders() {
  if (state.miniAppMode && state.initData) {
    return { Authorization: `tma ${state.initData}` };
  }
  return { Authorization: `Bearer ${state.token}` };
}

/** @type {(onLogout: () => void) => Promise<any>} */
export function createApi(onLogout) {
  return async function api(path, options = {}) {
    const response = await fetch(`/api/v1${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...(options.headers ?? {}),
      },
    });

    if (response.status === 401) {
      onLogout();
      throw new Error('Сессия истекла, войдите снова');
    }

    const data = await response.json().catch(() => ({}));
    if (response.status === 503 && data.error === 'Web admin auth is not configured') {
      throw new Error('Токеновый вход отключён на сервере. Откройте админку из MAX.');
    }

    if (!response.ok) {
      throw new Error(data.error ?? 'Ошибка запроса');
    }

    return data;
  };
}

export function persistToken(token) {
  state.token = token;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  state.token = null;
  localStorage.removeItem(TOKEN_KEY);
}
