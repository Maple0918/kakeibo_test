// ========================
// アプリケーションのメインエントリーポイント（起動処理）
// ========================

// core/main.js
// 目的：アプリの初期化とコントローラーの起動を管理する
// 役割：各機能モジュールを読み込み、適切な順序で初期化を実行する

// 必要なコントローラーモジュールをインポート
// ES6のimport文を使用してモジュールを読み込み
import { initCommon } from "./common-controller.js";     // 共通機能の初期化関数
import { initClearance } from "./clearance-controller.js"; // 清算機能の初期化関数

// DOMが完全に読み込まれた後にアプリを起動
// window.addEventListener("load", ...)でHTMLの読み込み完了を待つ
window.addEventListener("load", () => {
  // 1. 共通機能を最初に初期化（基盤となる機能）
  initCommon();
  
  // 2. 清算機能を初期化（メイン機能）
  initClearance();
  
  // 注意：初期化の順序は重要
  // 共通機能が先に初期化されてから、個別機能を初期化する
});