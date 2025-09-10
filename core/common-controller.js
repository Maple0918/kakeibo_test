// ========================
// 共通コントローラー（アプリの中核機能を管理）
// core/controller-common.js
// 役割：ユーザー切替・画面遷移・支出フォーム・一覧表示・詳細表示の制御
// ========================

// アプリの状態管理モジュールから必要な関数をインポート
import { currentUser, setCurrentUser, editingId, setEditingId } from "./app-state.js";
// 画面遷移を管理するルーターをインポート
import { show } from "./router.js";

// UIコンポーネントをインポート
import { toast } from "../ui/toast.js";              // 通知メッセージ表示
import { initAmountNumpad } from "../ui/numpad.js";  // 金額入力用テンキー

// 画面表示（View）関連の関数をインポート
import { renderExpensesTable } from "../ui/expenses-view.js";                    // 支出一覧表示
import { renderSettlementHistory, renderClearanceSummaryAll } from "../ui/settlement-view.js"; // 清算履歴・サマリー表示

// ビジネスロジック（Service）関連の関数をインポート
import { addExpense, editExpense, deleteExpense } from "../services/expenses-service.js"; // 支出データの操作

// DOM操作を簡潔に書くためのユーティリティ関数
const $  = (s, r = document) => r.querySelector(s);        // 単一要素を取得（jQueryの$()のような機能）
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s)); // 複数要素を配列で取得
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);       // イベントリスナーを安全に追加

// ========================
// 外部公開関数：他のモジュールから呼び出される関数
// ========================

/**
 * ホーム画面の表示内容を最新の状態に更新する
 * 他のモジュール（例：clearance側）からも呼び出される重要な関数
 */
export async function refreshHome() {
  await renderExpensesTable();     // 支出一覧テーブルを再描画（.js-expense-list要素）
  await renderSettlementHistory(); // 清算履歴を再描画（.js-clearance-history要素）
}

/**
 * 共通機能の初期化を行うメイン関数
 * アプリ起動時に main.js から呼び出される
 */
export async function initCommon() {
  // 各機能を順番に初期化
  bindUserSwitcher();    // ユーザー切替機能の設定
  bindRoutes();          // 画面遷移ボタンの設定
  bindEntryForm();       // 支出入力フォームの設定
  bindEntryShortcuts();  // 入力フォームのショートカット機能設定
  exposeDetailHook();    // 詳細画面表示機能の設定

  // アプリの初期表示
  show("home");                          // ホーム画面を表示
  await renderClearanceSummaryAll();     // 清算サマリーを更新
  await refreshHome();                   // ホーム画面の内容を更新
}

// ========================
// 内部関数：このファイル内でのみ使用されるプライベート関数群
// ========================

/**
 * ユーザー切替機能をセットアップする
 * ドロップダウンでAさん・Bさんを切り替えられるようにする
 */
function bindUserSwitcher() {
  // ユーザー選択のselect要素を取得（IDまたはクラスで検索）
  const userSelect = $("#current-user") || $(".js-current-user");
  
  // 選択肢（Aさん、Bさん）をselect要素に追加
  ["Aさん", "Bさん"].forEach((u) => {
    const opt = document.createElement("option"); // option要素を作成
    opt.value = u;                                // value属性を設定
    opt.textContent = u;                          // 表示テキストを設定
    userSelect.appendChild(opt);                  // select要素に追加
  });
  
  // 現在のユーザーを初期選択状態にする
  userSelect.value = currentUser;

  // ユーザーが選択を変更した時の処理
  on(userSelect, "change", async () => {
    // アプリの状態を新しいユーザーに更新
    setCurrentUser(userSelect.value);
    
    // 入力画面の支払者フィールドも同期して更新
    const payerInput = $("#payer");
    if (payerInput) payerInput.value = userSelect.value;

    // 画面表示を最新の状態に更新
    await renderClearanceSummaryAll(); // 清算サマリーを再計算
    await refreshHome();               // ホーム画面を更新
  });
}

/**
 * 画面遷移ボタンの動作をセットアップする
 * data-view属性を持つボタンがクリックされた時の処理を定義
 */
function bindRoutes() {
  // .js-routeクラスを持つ全てのボタンを取得して処理
  $$(".js-route").forEach((btn) => {
    on(btn, "click", async () => {
      // ボタンのdata-view属性から遷移先の画面名を取得
      const view = btn.getAttribute("data-view");
      show(view); // 指定された画面に遷移

      // 遷移先の画面に応じて追加の初期化処理を実行
      if (view === "home") {
        // ホーム画面：サマリーと一覧を最新状態に更新
        await renderClearanceSummaryAll();
        await refreshHome();
        
      } else if (view === "entry") {
        // 入力画面：フォームの初期設定を行う
        setEditingId(null);     // 明示的に新規モード
        resetExpenseForm();     // 表示も初期化
        
        // 支払者フィールドに現在のユーザーを設定
        const payerInput = $("#payer");
        if (payerInput) payerInput.value = currentUser;

        // 日付フィールドのデフォルト値を今日に設定（既に値がある場合は上書きしない）
        const dateEl = document.getElementById("date");
        if (dateEl && !dateEl.value) {
          dateEl.value = new Date().toISOString().slice(0, 10); // YYYY-MM-DD形式
        }

        // 金額入力用テンキーを初期化（重複初期化でも安全な実装）
        initAmountNumpad();
      }
    });
  });
}

/**
 * 支出入力フォームの動作をセットアップする
 * フォーム送信、編集、削除の処理を定義
 */
function bindEntryForm() {
  const form = $("#expense-form");
  
  // フォーム初期化：支払者フィールドに現在のユーザーを設定
  const payerInputAtInit = $("#payer");
  if (payerInputAtInit) payerInputAtInit.value = currentUser;

  // フォーム送信時の処理（新規追加または編集）
  on(form, "submit", async (e) => {
    e.preventDefault(); // ブラウザのデフォルト送信を防ぐ

    // フォームの入力値を取得してデータオブジェクトを作成
    const payload = {
      id: editingId || undefined,              // 編集中の場合はID、新規の場合はundefined
      payer: $("#payer").value,                // 支払者
      amount: Number($("#amount").value),       // 金額（数値に変換）
      date: $("#date").value,                  // 日付
      category: $("#category").value,          // カテゴリ
      memo: $("#memo").value,                  // メモ
    };

    // ================
    // 入力値検証（バリデーション）
    // ================
    
    // 金額の検証：数値で0より大きい値が必要
    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      toast.error("金額を入力してください");
      // テンキーまたは金額表示エリアにフォーカスを誘導
      document.querySelector(".js-numpad .js-key[data-key]")?.focus()
        || document.getElementById("amount-display")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    
    // 日付の検証：必須入力
    if (!payload.date) {
      toast.error("日付を入力してください");
      $("#date")?.focus(); return;
    }
    
    // カテゴリの検証：必須選択
    if (!payload.category) {
      toast.error("カテゴリを選択してください");
      $(".js-cat")?.focus(); return;
    }

    // ================
    // データ保存処理
    // ================
    try {
      if (editingId) { 
        // 編集モード：既存データを更新
        await editExpense(payload); 
        setEditingId(null); // 編集モードを解除
      } else { 
        // 新規モード：新しいデータを追加
        await addExpense(payload); 
      }
      
      toast.success("保存しました");

      // フォームをリセットして初期状態に戻す
      resetExpenseForm(); 
      $("#payer").value = currentUser; // 支払者は現在のユーザーに戻す
      
      // ホーム画面に戻り、表示を更新
      show("home");
      await renderClearanceSummaryAll();
      await refreshHome();
      
    } catch (err) {
      // エラーが発生した場合の処理
      console.warn(err);
      toast.error(err?.message || "保存に失敗しました");
    }
  });

  // ================
  // グローバル関数の定義：詳細画面からの編集・削除
  // ================
  
  /**
   * 支出データを編集モードで開く（詳細画面から呼び出される）
   * @param {Object} exp - 編集する支出データ
   */
  window.__editExpense = async (exp) => {
    setEditingId(exp.id); // 編集モードに設定
    
    // フォームに既存データを入力
    // 注意：編集では実際のデータの支払者を表示（現在のユーザーではない）
    $("#payer").value = exp.payer;
    $("#amount").value = exp.amount;
    $("#date").value = exp.date;
    $("#category").value = exp.category;
    $("#memo").value = exp.memo;

    // カテゴリの見た目を同期（選択されたカテゴリチップに .is-active クラスを付与）
    const cat = exp.category;
    document.querySelectorAll(".js-cat").forEach((c) => {
      c.classList.toggle("is-active", c.getAttribute("data-cat") === cat);
    });

    // 入力画面に遷移
    show("entry");
    
    // テンキーを初期化して表示を同期
    initAmountNumpad();
    document.querySelector(".js-numpad")?.__numpadSync?.();
  };

  /**
   * 支出データを削除する（詳細画面から呼び出される）
   * @param {string} expId - 削除する支出データのID
   */
  window.__deleteExpense = async (expId) => {
    await deleteExpense(expId);           // データベースから削除
    await renderClearanceSummaryAll();    // サマリーを更新
    await refreshHome();                  // ホーム画面を更新
    toast.success("削除しました");        // 成功メッセージを表示
  };
}

/**
 * 入力フォームのショートカット機能をセットアップする
 * 日付ボタン（今日・昨日）とカテゴリチップの動作を設定
 */
function bindEntryShortcuts() {
  // ================
  // 日付ショートカットボタンの設定
  // ================
  
  const btnToday = $(".js-date-today");       // 今日ボタン
  const btnYesterday = $(".js-date-yesterday"); // 昨日ボタン
  const dateInput = $("#date");               // 日付入力フィールド

  // 今日ボタンがクリックされた時の処理
  on(btnToday, "click", () => {
    if (!dateInput) return;
    const d = new Date();                           // 現在の日付を取得
    dateInput.value = d.toISOString().slice(0, 10); // YYYY-MM-DD形式で設定
  });

  // 昨日ボタンがクリックされた時の処理
  on(btnYesterday, "click", () => {
    if (!dateInput) return;
    const d = new Date();                           // 現在の日付を取得
    d.setDate(d.getDate() - 1);                     // 1日前に設定
    dateInput.value = d.toISOString().slice(0, 10); // YYYY-MM-DD形式で設定
  });

  // ================
  // カテゴリチップの選択機能
  // ================
  
  const categoryHidden = $("#category"); // 隠しフィールド（実際にサーバーに送信される値）
  
  // 全てのカテゴリチップ（.js-catクラス）に対してクリックイベントを設定
  $$(".js-cat").forEach((chip) => {
    on(chip, "click", () => {
      // まず全てのチップから選択状態（.is-activeクラス）を削除
      $$(".js-cat").forEach((c) => c.classList.remove("is-active"));
      
      // クリックされたチップに選択状態を追加
      chip.classList.add("is-active");
      
      // 隠しフィールドにカテゴリ値を設定（data-cat属性の値を使用）
      if (categoryHidden) categoryHidden.value = chip.getAttribute("data-cat") || "";
    });
  });
}

// ========================
// 詳細表示機能：支出データの詳細画面を管理
// ========================

/**
 * 支出詳細表示機能をセットアップする
 * グローバル関数 __showExpenseDetail を定義して、他の画面から呼び出せるようにする
 */
function exposeDetailHook() {
  // 既に関数が定義済みの場合は重複定義を避ける
  if (typeof window.__showExpenseDetail === "function") return;

  // DOM操作と表示用のユーティリティ関数
  const q = (s, r = document) => r.querySelector(s);                    // 単一要素取得
  const yen = (n) => new Intl.NumberFormat("ja-JP").format(Number(n || 0)) + "円"; // 金額を日本円形式で表示
  
  // カテゴリに対応する絵文字を返す関数
  const catIcon = (cat = "") => ({ 
    "食費":"🍔",
    "交通":"🚃",
    "日用品":"🛒",
    "娯楽":"🎉",
    "その他":"🗂" 
  }[cat] || "💸");

  /**
   * 支出データの詳細を画面に表示する
   * @param {Object} exp - 表示する支出データオブジェクト
   */
  window.__showExpenseDetail = (exp) => {
    // ================
    // 詳細情報を各表示要素に設定
    // ================
    
    q(".js-detail-date")      .textContent = exp.date ?? "-";           // 日付
    q(".js-detail-payer")     .textContent = exp.payer ?? "-";          // 支払者
    q(".js-detail-category2") .textContent = exp.category ?? "-";       // カテゴリ
    q(".js-detail-amount2")   .textContent = yen(exp.amount);           // 金額（円表示）
    q(".js-detail-memo")      .textContent = exp.memo ?? "-";           // メモ
    q(".js-detail-createdBy") .textContent = exp.createdBy ?? "-";      // 作成者
    
    // 最終更新日時（存在する場合は日時形式で表示）
    q(".js-detail-updated").textContent = exp.lastUpdated
      ? new Date(exp.lastUpdated).toLocaleString() // 日本のロケールで日時表示
      : "-";

    // 詳細画面に遷移
    show("detail");

    // ================
    // 編集・削除ボタンの動作設定
    // ================
    // 注意：show("detail")でDOMが更新された後にボタンを取得する必要がある
    
    const editBtn = q(".js-detail-edit");   // 編集ボタン
    const delBtn  = q(".js-detail-delete"); // 削除ボタン

    // 編集ボタンがクリックされた時の処理
    if (editBtn) {
      editBtn.onclick = () => window.__editExpense?.(exp);
    }
    
    // 削除ボタンがクリックされた時の処理
    if (delBtn) {
      delBtn.onclick = async () => {

      // 削除処理を実行
      await window.__deleteExpense?.(exp.id);
      toast.warn("削除しました");

      // ホーム画面に戻り、表示を更新
      show("home");
      await renderClearanceSummaryAll?.();
      await refreshHome?.();
          

      };
    }
  };
}

// 今の見た目を“初期値”として覚えさせる（SPA安定化用）
function primeFormDefaults(form) {
  if (!form) return;
  for (const el of form.elements) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.defaultValue = el.value;
      if (el.type === "checkbox" || el.type === "radio") el.defaultChecked = el.checked;
    } else if (el instanceof HTMLSelectElement) {
      for (const opt of el.options) opt.defaultSelected = opt.selected;
    }
  }
}

/**
 * expense-form を完全リセット
 * @param {Object} opts
 */
function resetExpenseForm(opts = {}) {
  const { keepDate = false } = opts;
  const form = document.getElementById("expense-form");
  if (!form) return;

  // 1) 標準フォーム要素を「初期値」に戻す
  form.reset();

  // 2) アプリ仕様に合わせて上書き（支払者はログインユーザーなど）
  const payer = form.querySelector("#payer");
  if (payer) payer.value = (window.currentUser ?? payer.value ?? "");

  // 3) カスタムUI（テンキー／金額表示）をクリア
  const amountHidden = form.querySelector("#amount");
  if (amountHidden) amountHidden.value = "0";

  const amountFormula = form.querySelector("#amount-formula");
  if (amountFormula) amountFormula.textContent = "";

  const amountDisplay = form.querySelector("#amount-display");
  if (amountDisplay) amountDisplay.textContent = "0";

  // 4) カテゴリ選択（hiddenとチップの見た目）をクリア
  const catHidden = form.querySelector("#category");
  if (catHidden) catHidden.value = "";

  form.querySelectorAll(".js-cat.is-active,[aria-pressed='true'],[data-selected]")
    .forEach(chip => {
      chip.classList.remove("is-active");
      chip.removeAttribute("aria-pressed");
      chip.removeAttribute("data-selected");
    });

  // 5) バリデーション表示・フォーム通知を隠す
  form.querySelectorAll(".c-form__error").forEach(el => el.hidden = true);
  const loading = form.querySelector(".js-form-loading");
  if (loading) loading.hidden = true;
  const err = form.querySelector(".js-form-error");
  if (err) err.hidden = true;

  // 6) 日付は保持しないなら空に戻す（changeイベントも発火して依存ロジックを更新）
  if (!keepDate) {
    const date = form.querySelector("#date");
    if (date) {
      date.value = "";
      date.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // 7) カスタムUI側に通知（必要ならリスナーで内部状態も初期化）
  form.dispatchEvent(new CustomEvent("form:reset", { bubbles: true }));

  // 8) 次回以降の reset() 戻り先を今の状態に更新（SPA向け）
  primeFormDefaults(form);
}