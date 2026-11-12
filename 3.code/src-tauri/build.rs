fn main() {
  // 前端产物进入 exe 的唯一通道是 `tauri::generate_context!`：它在编译期按 tauri.conf.json 的
  // `build.distDir`（../dist）把 index.html 内嵌进二进制。cargo 默认指纹只跟踪本 crate 的
  // Rust 源，前端（vite build）变化而 Rust 侧无改动时不会重编，exe 里仍是旧前端 ——
  // 这正是「源码改了、exe 大小与功能不变」的直接原因。
  // 显式声明依赖后：dist 内容变化 -> build script 重跑 -> 本 crate 重编 -> 重新内嵌最新 dist。
  println!("cargo:rerun-if-changed=../dist");
  println!("cargo:rerun-if-changed=../dist/index.html");
  println!("cargo:rerun-if-changed=tauri.conf.json");
  tauri_build::build()
}
