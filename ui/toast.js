// ========================
// ui/toast.js - 通知メッセージ表示システム
// ========================
//
// このファイルの役割：
// ユーザーに一時的な通知メッセージを表示するトースト機能を提供します。
// 成功・警告・エラーなどの操作結果をユーザーに分かりやすく伝えます。
//
// 主な機能：
// 1. 画面上部中央に通知を表示
// 2. 成功（緑）・警告（黄）・エラー（赤）の3種類の表示スタイル
// 3. 一定時間後の自動非表示
// 4. クリックまたはEscキーで手動非表示
// 5. 同時表示は1件のみ（新しい通知が古いものを上書き）
// 6. アクセシビリティ対応（スクリーンリーダー対応）
//
// 使用例：
// import { toast } from './ui/toast.js';
// toast.success('保存しました');     // 成功メッセージ
// toast.error('エラーが発生しました'); // エラーメッセージ
// toast.warn('注意が必要です');       // 警告メッセージ
//
// アクセシビリティ配慮：
// - aria-live="polite": スクリーンリーダーが内容を読み上げ
// - role="status": ステータス情報であることを明示
// - ESCキーでの閉じる操作をサポート
// ========================

// ================
// グローバル変数
// ================

// トースト表示用のDOM要素を保持する変数
// 初学者向け：一度作成したDOM要素を再利用するための仕組み
let rootEl = null;

// 自動非表示タイマーのIDを保持する変数
// 初学者向け：setTimeout()の戻り値を保存し、後でclearTimeout()で取り消すため
let timer = null;

// ================
// DOM要素作成・設定関数
// ================

/**
 * トースト表示用のDOM要素を作成・取得する
 * 
 * 初学者向け解説：
 * この関数は「シングルトンパターン」を実装しています。
 * 一度DOM要素を作成したら、それを使い回すことでパフォーマンスを向上させています。
 * 
 * @returns {HTMLElement} トースト表示用のDOM要素
 */
function ensureRoot() {
  // 既にDOM要素が作成済みの場合は、それを返す
  if (rootEl) return rootEl;
  
  // 新しいdiv要素を作成
  // 初学者向け：document.createElement()はHTMLの新しい要素を動的に作る基本メソッド
  const el = document.createElement("div");
  
  // 要素にIDを設定（CSSや他のJavaScriptから参照するため）
  el.id = "js-toast";
  
  // ================
  // アクセシビリティ属性の設定
  // ================
  
  // aria-live="polite": スクリーンリーダーに「内容が変わったら読み上げて」と指示
  // "polite"は現在の読み上げを中断せず、終了後に新しい内容を読む
  el.setAttribute("aria-live", "polite");
  
  // role="status": この要素がステータス情報であることを示す
  // 初学者向け：障害のあるユーザーが内容を理解しやすくするための仕組み
  el.setAttribute("role", "status");
  
  // ================
  // スタイルの設定
  // ================
  
  // 初学者向け：Object.assign()は複数のスタイルプロパティを一度に設定する便利なメソッド
  // 本来はCSSファイルに書くのが理想だが、この場合は独立性を重視してJavaScript内に記述
Object.assign(el.style, {
  position: "fixed",
  top: "16px",                  // 画面上端から16px下に変更
  left: "50%",
  transform: "translateX(-50%)",
  width: "80%",                 // 横幅を画面の80%に
  maxWidth: "480px",            // （任意）必要なら上限を決める
  padding: "10px 14px",
  borderRadius: "10px",
  boxShadow: "0 6px 18px rgba(0,0,0,.15)",
  color: "#fff",
  fontSize: "14px",
  zIndex: "10000",
  opacity: "0",
  transition: "opacity 180ms ease",
  userSelect: "none",
  cursor: "pointer",
  display: "none",
});
  
  // ================
  // イベントリスナーの設定
  // ================
  
  // トースト自体をクリックした時の処理
  // 初学者向け：アロー関数 () => は function() の短縮記法
  el.addEventListener("click", () => toastHide(0));
  
  // Escキーが押された時の処理（どこでキーが押されても反応）
  // 初学者向け：document全体にイベントリスナーを設定することで、フォーカス位置に関係なく反応
  document.addEventListener("keydown", (e) => { 
    if (e.key === "Escape") toastHide(0); 
  });
  
  // 作成した要素をHTMLのbody要素の末尾に追加
  // 初学者向け：appendChild()は親要素に子要素を追加するメソッド
  document.body.appendChild(el);

  rootEl = el;
  return el;
}

// ================
// ユーティリティ関数
// ================

/**
 * 通知タイプに応じた背景色を返す
 * 
 * @param {string} type - 通知タイプ（"error", "warn", その他）
 * @returns {string} CSS用のrgba色指定文字列
 * 
 */
function bg(type) {
  if (type === "error") return "rgba(231,76,60,.95)";   // 赤系（エラー用）
  if (type === "warn")  return "rgba(241,196,15,.95)";  // 黄系（警告用）
  return "rgba(46,204,113,.95)";                        // 緑系（成功用・デフォルト）
}

function toastShow(message, type = "success", ms) {
  const el = ensureRoot();
  clearTimeout(timer);
  const duration = typeof ms === "number"
    ? ms
    : type === "error" ? 3500
    : type === "warn"  ? 2800
    : 2000;

  el.textContent = message;
  el.style.background = bg(type);
  el.style.display = "block";
  requestAnimationFrame(() => { el.style.opacity = "1"; });

  timer = setTimeout(() => toastHide(180), duration);
}

function toastHide(fadeMs = 180) {
  const el = rootEl;
  if (!el || el.style.display === "none") return;
  clearTimeout(timer);
  el.style.transition = `opacity ${fadeMs}ms ease`;
  el.style.opacity = "0";
  setTimeout(() => { el.style.display = "none"; el.textContent = ""; }, fadeMs);
}

export const toast = {
  show: toastShow,
  success: (msg, ms) => toastShow(msg, "success", ms),
  warn:    (msg, ms) => toastShow(msg, "warn", ms),
  error:   (msg, ms) => toastShow(msg, "error", ms),
  hide: toastHide,
};