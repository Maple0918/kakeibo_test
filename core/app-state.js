// ========================
// UI用の軽い状態
// ========================

// 現在のログインユーザ（"Aさん" / "Bさん"）
export let currentUser = "Aさん";

// ログインユーザを変更（UIのセレクト変更時に呼ばれる）
export function setCurrentUser(u) {
  currentUser = u;
}

// 編集中の支出ID（新規時は null）
export let editingId = null;

export function setEditingId(id) {
  editingId = id;
}