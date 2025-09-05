// ========================
// 清算通知バナー・履歴・申請画面の文言
// ========================

import { currentUser } from "../app/state.js";
import { listAllSettlements, calcCurrentDiff } from "../logic/settlementsService.js";

// ホーム上部のバナー
export async function renderSettlementBanner() {
  const msg = document.getElementById("settlement-msg");
  const settlements = await listAllSettlements();
  const pending = settlements.find(s => s.status === "申請中");
  if (!pending) {
    msg.textContent = "現在清算はありません";
    return;
  }
  msg.textContent = `${pending.applicant}が申請: ${pending.directionText}に${pending.amount}円 (${pending.status}) `;
  if (pending.applicant !== currentUser) {
    const ok = document.createElement("button");
    ok.textContent = "承認";
    ok.onclick = () => window.__approveSettlement(pending.id);
    const ng = document.createElement("button");
    ng.textContent = "却下";
    ng.onclick = () => window.__rejectSettlement(pending.id);
    msg.appendChild(ok);
    msg.appendChild(ng);
  }
}

// 清算履歴
export async function renderSettlementHistory() {
  const ul = document.getElementById("settlement-history");
  const items = await listAllSettlements();
  ul.innerHTML = items
    .map(st => {
      // ISOで保存された日付を、表示時だけローカライズ
      const when = st.date ? new Date(st.date).toLocaleString() : "-";
      return `<li>[${when}] ${st.applicant}が申請: ${st.directionText}に${st.amount}円 (${st.status})</li>`;
    })
    .join("");
  }

// 清算申請画面の文言
export async function renderSettlementPageText() {
  const p = document.getElementById("settlement-info");
  const { directionText, amount } = await calcCurrentDiff();
  p.textContent = amount === 0 ? "差額はありません。" : `${directionText} に ${amount}円`;
}