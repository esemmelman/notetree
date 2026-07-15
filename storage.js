(function () {
  'use strict';

  const STORAGE_KEY = 'notetree_pages_v1';

  function isPage(value) {
    return value && typeof value === 'object' && typeof value.id === 'string';
  }

  class LocalPageStore {
    loadPages() {
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(stored) ? stored.filter(isPage) : [];
      } catch (error) {
        console.error('NoteTree could not read its local data.', error);
        return [];
      }
    }

    savePages(pages) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
    }
  }

  window.NoteTreeStorage = Object.freeze({
    createLocalStore: () => new LocalPageStore()
  });
})();
