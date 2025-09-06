# 2人用支出清算アプリ（モック）

## 🎯 目的
- 2人だけで使う立替・清算管理アプリのモック
- **台帳方式**：すべての支出や清算を「仕訳」として記録し、残高や差額を計算
- 現在はフロントのみ（配列に保存）。将来は API + DB に置換可能
- 学習用としてシンプルな設計を採用

## 📂 ディレクトリ構成（最新）
```
mock_app/
├── index.html                # 画面本体（SPA）
├── core/                     # 起動・ルータ・軽量UI状態・配線（コントローラ）
│   ├── main.js               # 起動ランナー（init呼び出しのみ）
│   ├── router.js             # 画面切替（.js-route / .js-view）
│   ├── app-state.js          # 現在ユーザ・編集IDなどの軽量UI状態
│   ├── controller-common.js  # 共通配線：ユーザ切替/ルート/支出入力/一覧/履歴/詳細
│   └── controller-clearance.js # 清算配線：申請/取消(却下)/承認/棄却 + サマリー/ボタン
├── ui/                       # 画面描画（View層：DOM操作のみ）
│   ├── expenses-view.js      # 支出一覧（4列：カテゴリ/金額/日付/支払者）
│   └── settlement-view.js    # 差額サマリー共通表示/清算履歴/清算ボタン表示切替
├── services/                 # ビジネスロジック（ドメインルール）
│   ├── ledger-service.js     # 台帳：集計・仕訳生成・逆仕訳
│   ├── expenses-service.js   # 支出：追加/編集/削除 → 仕訳コミット
│   └── settlements-service.js# 清算：差額計算/申請/承認/却下 → 仕訳コミット
└── repositories/             # 今は配列。将来API/DBに差し替え
├── ledger-repository.js
├── expenses-repository.js
└── settlements-repository.js
```

## 🧭 レイヤと責務

1. **core**  
   - `main.js`：起動時に各コントローラの `init()` を呼ぶだけ  
   - `router.js`：SPAの表示切替（`show(view)`）  
   - `app-state.js`：UI用の軽量状態（現在ユーザ/編集中ID など）  
   - **controller-common.js**：ユーザ切替、ルーティング、支出入力（submit/ショートカット/カテゴリ）、支出一覧・清算履歴の再描画、詳細画面フック  
   - **controller-clearance.js**：清算（申請/取消(却下)/承認/棄却）ボタンの配線、**差額サマリー＆ボタン表示の更新**、清算履歴の再描画

2. **ui (View)**
   - DOMを操作して描画するだけ。**ビジネス計算はしない**  
   - ホームと清算の2か所のサマリーは `settlement-view.js` の **共通関数**で同時更新

3. **services (ドメイン)**
   - アプリのルールを実装  
     - 支出：等分仕訳を作成し台帳へコミット  
     - 編集/削除：逆仕訳で相殺してから再コミット  
     - 清算：差額計算、申請/承認/却下に応じて相殺仕訳をコミット  
   - repositories を呼び出して保存/取得

4. **repositories (データ)**
   - 保存の仕組みを隠蔽（今は配列実装、将来API/DBへ差し替え）

## 🔄 主要フロー（イベント → 描画の順序）
- 画面更新時は **「サマリー → アクション → 一覧/履歴」** の順で `await` してズレを防止  
  - 例：清算申請ボタン押下  
    1) `requestSettlement()`（service）  
    2) `renderClearanceSummaryAll()`（サマリー：ホーム＆清算の同時更新）  
    3) `renderClearanceActions()`（ボタンの出し分け）  
    4) `renderSettlementHistory()`（履歴の更新）

## 🧮 台帳方式ルール
- **支出**：2000円立替 → A:+1000, B:-1000  
- **編集**：元仕訳を逆仕訳（符号反転）で相殺 → 新しい仕訳を追加  
- **削除**：逆仕訳を追加 + 論理削除フラグ  
- **清算承認**：差額を相殺する仕訳を追加（例：B → A に 1250円 → A:-1250, B:+1250）

## ➕ 清算計算ルール
- 支出は2人で等分  
- 金額が奇数の場合、**端数は支払者に寄せる**  
  - 例: 1円の支出 → 支払者 +1, 相手 0

## 🔒 ロックのルール
- **清算申請中**は、UIで支出の編集・削除を禁止  
- 承認または却下後に再び編集可能

## 🚀 実行方法（ESM対応の簡易サーバ）

1. サーバを起動（ESM対応のため必須）  
```bash
python3 -m http.server 8000
```
2. ブラウザで [http://localhost:8000](http://localhost:8000) を開く  