// ========================
// DB層：支出
// 今は配列、将来はAPIに置換
// ========================

const USE_API = false;

// in-memory の配列（モック）
// 形：{id, payer, amount, date, category, memo, createdBy, deleted?:true}
let _expenses = [];

// 一覧取得
export async function listExpenses() {
  if (!USE_API) return [..._expenses];

  // --- API化例 ---
  // const res = await fetch("/api/expenses", { credentials: "include" });
  // return await res.json();
}

// 1件取得（編集時に既存データを読むために使用）
export async function getExpenseById(id) {
  if (!USE_API) return _expenses.find(x => x.id === id) || null;

  // --- API化例 ---
  // const res = await fetch(`/api/expenses/${id}`, { credentials: "include" });
  // if (!res.ok) return null;
  // return await res.json();
}

// 作成
export async function createExpense(exp) {
  if (!USE_API) {
    _expenses.push(exp);
    return exp;
  }

  // --- API化例 ---
  // const res = await fetch("/api/expenses", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   credentials: "include",
  //   body: JSON.stringify(exp),
  // });
  // return await res.json();
}

// 更新（マージ更新：既存を温存しつつ、渡されたフィールドだけ上書き）←★今回修正
export async function updateExpense(exp) {
  if (!USE_API) {
    const idx = _expenses.findIndex(x => x.id === exp.id);
    if (idx >= 0) {
      _expenses[idx] = { ..._expenses[idx], ...exp };
      return _expenses[idx];
    }
    return exp; // 想定外（見つからない）だが、呼び出し側で保険的に扱う
  }

  // --- API化例（PUT 全置換 or PATCH 部分更新を選択）---
  // const res = await fetch(`/api/expenses/${exp.id}`, {
  //   method: "PUT",
  //   headers: { "Content-Type": "application/json" },
  //   credentials: "include",
  //   body: JSON.stringify(exp),
  // });
  // return await res.json();
}

// 論理削除（deleted: true を付ける）
export async function softDeleteExpense(expId) {
  if (!USE_API) {
    const idx = _expenses.findIndex(x => x.id === expId);
    if (idx >= 0) _expenses[idx] = { ..._expenses[idx], deleted: true };
    return true;
  }

  // --- API化例 ---
  // await fetch(`/api/expenses/${expId}`, {
  //   method: "DELETE",
  //   credentials: "include",
  // });
  // return true;
}