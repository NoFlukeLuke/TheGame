// FIXED MENU SIZE (r407): the content zoom for the full-screen menus, from the
// viewport. 1 on a phone, rising to 1.4 on a 1080p desktop. See css/menu-size.css.
function syncMenuZoom() {
  const z = Math.max(1, Math.min(1.4, window.innerWidth / 1100, window.innerHeight / 660));
  document.documentElement.style.setProperty('--menu-z', z.toFixed(3));
}
syncMenuZoom();
window.addEventListener('resize', syncMenuZoom);
