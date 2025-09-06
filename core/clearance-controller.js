// ========================
// core/controller-clearance.js
// 清算配線：申請／取消(却下)／承認／棄却 と、サマリー/ボタン/履歴の更新
// ========================




import { show } from "./router.js";
import { currentUser } from "./app-state.js";

// Service
import { listAllSettlements, requestSettlement, approveSettlement, rejectSettlement } from "../services/settlements-service.js";

// View
import { renderSettlementHistory, renderClearanceSummaryAll, renderClearanceActions } from "../ui/settlement-view.js";

const $  = (s, r = document) => r.querySelector(s);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

export async function initClearance() {
  bindButtons();
  bindClearanceRouteInit();
}

/* ---------------- private ---------------- */

function bindClearanceRouteInit() {
  // 「清算」ビューへ来たタイミングでの初期描画
  document.querySelectorAll(".js-route").forEach((btn) => {
    on(btn, "click", async () => {
      if (btn.getAttribute("data-view") !== "clearance") return;
      await renderClearanceSummaryAll();
      await renderClearanceActions();
      await renderSettlementHistory();
    });
  });
}

function bindButtons() {
  const applyBtn   = $(".js-clearance-apply");
  const cancelBtn  = $(".js-clearance-cancel");
  const approveBtn = $(".js-clearance-approve2");
  const rejectBtn  = $(".js-clearance-reject2");

  const refreshAll = async () => {
    await renderClearanceSummaryAll();
    await renderClearanceActions();
    await renderSettlementHistory();
  };
  const getPending = async () => {
    const list = await listAllSettlements();
    return list.find(s => s.status === "申請中");
  };

  on(applyBtn, "click", async () => {
    try {
      const who = ($("#current-user") || document.querySelector(".js-current-user"))?.value || currentUser;
      await requestSettlement(who);
      await refreshAll();
      // show("home"); // 申請後にホームへ戻したい場合は有効化
    } catch (e) { console.warn(e); }
  });

  on(cancelBtn, "click", async () => {
    try {
      const p = await getPending();
      if (p) { await rejectSettlement(p.id); await refreshAll(); }
    } catch (e) { console.warn(e); }
  });

  on(approveBtn, "click", async () => {
    try {
      const p = await getPending();
      if (p) { await approveSettlement(p.id); await refreshAll(); }
    } catch (e) { console.warn(e); }
  });

  on(rejectBtn, "click", async () => {
    try {
      const p = await getPending();
      if (p) { await rejectSettlement(p.id); await refreshAll(); }
    } catch (e) { console.warn(e); }
  });

  // 他UIから呼べるフックも維持（既存コード互換）
  window.__approveSettlement = async (id) => { await approveSettlement(id); await refreshAll(); };
  window.__rejectSettlement  = async (id) => { await rejectSettlement(id);  await refreshAll(); };
}