// Small local icon set. No icon font or external assets.
const paths = {
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9l10-6Zm-10 10 10 6 10-6M2 17l10 6 10-6"/>',
  car: '<path d="m5 8 2-5h10l2 5M3 15V9l2-1h14l2 1v6H3Zm0 0v4h3v-4m12 0v4h3v-4M6 11h2m8 0h2"/>',
  truck: '<path d="M2 5h13v12H2V5Zm13 5h4l3 4v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  alert: '<path d="M10 4 2 18a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3L14 4a2 2 0 0 0-4 0Z"/><path d="M12 9v5m0 3v.1"/>',
  laptop: '<path d="M4 3h16v14H4V3ZM2 21h20l-2-4H4l-2 4Z"/>',
  chat: '<path d="M21 11a9 9 0 0 1-9 9H5l-4 3 2-7a9 9 0 1 1 18-5Z"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  reset: '<path d="M3 10a9 9 0 1 1 1 7M3 3v7h7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0"/>',
};
export function renderIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[el.dataset.icon] || paths.info}</svg>`;
  });
}
