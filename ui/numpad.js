// ========================
// ui/numpad.js
// 金額テンキー（式表示つき）。
// #amount(入力値) と #amount-display / #amount-formula を同期。
// 依存：#expense-form 内に #amount, #amount-display, #amount-formula, .js-numpad があること。
// ========================
export function initAmountNumpad() {
  const form = document.getElementById("expense-form");
  if (!form) return;

  const amountInput = form.querySelector("#amount");
  const displayEl   = form.querySelector("#amount-display");
  const formulaEl   = form.querySelector("#amount-formula");
  const keypad      = form.querySelector(".js-numpad");
  if (!amountInput || !displayEl || !formulaEl || !keypad) return;

  // ★重複初期化ガード
  if (keypad.dataset.numpadBound === "1") {
    // 既に初期化済み → 表示を同期しておく
    keypad.__numpadSync?.();
    return;
  }
  keypad.dataset.numpadBound = "1";

  const fmt = new Intl.NumberFormat("ja-JP");

  // 内部状態
  let current  = String(Math.max(0, Number(amountInput.value) || 0));
  let tokens   = [];
  let result   = null;
  let finished = false;

  function toPosInt(n) {
    n = Math.trunc(Number(n) || 0);
    return n < 0 ? 0 : n;
  }

  function calc(ts) {
    if (ts.length === 0) return 0;
    let acc = toPosInt(ts[0]);
    for (let i = 1; i < ts.length; i += 2) {
      const op = ts[i];
      const b  = toPosInt(ts[i + 1]);
      switch (op) {
        case "+": acc += b; break;
        case "-": acc = Math.max(0, acc - b); break;
        case "×": acc *= b; break;
        case "÷": acc = b === 0 ? 0 : Math.floor(acc / b); break;
      }
    }
    return acc;
  }

  function syncDom() {
    const n = toPosInt(current);
    displayEl.textContent = fmt.format(n);
    formulaEl.textContent = tokens.join(" ");
    amountInput.value = String(n); // コントローラはこれを参照
  }

  function resetIfFinished() {
    if (finished) {
      tokens = [];
      current = "0";
      finished = false;
    }
  }

  // ★外から #amount を書き換えたとき用の同期関数
  function syncFromInput() {
    current = String(Math.max(0, Number(amountInput.value) || 0));
    tokens = [];
    finished = false;
    result = null;
    syncDom();
  }
  keypad.__numpadSync = syncFromInput;

  // ボタン群
  keypad.querySelectorAll(".js-key").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const op     = btn.dataset.op;

      if (!action && !op) {
        // 数字
        const d = btn.textContent.trim();
        resetIfFinished();
        current = current === "0" ? d : current + d;
        syncDom();
        return;
      }

      if (action === "clear") {
        current = "0"; tokens = []; finished = false; result = null;
        syncDom();
        return;
      }

      if (action === "back") {
        resetIfFinished();
        current = current.slice(0, -1) || "0";
        syncDom();
        return;
      }

      if (op) {
        if (finished) { tokens = [result]; finished = false; }
        else { tokens.push(toPosInt(current)); }
        tokens.push(op);
        current = "0";
        syncDom();
        return;
      }

      if (action === "equal") {
        tokens.push(toPosInt(current));
        result = calc(tokens);
        formulaEl.textContent = tokens.join(" ") + " =";
        current = String(result);
        finished = true;
        tokens = [];
        syncDom();
        return;
      }

      if (action === "ok") {
        // 値は常に同期済み。OKでは次フィールドへフォーカス（任意）
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