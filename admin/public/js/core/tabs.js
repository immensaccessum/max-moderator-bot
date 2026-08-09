import { state } from './state.js';

export function createTabs({ tabButtons, tabPanels, onChange }) {
  function setActiveTab(tab) {
    if (tab !== 'silence' && tab !== 'autopost' && tab !== 'rss' && tab !== 'triggers' && tab !== 'logger') {
      return;
    }

    state.activeTab = tab;

    for (const button of tabButtons) {
      const isActive = button.dataset.tab === tab;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }

    for (const [name, panel] of Object.entries(tabPanels)) {
      panel.classList.toggle('hidden', name !== tab);
    }

    onChange?.(tab);
  }

  for (const button of tabButtons) {
    button.addEventListener('click', () => {
      setActiveTab(button.dataset.tab);
    });
  }

  return { setActiveTab };
}
