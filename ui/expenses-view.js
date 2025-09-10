// ========================
// 支出一覧表示機能（UI層）
// ui/expenses-view.js
// 役割：支出データを一覧表として画面に表示する
// 表示内容：4列構成（カテゴリ / 金額 / 日付 / 支払者）
// 表示ルール：
// - 承認済み清算の最新日時より前に「最終更新」された支出は非表示
// - 論理削除（deleted=true）されたデータは非表示
// - 最大10件まで表示
// - 行クリックで詳細画面に遷移（window.__showExpenseDetail が存在する場合）
// ========================

// データ取得サービスをインポート
import { getAllExpenses } from "../services/expenses-service.js";      // 全支出データを取得
import { listAllSettlements } from "../services/settlements-service.js"; // 全清算データを取得

// DOM操作のユーティリティ関数
const $ = (sel, root = document) => root.querySelector(sel);

/**
 * ローディング・エラー・空状態の表示を制御する
 * @param {Object} state - 表示状態を表すオブジェクト
 * @param {boolean} state.loading - ローディング状態の表示フラグ
 * @param {boolean} state.error - エラー状態の表示フラグ
 * @param {boolean} state.empty - 空状態（データなし）の表示フラグ
 */
function showState({ loading = false, error = false, empty = false }) {
  // 各状態表示用の要素を取得
  const elLoading = $(".js-expense-loading"); // ローディング表示要素
  const elError = $(".js-expense-error");     // エラー表示要素
  const elEmpty = $(".js-expense-empty");     // 空状態表示要素
  
  // hidden属性を使用して表示/非表示を制御
  // hidden=true で非表示、hidden=false で表示
  if (elLoading) elLoading.hidden = !loading;
  if (elError) elError.hidden = !error;
  if (elEmpty) elEmpty.hidden = !empty;
}

/**
 * 支出一覧テーブルを描画するメイン関数
 * 他のモジュールから呼び出されて、最新の支出データを表形式で表示する
 */
export async function renderExpensesTable() {
  // ================
  // 初期化処理
  // ================
  
  // 支出一覧を表示するtbody要素を取得
  const tbody = $(".js-expense-list");
  if (!tbody) {
    console.warn("[expensesView] .js-expense-list が見つかりません");
    return; // 表示先の要素が存在しない場合は処理を中断
  }

  // 既存の表示内容をクリアし、ローディング状態を表示
  tbody.innerHTML = ""; // 前回の表示内容を削除
  showState({ loading: true, error: false, empty: false }); // ローディング表示

  try {
    // ================
    // データ取得処理
    // ================
    
    // 支出データと清算データを並行して取得（Promise.allで高速化）
    const [items, settlements] = await Promise.all([
      getAllExpenses(),    // 全ての支出データを取得
      listAllSettlements(), // 全ての清算データを取得
    ]);

    // ================
    // 表示フィルタリング：承認済み清算による制限
    // ================
    
    // 最新の「承認済み」清算の日時を計算
    // この日時以前に更新された支出は「清算済み」として非表示にする
    let lastApprovedAt = null;
    const approved = (settlements || []).filter((s) => s.status === "承認済み");
    
    if (approved.length > 0) {
      // 承認済み清算が存在する場合、最新の日時を取得
      lastApprovedAt = approved
        .map((s) => new Date(s.date))           // 各清算の日付をDateオブジェクトに変換
        .reduce((a, b) => (a > b ? a : b));     // 最新（最大）の日付を取得
    }

    // ================
    // 表示対象データの抽出
    // ================
    
    const visible = []; // 表示対象の支出データを格納する配列
    
    for (const exp of items || []) {
      // 1. 論理削除されたデータは除外
      if (exp.deleted) continue;
      
      // 2. 最終更新日時を取得（lastUpdatedがなければ作成日を使用）
      const updatedAt = exp.lastUpdated ? new Date(exp.lastUpdated) : new Date(exp.date);
      
      // 3. 承認済み清算より前に更新されたデータは除外（清算済みとして扱う）
      if (lastApprovedAt && updatedAt <= lastApprovedAt) continue;
      
      // 上記の条件をクリアしたデータのみ表示対象に追加
      visible.push(exp);
    }

    // ================
    // 空状態の処理
    // ================
    
    if (visible.length === 0) {
      // 表示するデータが1件もない場合は空状態を表示
      showState({ loading: false, error: false, empty: true });
      return;
    }

    // ================
    // テーブル行の生成と描画
    // ================
    
    // DocumentFragmentを使用してパフォーマンスを向上
    // 複数のDOM要素を一度に追加するための仮想的なコンテナ
    const frag = document.createDocumentFragment();
    
    // 最大10件まで表示（パフォーマンス考慮）
    visible.slice(0, 10).forEach((exp) => {
      // テーブル行（tr要素）を作成
      const tr = document.createElement("tr");
      tr.className = "c-expense-table__row"; // CSSクラスを設定

      /**
       * テーブルセル（td要素）を作成するヘルパー関数
       * @param {string} text - セルに表示するテキスト
       * @returns {HTMLTableCellElement} 作成されたtd要素
       */
      const td = (text) => {
        const cell = document.createElement("td");
        cell.className = "c-expense-table__cell"; // 統一されたCSSクラス
        cell.textContent = text;                  // テキスト内容を設定
        return cell;
      };

      /**
       * 金額を日本円形式でフォーマットする関数
       * @param {number|string} n - フォーマットする金額
       * @returns {string} "1,000円" のような形式の文字列
       */
      const fmtJPY = (n) => new Intl.NumberFormat("ja-JP").format(Number(n || 0)) + "円";

      // 4列のデータをテーブル行に追加
      tr.appendChild(td(exp.category ?? "-"));          // 1列目：カテゴリ
      tr.appendChild(td(fmtJPY(exp.amount)));           // 2列目：金額（日本円フォーマット）
      tr.appendChild(td(exp.date ?? "-"));              // 3列目：日付
      tr.appendChild(td(exp.payer ?? "-"));             // 4列目：支払者

      // ================
      // インタラクション：行クリックで詳細画面に遷移
      // ================
      
      // 詳細表示関数が存在する場合のみクリック機能を追加
      if (typeof window.__showExpenseDetail === "function") {
        tr.style.cursor = "pointer";                    // マウスカーソルをポインターに変更
        tr.addEventListener("click", () => window.__showExpenseDetail(exp)); // クリック時に詳細表示
      }

      // 作成した行をDocumentFragmentに追加
      frag.appendChild(tr);
    });

    // 一度にすべての行をテーブルに追加（DOMの再描画を最小限に抑制）
    tbody.appendChild(frag);
    
    // 正常完了状態を表示
    showState({ loading: false, error: false, empty: false });
    
  } catch (err) {
    // ================
    // エラーハンドリング
    // ================
    
    console.warn(err); // 開発者向けのエラーログ出力
    showState({ loading: false, error: true, empty: false }); // ユーザー向けエラー表示
  }
}