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
// ========================
// ui/expensesView.js
// 支出一覧の描画（UI層）
// - 承認済み清算の最新日時より前に「最終更新」された支出は非表示
// - 清算申請中は編集/削除をロック
// - 編集/削除は「自分が登録したものだけ」
// ========================

import { getAllExpenses } from "../service/expensesService.js";
import { listAllSettlements } from "../service/settlementsService.js";
import { currentUser } from "../core/app-state.js";

// 小ユーティリティ
const $ = (sel, root = document) => root.querySelector(sel);

function showState({ loading = false, error = false, empty = false }) {
  const elLoading = $(".js-expense-loading");
  const elError = $(".js-expense-error");
  const elEmpty = $(".js-expense-empty");
  if (elLoading) elLoading.hidden = !loading;
  if (elError) elError.hidden = !error;
  if (elEmpty) elEmpty.hidden = !empty;
}

// 支出テーブルを描画
export async function renderExpensesTable() {
  const tbody = $(".js-expense-list");
  if (!tbody) {
    console.warn("[expensesView] .js-expense-list が見つかりません");
    return;
  }

  // 初期状態：ローディングON
  showState({ loading: true, error: false, empty: false });
  tbody.innerHTML = "";

  try {
    const [items, settlements] = await Promise.all([
      getAllExpenses(),
      listAllSettlements(),
    ]);

    const hasPending = settlements.some((s) => s.status === "申請中");

    // ✅ 最新の「承認済み」清算日時
    let lastApprovedAt = null;
    const approved = settlements.filter((s) => s.status === "承認済み");
    if (approved.length > 0) {
      lastApprovedAt = approved
        .map((s) => new Date(s.date)) // settlements の date は toLocaleString の文字列想定
        .reduce((a, b) => (a > b ? a : b));
    }

    // フィルタ＆描画
    const visible = [];
    items.forEach((exp) => {
      if (exp.deleted) return; // 論理削除は非表示

      // lastUpdated があれば採用、なければ互換のため date を使う
      const updatedAt = exp.lastUpdated ? new Date(exp.lastUpdated) : new Date(exp.date);

      // 承認済みの最終日時より前に「最終更新」された支出は非表示
      if (lastApprovedAt && updatedAt <= lastApprovedAt) return;

      visible.push(exp);
    });

    if (visible.length === 0) {
      showState({ loading: false, error: false, empty: true });
      return;
    }

    // 行を構築（BEMクラス）
    const frag = document.createDocumentFragment();
    visible.forEach((exp) => {
      const tr = document.createElement("tr");
      tr.className = "c-expense-table__row";

      const td = (html) => {
        const cell = document.createElement("td");
        cell.className = "c-expense-table__cell";
        cell.innerHTML = html;
        return cell;
      };

      tr.appendChild(td(`${exp.date}`));
      tr.appendChild(td(`${exp.payer}`));
      tr.appendChild(td(`${exp.category}`));
      tr.appendChild(td(`${exp.amount}`));
      tr.appendChild(td(`${exp.memo ?? ""}`));
      tr.appendChild(td(`${exp.createdBy}`));

      // 操作列
      const actionsCell = td("");
      actionsCell.classList.add("c-expense-table__cell--actions");

      if (hasPending) {
        actionsCell.textContent = "申請中のため編集不可";
      } else if (exp.createdBy === currentUser) {
        const eBtn = document.createElement("button");
        eBtn.className = "c-button";
        eBtn.textContent = "編集";
        eBtn.addEventListener("click", () => window.__editExpense(exp));

        const dBtn = document.createElement("button");
        dBtn.className = "c-button";
        dBtn.textContent = "削除";
        dBtn.addEventListener("click", () => window.__deleteExpense(exp.id));

        actionsCell.appendChild(eBtn);
        actionsCell.appendChild(dBtn);
      } else {
        actionsCell.textContent = "-";
      }
      tr.appendChild(actionsCell);

      // 最終更新
      const updatedLabel = exp.lastUpdated
        ? new Date(exp.lastUpdated).toLocaleString()
        : "-";
      tr.appendChild(td(updatedLabel));

      frag.appendChild(tr);
    });

    tbody.appendChild(frag);
    showState({ loading: false, error: false, empty: false });
  } catch (err) {
    console.warn(err);
    // エラー表示
    showState({ loading: false, error: true, empty: false });
  }
}