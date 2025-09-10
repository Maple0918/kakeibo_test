// ========================
// 台帳ビジネスロジック（会計処理の中核）
// services/ledger-service.js
// 役割：複式簿記の概念に基づいた会計処理を管理
// 特徴：
// - 仕訳（しわけ）：会計取引を記録する基本単位
// - 台帳方式：過去の記録は削除せず、逆仕訳で相殺
// - 等分計算：支出を2人で平等に分割
// - 端数処理：支払者が端数を負担
// ========================

// データアクセス層から台帳操作機能をインポート
import { 
  appendEntries,  // 台帳に仕訳データを追加
  listEntries     // 台帳から全仕訳データを取得
} from "../repositories/ledger-repository.js";

// ========================
// 集計・計算関数
// ========================

/**
 * ユーザーごとの残高を計算する
 * @returns {Promise<Object>} ユーザー名をキーとした残高オブジェクト
 * 
 * 仕組み：
 * - 全ての仕訳データを取得
 * - ユーザーごとに delta（増減額）を合計
 * - 正の値：受け取り超過、負の値：支払い超過
 * 
 * 例：{ "Aさん": 500, "Bさん": -500 } 
 *     → Aさんが500円多く支払い、Bさんに500円もらう権利がある
 */
export async function sumByUser() {
  // 台帳から全ての仕訳データを取得
  const entries = await listEntries();
  
  // reduce関数を使ってユーザーごとの合計を計算
  return entries.reduce((acc, e) => {
    // 各ユーザーの delta（増減額）を累積
    acc[e.user] = (acc[e.user] || 0) + e.delta;
    return acc;
  }, { "Aさん": 0, "Bさん": 0 }); // 初期値として両ユーザーを0で設定
}

// ========================
// 仕訳生成関数群
// ========================

/**
 * 支出時の仕訳データを生成する（2人等分方式）
 * @param {Object} params - 支出情報
 * @param {string} params.refId - 参照する支出データのID
 * @param {string} params.payer - 支払者の名前
 * @param {number} params.total - 支払総額
 * @returns {Array} 2つの仕訳エントリの配列
 * 
 * 会計の考え方：
 * - 支払者：自分の分 + 相手の分を立て替えた → プラス
 * - 相手：立て替えてもらった → マイナス
 * 
 * 端数処理：
 * - 相手側は切り捨て（Math.floor）
 * - 支払者側が端数を負担（公平性を保つため）
 * 
 * 例：1000円の場合
 * - 支払者：+500円、相手：-500円
 * 例：1001円の場合  
 * - 支払者：+501円、相手：-500円（支払者が1円多く負担）
 */
export function makeExpenseEntries({ refId, payer, total }) {
  // ================
  // 等分計算と端数処理
  // ================
  
  // 相手側の負担額（切り捨てで計算）
  const halfDown = Math.floor(total / 2);
  
  // 支払者側の負担額（端数は支払者が負担）
  const payerPortion = total - halfDown;
  
  // 相手ユーザーを特定
  const other = payer === "Aさん" ? "Bさん" : "Aさん";
  
  // 一意のタイムスタンプを生成（仕訳IDに使用）
  const ts = Date.now();
  
  // ================
  // 仕訳エントリの生成
  // ================
  return [
    // 支払者の仕訳：立て替えた分だけプラス
    { 
      id: `le_${ts}_1`,        // 一意のID
      user: payer,             // 支払者
      delta: +payerPortion,    // 増加額（プラス）
      kind: "expense",         // 仕訳種別
      refId,                   // 参照する支出ID
      ts                       // タイムスタンプ
    },
    // 相手の仕訳：立て替えてもらった分だけマイナス
    { 
      id: `le_${ts}_2`,        // 一意のID
      user: other,             // 相手ユーザー
      delta: -halfDown,        // 減少額（マイナス）
      kind: "expense",         // 仕訳種別
      refId,                   // 参照する支出ID
      ts                       // タイムスタンプ
    },
  ];
}

/**
 * 逆仕訳データを生成する（編集・削除時に使用）
 * @param {string} refId - 取り消し対象の支出ID
 * @returns {Promise<Array>} 逆仕訳エントリの配列
 * 
 * 台帳方式の重要概念：
 * - 過去の記録は物理削除しない
 * - 逆の金額で仕訳を追加して相殺する
 * - これにより会計監査や履歴追跡が可能
 * 
 * 処理の流れ：
 * 1. 対象の支出に関連する全仕訳を検索
 * 2. 各仕訳に対して正負を反転した逆仕訳を生成
 * 3. 結果として元の仕訳の効果が相殺される
 * 
 * 例：元の仕訳が [Aさん:+500, Bさん:-500] の場合
 *     逆仕訳は [Aさん:-500, Bさん:+500] になる
 */
export async function makeReversalEntries(refId) {
  // ================
  // 対象仕訳の検索
  // ================
  
  // 台帳から全ての仕訳を取得
  const entries = await listEntries();
  
  // タイムスタンプを生成（逆仕訳のID用）
  const ts = Date.now();
  
  // 指定されたrefIdに関連する仕訳を抽出
  // kind が "expense" または "reversal" のもの（清算仕訳は除外）
  const targets = entries.filter(e => 
    e.refId === refId && 
    (e.kind === "expense" || e.kind === "reversal")
  );
  
  // ================
  // 逆仕訳の生成
  // ================
  
  // 各対象仕訳に対して、deltaの符号を反転した逆仕訳を作成
  return targets.map((e, i) => ({
    id: `rv_${ts}_${i}`,    // 一意のID（rv = reversal）
    user: e.user,           // 同じユーザー
    delta: -e.delta,        // 金額の符号を反転（これが逆仕訳の核心）
    kind: "reversal",       // 逆仕訳であることを示すkind
    refId,                  // 元の支出IDを参照
    ts                      // タイムスタンプ
  }));
}

/**
 * 清算承認時の仕訳データを生成する
 * @param {Object} params - 清算情報  
 * @param {string} params.settlementId - 清算データのID
 * @param {string} params.directionText - 清算方向テキスト（例："Aさん が Bさん に"）
 * @param {number} params.amount - 清算金額
 * @returns {Array} 清算仕訳エントリの配列
 * 
 * 清算の会計処理：
 * - 支払う人：マイナス（お金が減る）
 * - 受け取る人：プラス（お金が増える）
 * - これにより残高が調整され、差額が解消される
 * 
 * 例：「Aさん が Bさん に 1000円」の場合
 * - Aさん：-1000円（支払い）
 * - Bさん：+1000円（受け取り）
 */
export function makeSettlementEntries({ settlementId, directionText, amount }) {
  // ================
  // 方向テキストの解析
  // ================
  
  // "Aさん が Bさん に" → ["Aさん", "が", "Bさん", "に"]
  const [from, , to] = directionText.split(" ");
  
  // タイムスタンプを生成
  const ts = Date.now();
  
  // ================
  // 清算仕訳の生成
  // ================
  return [
    // 受け取る人の仕訳：受け取り額分だけマイナス（負債の減少）
    { 
      id: `stl_${ts}_to`,      // 一意のID（stl = settlement）
      user: to,                // 受け取る人
      delta: -amount,          // 受け取り（負債減少）
      kind: "settlement",      // 清算仕訳
      refId: settlementId,     // 清算データのID
      ts                       // タイムスタンプ
    },
    // 支払う人の仕訳：支払い額分だけプラス（債権の減少）
    { 
      id: `stl_${ts}_from`,    // 一意のID
      user: from,              // 支払う人  
      delta: +amount,          // 支払い（債権減少）
      kind: "settlement",      // 清算仕訳
      refId: settlementId,     // 清算データのID
      ts                       // タイムスタンプ
    },
  ];
}

// ========================
// 台帳操作関数
// ========================

/**
 * 生成された仕訳データを台帳に記録する
 * @param {Array} entries - 記録する仕訳エントリの配列
 * @returns {Promise} Repository層での処理結果
 * 
 * 役割：
 * - 各種仕訳生成関数で作られたデータを実際に台帳に保存
 * - Repository層への橋渡し役
 * - 会計処理の最終ステップ
 * 
 * 使用例：
 * const entries = makeExpenseEntries({...});
 * await commitEntries(entries);
 */
export async function commitEntries(entries) {
  return appendEntries(entries); // Repository層に処理を委譲
}