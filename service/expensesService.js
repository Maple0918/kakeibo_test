// ========================
// 支出ロジック
// ========================

import {
  createExpense,
  listExpenses,
  softDeleteExpense,
  updateExpense,
  getExpenseById,
} from "../repository/expensesRepository.js";
import {
  commitEntries,
  makeExpenseEntries,
  makeReversalEntries,
} from "./ledgerService.js";

// 一覧取得（UIは deleted を見て非表示にする）
export async function getAllExpenses() {
  return listExpenses();
}

// 新規支出：createdBy を必ず保存し、lastUpdated を現在時刻で設定して、等分仕訳を積む
export async function addExpense({ payer, amount, date, category, memo }) {
  const id = `exp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const exp = {
    id,
    payer,
    amount,
    date,                              // 支払いが生じた日付（ユーザ入力）
    category,
    memo,
    createdBy: payer,                  // 登録者（=当面は支払者と同一）
    lastUpdated: new Date().toISOString(), // 最終更新（登録時）
  };
  await createExpense(exp);
  await commitEntries(makeExpenseEntries({ refId: id, payer, total: amount }));
  return exp;
}

// 編集：既存データを読み込み、重要フィールド（createdBy/payer）を維持して更新
// その後、新しい内容で仕訳を積み直す（台帳方式の原則）
export async function editExpense(exp) {
  // 既存レコードを取得（見つからない場合はエラー）
  const existing = await getExpenseById(exp.id);
  if (!existing) throw new Error("編集対象の支出が見つかりません。");

  // createdBy と payer は既存を優先して固定（編集では変えない）
  const next = {
    ...existing,
    amount: exp.amount,
    date: exp.date,
    category: exp.category,
    memo: exp.memo,
    lastUpdated: new Date().toISOString(), // 編集のたびに更新
  };

  // 1) 逆仕訳で既存を相殺
  await commitEntries(await makeReversalEntries(existing.id));

  // 2) メタ（支出レコード）を更新（Repository 側はマージ更新）
  const saved = await updateExpense(next);

  // 3) 新しい内容で等分仕訳を追加（payer は existing を使用）
  await commitEntries(
    makeExpenseEntries({ refId: saved.id, payer: saved.payer, total: saved.amount })
  );

  return saved;
}

// 削除：逆仕訳で相殺 → 論理削除
export async function deleteExpense(expId) {
  await commitEntries(await makeReversalEntries(expId));
  await softDeleteExpense(expId);
  return true;
}