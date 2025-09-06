// ========================
// ui/expenses-view.js
// 支出一覧（4列：カテゴリ / 金額 / 日付 / 支払者）
// - 承認済み清算の最新日時より前に「最終更新」された支出は非表示
// - 論理削除は非表示
// - 最大10件表示
// - 行クリックで詳細へ（window.__showExpenseDetail があれば）
// ========================

import { getAllExpenses } from "../services/expenses-service.js";
import { listAllSettlements } from "../services/settlements-service.js";

const $ = (sel, root = document) => root.querySelector(sel);

function showState({ loading = false, error = false, empty = false }) {
  const elLoading = $(".js-expense-loading");
  const elError = $(".js-expense-error");
  const elEmpty = $(".js-expense-empty");
  if (elLoading) elLoading.hidden = !loading;
  if (elError) elError.hidden = !error;
  if (elEmpty) elEmpty.hidden = !empty;
}

export async function renderExpensesTable() {
  const tbody = $(".js-expense-list");
  if (!tbody) {
    console.warn("[expensesView] .js-expense-list が見つかりません");
    return;
  }

  // 初期化
  tbody.innerHTML = "";
  showState({ loading: true, error: false, empty: false });

  try {
    const [items, settlements] = await Promise.all([
      getAllExpenses(),
      listAllSettlements(),
    ]);

    // 最新の「承認済み」清算日時（これ以前の最終更新は非表示）
    let lastApprovedAt = null;
    const approved = (settlements || []).filter((s) => s.status === "承認済み");
    if (approved.length > 0) {
      lastApprovedAt = approved
        .map((s) => new Date(s.date))
        .reduce((a, b) => (a > b ? a : b));
    }

    // 可視データ抽出
    const visible = [];
    for (const exp of items || []) {
      if (exp.deleted) continue;
      const updatedAt = exp.lastUpdated ? new Date(exp.lastUpdated) : new Date(exp.date);
      if (lastApprovedAt && updatedAt <= lastApprovedAt) continue;
      visible.push(exp);
    }

    if (visible.length === 0) {
      showState({ loading: false, error: false, empty: true });
      return;
    }

    // 最大10件・4列で描画（カテゴリ / 金額 / 日付 / 支払者）
    const frag = document.createDocumentFragment();
    visible.slice(0, 10).forEach((exp) => {
      const tr = document.createElement("tr");
      tr.className = "c-expense-table__row";

      const td = (text) => {
        const cell = document.createElement("td");
        cell.className = "c-expense-table__cell";
        cell.textContent = text;
        return cell;
      };

      const fmtJPY = (n) => new Intl.NumberFormat("ja-JP").format(Number(n || 0)) + "円";

      tr.appendChild(td(exp.category ?? "-"));          // カテゴリ
      tr.appendChild(td(fmtJPY(exp.amount)));           // 金額（フォーマット適用）
      tr.appendChild(td(exp.date ?? "-"));              // 日付
      tr.appendChild(td(exp.payer ?? "-"));             // 支払者

      // 行クリック → 詳細へ（任意）
      if (typeof window.__showExpenseDetail === "function") {
        tr.style.cursor = "pointer";
        tr.addEventListener("click", () => window.__showExpenseDetail(exp));
      }

      frag.appendChild(tr);
    });

    tbody.appendChild(frag);
    showState({ loading: false, error: false, empty: false });
  } catch (err) {
    console.warn(err);
    showState({ loading: false, error: true, empty: false });
  }
}