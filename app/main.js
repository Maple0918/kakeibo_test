// ========================
// アプリの起動＆配線：UIとロジックをつなぐ
// ========================


// UI状態（現在ユーザ／編集中ID）
import { currentUser, setCurrentUser, editingId, setEditingId } from "./state.js";
// 画面切替
import { show } from "./router.js";

// UI描画（View）
import { renderExpensesTable } from "../ui/expensesView.js";
import {
  renderSettlementBanner,
  renderSettlementHistory,
  renderSettlementPageText,
} from "../ui/settlementView.js";

// ロジック（Service）
import { addExpense, editExpense, deleteExpense } from "../logic/expensesService.js";
import { requestSettlement, approveSettlement, rejectSettlement } from "../logic/settlementsService.js";

window.addEventListener("load", () => {
  // --- ログインユーザ選択肢の生成 ---
  const userSelect = document.getElementById("current-user");
  ["Aさん", "Bさん"].forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u;
    userSelect.appendChild(opt);
  });
  userSelect.value = currentUser;

  // ユーザ切替：一覧や清算バナーの表示が変わるので再描画
  userSelect.addEventListener("change", async () => {
    setCurrentUser(userSelect.value);
    // 支出登録フォームのpayerも同期（常にログインユーザ固定表示）
    const payerInput = document.getElementById("payer");
    if (payerInput) payerInput.value = userSelect.value;
    await refreshHome();
  });

  // --- 画面遷移ボタン ---
  document.getElementById("nav-home").addEventListener("click", async () => {
    show("home");
    await refreshHome();
  });

  document.getElementById("nav-add").addEventListener("click", () => {
    show("add");
    // いつ開いても payer は現在ユーザを表示（readonly）
    const payerInput = document.getElementById("payer");
    if (payerInput) payerInput.value = currentUser;
  });

  document.getElementById("nav-settlement").addEventListener("click", async () => {
    show("settlement");
    await renderSettlementPageText();
  });

  // --- 清算申請ボタン（ポップアップなし／申請後はホームへ） ---
  document.getElementById("settle-btn").addEventListener("click", async () => {
    try {
      await requestSettlement(userSelect.value); // 申請者＝現在ユーザ
      show("home");        // 申請後はホームに戻る
      await refreshHome(); // バナー等を更新
    } catch (e) {
      // 非モーダル方針：ここではログのみ（必要になれば画面内メッセージを追加）
      console.warn(e);
    }
  });

  // --- 支出登録フォーム（新規/編集 兼用） ---
  const form = document.getElementById("expense-form");
  // 初期表示時も payer を現在ユーザに設定
  const payerInputAtInit = document.getElementById("payer");
  if (payerInputAtInit) payerInputAtInit.value = currentUser;

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // リロード防止

    const payload = {
      id: editingId || undefined, // 編集時は既存ID／新規は undefined
      payer: document.getElementById("payer").value, // ログインユーザ固定（readonly）
      amount: Number(document.getElementById("amount").value),
      date: document.getElementById("date").value,
      category: document.getElementById("category").value,
      memo: document.getElementById("memo").value,
    };

    // 入力バリデーション（二重ガード）
    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      document.getElementById("amount").focus();
      return;
    }

    if (!payload.date) { // 日付も必須
      document.getElementById("date").focus();
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
      document.getElementById("payer").value = currentUser; // 念のため再設定
      show("home"); // 完了後はホームへ
      await refreshHome();
    } catch (err) {
      // 非モーダル方針：ログのみ
      console.warn(err);
    }
  });

  // --- 初期表示：ホームを描画 ---
  show("home");
  refreshHome();

  // --- 内部ハンドラ（View から呼ばれる） ---
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
    document.getElementById("payer").value = currentUser;
    document.getElementById("amount").value = exp.amount;
    document.getElementById("date").value = exp.date;
    document.getElementById("category").value = exp.category;
    document.getElementById("memo").value = exp.memo;
    show("add"); // 登録画面を開く
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
  await renderSettlementBanner();
  await renderExpensesTable();
  await renderSettlementHistory();
}