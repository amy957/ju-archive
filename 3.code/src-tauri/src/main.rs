// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! JU 桌面端 IPC 通道（批 BH: Tauri IPC + Rust 存储指令；批 BO: 崩溃包采集；批 CT: 崩溃包导出）
//!
//! 存储指令：`save_state` / `load_state`
//! 存储落盘：`app_data_dir/ju_store.json`
//! 崩溃包指令：`save_crash_dump`（写入）/ `read_crash_dumps`（读取导出）
//! 崩溃包落盘：`app_data_dir/crash_dumps/crash_<timestamp>.json`
//! 前端契约：`desktopInvoke('save_state', { payload })` -> `Result<(), String>`
//!           `desktopInvoke('load_state')`               -> `Result<String, String>`
//!           `desktopInvoke('save_crash_dump', { payload })`      -> `Result<(), String>`
//!           `desktopInvoke('read_crash_dumps', {})`              -> `Result<String, String>`
//!           `desktopInvoke('report_error', { entry })`           -> `Result<(), String>`
//!           `desktopInvoke('clear_encrypted', {})`               -> `Result<(), String>`
//!           （`read_crash_dumps` 返回单个 JSON 字符串，形如
//!            `{"dir":"…","count":N,"exportedAt":<ms>,"dumps":[{"file":"crash_<ts>.json","size":N,"raw":"…","json":…}]}`）

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use serde_json::{json, Map, Value};
use tauri::Manager;

/// 桌面端状态库文件名
const STORE_FILE: &str = "ju_store.json";

/// 桌面端共享状态：应用数据目录（由 `setup` 注入，供各指令读取）
pub struct AppState {
  data_dir: PathBuf,
}

impl AppState {
  /// `ju_store.json` 的绝对路径
  fn store_path(&self) -> PathBuf {
    self.data_dir.join(STORE_FILE)
  }
}

/// 确保数据目录存在（幂等）
fn ensure_data_dir(dir: &Path) -> Result<(), String> {
  if dir.exists() {
    return Ok(());
  }
  fs::create_dir_all(dir).map_err(|e| format!("创建数据目录失败 {}: {}", dir.display(), e))
}

/// 读取整份 state；文件缺失或为空时返回空对象 `{}`
fn read_store(path: &Path) -> Result<Value, String> {
  if !path.exists() {
    return Ok(Value::Object(Map::new()));
  }
  let raw = fs::read_to_string(path).map_err(|e| format!("读取 {} 失败: {}", path.display(), e))?;
  if raw.trim().is_empty() {
    return Ok(Value::Object(Map::new()));
  }
  serde_json::from_str::<Value>(&raw).map_err(|e| format!("解析 {} 失败: {}", path.display(), e))
}

/// 【review20-01 · ISSUE-001】保存前读取既有库：读失败则把原文件隔离为
/// `ju_store.corrupt-<UTCms>.json`（只移不删），隔离失败即中止保存，不静默覆盖。
fn existing_store_or_quarantine(path: &Path) -> Result<Value, String> {
  let err = match read_store(path) {
    Ok(value) => return Ok(value),
    Err(e) => e,
  };
  if !path.exists() {
    return Err(err);
  }
  let ms = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
  let quarantined = path.with_file_name(format!("ju_store.corrupt-{}.json", ms));
  fs::rename(path, &quarantined).map_err(|e| {
    format!("既有库 {} 不可读（{}），隔离为 {} 失败: {}", path.display(), err, quarantined.display(), e)
  })?;
  eprintln!("既有库 {} 不可读（{}），已隔离为 {} 并重建空库", path.display(), err, quarantined.display());
  Ok(Value::Object(Map::new()))
}

/// 进程内写盘互斥：串行化同进程并发写，避免两次写共用同一临时文件互相截断
static STORE_WRITE_LOCK: Mutex<()> = Mutex::new(());

/// 进程内临时文件序号：每次写盘取新号，跨调用不复用同一临时文件
static STORE_WRITE_SEQ: AtomicU64 = AtomicU64::new(0);

// 【review20-04 · ISSUE-004】测试钩子：本线程置位后令同步步骤返回注入错误（仅测试构建）。
#[cfg(test)]
std::thread_local! { static SYNC_FAIL_HOOK: std::cell::Cell<bool> = const { std::cell::Cell::new(false) }; }
/// 临时文件落盘并 fsync：创建→write_all→sync_all 成功后才允许 rename；失败删临时文件返回 Err。
fn write_tmp_synced(tmp: &Path, bytes: &[u8]) -> Result<(), String> {
  let mut file = fs::OpenOptions::new().write(true).create(true).truncate(true).open(tmp).map_err(|e| format!("创建临时文件 {} 失败: {}", tmp.display(), e))?;
  let synced = file.write_all(bytes).map_err(|e| format!("写入 {} 失败: {}", tmp.display(), e)).and_then(|_| sync_all_file(&file, tmp));
  drop(file); if let Err(e) = synced { let _ = fs::remove_file(tmp); return Err(e); } Ok(())
}
#[cfg(not(test))]
fn sync_all_file(file: &fs::File, tmp: &Path) -> Result<(), String> { file.sync_all().map_err(|e| format!("同步临时文件 {} 失败: {}", tmp.display(), e)) }

/// 测试构建下同步失败可注入：钩子置位返回注入错误，与真实同步同点（去掉同步调用即同时去掉钩子）。
#[cfg(test)]
fn sync_all_file(file: &fs::File, tmp: &Path) -> Result<(), String> {
  if SYNC_FAIL_HOOK.with(|h| h.replace(false)) { return Err(format!("同步临时文件 {} 失败: 注入的同步错误", tmp.display())); }
  file.sync_all().map_err(|e| format!("同步临时文件 {} 失败: {}", tmp.display(), e))
}

/// 原子写入：先写同目录临时文件，复核可解析后再 rename 覆盖，避免半截文件。
/// 临时文件名带 pid 与进程内序号，多次写与多进程（双开）各自独立，不会互相覆盖。
fn write_store(path: &Path, value: &Value) -> Result<(), String> {
  let _guard = STORE_WRITE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
  let text = serde_json::to_string(value).map_err(|e| format!("序列化 state 失败: {}", e))?;
  if let Some(parent) = path.parent() {
    ensure_data_dir(parent)?;
  }
  let tmp = path.with_extension(format!(
    "{}.{}.json.tmp",
    std::process::id(),
    STORE_WRITE_SEQ.fetch_add(1, Ordering::SeqCst)
  ));
  write_tmp_synced(&tmp, text.as_bytes())?;
  let verify = fs::read_to_string(&tmp)
    .map_err(|e| format!("回读临时文件 {} 失败: {}", tmp.display(), e))
    .and_then(|raw| serde_json::from_str::<Value>(&raw).map(|_| ()).map_err(|e| format!("临时文件 {} 不可解析: {}", tmp.display(), e)));
  if let Err(e) = verify {
    let _ = fs::remove_file(&tmp);
    return Err(e);
  }
  if let Err(e) = fs::rename(&tmp, path) {
    let _ = fs::remove_file(&tmp);
    return Err(format!("替换 {} 失败: {}", path.display(), e));
  }
  Ok(())
}

/// 全量落盘：把前端序列化好的 payload 写入 `app_data_dir/ju_store.json`
#[tauri::command]
fn save_state(state_dir: tauri::State<AppState>, payload: String) -> Result<(), String> {
  // 先校验 JSON 合法性，避免把损坏内容落盘
  let mut parsed: Value =
    serde_json::from_str(&payload).map_err(|e| format!("save_state payload 不是合法 JSON: {}", e))?;
  ensure_data_dir(&state_dir.data_dir)?;
  let path = state_dir.store_path();
  // 前端 state 不含 errorLog，落盘前回填既有日志，避免全量写入把日志清空
  let existing = existing_store_or_quarantine(&path)?;
  if let Some(object) = parsed.as_object_mut() {
    if !object.contains_key("errorLog") {
      if let Some(log) = existing.get("errorLog") {
        object.insert(String::from("errorLog"), log.clone());
      }
    }
    // 明文全量快照（不含 encStore）落盘前回填磁盘既有密文，避免整快照覆盖删掉加密库；
    // 加密快照本身只带 encStore，不会命中该分支，故不构成双向合并
    if !object.contains_key("encStore") {
      if let Some(enc) = existing.get("encStore") {
        object.insert(String::from("encStore"), enc.clone());
      }
    }
  }
  write_store(&path, &parsed)
}

/// 【review15-01 · ISSUE-001】关闭加密：一次原子写把明文快照落盘并删除 `encStore`。
/// 禁止「先 clear 后写」：clear 与写盘之间崩溃会留空库，在途密文写盘还会复活 encStore。
#[tauri::command]
fn save_plain_and_clear(state_dir: tauri::State<AppState>, payload: String) -> Result<(), String> {
  let mut parsed: Value = serde_json::from_str(&payload)
    .map_err(|e| format!("save_plain_and_clear payload 不是合法 JSON: {}", e))?;
  ensure_data_dir(&state_dir.data_dir)?;
  let path = state_dir.store_path();
  // 明文快照不含 errorLog：回填既有日志，避免关闭加密把错误日志清空
  let existing = existing_store_or_quarantine(&path)?;
  if let Some(object) = parsed.as_object_mut() {
    object.remove("encStore");
    if !object.contains_key("errorLog") {
      if let Some(log) = existing.get("errorLog") {
        object.insert(String::from("errorLog"), log.clone());
      }
    }
  }
  write_store(&path, &parsed)
}

/// 读取落盘 state：返回 JSON 文本；文件缺失时返回 `{}`（前端按空库处理，不报错）
#[tauri::command]
fn load_state(state_dir: tauri::State<AppState>) -> Result<String, String> {
  let path = state_dir.store_path();
  if !path.exists() {
    return Ok(String::from("{}"));
  }
  fs::read_to_string(&path).map_err(|e| format!("读取 {} 失败: {}", path.display(), e))
}

/// 崩溃包采集目录名（位于 `app_data_dir` 之下）
const CRASH_DIR: &str = "crash_dumps";

/// 保存崩溃包：把前端组装好的 JSON 文本写入
/// `app_data_dir/crash_dumps/crash_<timestamp>.json`（毫秒时间戳，单调递增避免覆盖）。
///
/// 与 `save_state` 不同，此处**不因 JSON 非法而拒收**：崩溃包本身就是诊断证据，
/// 解析失败时按原文落盘，保证「坏数据也能被取回」。
#[tauri::command]
fn save_crash_dump<R: tauri::Runtime>(app: tauri::AppHandle<R>, payload: String) -> Result<(), String> {
  let base = app
    .path_resolver()
    .app_data_dir()
    .ok_or_else(|| String::from("无法解析应用数据目录 app_data_dir"))?;
  let dir = base.join(CRASH_DIR);
  fs::create_dir_all(&dir).map_err(|e| format!("创建崩溃包目录失败 {}: {}", dir.display(), e))?;
  let ts = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
  let path: PathBuf = dir.join(format!("crash_{}.json", ts));
  let text = serde_json::from_str::<Value>(&payload)
    .and_then(|v| serde_json::to_string(&v))
    .unwrap_or(payload);
  let tmp = path.with_extension(format!("{}.{}.json.tmp", std::process::id(), STORE_WRITE_SEQ.fetch_add(1, Ordering::SeqCst))); write_tmp_synced(&tmp, text.as_bytes())?;
  if let Err(e) = fs::rename(&tmp, &path) { let _ = fs::remove_file(&tmp); return Err(format!("替换 {} 失败: {}", path.display(), e)); }
  let mut old: Vec<PathBuf> = fs::read_dir(&dir).into_iter().flatten().flatten().map(|e| e.path())
    .filter(|p| p.file_name().map_or(false, |n| n.to_string_lossy().starts_with("crash_") && n.to_string_lossy().ends_with(".json"))).collect();
  old.sort_by_key(|p| (fs::metadata(p).and_then(|m| m.modified()).unwrap_or(std::time::UNIX_EPOCH), p.clone())); let cut = old.len().saturating_sub(20);
  for p in old.into_iter().take(cut) { if let Err(e) = fs::remove_file(&p) { eprintln!("清理旧崩溃包失败 {}: {}", p.display(), e); } }
  Ok(())
}

/// 读取全部崩溃包：遍历 `app_data_dir/crash_dumps/` 下所有 `.json` 文件，
/// 拼装成**单个 JSON 字符串**返回（前端直接落盘为 `JU-CrashLogs-<date>.json`）。
///
/// 返回结构：
/// ```json
/// {"dir":"<crash_dumps 路径>","count":2,"exportedAt":<毫秒时间戳>,
///  "dumps":[{"file":"crash_1712.json","size":812,"raw":"<原文>","json":{...}}]}
/// ```
///
/// 约定：
/// - 目录不存在 / 为空时返回 `count = 0` 的空结构，不报错（首次运行即无崩溃属正常态）；
/// - 单个文件读取失败不中断整体导出：该项带 `error` 字段、`raw` / `json` 置 `null`；
/// - `raw` 保留原文，`json` 为解析结果（解析失败为 `null`），保证「坏数据也能被取回」；
/// - 全程只读本机文件，不触网、不上传。
#[tauri::command]
fn read_crash_dumps(app: tauri::AppHandle) -> Result<String, String> {
  let base = app
    .path_resolver()
    .app_data_dir()
    .ok_or_else(|| String::from("无法解析应用数据目录 app_data_dir"))?;
  let dir = base.join(CRASH_DIR);
  let dir_text = dir.display().to_string();
  let exported_at = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);

  if !dir.exists() {
    return Ok(json!({
      "dir": dir_text,
      "count": 0,
      "exportedAt": exported_at,
      "dumps": Vec::<Value>::new()
    })
    .to_string());
  }

  // 1) 收集并按文件名排序（毫秒时间戳命名，字典序即时间序，便于人工比对）
  let mut paths: Vec<PathBuf> = Vec::new();
  let entries = fs::read_dir(&dir).map_err(|e| format!("读取崩溃包目录失败 {}: {}", dir_text, e))?;
  for entry in entries {
    let entry = entry.map_err(|e| format!("遍历崩溃包目录失败 {}: {}", dir_text, e))?;
    let path = entry.path();
    if !path.is_file() {
      continue;
    }
    let is_json = path
      .extension()
      .and_then(|s| s.to_str())
      .map(|s| s.eq_ignore_ascii_case("json"))
      .unwrap_or(false);
    if is_json {
      paths.push(path);
    }
  }
  paths.sort();

  // 2) 逐个读入原文 + 尽力解析（解析失败不影响导出）
  let mut dumps: Vec<Value> = Vec::with_capacity(paths.len());
  for path in paths.iter() {
    let file = path
      .file_name()
      .and_then(|s| s.to_str())
      .unwrap_or_default()
      .to_string();
    match fs::read_to_string(path) {
      Ok(raw) => {
        let parsed: Value = serde_json::from_str::<Value>(&raw).unwrap_or(Value::Null);
        dumps.push(json!({
          "file": file,
          "size": raw.len(),
          "raw": raw,
          "json": parsed
        }));
      }
      Err(e) => {
        dumps.push(json!({
          "file": file,
          "size": 0,
          "error": format!("读取失败: {}", e),
          "raw": null,
          "json": null
        }));
      }
    }
  }

  Ok(json!({
    "dir": dir_text,
    "count": dumps.len(),
    "exportedAt": exported_at,
    "dumps": dumps
  })
  .to_string())
}

/// 追加错误日志：把 `entry`（前端序列化好的 JSON 文本）压入 `ju_store.json` 的
/// `errorLog` 数组（保留最近 200 条），与 `save_state` 共用同一文件与原子写入。
#[tauri::command]
fn report_error(state_dir: tauri::State<AppState>, entry: String) -> Result<(), String> {
  let parsed: Value =
    serde_json::from_str(&entry).map_err(|e| format!("report_error entry 不是合法 JSON: {}", e))?;
  ensure_data_dir(&state_dir.data_dir)?;
  let path = state_dir.store_path();
  let mut store = existing_store_or_quarantine(&path)?;
  if !store.is_object() {
    store = Value::Object(Map::new());
  }
  let object = store.as_object_mut().ok_or_else(|| String::from("state 根节点不是 JSON 对象"))?;
  let log = object.entry(String::from("errorLog")).or_insert_with(|| Value::Array(Vec::new()));
  if !log.is_array() {
    *log = Value::Array(Vec::new());
  }
  let items = log.as_array_mut().ok_or_else(|| String::from("errorLog 不是 JSON 数组"))?;
  items.push(parsed);
  let overflow = items.len().saturating_sub(200);
  if overflow > 0 {
    items.drain(0..overflow);
  }
  write_store(&path, &store)
}

/// 清除加密落盘痕迹：打开 `ju_store.json` 移除 `encStore` 后原子写回；文件缺失视作已清空。
#[tauri::command]
fn clear_encrypted(state_dir: tauri::State<AppState>) -> Result<(), String> {
  let path = state_dir.store_path();
  if !path.exists() {
    return Ok(());
  }
  let mut store = existing_store_or_quarantine(&path)?;
  if let Some(object) = store.as_object_mut() {
    object.remove("encStore");
  }
  write_store(&path, &store)
}

/// 备份目录安全边界（ISSUE-004）：空串回落 `fallback`；否则须绝对路径、无 `..`、非 UNC。
fn safe_backup_dir(raw: &str, fallback: &Path) -> Result<PathBuf, String> {
  let raw = raw.trim();
  if raw.is_empty() { return Ok(fallback.to_path_buf()); }
  let path = Path::new(raw);
  let bad = path.components().any(|c| matches!(c, std::path::Component::ParentDir)
    || matches!(c, std::path::Component::Prefix(p) if matches!(p.kind(), std::path::Prefix::UNC(..) | std::path::Prefix::VerbatimUNC(..))));
  if !path.is_absolute() || raw.starts_with("\\\\") || bad { return Err(format!("备份目录不安全: {}", raw)); }
  /* 【review7-07 · ISSUE-007】系统关键目录拒写（与前端 _juBlockedDir 同口径：盘符根 / Windows / Program Files / ProgramData / unix 系统目录） */
  let dir = path.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or(path);
  let norm = dir.to_string_lossy().replace('\\', "/").to_lowercase();
  let norm = norm.trim_end_matches('/');
  const ROOTS: [&str; 18] = ["c:/windows", "c:/program files", "c:/program files (x86)", "c:/programdata",
    "/bin", "/boot", "/dev", "/etc", "/lib", "/proc", "/root", "/sbin", "/sys", "/usr", "/var", "/library", "/system", "/applications"];
  let drive = norm.len() == 2 && norm.as_bytes()[0].is_ascii_alphabetic() && norm.as_bytes()[1] == b':';
  let hit = ROOTS.iter().any(|b| norm == *b || norm.starts_with(&format!("{}/", b)));
  if norm.is_empty() || norm == "/" || norm.starts_with("//") || drive || hit { return Err(format!("备份目录不安全: {}", raw)); }
  Ok(path.to_path_buf())
}

/// 【review18-09 · ISSUE-009】备份原子写：临时名带 pid 与序号 + 写锁串行化，写后回读 `serde_json::from_str` 复核，失败删临时文件并返回错误；返回落盘路径。
fn write_backup_file(dir: &Path, file: &str, content: &str) -> Result<PathBuf, String> {
  let _guard = STORE_WRITE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
  let mut target = dir.join(file);
  let mut seq = 0u32; while target.exists() { seq += 1; target = dir.join(format!("{}_{}.json", file.trim_end_matches(".json"), seq)); }
  let tmp = target.with_extension(format!("{}.{}.json.tmp", std::process::id(), STORE_WRITE_SEQ.fetch_add(1, Ordering::SeqCst)));
  let ok = write_tmp_synced(&tmp, content.as_bytes())
    .and_then(|_| fs::read_to_string(&tmp).map_err(|e| format!("写入 {} 失败: {}", tmp.display(), e)))
    .and_then(|raw| serde_json::from_str::<Value>(&raw).map(|_| ()).map_err(|e| format!("临时文件 {} 不可解析: {}", tmp.display(), e)))
    .and_then(|_| fs::rename(&tmp, &target).map_err(|e| format!("替换 {} 失败: {}", target.display(), e)));
  if let Err(e) = ok { let _ = fs::remove_file(&tmp); return Err(e); }
  Ok(target)
}

/// 备份直写（fix41/fix42）：`path` 为空写 `app_data_dir/backups`，否则写其所在目录；
/// 文件名取 `name`（去分隔符、拒 `..`），缺省为 `JU_Backup_<UTC微秒>.json`，写盘后仅保留最近 5 个。
#[tauri::command]
fn save_backup(state_dir: tauri::State<AppState>, path: String, name: Option<String>, content: String) -> Result<String, String> {
  const PREFIX: &str = "JU_Backup_";
  const KEEP: usize = 5;
  let name = name.map(|n| n.trim().replace(['/', '\\'], "_"));
  if name.as_ref().map_or(false, |f| f.is_empty() || f.contains("..")) { return Err(String::from("备份文件名不安全")); }
  let raw = path.trim();
  let dir = if raw.is_empty() {
    state_dir.data_dir.join("backups")
  } else {
    safe_backup_dir(raw, &state_dir.data_dir.join("backups"))?
      .parent()
      .filter(|p| !p.as_os_str().is_empty())
      .map(|p| p.to_path_buf())
      .unwrap_or_else(|| state_dir.data_dir.join("backups"))
  };
  ensure_data_dir(&dir)?;
  let stamp = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_micros())
    .unwrap_or(0);
  let file = name.unwrap_or_else(|| format!("{}{}.json", PREFIX, stamp));
  let target = write_backup_file(&dir, &file, &content)?;
  let mut names: Vec<(String, Option<std::time::SystemTime>)> = fs::read_dir(&dir)
    .ok()
    .into_iter()
    .flatten()
    .flatten()
    .filter_map(|e| {
      let n = e.file_name().into_string().ok()?;
      if !((n.starts_with(PREFIX) || n.starts_with("JU-备份-")) && n.ends_with(".json")) { return None; }
      let mtime = e.metadata().ok().and_then(|m| m.modified().ok());
      Some((n, mtime))
    })
    .collect();
  /* 【review22-03 · ISSUE-003】按 (mtime 倒序, 名字倒序) 排序：同日 `_10` 晚于 `_9` 写入，
     纯名字倒序会把最新一份 `_10` 当作最旧删除；metadata 失败（None）按名字倒序回退。 */
  names.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| b.0.cmp(&a.0)));
  let names: Vec<String> = names.into_iter().map(|(n, _)| n).collect();
  /* 【review11-08 · ISSUE-008】密文/明文分桶各自 skip(KEEP)，避免明文备份把密文备份挤出 */
  /* 【review12-fix · #3】同日重名备份会追加 `_N` 后缀（`xxx.enc_1.json`）：先去掉末尾 `.json`
     再判断是否含 `.enc`，确保带后缀的密文仍归入加密分桶（加密/明文各保留 5 份）。 */
  let (enc, plain): (Vec<String>, Vec<String>) = names.into_iter().partition(|n| {
    n.strip_suffix(".json").unwrap_or(n).contains(".enc")
  });
  for old in enc.into_iter().skip(KEEP).chain(plain.into_iter().skip(KEEP)) {
    let victim = dir.join(&old);
    if let Err(e) = fs::remove_file(&victim) {
      eprintln!("[backup] 旧备份清理失败（忽略）{}: {}", victim.display(), e);
    }
  }
  Ok(target.display().to_string())
}

/// 【review19-03 · ISSUE-003】单实例守卫：Windows 命名 mutex + 命名事件（零新增依赖，不再占用固定端口）。
/// 首个实例持有 mutex 并等待聚焦事件；第二实例发出聚焦请求后带原生提示退出。
const INSTANCE_MUTEX: &str = "Local\\JU-Note-Instance";
const INSTANCE_FOCUS: &str = "Local\\JU-Note-Focus";

#[cfg(windows)]
mod singleton {
  use std::ffi::c_void;

  pub type Handle = isize;
  const ALREADY_EXISTS: u32 = 183;
  #[link(name = "kernel32")]
  extern "system" {
    fn CreateMutexW(attrs: *mut c_void, owner: i32, name: *const u16) -> Handle;
    fn CreateEventW(attrs: *mut c_void, manual: i32, initial: i32, name: *const u16) -> Handle;
    fn SetEvent(handle: Handle) -> i32;
    fn WaitForSingleObject(handle: Handle, millis: u32) -> u32;
    fn CloseHandle(handle: Handle) -> i32;
    fn GetLastError() -> u32;
    fn MessageBoxW(hwnd: Handle, text: *const u16, caption: *const u16, kind: u32) -> i32;
  }

  fn wide(s: &str) -> Vec<u16> { s.encode_utf16().chain(std::iter::once(0)).collect() }

  /// `Ok(Some((mutex, focus)))` 首个实例（句柄存活到进程结束、不主动关闭）；`Ok(None)` 已有实例且已请求其聚焦；`Err` 加锁本身失败。
  pub fn acquire(mutex_name: &str, focus_name: &str) -> Result<Option<(Handle, Handle)>, String> {
    let (mw, fw) = (wide(mutex_name), wide(focus_name));
    let focus = unsafe { CreateEventW(std::ptr::null_mut(), 0, 0, fw.as_ptr()) };
    if focus == 0 {
      return Err(format!("聚焦事件创建失败（错误码 {}）", unsafe { GetLastError() }));
    }
    let mutex = unsafe { CreateMutexW(std::ptr::null_mut(), 1, mw.as_ptr()) };
    let err = unsafe { GetLastError() };
    if mutex == 0 {
      unsafe { CloseHandle(focus) };
      return Err(format!("命名 mutex 创建失败（错误码 {}）", err));
    }
    if err == ALREADY_EXISTS {
      unsafe { SetEvent(focus); CloseHandle(focus); CloseHandle(mutex) };
      return Ok(None);
    }
    Ok(Some((mutex, focus)))
  }

  /// 阻塞等待一次聚焦请求（自动复位事件，消费后继续等待下一次）。
  pub fn wait_focus(handle: Handle) -> bool { unsafe { WaitForSingleObject(handle, 0xFFFF_FFFF) == 0 } }

  /// 原生提示：不依赖 WebView，避免以静默退出替代提示。
  pub fn note(text: &str, is_error: bool) {
    let (t, c) = (wide(text), wide("JU 笔记"));
    unsafe { MessageBoxW(0, t.as_ptr(), c.as_ptr(), if is_error { 0x10 } else { 0x40 }) };
  }
}

/// 【review20-01 · ISSUE-003】有界轮询等待主窗口就绪；超时返回 false（不 panic、不放任请求丢失）。
const FOCUS_READY_TIMEOUT_MS: u64 = 5_000;
const FOCUS_READY_INTERVAL_MS: u64 = 50;

fn focus_when_ready<W, G: FnMut() -> Option<W>, F: FnMut(&W)>(mut get: G, mut focus: F, timeout_ms: u64, interval_ms: u64) -> bool {
  let deadline = std::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);
  loop {
    if let Some(w) = get() { focus(&w); return true; }
    let now = std::time::Instant::now();
    if now >= deadline { return false; }
    let step = std::time::Duration::from_millis(interval_ms.max(1));
    std::thread::sleep(step.min(deadline - now));
  }
}

/// 【优化 #2】数据目录可重定向：`--data-dir <path>` > `JU_DATA_DIR` > 平台默认 app_data_dir。
/// 用途：QA 隔离测试（互不干扰的多实例）、便携模式、以及绕过受限目录写入策略。
/// 只影响 store / crash_dumps 的落点，不改任何已有数据的读取语义。
fn resolve_data_dir(app: &tauri::App) -> Result<PathBuf, String> {
  let args: Vec<String> = std::env::args().collect();
  let mut from_arg: Option<PathBuf> = None;
  let mut i = 1;
  while i < args.len() {
    if args[i] == "--data-dir" || args[i] == "--data-dir=" {
      if let Some(v) = args.get(i + 1) {
        from_arg = Some(PathBuf::from(v));
        break;
      }
    } else if let Some(v) = args[i].strip_prefix("--data-dir=") {
      if !v.is_empty() { from_arg = Some(PathBuf::from(v)); break; }
    }
    i += 1;
  }
  if let Some(d) = from_arg {
    eprintln!("[ju] 数据目录（--data-dir）：{}", d.display());
    return Ok(d);
  }
  if let Ok(v) = std::env::var("JU_DATA_DIR") {
    if !v.trim().is_empty() {
      let d = PathBuf::from(v);
      eprintln!("[ju] 数据目录（JU_DATA_DIR）：{}", d.display());
      return Ok(d);
    }
  }
  app.path_resolver()
    .app_data_dir()
    .ok_or_else(|| String::from("无法解析应用数据目录 app_data_dir"))
}

/// 构建并进入 Tauri 主循环（可被 main 重试调用一次）。
fn build_and_run(focus: singleton::Handle) -> Result<(), tauri::Error> {
  tauri::Builder::default()
    .setup(move |app| {
      let handle = app.handle();
      std::thread::spawn(move || {
        while singleton::wait_focus(focus) {
          let ok = focus_when_ready(
            || handle.get_window("main"),
            |w| { let _ = w.show(); let _ = w.unminimize(); let _ = w.set_focus(); },
            FOCUS_READY_TIMEOUT_MS,
            FOCUS_READY_INTERVAL_MS,
          );
          if !ok {
            eprintln!("[singleton] 聚焦超时：{}ms 内未取得主窗口", FOCUS_READY_TIMEOUT_MS);
          }
        }
      });
      let data_dir = resolve_data_dir(app)?;
      ensure_data_dir(&data_dir)?;
      app.manage(AppState { data_dir });
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      save_state,
      save_plain_and_clear,
      load_state,
      save_crash_dump,
      read_crash_dumps,
      report_error,
      clear_encrypted,
      save_backup
    ])
    .run(tauri::generate_context!())
}

/// 【F-1】WebView2 数据目录不可复用时的自愈：把 EBWebView 整体改名备份，下一次启动用全新 profile。
/// 触发条件：CreateWebview / 0x800700AA（"请求的资源在使用中"）。不改用户文档数据（只动浏览器缓存）。
fn reset_webview_profile() -> bool {
  let base = match std::env::var("LOCALAPPDATA") { Ok(v) => v, Err(_) => return false };
  let dir = PathBuf::from(base).join("com.ju.app").join("EBWebView");
  if !dir.exists() { return false; }
  let ms = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
  let bak = dir.with_file_name(format!("EBWebView.bak-{ms}"));
  match fs::rename(&dir, &bak) {
    Ok(_) => { eprintln!("[ju] WebView2 数据目录不可用，已重置：{} -> {}", dir.display(), bak.display()); true }
    Err(e) => { eprintln!("[ju] WebView2 数据目录重置失败：{} ({})", dir.display(), e); false }
  }
}

fn main() {
  let focus = match singleton::acquire(INSTANCE_MUTEX, INSTANCE_FOCUS) {
    Ok(Some((_mutex, f))) => f,
    Ok(None) => {
      singleton::note("JU 笔记已在运行，已请求切换到已打开的窗口。", false);
      return;
    }
    Err(e) => {
      singleton::note(&format!("单实例守卫创建失败，程序退出。\n{e}"), true);
      std::process::exit(1);
    }
  };
  match build_and_run(focus) {
    Ok(()) => {}
    Err(e) => {
      let msg = format!("{e}");
      let webview_broken = msg.contains("CreateWebview") || msg.contains("0x800700AA") || msg.contains("WebView2");
      if webview_broken && reset_webview_profile() {
        eprintln!("[ju] 已重置 WebView2 数据目录，重试启动一次");
        if let Err(e2) = build_and_run(focus) {
          singleton::note(&format!("JU 启动失败（WebView2 已重置仍不可用）：\n{e2}"), true);
          std::process::exit(1);
        }
      } else {
        singleton::note(&format!("JU 启动失败：\n{msg}"), true);
        std::process::exit(1);
      }
    }
  }
}

/// 真实往返验收（tauri v1 mock 运行时，dev-dependencies 提供 `tauri::test`）：
/// 磁盘先有密文快照，再来一次明文整快照 save_state，密文键必须仍在。
#[cfg(test)]
mod tests {
  use super::*;

  fn mock_app(tag: &str) -> tauri::App<tauri::test::MockRuntime> {
    let dir = std::env::temp_dir().join(format!("ju-fix34-2-{}", tag));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("创建临时数据目录失败");
    tauri::test::mock_builder()
      .manage(AppState { data_dir: dir })
      .build(tauri::test::mock_context(tauri::test::noop_assets()))
      .expect("构建 mock app 失败")
  }

  /// 崩溃包用例互斥：`save_crash_dump` 经 `path_resolver` 落到同一 mock 目录，两个崩溃包用例必须串行。
  static CRASH_USE_LOCK: Mutex<()> = Mutex::new(());

  /// 【review20-01 · ISSUE-001】既有库损坏时保存不得静默覆盖：原文件须原字节隔离为
  /// `ju_store.corrupt-<UTCms>.json`，且新库可解析（证伪：helper 退回 unwrap_or_else 后无隔离件）。
  #[test]
  fn save_state_quarantines_corrupt_store_before_overwrite() {
    let app = mock_app("corrupt-quarantine");
    let path = app.state::<AppState>().store_path();
    let corrupt = r#"{"nodes":[{"id":"n1""#;
    fs::write(&path, corrupt).expect("预置损坏库失败");
    save_state(app.state::<AppState>(), String::from(r#"{"nodes":[{"id":"n2"}]}"#))
      .expect("save_state 失败");
    let parent = path.parent().unwrap().to_path_buf();
    let is_corrupt = |p: &PathBuf| p.file_name().and_then(|n| n.to_str())
      .map(|n| n.starts_with("ju_store.corrupt-") && n.ends_with(".json")).unwrap_or(false);
    let quarantined: Vec<PathBuf> = fs::read_dir(&parent).expect("列目录失败")
      .filter_map(|e| e.ok()).map(|e| e.path()).filter(is_corrupt).collect();
    assert_eq!(quarantined.len(), 1, "必须隔离出且仅隔离出一个损坏库副本");
    assert_eq!(fs::read_to_string(&quarantined[0]).expect("读隔离件失败"), corrupt, "隔离件必须保持原字节");
    let after = read_store(&path).expect("新库必须可解析");
    assert!(after.get("nodes").is_some(), "新库应包含本次落盘内容");
    if std::env::var("JU_KEEP_TEST_STORE").is_err() {
      let _ = fs::remove_dir_all(parent);
    }
  }

  /// 统计数据目录下 `ju_store.corrupt-*.json` 隔离件（review22-05 用例共用）。
  fn corrupt_copies(path: &Path) -> Vec<PathBuf> {
    let is_corrupt = |p: &PathBuf| p.file_name().and_then(|n| n.to_str())
      .map(|n| n.starts_with("ju_store.corrupt-") && n.ends_with(".json")).unwrap_or(false);
    fs::read_dir(path.parent().expect("路径无父目录")).expect("列目录失败")
      .filter_map(|e| e.ok()).map(|e| e.path()).filter(is_corrupt).collect()
  }

  /// 【review22-05 · ISSUE-005】损坏库上追加错误日志不得静默失败：原文件原字节隔离、新库含 errorLog 数组。
  /// （证伪：report_error 改回 read_store 后无隔离件，本用例转红）
  #[test]
  fn report_error_quarantines_corrupt_store() {
    let app = mock_app("report-corrupt");
    let path = app.state::<AppState>().store_path();
    let corrupt = r#"{"nodes":[{"id":"n1""#;
    fs::write(&path, corrupt).expect("预置损坏库失败");
    report_error(app.state::<AppState>(), String::from(r#"{"msg":"boom"}"#)).expect("report_error 失败");
    let copies = corrupt_copies(&path);
    assert_eq!(copies.len(), 1, "必须隔离出且仅隔离出一个损坏库副本");
    assert_eq!(fs::read_to_string(&copies[0]).expect("读隔离件失败"), corrupt, "隔离件必须保持原字节");
    let after = read_store(&path).expect("新库必须可解析");
    assert!(after.get("errorLog").and_then(Value::as_array).is_some(), "新库应含 errorLog 数组");
    if std::env::var("JU_KEEP_TEST_STORE").is_err() { let _ = fs::remove_dir_all(path.parent().unwrap()); }
  }

  /// 【review20-04 · ISSUE-004】fsync 失败须传播为 Err 且不得替换目标库（证伪：去掉同步后钩子不触发，本用例转红）。
  #[test]
  fn write_store_reports_sync_failure_without_replacing_target() {
    let app = mock_app("sync-fail"); let path = app.state::<AppState>().store_path();
    fs::write(&path, r#"{"nodes":[{"id":"old"}]}"#).expect("预置目标库失败");
    SYNC_FAIL_HOOK.with(|h| h.set(true)); let result = write_store(&path, &json!({"nodes":[{"id":"new"}]}));
    assert!(result.is_err(), "sync_all 失败必须返回 Err");
    assert_eq!(fs::read_to_string(&path).expect("读目标库失败"), r#"{"nodes":[{"id":"old"}]}"#, "同步失败不得替换目标文件");
    assert!(!fs::read_dir(path.parent().unwrap()).expect("列目录失败").filter_map(|e| e.ok()).any(|e| e.file_name().to_string_lossy().ends_with(".json.tmp")), "同步失败必须删除临时文件");
    if std::env::var("JU_KEEP_TEST_STORE").is_err() { let _ = fs::remove_dir_all(path.parent().unwrap()); }
  }

  #[test]
  fn save_state_keeps_existing_encstore() {
    let app = mock_app("enc");
    let path = app.state::<AppState>().store_path();
    fs::write(&path, r#"{"encStore":"{\"v\":1}","errorLog":[{"msg":"x"}]}"#).expect("预置磁盘失败");
    save_state(app.state::<AppState>(), String::from(r#"{"nodes":[{"id":"n1"}]}"#))
      .expect("save_state 失败");
    let after = read_store(&path).expect("回读失败");
    assert!(after.get("nodes").is_some(), "明文快照应落盘");
    assert!(after.get("errorLog").is_some(), "errorLog 必须回填");
    assert!(after.get("encStore").is_some(), "整快照落盘后 encStore 必须保留");
    if std::env::var("JU_KEEP_TEST_STORE").is_err() {
      let _ = fs::remove_dir_all(path.parent().unwrap());
    }
  }

  /// 【review14-02 · ISSUE-002】clear 与在途 save_state 串行后不得回填旧密文：
  /// 写加密快照 → clear_encrypted → 明文 save_state，encStore 必须不存在。
  /// （证伪：删 clear_encrypted 内 `object.remove("encStore")` 后本用例转红）
  #[test]
  fn save_state_after_clear_does_not_backfill() {
    let app = mock_app("clear-backfill");
    let path = app.state::<AppState>().store_path();
    save_state(app.state::<AppState>(), String::from(r#"{"encStore":"{\"v\":1}"}"#))
      .expect("写入加密快照失败");
    assert!(read_store(&path).expect("回读失败").get("encStore").is_some(), "加密快照应已落盘");
    clear_encrypted(app.state::<AppState>()).expect("clear_encrypted 失败");
    save_state(app.state::<AppState>(), String::from(r#"{"nodes":[{"id":"n1","text":"PLAIN"}]}"#))
      .expect("明文 save_state 失败");
    let after = read_store(&path).expect("回读失败");
    assert!(after.get("nodes").is_some(), "明文快照必须落盘");
    assert!(after.get("encStore").is_none(), "clear 后明文 save_state 不得回填旧密文");
    if std::env::var("JU_KEEP_TEST_STORE").is_err() {
      let _ = fs::remove_dir_all(path.parent().unwrap());
    }
  }

  /// 【review17-12 · ISSUE-012】并发写同一 store：两线程各写 100 次，读回必须恒为合法 JSON
  /// （证伪：临时文件改回固定名并发放大后读回应出现解析失败）
  #[test]
  fn concurrent_write_store_keeps_json_parseable() {
    let app = mock_app("concurrent");
    let path = app.state::<AppState>().store_path();
    let handles: Vec<_> = (0..2)
      .map(|t| {
        let p = path.clone();
        std::thread::spawn(move || {
          for i in 0..100 {
            write_store(&p, &json!({"thread": t, "seq": i, "blob": "x".repeat(1024)})).expect("并发写盘失败");
            serde_json::from_str::<Value>(&fs::read_to_string(&p).expect("读回失败")).expect("并发写后读回必须是合法 JSON");
          }
        })
      })
      .collect();
    for h in handles {
      h.join().expect("并发写线程 panic");
    }
    let _ = fs::remove_dir_all(path.parent().unwrap());
  }

  /// 【review19-03 · ISSUE-003】同名 mutex 第二次取守卫必须判定「已在运行」（负向用例）。
  /// 名称按 pid + 纳秒生成，不占用任何固定端口，可与其他用例并发运行。
  #[test]
  fn second_instance_guard_detects_running() {
    let n = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
    let (m, f) = (format!("JU-test-{}-{}", std::process::id(), n), format!("JU-focus-{}-{}", std::process::id(), n));
    assert!(matches!(singleton::acquire(&m, &f), Ok(Some(_))), "首个实例应当拿到守卫");
    assert!(matches!(singleton::acquire(&m, &f), Ok(None)), "同名第二次必须判定已在运行");
  }

  /// 【review20-01 · ISSUE-003】无窗口时聚焦请求须有界放弃，不得无限等待或误报成功。
  /// （证伪：改回单次 `if let Some` 并恒返回 true 后本用例转红）
  #[test]
  fn focus_when_ready_gives_up_without_window() {
    let mut calls = 0u32;
    let started = std::time::Instant::now();
    let ok = focus_when_ready(|| { calls += 1; None::<u8> }, |_| {}, 5_000, 50);
    assert!(!ok, "无窗口时不得声称聚焦成功");
    assert!(started.elapsed() <= std::time::Duration::from_millis(5_100), "必须在 5s 内有界返回，实耗 {:?}", started.elapsed());
    assert!(calls >= 2, "必须轮询重试而非只试一次，实试 {} 次", calls);
  }

  
    /// 【review15-01 · ISSUE-001】关闭加密一次写盘内落明文并删密文：明文在、encStore 不在。
    #[test]
    fn save_plain_and_clear_removes_encstore_in_one_write() {
      let app = mock_app("plain-clear");
      let path = app.state::<AppState>().store_path();
      save_state(app.state::<AppState>(), String::from(r#"{"encStore":"{\"v\":1}","errorLog":[{"msg":"x"}]}"#))
        .expect("写入加密快照失败");
      save_plain_and_clear(app.state::<AppState>(), String::from(r#"{"nodes":[{"id":"n1","text":"PLAIN-AFTER"}]}"#))
        .expect("save_plain_and_clear 失败");
      let after = read_store(&path).expect("回读失败");
      assert!(after.to_string().contains("PLAIN-AFTER"), "明文快照必须落盘");
      assert!(after.get("encStore").is_none(), "一次写盘后不得残留 encStore");
      assert!(after.get("errorLog").is_some(), "errorLog 必须回填");
      if std::env::var("JU_KEEP_TEST_STORE").is_err() {
        let _ = fs::remove_dir_all(path.parent().unwrap());
      }
    }

    /// 【review15-02 · ISSUE-002】强杀窗口内原子写：加密快照 → save_plain_and_clear 一次写盘后，
    /// 磁盘必须无 encStore 且 nodes 完整（证伪：拆成两次调用则中间态留旧密文或缺明文）。
    #[test]
    fn save_plain_and_clear_is_atomic() {
      let app = mock_app("plain-atomic");
      let path = app.state::<AppState>().store_path();
      save_state(app.state::<AppState>(), String::from(r#"{"encStore":"{\"cipher\":1}","nodes":{"n1":{"id":"n1","text":"OLD-ENC"}}}"#))
        .expect("写入加密快照失败");
      save_plain_and_clear(app.state::<AppState>(), String::from(r#"{"rootId":"n1","nodes":{"n1":{"id":"n1","text":"G-PLAIN"},"n2":{"id":"n2","text":"N2"}}}"#))
        .expect("save_plain_and_clear 失败");
      let after = read_store(&path).expect("回读失败");
      let nodes = after.get("nodes").and_then(|v| v.as_object()).expect("nodes 必须完整落盘");
      assert_eq!(nodes.len(), 2, "nodes 必须完整，实得 {}", nodes.len());
      let text = |k: &str| nodes.get(k).and_then(|n| n.get("text")).and_then(|t| t.as_str());
      assert_eq!(text("n1"), Some("G-PLAIN"), "新标题必须落盘");
      assert_eq!(text("n2"), Some("N2"), "未变更节点不得丢失");
      assert_eq!(after.get("rootId").and_then(|v| v.as_str()), Some("n1"), "rootId 必须保留");
      assert!(after.get("encStore").is_none(), "一次写盘后不得残留 encStore");
      if std::env::var("JU_KEEP_TEST_STORE").is_err() {
        let _ = fs::remove_dir_all(path.parent().unwrap());
      }
    }
  
    #[test]
    fn save_backup_keeps_latest_five() {
    let app = mock_app("backup-roll");
    let dir = app.state::<AppState>().data_dir.join("backups");
    fs::create_dir_all(&dir).expect("创建备份目录失败");
    for i in 0..6 {
      fs::write(dir.join(format!("JU-备份-2026-10-{:02}.json", i + 1)), "{}").expect("写入旧命名备份失败");
    }
    let as_file = dir.join("JU-备份-2026-11-01.json").display().to_string();
    let mut written: Vec<String> = Vec::new();
    for _ in 0..6 {
      written.push(
        save_backup(app.state::<AppState>(), as_file.clone(), None, String::from(r#"{"type":"full-backup"}"#))
          .expect("备份失败"),
      );
    }
    let count = fs::read_dir(&dir)
      .expect("读取备份目录失败")
      .filter_map(|e| e.ok())
      .filter(|e| e.file_name().to_string_lossy().ends_with(".json"))
      .count();
    assert_eq!(count, 5, "备份数量应恒定为 5");
    assert!(!Path::new(&written[0]).exists(), "最早备份应被删除");
    assert!(Path::new(&written[5]).exists(), "最新备份应存在");
    let _ = fs::remove_dir_all(&dir);
  }

  /// 【review22-03 · ISSUE-003】同日 11 份备份（`_1`..`_10`，mtime 递增）按 (mtime desc, name desc) 轮转：
  /// 最新 `_10` 必须留存、最早 `_1` 必须清理（证伪：改回纯名字倒序后 `_10` 被删，本用例转红）
  #[test]
  fn save_backup_keeps_newest_same_day() {
    let app = mock_app("backup-same-day");
    let dir = app.state::<AppState>().data_dir.join("backups");
    fs::create_dir_all(&dir).expect("创建备份目录失败");
    let base = std::time::SystemTime::now() - std::time::Duration::from_secs(3600);
    for i in 0..10u64 {
      let file = if i == 0 { String::from("JU-备份-2026-11-01.json") } else { format!("JU-备份-2026-11-01_{}.json", i) };
      let p = dir.join(&file);
      fs::write(&p, "{}").expect("预置同日备份失败");
      fs::File::options().write(true).open(&p).expect("打开备份失败")
        .set_modified(base + std::time::Duration::from_secs(i * 10)).expect("设置备份 mtime 失败");
    }
    let written = save_backup(app.state::<AppState>(), String::new(), Some(String::from("JU-备份-2026-11-01.json")), String::from("{}")).expect("备份失败");
    assert!(written.ends_with("_10.json"), "同日第 11 份应为 _10，实得 {}", written);
    let count = fs::read_dir(&dir).expect("读取备份目录失败").filter(|e| e.as_ref().map_or(false, |e| e.file_name().to_string_lossy().ends_with(".json"))).count();
    assert_eq!(count, 5, "同日备份应只保留 5 份，实得 {}", count);
    assert!(Path::new(&written).exists(), "最新备份 _10 不得被删除，实得 {}", written);
    assert!(!dir.join("JU-备份-2026-11-01_1.json").exists(), "最早备份 _1 应被清理");
    let _ = fs::remove_dir_all(&dir);
  }

  /// 【review11-08 · ISSUE-008】密文与明文分桶配额：5 明文 + 2 密文时密文全在、明文保持 5 个
  /// （证伪：改回单窗口 `names.into_iter().skip(KEEP)` 后 enc_count 实得 0）
  #[test]
  fn save_backup_keeps_encrypted_quota() {
    let app = mock_app("backup-enc-quota");
    let dir = app.state::<AppState>().data_dir.join("backups");
    fs::create_dir_all(&dir).expect("创建备份目录失败");
    for d in 5..10 {
      fs::write(dir.join(format!("JU-备份-2026-10-{:02}.json", d)), "{}").expect("预置明文备份失败");
    }
    for d in 1..3 {
      fs::write(dir.join(format!("JU-备份-2026-10-{:02}.enc.json", d)), "{}").expect("预置密文备份失败");
    }
    save_backup(app.state::<AppState>(), dir.join("x.json").display().to_string(), Some(String::from("JU-备份-2026-11-01.json")), String::from("{}")).expect("备份失败");
    let count = |enc: bool| fs::read_dir(&dir)
      .expect("读取备份目录失败")
      .filter_map(|e| e.ok())
      .filter(|e| { let n = e.file_name().to_string_lossy().to_string(); n.ends_with(".json") && n.ends_with(".enc.json") == enc })
      .count();
    assert_eq!(count(true), 2, "密文备份不得被明文挤出，实得 {}", count(true));
    assert_eq!(count(false), 5, "明文备份应保持 5 个，实得 {}", count(false));
    assert!(dir.join("JU-备份-2026-10-01.enc.json").exists(), "最早密文备份必须保留");
    let _ = fs::remove_dir_all(&dir);
  }

  /// 【review12-fix · #3】同日重名密文（`_N` 后缀）必须与密文同桶：
  /// 6 个密文备份（含 `.enc_1.json`）只保留 5 个，且明文桶为 0。
  #[test]
  fn save_backup_counts_encrypted_with_suffix_in_enc_bucket() {
    let app = mock_app("backup-enc-suffix");
    let dir = app.state::<AppState>().data_dir.join("backups");
    fs::create_dir_all(&dir).expect("创建备份目录失败");
    for d in 1..6 {
      fs::write(dir.join(format!("JU-备份-2026-10-{:02}.enc.json", d)), "{}").expect("预置密文备份失败");
    }
    let written = save_backup(app.state::<AppState>(), dir.join("x.json").display().to_string(), Some(String::from("JU-备份-2026-10-01.enc.json")), String::from("{}")).expect("备份失败");
    assert!(written.ends_with(".enc_1.json"), "冲突时应追加 _1 后缀，实得 {}", written);
    let is_enc = |n: &str| n.strip_suffix(".json").unwrap_or(n).contains(".enc");
    let count = |enc: bool| fs::read_dir(&dir)
      .expect("读取备份目录失败")
      .filter_map(|e| e.ok())
      .filter(|e| { let n = e.file_name().to_string_lossy().to_string(); n.ends_with(".json") && is_enc(&n) == enc })
      .count();
    assert_eq!(count(true), 5, "密文备份应保持 5 个，实得 {}", count(true));
    assert_eq!(count(false), 0, "带 _N 的密文不得落入明文桶，实得 {}", count(false));
    assert!(!dir.join("JU-备份-2026-10-01.enc.json").exists(), "加密桶最早备份应被清理");
    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn save_backup_uses_name() {
    let app = mock_app("backup-name");
    let dir = app.state::<AppState>().data_dir.join("backups");
    let written = save_backup(app.state::<AppState>(), dir.join("x.json").display().to_string(), Some(String::from("JU-备份-2026-11-01.json")), String::from("{}")).expect("备份失败");
    assert_eq!(Path::new(&written).file_name().unwrap().to_string_lossy(), "JU-备份-2026-11-01.json", "文件名应为 JU-备份-…，实得 {}", written);
    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn save_backup_leaves_no_tmp_residue() {
    let app = mock_app("backup-tmp");
    let dir = app.state::<AppState>().data_dir.join("backups");
    let written = save_backup(app.state::<AppState>(), dir.join("x.json").display().to_string(), None, String::from("{}")).expect("备份失败");
    assert!(Path::new(&written).exists(), "备份应落盘，实得 {}", written);
    let tmp = fs::read_dir(&dir).expect("读取备份目录失败").filter(|e| e.as_ref().map_or(false, |e| e.file_name().to_string_lossy().ends_with(".json.tmp"))).count();
    assert_eq!(tmp, 0, "写盘后不得残留 .json.tmp，实得 {}", tmp);
    assert!(save_backup(app.state::<AppState>(), dir.join("x.json").display().to_string(), Some(String::from("JU-备份-x.json")), String::from("not-json")).is_err(), "内容不可解析时备份必须失败");
    assert_eq!(fs::read_dir(&dir).expect("读取备份目录失败").filter(|e| e.as_ref().map_or(false, |e| e.file_name().to_string_lossy().ends_with(".json.tmp"))).count(), 0, "校验失败后不得残留临时文件");
    let _ = fs::remove_dir_all(&dir);
  }

  /// 【review18-09 · ISSUE-009】并发备份写（`save_backup` 同一写路径）：两线程各 50 次，每次落盘回读必须可解析且无 .json.tmp 残留（证伪：临时名改回固定并去锁后出现失败）
  #[test]
  fn concurrent_save_backup_keeps_parseable_and_no_tmp() {
    let dir = std::env::temp_dir().join("ju-fix34-2-backup-concurrent");
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("创建备份目录失败");
    let handles: Vec<_> = (0..2).map(|t| {
      let d = dir.clone();
      std::thread::spawn(move || for i in 0..50 {
        let content = json!({"thread": t, "seq": i, "blob": "x".repeat(200_000)}).to_string();
        let p = write_backup_file(&d, "JU-备份-2026-11-01.json", &content).expect("并发备份失败");
        serde_json::from_str::<Value>(&fs::read_to_string(&p).expect("读回备份失败")).expect("并发备份落盘文件必须可解析");
      })
    }).collect();
    for h in handles { h.join().expect("并发备份线程 panic"); }
    let names: Vec<String> = fs::read_dir(&dir).expect("读取备份目录失败").filter_map(|e| e.ok()).map(|e| e.file_name().to_string_lossy().to_string()).collect();
    assert_eq!(names.iter().filter(|n| n.ends_with(".json.tmp")).count(), 0, "不得残留 .json.tmp");
    assert_eq!(names.iter().filter(|n| n.ends_with(".json")).count(), 100, "100 次备份应全部落盘");
    let _ = fs::remove_dir_all(&dir);
  }

  /// 默认备份目录：空 `path` 必须落 `app_data_dir/backups`（证伪：若回退后再取 parent，则落 data_dir，本用例转红）
  #[test]
  fn save_backup_default_dir() {
    let app = mock_app("backup-default");
    let dir = app.state::<AppState>().data_dir.join("backups");
    let written = save_backup(app.state::<AppState>(), String::new(), None, String::from("{}")).expect("备份失败");
    assert_eq!(Path::new(&written).parent().map(|p| p.to_path_buf()).as_deref(), Some(dir.as_path()), "空 path 应写入 app_data_dir/backups，实得 {}", written);
    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn rejects_parent_dir_backup() {
    let fallback = std::env::temp_dir();
    assert!(safe_backup_dir(r"..\evil", &fallback).is_err(), r#"rejects "..\evil""#);
    assert!(safe_backup_dir(r"\\srv\share", &fallback).is_err(), "rejects UNC");
  }

  /// 【review7-07 · ISSUE-007】系统关键目录必须拒写（证伪：删白名单后本用例转红）
  #[test]
  fn save_backup_rejects_system_dir() {
    let app = mock_app("backup-blocked");
    let r = save_backup(app.state::<AppState>(), String::from(r"C:\Windows\Temp\x.json"), None, String::from("{}"));
    assert!(r.is_err(), "C:\\Windows\\Temp 下不得写备份，实得 {:?}", r);
  }

  #[test]
  fn save_crash_dump_keeps_latest_twenty() {
    let _g = CRASH_USE_LOCK.lock().unwrap_or_else(|e| e.into_inner()); let app = mock_app("crash-roll"); let dir = app.path_resolver().app_data_dir().expect("解析数据目录失败").join(CRASH_DIR);
    let _ = fs::remove_dir_all(&dir); fs::create_dir_all(&dir).expect("创建崩溃目录失败");
    for i in 0..24u64 {
      let p = dir.join(format!("crash_{}.json", 1000000000000u64 + i)); fs::write(&p, "{}").expect("预置崩溃包失败");
      fs::File::options().write(true).open(&p).expect("打开崩溃包失败").set_times(fs::FileTimes::new().set_modified(std::time::UNIX_EPOCH + std::time::Duration::from_secs(1_000_000 + (23 - i)))).expect("设置 mtime 失败");
    }
    save_crash_dump(app.handle(), String::from(r#"{"reason":"review23-07"}"#)).expect("写入崩溃包失败"); let names: Vec<String> = fs::read_dir(&dir).expect("读取崩溃目录失败").filter_map(|e| e.ok()).map(|e| e.file_name().to_string_lossy().to_string()).collect();
    assert!(!names.iter().any(|n| n.ends_with(".tmp")), "原子写后不得残留临时文件，实得 {:?}", names);
    assert_eq!(names.iter().filter(|n| n.starts_with("crash_") && n.ends_with(".json")).count(), 20, "崩溃包应仅保留最近 20 个，实得 {:?}", names);
    for i in 19..24u64 { assert!(!dir.join(format!("crash_{}.json", 1000000000000u64 + i)).exists(), "mtime 最旧的崩溃包应被删除: {}", i); }
    assert!(names.iter().filter(|n| n.starts_with("crash_")).filter_map(|n| fs::read_to_string(dir.join(n.as_str())).ok()).filter_map(|raw| serde_json::from_str::<Value>(&raw).ok()).any(|v| v["reason"] == json!("review23-07")), "新崩溃包内容应可解析且保留 payload");
    let _ = fs::remove_dir_all(&dir);
  }

  /// 【review23-07 · ISSUE-007】崩溃包写一半失败（同步注入）必须整包回滚：返回 Err、无 `.tmp` 残留、无半截包（证伪：写端退回 `fs::write` 后本用例转红）。
  #[test]
  fn save_crash_dump_sync_failure_leaves_no_tmp_or_half_pack() {
    let _g = CRASH_USE_LOCK.lock().unwrap_or_else(|e| e.into_inner()); let app = mock_app("crash-sync-fail"); let dir = app.path_resolver().app_data_dir().expect("解析数据目录失败").join(CRASH_DIR); let _ = fs::remove_dir_all(&dir); fs::create_dir_all(&dir).expect("创建崩溃目录失败");
    SYNC_FAIL_HOOK.with(|h| h.set(true)); assert!(save_crash_dump(app.handle(), String::from(r#"{"k":1}"#)).is_err(), "同步失败必须传播为 Err");
    let left: Vec<String> = fs::read_dir(&dir).expect("读取崩溃目录失败").filter_map(|e| e.ok()).map(|e| e.file_name().to_string_lossy().to_string()).filter(|n| n.ends_with(".tmp") || n.ends_with(".json")).collect();
    assert!(left.is_empty(), "同步失败不得留下临时文件或半截崩溃包，实得 {:?}", left); let _ = fs::remove_dir_all(&dir);
  }
}
