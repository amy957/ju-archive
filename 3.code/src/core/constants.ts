/**
 * M1-1 · 公共常量模块（自 canonical 只读提取，逐字保留）
 *
 * 来源：6.P0-T3基线\v2.0-t3.html:5596-5600（script 块内常量区原文）
 * 约束：正则表达式、默认值一律逐字复制，不得改写（本文件仅追加 `export` 与类型注解）。
 */

/* 【P1-8 H3/I4】统一标签正则：要求 # 前为行首/空白/标点，首字符字母/CJK，最长20 */
export const TAG_RE=/(?:^|[\s(（\[【、,，])(#[A-Za-z\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5_-]{0,19})/g;
/* M0-7：WIKI_RE / APP_LOCALE 与 TAG_RE 同处常量区提前声明，消除跨 script TDZ 与加载顺序依赖 */
export const WIKI_RE=/\[\[([^\[\]\n]{1,80}?)\]\]/g;
export const APP_LOCALE=(typeof navigator!=='undefined'&&navigator.language)||'zh-CN';
/* 来源：v2.0-t3.html:1724（VIEW_KIND 原文逐字，属常量区；批次 L 的 bindTopbar 依赖） */
export const VIEW_KIND={LIBRARY_ROOT:'library-root',FOLDER:'folder',CALENDAR:'calendar',DATABASE:'database',OUTLINE:'outline'} as const;

/* ============================================================
   v2.1 fix9 · P1：内置默认表格模板（与 v2.0-t3.html 的默认状态对齐）
   ------------------------------------------------------------
   列名来源（真实文件取证，非人眼抄写）：6.P0-T3基线/v2.0-t3.html:5566
     dbFields:['标题','优先级','状态','时间','地点','人物','内容','星级','评价','备注']
   行数来源：同文件 5586-5592 —— defaultState() 内置「任务表」共 3 行（r1/r2/r3）
   取证脚本：90过程材料/tmp/fix9/extract_template.cjs → db_template.json（EXTRACT_VERDICT: PASS）

   【偏差说明，详见 fix9 回执「偏差说明」章】
   ① 任务书正文把列名写作「序号/名称/状态/…」，canonical 实际为「标题/优先级/状态/…」；
      按任务书「确保模板与 v2.0-t3.html 默认状态完全一致」的硬约束，此处取 canonical 原文，
      不改写列名（7/10 列同名；差异为首两列与「地点/人物」次序）。
   ② canonical 的 3 行是带示例单元格值（状态/优先级/时间/星级）的演示行；任务书要求「3 行空白」，
      故取「行数=3」且行内容置空，不复制示例值。
   ============================================================ */
export const DEFAULT_DB_FIELDS = ['标题', '优先级', '状态', '时间', '地点', '人物', '内容', '星级', '评价', '备注'] as const;
/** 默认模板的数据行数（v2.0-t3 内置 3 行；fix9 按要求落 3 行空白） */
export const DEFAULT_DB_ROW_COUNT = 3;

/* ============================================================
   v2.1 fix16 · P1：数据库「地点」字段的存储格式契约
   ------------------------------------------------------------
   ① 存储位置：database 节点行的 `node.db[<字段名>]`（与其它列同容器，不引入新结构）。
   ② 存储类型：**字符串**（不是对象/数组），便于筛选、排序、汇总与旧数据回填。
   ③ 存储格式：`国家 / 省 / 市` —— 分隔符为「斜杠 + 左右各一个半角空格」（LOCATION_SEP），
      例：`中国 / 北京市 / 东城区`、`中国 / 香港特别行政区 / 香港岛`、`中国 / 台湾省 / 台北市`。
   ④ 空值不传：未选择时不写该键（或写空串），单元格渲染回落到「选择...」按钮。
   ⑤ 历史兼容：旧版 `中国-省-市`（半角连字符）字符串可被 parseLocation() 无损解析回填。

   数据与纯函数见 src/utils/regions.ts：CN_PROVINCES（34 个省级行政区，含台湾省 /
   香港特别行政区 / 澳门特别行政区）/ CN_REGIONS（省 → 完整地级列表）/
   LOCATION_SEP / joinLocation() / parseLocation()。
   ============================================================ */
/** 「地点」字段类型标识（与 views/database/panels.ts 字段类型列表、render.ts 单元格分支一致） */
export const DB_FIELD_TYPE_LOCATION = 'location';
/** 地点值分隔符（与 src/utils/regions.ts 的 LOCATION_SEP 同值；此处导出便于核心层引用而不引入 utils） */
export const DB_LOCATION_SEP = ' / ';
