// ========================
// 清算ロジック
// ========================

import { listSettlements, createSettlement, updateSettlementStatus } from "../repositories/settlements-repository.js";
import { sumByUser, commitEntries, makeSettlementEntries } from "./ledger-service.js";

export async function calcCurrentDiff() {
  const s = await sumByUser();
  const a = s["Aさん"];
  if (a === 0) return { directionText: "", amount: 0 };
  if (a > 0) return { directionText: "Bさん → Aさん", amount: a };
  return { directionText: "Aさん → Bさん", amount: Math.abs(a) };
}

export async function requestSettlement(applicant) {
  const list = await listSettlements();
  if (list.find(s => s.status === "申請中")) throw new Error("すでに申請中の清算があります。");

  const { directionText, amount } = await calcCurrentDiff();
  if (amount === 0) throw new Error("差額がないため清算不要です。");

  const st = {
    id: `st_${Date.now()}`,
    applicant,
    directionText,
    amount,
    status: "申請中",
    date: new Date().toISOString()
  };
  await createSettlement(st);
  return st;
}

export async function approveSettlement(id) {
  const list = await listSettlements();
  const st = list.find(x => x.id === id);
  if (!st) throw new Error("not found");
  if (st.status !== "申請中") return st;

  await commitEntries(makeSettlementEntries({ settlementId: st.id, directionText: st.directionText, amount: st.amount }));
  return updateSettlementStatus(id, "承認済み");
}

export async function rejectSettlement(id) {
  const list = await listSettlements();
  const st = list.find(x => x.id === id);
  if (!st) throw new Error("not found");
  if (st.status !== "申請中") return st;
  return updateSettlementStatus(id, "却下");
}

export async function listAllSettlements() {
  return listSettlements();
}