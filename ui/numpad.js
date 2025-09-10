// ========================
// 金額入力テンキーUI（計算機機能付き）
// ui/numpad.js
// 役割：金額入力を効率化するための専用テンキーインターフェース
// 機能：
// - 数字入力・四則演算・計算実行
// - リアルタイムでの表示更新（数値と計算式）
// - 隠しフィールド（#amount）との自動同期
// - 重複初期化の防止機能
// 
// 必要なDOM要素：
// - #expense-form: フォーム要素
// - #amount: 隠しフィールド（実際にサーバーに送信される値）
// - #amount-display: 金額表示エリア（フォーマット済み）
// - #amount-formula: 計算式表示エリア
// - .js-numpad: テンキー本体
// ========================

/**
 * 金額テンキーを初期化する
 * フォーム内の金額入力関連要素を検索し、テンキー機能を設定
 * 重複初期化を防ぐ仕組みも含む
 */
export function initAmountNumpad() {
  // ================
  // DOM要素の取得と存在確認
  // ================
  
  const form = document.getElementById("expense-form");
  if (!form) return; // フォームが存在しない場合は処理しない

  // テンキー機能に必要な各要素を取得
  const amountInput = form.querySelector("#amount");        // 隠しフィールド（サーバー送信用）
  const displayEl   = form.querySelector("#amount-display"); // 金額表示エリア
  const formulaEl   = form.querySelector("#amount-formula");  // 計算式表示エリア
  const keypad      = form.querySelector(".js-numpad");      // テンキー本体
  
  // 必要な要素のいずれかが存在しない場合は処理を中断
  if (!amountInput || !displayEl || !formulaEl || !keypad) return;

  // ================
  // 重複初期化ガード
  // ================
  
  // 同じテンキーが複数回初期化されることを防ぐ
  if (keypad.dataset.numpadBound === "1") {
    // 既に初期化済みの場合は表示を同期するだけ
    keypad.__numpadSync?.(); // 外部から値が変更された可能性への対応
    return;
  }
  
  // 初期化済みフラグを設定
  keypad.dataset.numpadBound = "1";

  // ================
  // ユーティリティと内部状態
  // ================
  
  // 日本語の数値フォーマッター（1,000円 のような形式）
  const fmt = new Intl.NumberFormat("ja-JP");

  // テンキーの内部状態変数
  let current  = String(Math.max(0, Number(amountInput.value) || 0)); // 現在入力中の数値
  let tokens   = [];      // 計算式のトークン配列 [数値, 演算子, 数値, ...]
  let result   = null;    // 最後の計算結果
  let finished = false;   // 計算完了フラグ（= ボタンを押した直後）

  // ================
  // ヘルパー関数群
  // ================

  /**
   * 数値を正の整数に変換する
   * @param {any} n - 変換対象の値
   * @returns {number} 0以上の整数
   * 
   * 処理内容：
   * - 数値以外は0に変換
   * - 小数は切り捨て
   * - 負の値は0に変換
   */
  function toPosInt(n) {
    n = Math.trunc(Number(n) || 0); // 整数部分のみ取得
    return n < 0 ? 0 : n;           // 負の値は0に変換
  }

  /**
   * トークン配列から計算結果を求める
   * @param {Array} ts - 計算式のトークン配列 [数値, 演算子, 数値, ...]
   * @returns {number} 計算結果（常に0以上の整数）
   * 
   * 計算ルール：
   * - 左から順番に計算（演算子の優先順位は考慮しない）
   * - 減算結果が負になる場合は0にクリップ
   * - ゼロ除算は0として扱う
   * - 乗算・除算も整数で処理
   * 
   * 例：[100, "+", 50, "×", 2] → ((100 + 50) × 2) = 300
   */
  function calc(ts) {
    if (ts.length === 0) return 0; // 空の場合は0
    
    let acc = toPosInt(ts[0]); // 最初の数値で初期化
    
    // トークンを2つずつ処理（演算子, 数値）
    for (let i = 1; i < ts.length; i += 2) {
      const op = ts[i];     // 演算子
      const b  = toPosInt(ts[i + 1]); // 次の数値
      
      // 演算子に応じて計算実行
      switch (op) {
        case "+": acc += b; break;                           // 加算
        case "-": acc = Math.max(0, acc - b); break;         // 減算（負の値は0にクリップ）
        case "×": acc *= b; break;                           // 乗算
        case "÷": acc = b === 0 ? 0 : Math.floor(acc / b); break; // 除算（ゼロ除算は0、小数切り捨て）
      }
    }
    return acc;
  }

  /**
   * DOM要素の表示を現在の内部状態と同期する
   * テンキーの操作後に毎回呼び出され、表示を最新状態に更新
   */
  function syncDom() {
    const n = toPosInt(current); // 現在値を正の整数に変換
    
    // 金額表示エリアを更新（1,000 のようにカンマ区切り形式）
    displayEl.textContent = fmt.format(n);
    
    // 計算式表示エリアを更新（例："100 + 50 ×"）
    formulaEl.textContent = tokens.join(" ");
    
    // 隠しフィールドを更新（フォーム送信時にサーバーが受け取る値）
    amountInput.value = String(n);
  }

  /**
   * 計算完了状態をリセットする
   * = ボタンを押した直後の状態から新しい入力を開始する際に呼び出される
   */
  function resetIfFinished() {
    if (finished) {
      tokens = [];     // 計算式をクリア
      current = "0";   // 現在値をリセット
      finished = false; // 完了フラグをリセット
    }
  }

  // ================
  // 外部同期関数
  // ================

  /**
   * 外部から #amount フィールドの値が変更された時の同期関数
   * 編集モードで既存の支出データを読み込んだ時などに使用
   */
  function syncFromInput() {
    // 隠しフィールドの値からテンキーの状態を復元
    current = String(Math.max(0, Number(amountInput.value) || 0));
    tokens = [];     // 計算式はクリア
    finished = false; // 完了状態はリセット
    result = null;   // 結果もクリア
    syncDom();       // 表示を更新
  }
  
  // この関数をテンキー要素に保存（外部から呼び出し可能にする）
  keypad.__numpadSync = syncFromInput;

  // ================
  // ボタンイベントハンドラーの設定
  // ================

  // テンキー内の全ボタンに対してクリックイベントを設定
  keypad.querySelectorAll(".js-key").forEach((btn) => {
    btn.addEventListener("click", () => {
      // ボタンの属性から動作を判定
      const action = btn.dataset.action; // 特殊動作（clear, back, equal, ok）
      const op     = btn.dataset.op;     // 演算子（+, -, ×, ÷）

      // ================
      // 数字ボタンの処理
      // ================
      if (!action && !op) {
        const d = btn.textContent.trim(); // ボタンの表示文字を取得
        resetIfFinished();                // 計算完了状態の場合はリセット
        
        // 現在値に数字を追加（先頭が0の場合は置き換え）
        current = current === "0" ? d : current + d;
        syncDom(); // 表示を更新
        return;
      }

      // ================
      // クリアボタンの処理
      // ================
      if (action === "clear") {
        // 全ての状態をリセット
        current = "0";
        tokens = [];
        finished = false;
        result = null;
        syncDom();
        return;
      }

      // ================
      // バックスペースボタンの処理
      // ================
      if (action === "back") {
        resetIfFinished(); // 計算完了状態の場合はリセット
        
        // 現在値の最後の文字を削除（空になったら"0"）
        current = current.slice(0, -1) || "0";
        syncDom();
        return;
      }

      // ================
      // 演算子ボタンの処理
      // ================
      if (op) {
        if (finished) {
          // 計算完了直後の場合：結果を使って新しい計算を開始
          tokens = [result];
          finished = false;
        } else {
          // 通常の場合：現在値をトークンに追加
          tokens.push(toPosInt(current));
        }
        
        tokens.push(op);    // 演算子をトークンに追加
        current = "0";      // 現在値をリセット（次の数値入力用）
        syncDom();
        return;
      }

      // ================
      // イコールボタンの処理（計算実行）
      // ================
      if (action === "equal") {
        tokens.push(toPosInt(current)); // 現在値をトークンに追加
        result = calc(tokens);          // 計算を実行
        
        // 計算式表示を "式 =" の形式に更新
        formulaEl.textContent = tokens.join(" ") + " =";
        
        current = String(result); // 結果を現在値に設定
        finished = true;          // 完了フラグを設定
        tokens = [];              // トークンをクリア
        syncDom();
        return;
      }

      // ================
      // OKボタンの処理（入力完了）
      // ================
      if (action === "ok") {
        // 値は既に同期済み。次のフィールドにフォーカスを移動
        // メモフィールドまたは送信ボタンに移動
        (form.querySelector("#memo") || form.querySelector("[type='submit']"))?.focus();
        return;
      }
    });
  });

  // 初期描画
  syncDom();

  // 入力欄はテンキー専用にする
  amountInput.addEventListener("focus", (e) => e.target.blur?.());
}