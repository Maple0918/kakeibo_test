// ========================
// 台帳ロジック
// ========================

import { appendEntries, listEntries } from "../repositories/ledger-repository.js";

// ユーザごとの合計
export async function sumByUser() {
  const entries = await listEntries();
  return entries.reduce((acc, e) => {
    acc[e.user] = (acc[e.user] || 0) + e.delta;
    return acc;
  }, { "Aさん": 0, "Bさん": 0 });
}

// 支出仕訳（2人等分）
export function makeExpenseEntries({ refId, payer, total }) {
  // 端数は「支払者」に寄せる
  const halfDown = Math.floor(total / 2);          // 相手側（切り捨て）
  const payerPortion = total - halfDown;           // 支払者側（端数含む）
  const other = payer === "Aさん" ? "Bさん" : "Aさん";
  const ts = Date.now();
  return [
    { id: `le_${ts}_1`, user: payer, delta: +payerPortion, kind: "expense", refId, ts },
    { id: `le_${ts}_2`, user: other, delta: -halfDown,     kind: "expense", refId, ts },
  ];
}

// 逆仕訳（編集・削除時に使用）
export async function makeReversalEntries(refId) {
  const entries = await listEntries();
  const ts = Date.now();
  const targets = entries.filter(e => e.refId === refId && (e.kind === "expense" || e.kind === "reversal"));
  return targets.map((e, i) => ({
    id: `rv_${ts}_${i}`,
    user: e.user,
    delta: -e.delta,
    kind: "reversal",
    refId,
    ts
  }));
}

// 清算承認仕訳
export function makeSettlementEntries({ settlementId, directionText, amount }) {
  const [from, , to] = directionText.split(" ");
  const ts = Date.now();
  return [
    { id: `stl_${ts}_to`,   user: to,   delta: -amount, kind: "settlement", refId: settlementId, ts },
    { id: `stl_${ts}_from`, user: from, delta: +amount, kind: "settlement", refId: settlementId, ts },
  ];
}

// 台帳に仕訳を追加
export async function commitEntries(entries) {
  return appendEntries(entries);
}