// ========================
// 清算通知バナー・履歴・申請画面の文言
// ========================

// ========================
// 清算通知バナー・履歴・申請画面の文言（UI層）
// ========================

import { currentUser } from "../core/app-state.js";
import { listAllSettlements, calcCurrentDiff } from "../service/settlementsService.js";

// 小ユーティリティ
const $ = (sel, root = document) => root.querySelector(sel);
const formatJPY = (n) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" })
    .format(Number(n || 0)).replace("￥", "") + "円";

// -------------------------
// ホーム上部の清算通知バナー
// -------------------------
export async function renderSettlementBanner() {
  const notice = $(".js-clearance-notice");
  const approveBtn = $(".js-clearance-approve");
  const rejectBtn = $(".js-clearance-reject");
  if (!notice) return;

  // 初期化
  notice.textContent = "現在清算はありません";
  if (approveBtn) approveBtn.disabled = true;
  if (rejectBtn) rejectBtn.disabled = true;

  try {
    const settlements = await listAllSettlements();
    const pending = settlements.find((s) => s.status === "申請中");
    if (!pending) return;

    // 文言
    notice.textContent = `${pending.applicant}が申請: ${pending.directionText}に${formatJPY(pending.amount)} (${pending.status})`;

    // 申請者以外のみ承認/却下可能
    const canAct = pending.applicant !== currentUser;
    if (approveBtn) {
      approveBtn.disabled = !canAct;
      if (canAct) approveBtn.onclick = () => window.__approveSettlement(pending.id);
    }
    if (rejectBtn) {
      rejectBtn.disabled = !canAct;
      if (canAct) rejectBtn.onclick = () => window.__rejectSettlement(pending.id);
    }
  } catch (err) {
    console.warn(err);
    if (notice) notice.textContent = "清算情報の取得に失敗しました";
  }
}

// -------------------------
// 清算履歴（読み物）
// -------------------------
export async function renderSettlementHistory() {
  const ul = $(".js-clearance-history");
  if (!ul) return;

  ul.innerHTML = "";
  try {
    const items = await listAllSettlements();
    const frag = document.createDocumentFragment();

    items.forEach((st) => {
      const li = document.createElement("li");
      li.className = "c-history-list__item";
      const when = st.date ? new Date(st.date).toLocaleString() : "-";
      li.textContent = `[${when}] ${st.applicant}が申請: ${st.directionText}に${formatJPY(st.amount)} (${st.status})`;
      frag.appendChild(li);
    });

    ul.appendChild(frag);
  } catch (err) {
    console.warn(err);
    ul.innerHTML = "<li class=\"c-history-list__item\">清算履歴の取得に失敗しました</li>";
  }
}

// -------------------------
// 清算申請ページの文言
// -------------------------
export async function renderSettlementPageText() {
  const p = $(".js-clearance-info");
  const loading = $(".js-clearance-loading");
  const error = $(".js-clearance-error");
  if (!p) return;

  // 状態：ロード開始
  if (loading) loading.hidden = false;
  if (error) error.hidden = true;

  try {
    const { directionText, amount } = await calcCurrentDiff();
    p.textContent = Number(amount) === 0
      ? "差額はありません。"
      : `${directionText} に ${formatJPY(amount)}`;
  } catch (err) {
    console.warn(err);
    if (error) error.hidden = false;
  } finally {
    if (loading) loading.hidden = true;
  }
}