// ========================
// 画面切り替えの超シンプル実装
// ========================

// 指定IDの<section>だけを表示し、他を非表示にする
export function show(id) {
  document.querySelectorAll("section").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}