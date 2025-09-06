// ========================
// アプリの起動＆配線：UIとロジックをつなぐ（BEM/js-*対応）
// ========================

// UI状態（現在ユーザ／編集中ID）
import { currentUser, setCurrentUser, editingId, setEditingId } from "./app-state.js";
// 画面切替（新HTML: .js-view / .js-route 対応）
import { show } from "./router.js";

// UI描画（View）
import { renderExpensesTable } from "../ui/expensesView.js";
import {
  renderSettlementBanner,
  renderSettlementHistory,
  renderSettlementPageText,
} from "../ui/settlementView.js";

// ロジック（Service）
import { addExpense, editExpense, deleteExpense } from "../service/expensesService.js";
import { requestSettlement, approveSettlement, rejectSettlement } from "../service/settlementsService.js";

// 便利関数
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

window.addEventListener("load", () => {
  // --- ログインユーザ選択肢の生成 ---
  const userSelect = $("#current-user") || $(".js-current-user");
  ["Aさん", "Bさん"].forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u;
    userSelect.appendChild(opt);
  });
  userSelect.value = currentUser;

  // ユーザ切替：一覧や清算バナーの表示が変わるので再描画
  on(userSelect, "change", async () => {
    setCurrentUser(userSelect.value);
    // 支出登録フォームのpayerも同期（常にログインユーザ固定表示）
    const payerInput = $("#payer");
    if (payerInput) payerInput.value = userSelect.value;
    await refreshHome();
  });

  // --- 画面遷移ボタン（新：.js-route[data-view]） ---
  $$(".js-route").forEach((btn) => {
    on(btn, "click", async () => {
      const view = btn.getAttribute("data-view");
      show(view);

      if (view === "home") {
        await refreshHome();
      } else if (view === "entry") {
        // いつ開いても payer は現在ユーザを表示（readonly）
        const payerInput = $("#payer");
        if (payerInput) payerInput.value = currentUser;
      } else if (view === "clearance") {
        await renderSettlementPageText();
      }
    });
  });

  // --- 清算申請ボタン（ホームの通知エリアとは別。申請後はホームへ） ---
  const settleBtn = $("#settle-btn") || $(".js-clearance-apply");
  on(settleBtn, "click", async () => {
    try {
      await requestSettlement(userSelect.value); // 申請者＝現在ユーザ
      show("home");        // 申請後はホームに戻る
      await refreshHome(); // バナー等を更新
    } catch (e) {
      console.warn(e);
    }
  });

  // --- 支出登録フォーム（新規/編集 兼用） ---
  const form = $("#expense-form");
  // 初期表示時も payer を現在ユーザに設定
  const payerInputAtInit = $("#payer");
  if (payerInputAtInit) payerInputAtInit.value = currentUser;

  on(form, "submit", async (e) => {
    e.preventDefault(); // リロード防止

    const payload = {
      id: editingId || undefined, // 編集時は既存ID／新規は undefined
      payer: $("#payer").value, // ログインユーザ固定（readonly）
      amount: Number($("#amount").value),
      date: $("#date").value,
      category: $("#category").value,
      memo: $("#memo").value,
    };

    // 入力バリデーション（二重ガード）
    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      $("#amount").focus();
      return;
    }
    if (!payload.date) {
      $("#date").focus();
      return;
    }

    try {
      if (editingId) {
        // --- 編集モード ---
        await editExpense(payload);
        setEditingId(null); // 編集モード解除
      } else {
        // --- 新規モード ---
        await addExpense(payload);
      }
      form.reset();
      $("#payer").value = currentUser; // 念のため再設定
      show("home"); // 完了後はホームへ
      await refreshHome();
    } catch (err) {
      console.warn(err);
    }
  });

  // --- 初期表示：ホームを描画 ---
  show("home");
  refreshHome();

  // --- 内部ハンドラ（View から呼ばれる。グローバルに露出） ---
  // 清算 承認/却下
  window.__approveSettlement = async (id) => {
    await approveSettlement(id);
    await refreshHome();
  };
  window.__rejectSettlement = async (id) => {
    await rejectSettlement(id);
    await refreshHome();
  };

  // 編集開始：登録フォームを編集モードに切り替える
  window.__editExpense = async (exp) => {
    setEditingId(exp.id);
    // フォームへ既存値を反映（payer は現在ユーザ固定で上書き）
    $("#payer").value = currentUser;
    $("#amount").value = exp.amount;
    $("#date").value = exp.date;
    $("#category").value = exp.category;
    $("#memo").value = exp.memo;
    show("entry"); // 新HTMLのview名
  };

  // 削除（ポップアップ無しで即時）
  window.__deleteExpense = async (expId) => {
    await deleteExpense(expId);
    await refreshHome();
  };
});

// ------------------------
// ホーム画面の一括再描画
// 清算通知バナー / 支出一覧 / 清算履歴
// ------------------------
async function refreshHome() {
  await renderSettlementBanner();   // .js-clearance-notice / 承認・却下ボタンの有効制御はView側で
  await renderExpensesTable();      // .js-expense-list へ行差し込み + 状態表示（loading/empty/error）
  await renderSettlementHistory();  // .js-clearance-history
}
