// ========================
// 支出ビジネスロジック（Service層）
// services/expenses-service.js
// 役割：支出データの操作に関するビジネスルールを管理
// 特徴：
// - Repository層（データアクセス）とUI層の中間に位置
// - 複雑なビジネスロジックを集約
// - 会計的な整合性を保つための仕訳処理を含む
// ========================

// データアクセス層（Repository）から支出データ操作機能をインポート
import {
  createExpense,      // 新規支出データの作成
  listExpenses,       // 全支出データの取得
  softDeleteExpense,  // 支出データの論理削除（物理削除ではなく削除フラグの設定）
  updateExpense,      // 既存支出データの更新
  getExpenseById,     // IDによる特定支出データの取得
} from "../repositories/expenses-repository.js";

// 会計処理（仕訳）に関するサービスをインポート
import {
  commitEntries,        // 仕訳データをデータベースに記録
  makeExpenseEntries,   // 支出時の仕訳データを生成
  makeReversalEntries,  // 取消し（逆仕訳）データを生成
} from "./ledger-service.js";

// ========================
// 外部公開関数：UI層から呼び出される関数群
// ========================

/**
 * 全ての支出データを取得する
 * @returns {Promise<Array>} 支出データの配列（論理削除されたものも含む）
 * 
 * 注意：UI層で deleted フラグを確認して表示/非表示を制御する
 */
export async function getAllExpenses() {
  return listExpenses(); // Repository層に処理を委譲
}

/**
 * 新規支出を追加する
 * @param {Object} params - 支出情報
 * @param {string} params.payer - 支払者の名前
 * @param {number} params.amount - 支払金額
 * @param {string} params.date - 支払日（YYYY-MM-DD形式）
 * @param {string} params.category - カテゴリ
 * @param {string} params.memo - メモ
 * @returns {Promise<Object>} 作成された支出データ
 * 
 * 処理の流れ：
 * 1. 一意のIDを生成
 * 2. 支出データを作成（メタデータ含む）
 * 3. データベースに保存
 * 4. 会計仕訳を作成・記録
 */
export async function addExpense({ payer, amount, date, category, memo }) {
  // ================
  // 1. 一意のIDを生成
  // ================
  // タイムスタンプとランダム値を組み合わせて重複のないIDを作成
  const id = `exp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  
  // ================
  // 2. 支出データオブジェクトを構築
  // ================
  const exp = {
    id,                                    // 一意識別子
    payer,                                 // 支払者
    amount,                                // 金額
    date,                                  // 支払いが発生した日付（ユーザー入力）
    category,                              // カテゴリ（食費、交通費など）
    memo,                                  // メモ・備考
    createdBy: payer,                      // 作成者（現在の仕様では支払者と同一）
    lastUpdated: new Date().toISOString(), // 最終更新日時（作成時点）
  };
  
  // ================
  // 3. データベースへの保存
  // ================
  await createExpense(exp); // Repository層でデータベースに保存
  
  // ================
  // 4. 会計仕訳の作成と記録
  // ================
  // 支出に対応する仕訳（会計処理）を生成し、台帳に記録
  // これにより、誰がいくら支払ったかの会計的な記録が残る
  await commitEntries(makeExpenseEntries({ 
    refId: id,        // 参照する支出データのID
    payer,           // 支払者
    total: amount    // 支払総額
  }));
  
  return exp; // 作成された支出データを返す
}

/**
 * 既存の支出データを編集する
 * @param {Object} exp - 編集後の支出データ（IDを含む）
 * @returns {Promise<Object>} 更新された支出データ
 * 
 * 重要な仕様：
 * - createdBy（作成者）と payer（支払者）は変更不可
 * - 会計的整合性を保つため、逆仕訳→更新→新仕訳の順で処理
 * - 台帳方式：過去の記録は削除せず、逆仕訳で相殺してから新記録を追加
 * 
 * 処理の流れ：
 * 1. 既存データの取得と検証
 * 2. 更新データの構築（重要フィールドは既存値を維持）
 * 3. 逆仕訳で既存の会計記録を相殺
 * 4. 支出データの更新
 * 5. 新しい内容で仕訳を再作成
 */
export async function editExpense(exp) {
  // ================
  // 1. 既存データの取得と存在確認
  // ================
  const existing = await getExpenseById(exp.id);
  if (!existing) {
    throw new Error("編集対象の支出が見つかりません。");
  }

  // ================
  // 2. 更新データの構築
  // ================
  // 重要：createdBy と payer は既存値を維持（編集では変更しない）
  // これにより、「誰が作成したか」「誰が支払ったか」の記録が保持される
  const next = {
    ...existing,                           // 既存データをベースにする
    amount: exp.amount,                    // 金額のみ更新可能
    date: exp.date,                        // 日付のみ更新可能
    category: exp.category,                // カテゴリのみ更新可能
    memo: exp.memo,                        // メモのみ更新可能
    lastUpdated: new Date().toISOString(), // 最終更新日時を現在時刻に設定
  };

  // ================
  // 3. 会計処理：既存の仕訳を逆仕訳で相殺
  // ================
  // 台帳方式の原則：過去の記録は削除せず、逆の仕訳を追加して相殺する
  // これにより会計監査や履歴追跡が可能になる
  await commitEntries(await makeReversalEntries(existing.id));

  // ================
  // 4. 支出データの更新
  // ================
  // Repository層でデータベースの支出レコードを更新
  const saved = await updateExpense(next);

  // ================
  // 5. 新しい内容で仕訳を再作成
  // ================
  // 更新された内容に基づいて新しい仕訳を作成し記録
  // 注意：payer は既存データの値を使用（編集では変更されない）
  await commitEntries(
    makeExpenseEntries({ 
      refId: saved.id,    // 更新された支出データのID
      payer: saved.payer, // 既存の支払者（変更不可）
      total: saved.amount // 新しい金額
    })
  );

  return saved; // 更新された支出データを返す
}

/**
 * 支出データを削除する（論理削除）
 * @param {string} expId - 削除する支出データのID
 * @returns {Promise<boolean>} 削除成功時は true
 * 
 * 重要な仕様：
 * - 物理削除ではなく論理削除（deleted フラグを true に設定）
 * - 会計記録は逆仕訳で相殺して整合性を保つ
 * - データは残るため、必要に応じて復元や監査が可能
 * 
 * 処理の流れ：
 * 1. 逆仕訳で既存の会計記録を相殺
 * 2. 支出データに削除フラグを設定
 */
export async function deleteExpense(expId) {
  // ================
  // 1. 会計処理：逆仕訳で相殺
  // ================
  // 削除対象の支出に対応する仕訳を逆仕訳で相殺
  // これにより会計上はその支出がなかったことになる
  await commitEntries(await makeReversalEntries(expId));
  
  // ================
  // 2. 論理削除の実行
  // ================
  // 物理的にデータを削除するのではなく、deleted フラグを true に設定
  // これにより：
  // - データは保持されるため復元可能
  // - 会計監査やデータ分析が可能
  // - UI層では deleted=true のデータを非表示にする
  await softDeleteExpense(expId);
  
  return true; // 削除処理の成功を示す
}