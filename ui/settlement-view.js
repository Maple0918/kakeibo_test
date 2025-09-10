// ========================
// 清算関連UI表示機能（清算の状態とデータを画面に表示）
// ui/settlement-view.js
// 役割：清算に関する様々な表示要素を管理する
// 機能：
// - 清算通知バナー：申請状況の通知表示
// - 清算履歴：過去の清算記録一覧
// - 清算サマリー：現在の差額状況表示
// - 清算アクション：申請・承認・棄却ボタンの状態制御
// ========================

// アプリケーション状態から現在のユーザー情報を取得
import { currentUser } from "../core/app-state.js";
// 清算関連のビジネスロジック（データ取得・計算）
import { listAllSettlements, calcCurrentDiff } from "../services/settlements-service.js";

// ================
// ユーティリティ関数：頻繁に使用する処理を簡潔にまとめる
// ================
const $ = (sel, root = document) => root.querySelector(sel);        // 単一要素取得
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel)); // 複数要素取得

/**
 * 金額を日本円形式でフォーマットする関数
 * @param {number|string} n - フォーマットする金額
 * @returns {string} "1,000円" のような形式の文字列
 */
const formatJPY = (n) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" })
    .format(Number(n || 0))      // 数値に変換してフォーマット
    .replace("￥", "") + "円";    // "￥"記号を削除して"円"を追加

/**
 * ユーザー名に色付き絵文字を追加する装飾関数
 * @param {string} s - 装飾するテキスト
 * @returns {string} 絵文字付きのテキスト
 */
const decorateAB = (s = "") =>
  s.replaceAll("Aさん", "🟦Aさん")    // Aさんに青い四角を追加
   .replaceAll("Bさん", "🟧Bさん");   // Bさんにオレンジの四角を追加

// ========================
// 清算サマリー表示機能
// ========================

/**
 * 全ての清算サマリー要素を最新の差額情報で更新する
 * ホーム画面と清算画面の両方に配置された .js-clearance-info 要素を一括更新
 * 
 * 表示内容：
 * - 差額がない場合："差額はありません"
 * - 差額がある場合："🟦Aさんが🟧Bさんに 1,000円" のような形式
 */
export async function renderClearanceSummaryAll() {
  // ページ内の全ての清算サマリー表示要素を取得
  const targets = $$(".js-clearance-info");
  if (targets.length === 0) return; // 表示要素が存在しない場合は処理しない

  try {
    // 現在の差額情報を計算で取得
    const { directionText, amount } = await calcCurrentDiff();
    
    // 表示テキストを生成
    const text =
      !amount || Number(amount) === 0
        ? "差額はありません"                                    // 差額なしの場合
        : `${decorateAB(directionText)} ${formatJPY(amount)}`;  // 差額ありの場合（装飾付き）

    // 全ての表示要素に同じテキストを設定
    targets.forEach((el) => (el.textContent = text));
    
  } catch (err) {
    // エラーが発生した場合の処理
    console.warn(err); // 開発者向けログ
    targets.forEach((el) => (el.textContent = "サマリーの取得に失敗しました")); // ユーザー向けエラー表示
  }
}

/**
 * 後方互換性のための関数（旧コードとの互換性を保つ）
 * 清算ページ個別の文言表示機能だったが、現在は共通関数に処理を委譲
 */
export async function renderSettlementPageText() {
  await renderClearanceSummaryAll();
}

// ========================
// 清算通知バナー機能
// ========================

/**
 * ホーム画面上部の清算通知バナーを更新する
 * 申請中の清算がある場合は通知を表示し、承認・棄却ボタンを制御する
 * 
 * 注意：現行レイアウトでは非表示だが、DOM要素が存在すれば動作する
 */
export async function renderSettlementBanner() {
  // 通知バナーとアクションボタンの要素を取得
  const notice = $(".js-clearance-notice");     // 通知テキスト表示エリア
  const approveBtn = $(".js-clearance-approve"); // 承認ボタン
  const rejectBtn = $(".js-clearance-reject");   // 棄却ボタン
  
  // 通知要素が存在しない場合は処理を中断
  if (!notice) return;

  // ================
  // 初期状態の設定
  // ================
  notice.textContent = "現在清算はありません";
  if (approveBtn) approveBtn.disabled = true; // ボタンを無効化
  if (rejectBtn) rejectBtn.disabled = true;   // ボタンを無効化

  try {
    // 全ての清算データを取得
    const settlements = await listAllSettlements();
    
    // 申請中の清算を検索
    const pending = settlements.find((s) => s.status === "申請中");
    if (!pending) return; // 申請中の清算がない場合は初期状態のまま

    // ================
    // 申請中の清算が存在する場合の処理
    // ================
    
    // 通知テキストを更新
    notice.textContent = `${pending.applicant}が申請: ${pending.directionText}に${formatJPY(pending.amount)} (${pending.status})`;

    // アクション可能性の判定（自分以外の申請のみアクション可能）
    const canAct = pending.applicant !== currentUser;
    
    // 承認ボタンの制御
    if (approveBtn) {
      approveBtn.disabled = !canAct; // 自分の申請の場合は無効化
      if (canAct) approveBtn.onclick = () => window.__approveSettlement(pending.id);
    }
    
    // 棄却ボタンの制御
    if (rejectBtn) {
      rejectBtn.disabled = !canAct; // 自分の申請の場合は無効化
      if (canAct) rejectBtn.onclick = () => window.__rejectSettlement(pending.id);
    }
    
  } catch (err) {
    // エラーが発生した場合の処理
    console.warn(err); // 開発者向けログ
    notice.textContent = "清算情報の取得に失敗しました"; // ユーザー向けエラー表示
  }
}

// ========================
// 清算アクションボタン制御機能
// ========================

/**
 * 清算画面のボタン状態を申請状況に応じて切り替える
 * 表示のみを担当し、実際のクリックハンドラーは controller 側で設定される
 * 
 * ボタンの表示パターン：
 * 1. 申請なし：「申請する」ボタンのみ表示
 * 2. 自分が申請中：「取り消す」ボタンのみ表示
 * 3. 相手が申請中：「承認」「棄却」ボタンを表示
 */
export async function renderClearanceActions() {
  // 清算画面のボタン要素を取得
  const applyBtn   = document.querySelector(".js-clearance-apply");    // 申請ボタン
  const cancelBtn  = document.querySelector(".js-clearance-cancel");   // 取消ボタン
  const approveBtn = document.querySelector(".js-clearance-approve2"); // 承認ボタン
  const rejectBtn  = document.querySelector(".js-clearance-reject2");  // 棄却ボタン
  const stateText  = document.querySelector(".js-clearance-state");    // 状態説明テキスト

  // 必要なボタンが存在しない場合は処理を中断
  if (!applyBtn || !cancelBtn || !approveBtn || !rejectBtn) return;

  // ================
  // 初期状態：全てのボタンを非表示にする
  // ================
  applyBtn.hidden = true;
  cancelBtn.hidden = true;
  approveBtn.hidden = true;
  rejectBtn.hidden = true;
  if (stateText) stateText.textContent = ""; // 状態テキストをクリア

  try {
    // 清算データを取得して申請中のものを検索
    const settlements = await listAllSettlements();
    const pending = settlements.find((s) => s.status === "申請中");

    if (!pending) {
      // ================
      // 状態1：誰も申請していない場合
      // ================
      applyBtn.hidden = false; // 申請ボタンのみ表示
      if (stateText) stateText.textContent = ""; // 説明テキストは空
      return;
    }

    // ================
    // 申請中の清算が存在する場合の処理
    // ================
    
    // 申請者が自分かどうかを判定
    const iAmApplicant = pending.applicant === currentUser;

    if (iAmApplicant) {
      // ================
      // 状態2：自分が申請中の場合
      // ================
      cancelBtn.hidden = false; // 取消ボタンのみ表示
      if (stateText) stateText.textContent = "清算を申請中です。相手の承認を待っています。";
      
    } else {
      // ================
      // 状態3：相手が申請中の場合
      // ================
      approveBtn.hidden = false; // 承認ボタンを表示
      rejectBtn.hidden  = false; // 棄却ボタンを表示
      if (stateText) stateText.textContent = "清算申請を受けています。承認または棄却してください。";
    }
    
  } catch (e) {
    // エラーが発生した場合の処理
    console.warn(e); // 開発者向けログ
    if (stateText) stateText.textContent = "状態の取得に失敗しました"; // ユーザー向けエラー表示
  }
}

// ========================
// 清算履歴表示機能
// ========================

/**
 * 清算履歴を一覧で表示する（直近5件まで）
 * ローディング・エラー・空状態の表示制御も含む
 * 
 * 表示内容：
 * - 日時、申請者、清算方向、金額、ステータス
 * - 新しい順に最大5件まで表示
 */
export async function renderSettlementHistory() {
  // DOM要素の取得
  const ul        = document.querySelector(".js-clearance-history");  // 履歴リスト表示エリア
  const emptyEl   = document.querySelector(".js-clearance-empty");     // 空状態表示要素
  const loadingEl = document.querySelector(".js-clearance-loading");   // ローディング表示要素
  const errorEl   = document.querySelector(".js-clearance-error");     // エラー表示要素
  
  // メイン表示要素が存在しない場合は処理を中断
  if (!ul) return;

  // ================
  // 初期状態の設定
  // ================
  ul.innerHTML = "";                              // 既存の履歴をクリア
  if (emptyEl)   emptyEl.hidden   = true;         // 空状態を非表示
  if (errorEl)   errorEl.hidden   = true;         // エラー状態を非表示
  if (loadingEl) loadingEl.hidden = false;        // ローディング状態を表示

  try {
    // ================
    // データ取得処理
    // ================
    const all = await listAllSettlements(); // 全ての清算データを取得

    // ローディング状態を終了
    if (loadingEl) loadingEl.hidden = true;

    // ================
    // データの並び替えと件数制限
    // ================
    
    // 直近5件を新しい順に取得
    const items = (all || [])
      .slice()                                                      // 元配列をコピー（破壊的変更を防ぐ）
      .sort((a, b) => (new Date(b.date || 0)) - (new Date(a.date || 0))) // 日付の降順でソート
      .slice(0, 5);                                                 // 最初の5件のみ取得

    // ================
    // 空状態の処理
    // ================
    if (!items.length) {
      if (emptyEl) emptyEl.hidden = false; // 「データがありません」を表示
      return;
    }

    // ================
    // 履歴リストの生成と表示
    // ================
    
    // DocumentFragmentを使用してパフォーマンスを向上
    const frag = document.createDocumentFragment();
    
    items.forEach((st) => {
      // リスト項目（li要素）を作成
      const li = document.createElement("li");
      li.className = "c-history-list__item"; // CSSクラスを設定
      
      // 日時をロケール形式でフォーマット
      const when = st.date ? new Date(st.date).toLocaleString() : "-";
      
      // 履歴項目のテキストを設定
      // フォーマット：[日時] 申請者が申請: 方向に金額 (ステータス)
      li.textContent = `[${when}] ${st.applicant}が申請: ${st.directionText}に${formatJPY(st.amount)} (${st.status})`;
      
      frag.appendChild(li);
    });
    
    // 一度にすべての履歴項目を追加
    ul.appendChild(frag);

  } catch (err) {
    // ================
    // エラーハンドリング
    // ================
    console.warn(err); // 開発者向けログ
    if (loadingEl) loadingEl.hidden = true;  // ローディング状態を終了
    if (errorEl)   errorEl.hidden   = false; // エラー表示を有効化
  }
}