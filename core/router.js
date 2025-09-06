// ========================
// 画面切り替えの超シンプル実装
// ========================

export function show(viewName) {
  document.querySelectorAll(".js-view").forEach((s) => {
    const isTarget = s.dataset.view === viewName;
    s.classList.toggle("is-active", isTarget);
    s.hidden = !isTarget;
  });

  document.querySelectorAll(".js-route").forEach((btn) => {
    const isActive = btn.dataset.view === viewName;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-current", isActive ? "page" : "false");
  });
}