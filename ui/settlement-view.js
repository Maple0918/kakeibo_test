// ========================
// ui/settlement-view.js
// 清算通知バナー・履歴・サマリー（共通）
// ========================

import { currentUser } from "../core/app-state.js";
import { listAllSettlements, calcCurrentDiff } from "../services/settlements-service.js";

// 小ユーティリティ
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const formatJPY = (n) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" })
    .format(Number(n || 0))
    .replace("￥", "") + "円";
const decorateAB = (s = "") =>
  s.replaceAll("Aさん", "🟦Aさん").replaceAll("Bさん", "🟧Bさん");

// -------------------------
// ✅ 共通サマリー（ホーム＆清算、両方の .js-clearance-info を一括更新）
// -------------------------
export async function renderClearanceSummaryAll() {
  const targets = $$(".js-clearance-info");
  if (targets.length === 0) return;

  try {
    const { directionText, amount } = await calcCurrentDiff();
    const text =
      !amount || Number(amount) === 0
        ? "差額はありません"
        : `${decorateAB(directionText)} ${formatJPY(amount)}`;

    targets.forEach((el) => (el.textContent = text));
  } catch (err) {
    console.warn(err);
    targets.forEach((el) => (el.textContent = "サマリーの取得に失敗しました"));
  }
}

// （後方互換）ページ個別の文言レンダラは共通関数に委譲
export async function renderSettlementPageText() {
  await renderClearanceSummaryAll();
}

// -------------------------
// 清算通知バナー（ホーム上部）
// ※ 現行レイアウトでは非表示だが、DOMがあれば動作
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

    notice.textContent = `${pending.applicant}が申請: ${pending.directionText}に${formatJPY(pending.amount)} (${pending.status})`;

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
    notice.textContent = "清算情報の取得に失敗しました";
  }
}

// -------------------------
// 清算画面のボタン状態を切替（表示のみ。ハンドラは main.js 側で配線）
// -------------------------
export async function renderClearanceActions() {
  const applyBtn   = document.querySelector(".js-clearance-apply");
  const cancelBtn  = document.querySelector(".js-clearance-cancel");
  const approveBtn = document.querySelector(".js-clearance-approve2");
  const rejectBtn  = document.querySelector(".js-clearance-reject2");
  const stateText  = document.querySelector(".js-clearance-state");

  // ボタンが無い画面なら何もしない
  if (!applyBtn || !cancelBtn || !approveBtn || !rejectBtn) return;

  // いったん全部隠す／状態文言クリア
  applyBtn.hidden = true;
  cancelBtn.hidden = true;
  approveBtn.hidden = true;
  rejectBtn.hidden = true;
  if (stateText) stateText.textContent = "";

  try {
    const settlements = await listAllSettlements();
    const pending = settlements.find((s) => s.status === "申請中");

    if (!pending) {
      // 状態1：誰も申請していない → 申請するだけ表示
      applyBtn.hidden = false;
      if (stateText) stateText.textContent = "";
      return;
    }

    // 以降：申請中
    const iAmApplicant = pending.applicant === currentUser;

    if (iAmApplicant) {
      // 状態2：自分が申請中 → 取り消すを表示
      cancelBtn.hidden = false;
      if (stateText) stateText.textContent = "清算を申請中です。相手の承認を待っています。";
    } else {
      // 状態3：相手が申請中 → 承認/棄却を表示
      approveBtn.hidden = false;
      rejectBtn.hidden  = false;
      if (stateText) stateText.textContent = "清算申請を受けています。承認または棄却してください。";
    }
  } catch (e) {
    console.warn(e);
    if (stateText) stateText.textContent = "状態の取得に失敗しました";
  }
}

// -------------------------
// 清算履歴
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
    ul.innerHTML = '<li class="c-history-list__item">清算履歴の取得に失敗しました</li>';
  }
}