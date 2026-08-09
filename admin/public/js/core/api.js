import { state } from './state.js';

export function getAuthHeaders() {
  if (!state.initData) {
    return {};
  }

  return { Authorization: `tma ${state.initData}` };
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
      throw new Error('Сессия истекла, откройте настройки снова из Max');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error ?? 'Ошибка запроса');
    }

    return data;
  };
}
