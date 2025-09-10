// ========================
// 清算機能コントローラー（お金の精算処理を管理）
// core/controller-clearance.js
// 役割：清算の申請・取消・承認・棄却の処理、およびサマリー・ボタン・履歴の表示更新
// ========================

// 画面遷移を管理するルーターをインポート
import { show } from "./router.js";
// アプリの状態管理から現在のユーザー情報を取得
import { currentUser } from "./app-state.js";

// UIコンポーネント：通知メッセージ表示
import { toast } from "../ui/toast.js";

// ビジネスロジック（Service）：清算データの操作
import { 
  listAllSettlements,    // 全ての清算データを取得
  requestSettlement,     // 清算を申請する
  approveSettlement,     // 清算を承認する
  rejectSettlement       // 清算を棄却（取消）する
} from "../services/settlements-service.js";

// 画面表示（View）：清算関連の表示機能
import { 
  renderSettlementHistory,      // 清算履歴を表示
  renderClearanceSummaryAll,    // 清算サマリーを表示
  renderClearanceActions        // 清算アクションボタンを表示
} from "../ui/settlement-view.js";

// DOM操作を簡潔に書くためのユーティリティ関数
const $  = (s, r = document) => r.querySelector(s);        // 単一要素を取得
const on = (el, ev, fn) => el && el.addEventListener(ev, fn); // イベントリスナーを安全に追加

/**
 * 清算機能の初期化を行うメイン関数
 * main.js から呼び出される
 */
export async function initClearance() {
  bindButtons();             // 清算関連のボタンの動作を設定
  bindClearanceRouteInit();  // 清算画面への遷移時の処理を設定
}

// ========================
// 内部関数：このファイル内でのみ使用されるプライベート関数群
// ========================

/**
 * 清算画面に遷移した時の初期表示処理をセットアップする
 * ユーザーが清算画面を開いた時に、最新の情報を表示するため
 */
function bindClearanceRouteInit() {
  // 全ての画面遷移ボタン（.js-routeクラス）を取得
  document.querySelectorAll(".js-route").forEach((btn) => {
    on(btn, "click", async () => {
      // クリックされたボタンの遷移先が「清算」画面でない場合は何もしない
      if (btn.getAttribute("data-view") !== "clearance") return;
      
      // 清算画面の各要素を最新データで更新
      await renderClearanceSummaryAll(); // サマリー（合計金額など）を更新
      await renderClearanceActions();    // アクションボタン（申請・承認など）を更新
      await renderSettlementHistory();   // 履歴リストを更新
    });
  });
}

/**
 * 清算関連のボタンの動作をセットアップする
 * 申請・取消・承認・棄却の各ボタンにクリックイベントを設定
 */
function bindButtons() {
  // ================
  // DOM要素の取得
  // ================
  const applyBtn   = $(".js-clearance-apply");    // 申請ボタン
  const cancelBtn  = $(".js-clearance-cancel");   // 取消ボタン
  const approveBtn = $(".js-clearance-approve2"); // 承認ボタン
  const rejectBtn  = $(".js-clearance-reject2");  // 棄却ボタン

  // ================
  // 共通処理：画面更新とデータ取得
  // ================
  
  /**
   * 清算関連の全ての表示を最新状態に更新する
   * 各ボタン処理の後に呼び出される共通処理
   */
  const refreshAll = async () => {
    await renderClearanceSummaryAll(); // サマリー情報を更新
    await renderClearanceActions();    // アクションボタンの状態を更新
    await renderSettlementHistory();   // 履歴一覧を更新
  };
  
  /**
   * 現在申請中の清算データを取得する
   * @returns {Object|undefined} 申請中の清算データ、なければundefined
   */
  const getPending = async () => {
    const list = await listAllSettlements();                    // 全清算データを取得
    return list.find(s => s.status === "申請中");               // 申請中のものを検索
  };

  // ================
  // 各ボタンのクリックイベント設定
  // ================

  /**
   * 申請ボタン：新しい清算を申請する
   */
  on(applyBtn, "click", async () => {
    try {
      // 現在のユーザーを取得（ユーザー選択ドロップダウンまたはアプリ状態から）
      const who = ($("#current-user") || document.querySelector(".js-current-user"))?.value || currentUser;
      
      await requestSettlement(who);  // 清算申請を実行
      await refreshAll();            // 画面を更新
      toast.success("清算を申請しました"); // 成功メッセージを表示
      show("home");                  // ホーム画面に戻る
      
    } catch (e) { 
      console.warn(e);               // エラーログを出力（開発用）
      toast.error(e.message);        // エラーメッセージを表示
    }
  });

  /**
   * 取消ボタン：申請中の清算を取り消す
   */
  on(cancelBtn, "click", async () => {
    try {
      const p = await getPending();        // 申請中のデータを取得
      if (p) { 
        await rejectSettlement(p.id);      // 清算を棄却（取消）
        await refreshAll();                // 画面を更新
      }
      toast.warn("清算を取り消しました");   // 警告メッセージを表示
      show("home");                      // ホーム画面に戻る
      
    } catch (e) { 
      console.warn(e);                    // エラーログを出力
      toast.error("エラーが発生しました");   // エラーメッセージを表示
    }
  });

  /**
   * 承認ボタン：申請中の清算を承認する
   */
  on(approveBtn, "click", async () => {
    try {
      const p = await getPending();        // 申請中のデータを取得
      if (p) { 
        await approveSettlement(p.id);     // 清算を承認
        await refreshAll();               // 画面を更新
      }
      toast.success("清算しました");       // 成功メッセージを表示
      show("home");                      // ホーム画面に戻る
      
    } catch (e) { 
      console.warn(e);                   // エラーログを出力
    }
  });

  /**
   * 棄却ボタン：申請中の清算を棄却する
   */
  on(rejectBtn, "click", async () => {
    try {
      const p = await getPending();        // 申請中のデータを取得
      if (p) { 
        await rejectSettlement(p.id);      // 清算を棄却
        await refreshAll();               // 画面を更新
      }
      toast.warn("清算を取り消しました");   // 警告メッセージを表示
      show("home");                      // ホーム画面に戻る
      
    } catch (e) { 
      console.warn(e);                   // エラーログを出力
    }
  });

  // ================
  // グローバル関数の定義：他のUIから呼び出し可能
  // ================
  // 既存コードとの互換性を保つため、グローバルスコープに関数を定義
  
  /**
   * 指定されたIDの清算を承認する（他のUIから呼び出し可能）
   * @param {string} id - 承認する清算のID
   */
  window.__approveSettlement = async (id) => { 
    await approveSettlement(id); 
    await refreshAll(); 
  };
  
  /**
   * 指定されたIDの清算を棄却する（他のUIから呼び出し可能）
   * @param {string} id - 棄却する清算のID
   */
  window.__rejectSettlement = async (id) => { 
    await rejectSettlement(id);  
    await refreshAll(); 
  };
}