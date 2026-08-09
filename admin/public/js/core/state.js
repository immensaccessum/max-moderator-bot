/** @type {{ initData: string | null; miniAppMode: boolean; currentUser: { displayName?: string } | null; chats: any[]; selectedChatId: number | null; timezones: string[]; activeTab: 'silence' | 'autopost' | 'rss' | 'triggers' | 'logger' }} */
export const state = {
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
