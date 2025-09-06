// ========================
// core/controller-common.js
// 共通配線：ユーザ切替／ルーティング／支出フォーム／一覧・履歴／詳細フック
// ========================

import { currentUser, setCurrentUser, editingId, setEditingId } from "./app-state.js";
import { show } from "./router.js";

import { toast } from "../ui/toast.js";
import { initAmountNumpad } from "../ui/numpad.js";

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

        // ★日付のデフォルト＝今日（既に値があれば上書きしない）
        const dateEl = document.getElementById("date");
        if (dateEl && !dateEl.value) {
          dateEl.value = new Date().toISOString().slice(0, 10);
        }

        // 金額テンキーを遅延初期化（重複初期化でも安全な実装）
        initAmountNumpad();
      }
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
    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      toast.error("金額を入力してください");
      // hidden #amount ではなく可視要素にフォーカス誘導
      document.querySelector(".js-numpad .js-key[data-key]")?.focus()
        || document.getElementById("amount-display")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!payload.date) {
      toast.error("日付を入力してください");
      $("#date")?.focus(); return;
    }
    if (!payload.category) {
      toast.error("カテゴリを選択してください");
      $(".js-cat")?.focus(); return;
    }

    try {
      if (editingId) { await editExpense(payload); setEditingId(null); }
      else { await addExpense(payload); }
      toast.success("保存しました");

      form.reset();
      $("#payer").value = currentUser;
      show("home");
      await renderClearanceSummaryAll();
      await refreshHome();
    } catch (err) {
      console.warn(err);
      toast.error(err?.message || "保存に失敗しました");
    }
  });

  // 詳細→編集の導線
  window.__editExpense = async (exp) => {
    setEditingId(exp.id);
    // ★編集では実データの支払者を表示（ドメイン仕様に合わせる）
    $("#payer").value = exp.payer;

    $("#amount").value = exp.amount;
    $("#date").value = exp.date;
    $("#category").value = exp.category;
    $("#memo").value = exp.memo;

    // カテゴリの見た目を同期（チップに .is-active を付け直す）
    const cat = exp.category;
    document.querySelectorAll(".js-cat").forEach((c) => {
      c.classList.toggle("is-active", c.getAttribute("data-cat") === cat);
    });

    show("entry");
    // テンキー初期化（重複安全）＆表示の同期
    initAmountNumpad();
    document.querySelector(".js-numpad")?.__numpadSync?.();
  };

  // 削除（トースト等は任意でUI層に委譲）
  window.__deleteExpense = async (expId) => {
    await deleteExpense(expId);
    await renderClearanceSummaryAll();
    await refreshHome();
    toast.success("削除しました");
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
    // 詳細
    q(".js-detail-date")  .textContent = exp.date ?? "-";
    q(".js-detail-payer") .textContent = exp.payer ?? "-";
    q(".js-detail-category2").textContent = exp.category ?? "-";
    q(".js-detail-amount2")  .textContent = yen(exp.amount);
    q(".js-detail-memo")     .textContent = exp.memo ?? "-";
    q(".js-detail-createdBy").textContent = exp.createdBy ?? "-";
    q(".js-detail-updated")  .textContent = exp.lastUpdated
      ? new Date(exp.lastUpdated).toLocaleString()
      : "-";

    show("detail");

    // ★編集・削除ボタン配線（このタイミングでDOMが存在）
    const editBtn = q(".js-detail-edit");
    const delBtn  = q(".js-detail-delete");

    if (editBtn) {
      editBtn.onclick = () => window.__editExpense?.(exp);
    }
    if (delBtn) {
      delBtn.onclick = async () => {
        const ok = confirm("この支出を削除しますか？");
        if (!ok) return;
        try {
          await window.__deleteExpense?.(exp.id);
          toast?.success?.("削除しました");
          show("home");
          await renderClearanceSummaryAll?.();
          await refreshHome?.();
        } catch (e) {
          console.warn(e);
          toast?.error?.("削除に失敗しました");
        }
      };
    }
  };
}