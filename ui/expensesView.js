// ========================
// 支出一覧の描画（UI層）
// ========================

// ========================
// ui/expensesView.js
// 支出一覧の描画（UI層）
// - 清算「承認済み」までの支出は非表示（判定は lastUpdated を使用）
// - 清算申請中は編集/削除をロック
// - 編集/削除は「自分が登録したものだけ」
// ========================

import { getAllExpenses } from "../logic/expensesService.js";
import { listAllSettlements } from "../logic/settlementsService.js";
import { currentUser } from "../app/state.js";

// 支出テーブルを描画
export async function renderExpensesTable() {
  const tbody = document.getElementById("expense-list");
  const items = await getAllExpenses();
  const settlements = await listAllSettlements();

  const hasPending = settlements.some((s) => s.status === "申請中");

  // ✅ 最新の「承認済み」清算日時（これ以前に“最終更新”された支出は一覧に出さない）
  let lastApprovedAt = null;
  const approved = settlements.filter((s) => s.status === "承認済み");
  if (approved.length > 0) {
    lastApprovedAt = approved
      .map((s) => new Date(s.date))     // settlements の date は toLocaleString の文字列
      .reduce((a, b) => (a > b ? a : b)); // 最大（最新）を取得
  }

  tbody.innerHTML = "";
  items.forEach((exp) => {
    if (exp.deleted) return; // 論理削除は非表示

    // lastUpdated があればそれを採用、なければ互換のため date を使う
    const updatedAt = exp.lastUpdated ? new Date(exp.lastUpdated) : new Date(exp.date);

    // 承認済みの最終日時より前に「最終更新」された支出は非表示にする
    if (lastApprovedAt && updatedAt <= lastApprovedAt) return;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${exp.date}</td>
      <td>${exp.payer}</td>
      <td>${exp.category}</td>
      <td>${exp.amount}</td>
      <td>${exp.memo}</td>
      <td>${exp.createdBy}</td>
      <td class="actions"></td>
      <td>${exp.lastUpdated ? new Date(exp.lastUpdated).toLocaleString() : "-"}</td>
    `;

    const actions = tr.querySelector(".actions");
    if (hasPending) {
      // 清算申請中は編集/削除できない（UI表示のみのロック）
      actions.textContent = "申請中のため編集不可";
    } else if (exp.createdBy === currentUser) {
      // 自分が登録した支出だけ編集・削除可能
      const eBtn = document.createElement("button");
      eBtn.textContent = "編集";
      eBtn.onclick = () => window.__editExpense(exp);

      const dBtn = document.createElement("button");
      dBtn.textContent = "削除";
      dBtn.onclick = () => window.__deleteExpense(exp.id);

      actions.appendChild(eBtn);
      actions.appendChild(dBtn);
    } else {
      actions.textContent = "-";
    }

    tbody.appendChild(tr);
  });
}