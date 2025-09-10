// ========================
// シンプルルーター（画面切り替え機能）
// core/router.js
// 役割：複数の画面（ビュー）を切り替える機能を提供
// 特徴：SPAライブラリを使わずに、純粋なJavaScriptで実装したシンプルなルーター
// ========================

/**
 * 指定された画面を表示し、他の画面を非表示にする
 * @param {string} viewName - 表示したい画面の名前（data-view属性の値）
 * 
 * 使用例：
 * show("home");     // ホーム画面を表示
 * show("entry");    // 入力画面を表示
 * show("clearance"); // 清算画面を表示
 */
export function show(viewName) {
  // ================
  // 画面（ビュー）の切り替え処理
  // ================
  
  // .js-viewクラスを持つ全ての画面要素を取得して処理
  document.querySelectorAll(".js-view").forEach((s) => {
    // 現在処理中の要素が、表示対象の画面かどうかを判定
    // data-view属性の値と、引数のviewNameを比較
    const isTarget = s.dataset.view === viewName;
    
    // CSSクラス「is-active」の切り替え
    // 表示対象の画面にはis-activeクラスを追加、それ以外は削除
    // このクラスはCSSでスタイリング（表示/非表示など）に使用される
    s.classList.toggle("is-active", isTarget);
    
    // HTML5のhidden属性による表示/非表示制御
    // 表示対象の画面はhidden=false（表示）、それ以外はhidden=true（非表示）
    // hidden属性はCSSの display: none と同等の効果
    s.hidden = !isTarget;
  });

  // ================
  // ナビゲーションボタンの状態更新
  // ================
  
  // .js-routeクラスを持つ全てのナビゲーションボタンを取得して処理
  document.querySelectorAll(".js-route").forEach((btn) => {
    // 現在処理中のボタンが、アクティブな画面に対応するかを判定
    const isActive = btn.dataset.view === viewName;
    
    // アクティブなボタンにis-activeクラスを追加（視覚的なフィードバック）
    // 例：選択中のタブを強調表示するためのCSSクラス
    btn.classList.toggle("is-active", isActive);
    
    // WAI-ARIA（アクセシビリティ）対応
    // aria-current属性で、現在表示中のページを示す
    // スクリーンリーダーなどの支援技術が現在位置を認識できる
    btn.setAttribute("aria-current", isActive ? "page" : "false");
  });
}