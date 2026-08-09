export const TOKEN_KEY = 'max-moderator-admin-token';

/** @type {{ token: string | null; initData: string | null; miniAppMode: boolean; currentUser: { displayName?: string } | null; chats: any[]; selectedChatId: number | null; timezones: string[]; activeTab: 'silence' | 'autopost' | 'triggers' | 'logger' }} */
export const state = {
  token: localStorage.getItem(TOKEN_KEY),
  initData: null,
  miniAppMode: false,
  currentUser: null,
  chats: [],
  selectedChatId: null,
  timezones: [],
  activeTab: 'silence',
};

export function getSelectedChat() {
  return state.chats.find((item) => item.id === state.selectedChatId) ?? null;
}

export function updateChatInList(chat) {
  state.chats = state.chats.map((item) => (item.id === chat.id ? chat : item));
}
