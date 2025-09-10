// ========================
// データアクセス層（Repository層）：支出データの管理
// repositories/expenses-repository.js
// 役割：データの永続化（保存・取得）を担当
// 特徴：
// - 現在はメモリ内配列でモック実装
// - 将来的にはAPI通信に置き換え可能な設計
// - ビジネスロジックは含まず、純粋なデータ操作のみ
// ========================

// ================
// 設定とデータストア
// ================

// API使用フラグ：true にするとAPI通信、false だとローカル配列を使用
const USE_API = false;

// インメモリデータストア（モック用）
// 実際のアプリケーションでは、データベースやAPIサーバーが担当する部分
// データ構造：{id, payer, amount, date, category, memo, createdBy, deleted?:true}
let _expenses = [];

// ========================
// データ取得関数群
// ========================

/**
 * 全ての支出データを取得する
 * @returns {Promise<Array>} 支出データの配列（削除済みも含む）
 * 
 * 現在の実装：
 * - ローカル配列をコピーして返す（元データの保護）
 * - 削除済みデータも含む（UI層で削除フラグを確認して表示制御）
 * 
 * 将来のAPI実装：
 * - サーバーから全支出データを取得
 * - 認証情報を含むHTTPリクエスト
 */
export async function listExpenses() {
  if (!USE_API) {
    // 配列のコピーを返す（元データの意図しない変更を防ぐ）
    return [..._expenses];
  }

  // ================
  // 将来のAPI実装例（現在はコメントアウト）
  // ================
  // const res = await fetch("/api/expenses", { 
  //   credentials: "include"  // 認証クッキーを含む
  // });
  // return await res.json();
}

/**
 * IDを指定して特定の支出データを取得する
 * @param {string} id - 取得したい支出のID
 * @returns {Promise<Object|null>} 支出データ、見つからない場合は null
 * 
 * 用途：
 * - 編集時に既存データを読み込む
 * - データの存在確認
 * - 詳細表示
 * 
 * 現在の実装：
 * - 配列から該当IDを検索
 * - 見つからない場合は null を返す
 */
export async function getExpenseById(id) {
  if (!USE_API) {
    // Array.find() で条件に一致する最初の要素を取得
    return _expenses.find(x => x.id === id) || null;
  }

  // ================
  // 将来のAPI実装例
  // ================
  // const res = await fetch(`/api/expenses/${id}`, { 
  //   credentials: "include" 
  // });
  // if (!res.ok) return null;  // 404エラーなどの場合
  // return await res.json();
}

// ========================
// データ操作関数群
// ========================

/**
 * 新しい支出データを作成する
 * @param {Object} exp - 作成する支出データ
 * @returns {Promise<Object>} 作成された支出データ
 * 
 * 責任範囲：
 * - データの永続化のみ担当
 * - ビジネスロジック（バリデーションなど）は Service層で実施
 * - IDの生成は呼び出し側で実施済み
 * 
 * 現在の実装：
 * - 配列に新しいデータを追加
 * - 作成されたデータをそのまま返す
 */
export async function createExpense(exp) {
  if (!USE_API) {
    // 配列に新しい支出データを追加
    _expenses.push(exp);
    return exp; // 作成されたデータを返す
  }

  // ================
  // 将来のAPI実装例
  // ================
  // const res = await fetch("/api/expenses", {
  //   method: "POST",                                // POST：新規作成
  //   headers: { "Content-Type": "application/json" }, // JSON形式で送信
  //   credentials: "include",                        // 認証情報を含む
  //   body: JSON.stringify(exp),                     // データをJSON文字列に変換
  // });
  // return await res.json();                         // 作成されたデータを返す
}

/**
 * 既存の支出データを更新する（マージ更新方式）
 * @param {Object} exp - 更新データ（IDと更新したいフィールドを含む）
 * @returns {Promise<Object>} 更新された支出データ
 * 
 * マージ更新とは：
 * - 既存データを完全に置き換えるのではなく
 * - 指定されたフィールドのみを上書き
 * - 指定されていないフィールドは既存値を維持
 * 
 * 例：既存 {id: "1", name: "A", age: 20}
 *     更新 {id: "1", age: 25}
 *     結果 {id: "1", name: "A", age: 25}  ← name は保持される
 * 
 * この方式の利点：
 * - 部分更新が可能
 * - 重要なメタデータ（createdBy など）の保護
 * - 意図しないデータ消失の防止
 */
export async function updateExpense(exp) {
  if (!USE_API) {
    // 配列内で該当IDのインデックスを検索
    const idx = _expenses.findIndex(x => x.id === exp.id);
    
    if (idx >= 0) {
      // マージ更新：既存データに新しいデータを上書き
      // ...演算子で既存データを展開し、新しいデータで上書き
      _expenses[idx] = { ..._expenses[idx], ...exp };
      return _expenses[idx]; // 更新されたデータを返す
    }
    
    // 想定外のケース：該当IDが見つからない
    // 呼び出し側で保険的に扱うため、渡されたデータをそのまま返す
    return exp;
  }

  // ================
  // 将来のAPI実装例
  // ================
  // 選択肢1：PUT（全置換） vs 選択肢2：PATCH（部分更新）
  // const res = await fetch(`/api/expenses/${exp.id}`, {
  //   method: "PUT",                                // PUT：全置換、PATCH：部分更新
  //   headers: { "Content-Type": "application/json" },
  //   credentials: "include",
  //   body: JSON.stringify(exp),
  // });
  // return await res.json();
}

/**
 * 支出データを論理削除する
 * @param {string} expId - 削除する支出のID
 * @returns {Promise<boolean>} 削除成功時は true
 * 
 * 論理削除とは：
 * - データを物理的に削除するのではなく
 * - deleted: true フラグを設定して「削除済み」とマーク
 * - データは残るため復元や監査が可能
 * 
 * 論理削除の利点：
 * - データの復元が可能
 * - 会計監査における証跡保持
 * - 他のデータとの整合性維持
 * - 削除操作の取り消しが可能
 * 
 * 物理削除との使い分け：
 * - 論理削除：重要なビジネスデータ（支出、売上など）
 * - 物理削除：一時的なデータ（セッション、ログなど）
 */
export async function softDeleteExpense(expId) {
  if (!USE_API) {
    // 配列内で該当IDのインデックスを検索
    const idx = _expenses.findIndex(x => x.id === expId);
    
    if (idx >= 0) {
      // マージ更新で deleted: true フラグを追加
      // 既存データは保持し、削除フラグのみ追加
      _expenses[idx] = { ..._expenses[idx], deleted: true };
    }
    return true; // 削除処理の完了を示す
  }

  // ================
  // 将来のAPI実装例
  // ================
  // await fetch(`/api/expenses/${expId}`, {
  //   method: "DELETE",      // DELETE：削除操作
  //   credentials: "include",
  // });
  // return true;
  
  // 注意：API側で論理削除か物理削除かは実装次第
  // RESTfulなAPIでは、通常 DELETE メソッドを使用
}