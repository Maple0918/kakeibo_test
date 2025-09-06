// ========================
// DB層：清算
// 今は配列、将来はAPIに置換
// ========================

const USE_API = false;
let _settlements = [];

export async function listSettlements() {
  if (!USE_API) return [..._settlements];
  // fetch GET ...
}

export async function createSettlement(st) {
  if (!USE_API) { _settlements.push(st); return st; }
  // fetch POST ...
}

export async function updateSettlementStatus(id, status) {
  if (!USE_API) {
    const idx = _settlements.findIndex(x => x.id === id);
    if (idx >= 0) _settlements[idx] = { ..._settlements[idx], status };
    return _settlements[idx];
  }
  // fetch PATCH ...
}