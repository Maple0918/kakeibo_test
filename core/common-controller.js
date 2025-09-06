// ========================
// core/controller-common.js
// 共通配線：ユーザ切替／ルーティング／支出フォーム／一覧・履歴／詳細フック
// ========================


import { currentUser, setCurrentUser, editingId, setEditingId } from "./app-state.js";
import { show } from "./router.js";

// View
import { renderExpensesTable } from "../ui/expenses-view.js";
import { renderSettlementHistory, renderClearanceSummaryAll } from "../ui/settlement-view.js";

// Service
import { addExpense, editExpense, deleteExpense } from "../services/expenses-service.js";

// 小ユーティリティ
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

// 外部からも使う（clearance 側から home を更新したい時など）
export async function refreshHome() {
  await renderExpensesTable();     // .js-expense-list
  await renderSettlementHistory(); // .js-clearance-history
}

export async function initCommon() {
  bindUserSwitcher();
  bindRoutes();
  bindEntryForm();
  bindEntryShortcuts();
  exposeDetailHook();

  // 初期表示（home）
  show("home");
  await renderClearanceSummaryAll(); // ホーム＆清算のサマリーを同期更新
  await refreshHome();
}

/* ---------------- private : binders ---------------- */

function bindUserSwitcher() {
  const userSelect = $("#current-user") || $(".js-current-user");
  ["Aさん", "Bさん"].forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u; opt.textContent = u;
    userSelect.appendChild(opt);
  });
  userSelect.value = currentUser;

  on(userSelect, "change", async () => {
    setCurrentUser(userSelect.value);
    const payerInput = $("#payer"); // 入力画面の支払者表示を同期
    if (payerInput) payerInput.value = userSelect.value;

    await renderClearanceSummaryAll();
    await refreshHome();
  });
}

function bindRoutes() {
  $$(".js-route").forEach((btn) => {
    on(btn, "click", async () => {
      const view = btn.getAttribute("data-view");
      show(view);

      if (view === "home") {
        await renderClearanceSummaryAll();
        await refreshHome();
      } else if (view === "entry") {
        const payerInput = $("#payer");
        if (payerInput) payerInput.value = currentUser;
      }
      // "clearance" は clearance controller 側で初期化
    });
  });
}

function bindEntryForm() {
  const form = $("#expense-form");
  const payerInputAtInit = $("#payer");
  if (payerInputAtInit) payerInputAtInit.value = currentUser;

  on(form, "submit", async (e) => {
    e.preventDefault();

    const payload = {
      id: editingId || undefined,
      payer: $("#payer").value,
      amount: Number($("#amount").value),
      date: $("#date").value,
      category: $("#category").value,
      memo: $("#memo").value,
    };

    // バリデーション（最小限）
    if (!Number.isFinite(payload.amount) || payload.amount <= 0) { $("#amount")?.focus(); return; }
    if (!payload.date) { $("#date")?.focus(); return; }
    if (!payload.category) { $(".js-cat")?.focus(); return; }

    try {
      if (editingId) { await editExpense(payload); setEditingId(null); }
      else { await addExpense(payload); }

      form.reset();
      $("#payer").value = currentUser;
      show("home");
      await renderClearanceSummaryAll();
      await refreshHome();
    } catch (err) {
      console.warn(err);
    }
  });

  // 詳細→編集の導線
  window.__editExpense = async (exp) => {
    setEditingId(exp.id);
    $("#payer").value = currentUser;
    $("#amount").value = exp.amount;
    $("#date").value = exp.date;
    $("#category").value = exp.category;
    $("#memo").value = exp.memo;
    show("entry");
  };

  // 削除（トースト等は任意でUI層に委譲）
  window.__deleteExpense = async (expId) => {
    await deleteExpense(expId);
    await renderClearanceSummaryAll();
    await refreshHome();
  };
}

function bindEntryShortcuts() {
  // 今日／昨日
  const btnToday = $(".js-date-today");
  const btnYesterday = $(".js-date-yesterday");
  const dateInput = $("#date");

  on(btnToday, "click", () => {
    if (!dateInput) return;
    const d = new Date();
    dateInput.value = d.toISOString().slice(0, 10);
  });

  on(btnYesterday, "click", () => {
    if (!dateInput) return;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    dateInput.value = d.toISOString().slice(0, 10);
  });

  // カテゴリ（チップ → hidden 値）
  const categoryHidden = $("#category");
  $$(".js-cat").forEach((chip) => {
    on(chip, "click", () => {
      $$(".js-cat").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      if (categoryHidden) categoryHidden.value = chip.getAttribute("data-cat") || "";
    });
  });
}

/* ---------------- private : detail hook ---------------- */

function exposeDetailHook() {
  if (typeof window.__showExpenseDetail === "function") return;

  const q = (s, r = document) => r.querySelector(s);
  const yen = (n) => new Intl.NumberFormat("ja-JP").format(Number(n || 0)) + "円";
  const catIcon = (cat = "") => ({ "食費":"🍔","交通":"🚃","日用品":"🛒","娯楽":"🎉","その他":"🗂" }[cat] || "💸");

  window.__showExpenseDetail = (exp) => {
    // 概要
    q(".js-detail-icon").textContent = catIcon(exp.category);
    q(".js-detail-category").textContent = exp.category ?? "-";
    q(".js-detail-amount").textContent = yen(exp.amount);
    // 詳細
    q(".js-detail-date").textContent = exp.date ?? "-";
    q(".js-detail-payer").textContent = exp.payer ?? "-";
    q(".js-detail-category2").textContent = exp.category ?? "-";
    q(".js-detail-amount2").textContent = yen(exp.amount);
    q(".js-detail-memo").textContent = exp.memo ?? "-";
    q(".js-detail-createdBy").textContent = exp.createdBy ?? "-";
    q(".js-detail-updated").textContent = exp.lastUpdated
      ? new Date(exp.lastUpdated).toLocaleString()
      : "-";
    show("detail");
  };
}