// ========================
// 清算ビジネスロジック（お金の精算処理）
// services/settlements-service.js
// 役割：2人間のお金の貸し借りを整理する清算機能を管理
// 機能：
// - 現在の差額計算：誰がいくら多く支払っているかを算出
// - 清算申請：差額の精算を申請
// - 清算承認：申請された精算を承認して実際に精算
// - 清算拒否：申請された精算を却下
// ========================

// データアクセス層から清算データ操作機能をインポート
import { 
  listSettlements,        // 全清算データの取得
  createSettlement,       // 新規清算データの作成
  updateSettlementStatus  // 清算ステータスの更新
} from "../repositories/settlements-repository.js";

// 台帳サービスから会計処理機能をインポート
import { 
  sumByUser,               // ユーザー別残高計算
  commitEntries,           // 仕訳の台帳への記録
  makeSettlementEntries    // 清算時の仕訳データ生成
} from "./ledger-service.js";

// ========================
// 差額計算関数
// ========================

/**
 * 現在の2人間の差額を計算する
 * @returns {Promise<Object>} 差額情報オブジェクト
 * @returns {string} returns.directionText - 精算方向（例："Bさん → Aさん"）
 * @returns {number} returns.amount - 精算金額（常に正の値）
 * 
 * 計算ロジック：
 * - 台帳から各ユーザーの残高を取得
 * - Aさんの残高を基準に判定
 * - 正の値：Aさんが多く支払い → Bさんから受け取る権利
 * - 負の値：Aさんが少なく支払い → Bさんに支払う義務
 * - ゼロ：差額なし
 * 
 * 例：
 * - Aさん:+500, Bさん:-500 → "Bさん → Aさん 500円"
 * - Aさん:-300, Bさん:+300 → "Aさん → Bさん 300円"
 */
export async function calcCurrentDiff() {
  // ユーザー別の残高を取得
  const s = await sumByUser();
  const a = s["Aさん"]; // Aさんの残高を基準に判定
  
  // 差額がない場合
  if (a === 0) return { directionText: "", amount: 0 };
  
  // Aさんが多く支払っている場合（Bさんが支払う）
  if (a > 0) return { directionText: "Bさん → Aさん", amount: a };
  
  // Aさんが少なく支払っている場合（Aさんが支払う）
  return { directionText: "Aさん → Bさん", amount: Math.abs(a) };
}

// ========================
// 清算操作関数群
// ========================

/**
 * 清算を申請する
 * @param {string} applicant - 申請者の名前
 * @returns {Promise<Object>} 作成された清算データ
 * @throws {Error} 既に申請中の清算がある場合、または差額がない場合
 * 
 * 処理の流れ：
 * 1. 既存の申請中清算の有無をチェック
 * 2. 現在の差額を計算
 * 3. 差額がある場合のみ清算データを作成
 * 
 * ビジネスルール：
 * - 同時に複数の清算申請は不可
 * - 差額がない場合は申請不可
 * - 申請者は誰でも可能（支払う側・受け取る側どちらでも）
 */
export async function requestSettlement(applicant) {
  // ================
  // 1. 重複申請のチェック
  // ================
  const list = await listSettlements();
  if (list.find(s => s.status === "申請中")) {
    // toast.error("すでに申請中の清算があります。");
    throw new Error("すでに申請中の清算があります。");
  }

  // ================
  // 2. 差額計算と申請可能性チェック
  // ================
  const { directionText, amount } = await calcCurrentDiff();
  if (amount === 0) {
    // toast.error("差額がないため清算不要です。");
    throw new Error("差額がないため清算不要です。");
  }

  // ================
  // 3. 清算データの作成
  // ================
  const st = {
    id: `st_${Date.now()}`,              // 一意のID（タイムスタンプベース）
    applicant,                           // 申請者
    directionText,                       // 清算方向（計算結果）
    amount,                              // 清算金額（計算結果）
    status: "申請中",                    // 初期ステータス
    date: new Date().toISOString()       // 申請日時
  };
  
  // データベースに保存
  await createSettlement(st);
  return st; // 作成された清算データを返す
}

/**
 * 清算申請を承認する（実際の精算処理を実行）
 * @param {string} id - 承認する清算のID
 * @returns {Promise<Object>} 更新された清算データ
 * @throws {Error} 清算が見つからない場合
 * 
 * 重要：この関数で実際のお金の移動が会計上記録される
 * 
 * 処理の流れ：
 * 1. 指定された清算データを検索
 * 2. 申請中ステータスの確認
 * 3. 会計仕訳の作成・記録（実際の精算処理）
 * 4. ステータスを「承認済み」に更新
 */
export async function approveSettlement(id) {
  // ================
  // 1. 清算データの検索と存在確認
  // ================
  const list = await listSettlements();
  const st = list.find(x => x.id === id);
  if (!st) throw new Error("not found");
  
  // 既に処理済みの場合は何もしない
  if (st.status !== "申請中") return st;

  // ================
  // 2. 会計処理：清算仕訳の作成と記録
  // ================
  // これが実際のお金の移動を表す会計記録
  // 台帳に記録されることで、残高が調整される
  await commitEntries(makeSettlementEntries({ 
    settlementId: st.id,        // 清算ID
    directionText: st.directionText, // 支払方向
    amount: st.amount           // 清算金額
  }));
  
  // ================
  // 3. ステータスの更新
  // ================
  return updateSettlementStatus(id, "承認済み");
}

/**
 * 清算申請を拒否する（却下）
 * @param {string} id - 拒否する清算のID
 * @returns {Promise<Object>} 更新された清算データ
 * @throws {Error} 清算が見つからない場合
 * 
 * 注意：拒否の場合は会計処理は行わない
 * 
 * 処理の流れ：
 * 1. 指定された清算データを検索
 * 2. 申請中ステータスの確認
 * 3. ステータスを「却下」に更新のみ（会計処理なし）
 * 
 * 承認との違い：
 * - 承認：会計仕訳を作成 + ステータス更新
 * - 拒否：ステータス更新のみ
 */
export async function rejectSettlement(id) {
  // ================
  // 1. 清算データの検索と存在確認
  // ================
  const list = await listSettlements();
  const st = list.find(x => x.id === id);
  if (!st) throw new Error("not found");
  
  // 既に処理済みの場合は何もしない
  if (st.status !== "申請中") return st;
  
  // ================
  // 2. ステータスの更新（会計処理は行わない）
  // ================
  return updateSettlementStatus(id, "却下");
}

// ========================
// データ取得関数
// ========================

/**
 * 全ての清算データを取得する
 * @returns {Promise<Array>} 清算データの配列
 * 
 * 用途：
 * - UI表示用の履歴一覧
 * - 申請中清算の存在チェック
 * - 清算状況の確認
 * 
 * 注意：Repository層への単純な委譲だが、
 * 将来的にフィルタリングやソートが必要になった場合は
 * この関数内で処理を追加する
 */
export async function listAllSettlements() {
  return listSettlements(); // Repository層に処理を委譲
}