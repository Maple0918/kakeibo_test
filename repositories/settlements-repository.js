// ========================
// データアクセス層（Repository層）：清算データの管理
// repositories/settlements-repository.js
// 役割：清算（お金の精算）データの永続化を担当
// 特徴：
// - 清算申請・承認・拒否のライフサイクルを管理
// - 申請者、精算方向、金額、ステータスなどの情報を保存
// - 現在はメモリ内配列でモック実装
// - 将来的にはAPI通信に置き換え可能な設計
// ========================

// ================
// 設定とデータストア
// ================

// API使用フラグ：true にするとAPI通信、false だとローカル配列を使用
const USE_API = false;

// インメモリ清算データストア（モック用）
// 実際のアプリケーションでは、データベースが担当する部分
// 清算データ構造：{id, applicant, directionText, amount, status, date}
// - id: 清算の一意識別子
// - applicant: 申請者（"Aさん" または "Bさん"）
// - directionText: 精算方向（例："Aさん → Bさん"）
// - amount: 精算金額
// - status: 処理状況（"申請中", "承認済み", "却下"）
// - date: 申請日時（ISO 8601形式）
let _settlements = [];

// ========================
// データ操作関数群
// ========================

/**
 * 全ての清算データを取得する
 * @returns {Promise<Array>} 清算データの配列
 * 
 * 用途：
 * - 清算履歴の表示
 * - 申請中清算の検索
 * - 清算状況の確認
 * - UI表示用のデータ提供
 * 
 * 取得されるデータ：
 * - 全ステータスの清算データ（申請中、承認済み、却下）
 * - 時系列順での取得（古いものから新しいものまで）
 * 
 * 現在の実装：
 * - ローカル配列をコピーして返す（元データの保護）
 * - フィルタリングは呼び出し側で実施
 */
export async function listSettlements() {
  if (!USE_API) {
    // 配列のコピーを返す（元データの意図しない変更を防ぐ）
    return [..._settlements];
  }
  
  // ================
  // 将来のAPI実装例
  // ================
  // const res = await fetch("/api/settlements", { 
  //   credentials: "include"  // 認証クッキーを含む
  // });
  // return await res.json();
}

/**
 * 新しい清算データを作成する
 * @param {Object} st - 作成する清算データ
 * @returns {Promise<Object>} 作成された清算データ
 * 
 * 清算データの構成要素：
 * - 申請者情報：誰が清算を申請したか
 * - 精算内容：誰から誰にいくら支払うか
 * - ステータス：初期状態は必ず「申請中」
 * - タイムスタンプ：申請された日時
 * 
 * 責任範囲：
 * - データの永続化のみ担当
 * - ビジネスロジック（重複チェックなど）は Service層で実施
 * - IDの生成は呼び出し側で実施済み
 * 
 * 現在の実装：
 * - 配列に新しいデータを追加
 * - 作成されたデータをそのまま返す
 */
export async function createSettlement(st) {
  if (!USE_API) { 
    // 配列に新しい清算データを追加
    _settlements.push(st); 
    return st; // 作成されたデータを返す
  }
  
  // ================
  // 将来のAPI実装例
  // ================
  // const res = await fetch("/api/settlements", {
  //   method: "POST",                                // POST：新規作成
  //   headers: { "Content-Type": "application/json" }, // JSON形式で送信
  //   credentials: "include",                        // 認証情報を含む
  //   body: JSON.stringify(st),                      // データをJSON文字列に変換
  // });
  // return await res.json();                         // 作成されたデータを返す
}

/**
 * 清算のステータスを更新する
 * @param {string} id - 更新する清算のID
 * @param {string} status - 新しいステータス（"申請中", "承認済み", "却下"）
 * @returns {Promise<Object>} 更新された清算データ
 * 
 * ステータスの意味：
 * - "申請中"：誰かが清算を申請し、相手の対応待ち
 * - "承認済み"：相手が承認し、実際の精算処理が完了
 * - "却下"：相手が拒否し、精算は行われない
 * 
 * 重要な特徴：
 * - ステータスのみの部分更新（他のフィールドは変更しない）
 * - マージ更新方式で既存データを保護
 * - 承認時は別途会計処理が Service層で実行される
 * 
 * 使用場面：
 * - 承認ボタンクリック時：申請中 → 承認済み
 * - 拒否ボタンクリック時：申請中 → 却下
 * - 取消ボタンクリック時：申請中 → 却下
 * 
 * なぜ部分更新か：
 * - 申請者や金額などの重要情報は変更禁止
 * - ステータス以外のデータ保護
 * - 意図しないデータ消失の防止
 */
export async function updateSettlementStatus(id, status) {
  if (!USE_API) {
    // 配列内で該当IDのインデックスを検索
    const idx = _settlements.findIndex(x => x.id === id);
    
    if (idx >= 0) {
      // マージ更新：既存データにステータスのみ上書き
      // ...演算子で既存データを展開し、status フィールドのみ更新
      _settlements[idx] = { ..._settlements[idx], status };
      return _settlements[idx]; // 更新されたデータを返す
    }
    
    // 該当IDが見つからない場合は undefined を返す
    return undefined;
  }
  
  // ================
  // 将来のAPI実装例
  // ================
  // const res = await fetch(`/api/settlements/${id}`, {
  //   method: "PATCH",                               // PATCH：部分更新
  //   headers: { "Content-Type": "application/json" },
  //   credentials: "include",
  //   body: JSON.stringify({ status }),              // ステータスのみを送信
  // });
  // return await res.json();
}