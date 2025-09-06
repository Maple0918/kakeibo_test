// ========================
// アプリの起動
// ========================

// core/main.js
// 起動ランナー：配線は各コントローラへ集約

import { initCommon } from "./common-controller.js";
import { initClearance } from "./clearance-controller.js";

window.addEventListener("load", () => {
  initCommon();
  initClearance();
});