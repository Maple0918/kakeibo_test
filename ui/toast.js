// ========================
// ui/toast.js
// ガイドライン対応：上部中央/1件のみ/自動クローズ/クリックorEscで閉じる/aria-live="polite"
// ========================

let rootEl = null;
let timer = null;

function ensureRoot() {
  if (rootEl) return rootEl;
  const el = document.createElement("div");
  el.id = "js-toast";
  el.setAttribute("aria-live", "polite");
  el.setAttribute("role", "status");
  // 最小スタイル（CSSは後で外出し可能）
  Object.assign(el.style, {
    position: "fixed",
    top: "8px",
    left: "50%",
    transform: "translateX(-50%)",
    maxWidth: "min(92vw, 480px)",
    padding: "10px 14px",
    borderRadius: "10px",
    boxShadow: "0 6px 18px rgba(0,0,0,.15)",
    color: "#fff",
    fontSize: "14px",
    zIndex: "10000",
    opacity: "0",
    transition: "opacity 180ms ease",
    userSelect: "none",
    cursor: "pointer",
    display: "none",
  });
  el.addEventListener("click", () => toastHide(0));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") toastHide(0); });
  document.body.appendChild(el);
  rootEl = el;
  return el;
}

function bg(type) {
  if (type === "error") return "rgba(231,76,60,.95)";   // 赤
  if (type === "warn")  return "rgba(241,196,15,.95)";  // 黄
  return "rgba(46,204,113,.95)";                        // 緑
}

function toastShow(message, type = "success", ms) {
  const el = ensureRoot();
  clearTimeout(timer);
  const duration = typeof ms === "number"
    ? ms
    : type === "error" ? 3500
    : type === "warn"  ? 2800
    : 2000;

  el.textContent = message;
  el.style.background = bg(type);
  el.style.display = "block";
  requestAnimationFrame(() => { el.style.opacity = "1"; });

  timer = setTimeout(() => toastHide(180), duration);
}

function toastHide(fadeMs = 180) {
  const el = rootEl;
  if (!el || el.style.display === "none") return;
  clearTimeout(timer);
  el.style.transition = `opacity ${fadeMs}ms ease`;
  el.style.opacity = "0";
  setTimeout(() => { el.style.display = "none"; el.textContent = ""; }, fadeMs);
}

export const toast = {
  show: toastShow,
  success: (msg, ms) => toastShow(msg, "success", ms),
  warn:    (msg, ms) => toastShow(msg, "warn", ms),
  error:   (msg, ms) => toastShow(msg, "error", ms),
  hide: toastHide,
};