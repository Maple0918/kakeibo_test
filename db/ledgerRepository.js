// ========================
// DB層：台帳仕訳
// 今は配列、将来はAPIに置換
// ========================

const USE_API = false;
let _entries = [];

export async function listEntries() {
  if (!USE_API) return [..._entries];
  // fetch GET ...
}

export async function appendEntries(entries) {
  if (!USE_API) { _entries.push(...entries); return entries; }
  // fetch POST ...
}