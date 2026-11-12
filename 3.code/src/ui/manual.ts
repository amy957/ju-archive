/**
 * 帮助手册弹窗（设置面板 区块四「帮助」→「查看手册」）
 *
 * 数据来源：`docs/RELEASE/USER-MANUAL用户手册.md`（v2.1 快速上手）。
 * 该 Markdown 在构建期一次性转换为 HTML，以静态字符串常量内联进前端包体
 * （vite 单文件产物无额外请求、离线可用，与「本地优先」产品口径一致）。
 *
 * 契约：
 *   1) `USER_MANUAL_HTML` 只读常量：与 docs 目录原文逐段对应，不再二次加工；
 *   2) `openManualModal()` 打开一个大尺寸模态（`#manualModal`），内容只渲染一次，
 *      关闭时直接销毁节点（下次打开重新渲染，无残留 DOM）；
 *   3) 模态复用 `ui/common` 的模态栈 `_modalStack` 与 `#app` inert 同步，
 *      ESC / 遮罩点击只作用于栈顶模态（与 appConfirm / appPrompt 同一口径）；
 *   4) `bindManualModal()` 幂等：只覆盖 `#btnViewManual` 的 onclick，重复调用不叠加监听；
 *      按钮缺失（迁移期骨架 / 精简壳）时静默跳过，不抛错。
 */

import { _modalStack, _syncAppInert } from './common';

/** 手册正文（由 docs/RELEASE/USER-MANUAL用户手册.md 转换，Markdown → HTML） */
const USER_MANUAL_HTML = `<h1>JU 笔记 · 用户手册（v2.1 快速上手）</h1>
<blockquote>
<p>适用版本：v2.1.0　平台：Windows 10 / 11（x64）<br />阅读时间：约 10 分钟。本手册只讲「怎么用」，技术细节见 <code>docs/RELEASE/RELEASE-NOTES-v2.1.md</code>。</p>
</blockquote>
<hr />
<h2>1. 第一次启动</h2>
<ol>
<li>双击 <code>JU-v2.1-win-x64.exe</code>（或浏览器打开 <code>dist/index.html</code>）。</li>
<li>首次启动会自动创建一份「欢迎使用 JU」示例文档，可直接编辑或删除。</li>
<li>所有数据保存在本机，<strong>不会上传网络</strong>；关闭窗口即自动保存。</li>
</ol>
<blockquote>
<p>若提示缺少 WebView2，请先安装 Microsoft Edge WebView2 Runtime（Windows 11 通常已内置）。</p>
</blockquote>
<hr />
<h2>2. 新建与管理节点</h2>
<h3>2.1 新建文档</h3>
<ol>
<li>左侧栏点击「＋ 新建文件」。</li>
<li>在出现的文档标题处输入名称（例如「项目计划」），按 Enter 确认。</li>
<li>文档出现在左侧列表中，点击即可打开。</li>
</ol>
<h3>2.2 新建节点（大纲）</h3>
<table>
<thead>
<tr><th>操作</th><th>效果</th></tr>
</thead>
<tbody>
<tr><td>在正文行末按 <code>Enter</code></td><td>新建<strong>同级</strong>节点</td></tr>
<tr><td>在行首按 <code>Tab</code></td><td>当前节点<strong>缩进</strong>为上一节点的子节点</td></tr>
<tr><td><code>Shift + Tab</code></td><td>取消缩进（升级一层）</td></tr>
<tr><td><code>Backspace</code>（空行行首）</td><td>删除空行 / 与上一行合并</td></tr>
<tr><td><code>Ctrl + D</code></td><td>复制当前节点</td></tr>
<tr><td>拖动行首 <code>⋮⋮</code></td><td>调整顺序或移动到其它节点下</td></tr>
</tbody>
</table>
<h3>2.3 常用快捷键</h3>
<table>
<thead>
<tr><th>快捷键</th><th>功能</th></tr>
</thead>
<tbody>
<tr><td><code>Ctrl + K</code></td><td>全局搜索</td></tr>
<tr><td><code>Ctrl + Z</code> / <code>Ctrl + Y</code></td><td>撤回 / 恢复</td></tr>
<tr><td><code>Ctrl + ↑ / ↓</code></td><td>上移 / 下移节点</td></tr>
<tr><td>输入 <code>#标签</code></td><td>自动生成标签，可在左侧「标签」中筛选</td></tr>
<tr><td>输入 <code>[[标题]]</code></td><td>创建指向其它文档的链接（右侧可看反链）</td></tr>
</tbody>
</table>
<hr />
<h2>3. 同一份数据的多种视图</h2>
<p>顶部栏切换视图，<strong>数据只有一份</strong>，任何视图的修改都会同步到其它视图：</p>
<table>
<thead>
<tr><th>视图</th><th>适合做什么</th><th>入口</th></tr>
</thead>
<tbody>
<tr><td>大纲</td><td>写笔记、列计划、整理层级</td><td>顶部「大纲」</td></tr>
<tr><td>多维表格</td><td>任务清单、字段化管理（状态 / 日期 / 数字 / 公式）</td><td>顶部「表格」</td></tr>
<tr><td>日历</td><td>按日期看待办、安排日程</td><td>顶部「日历」</td></tr>
<tr><td>思维导图</td><td>梳理结构、汇报提纲</td><td>顶部「导图」</td></tr>
<tr><td>幻灯片</td><td>把大纲直接演示</td><td>顶部「幻灯片」</td></tr>
</tbody>
</table>
<h3>3.1 多维表格 → 日历联动（示例）</h3>
<ol>
<li>新建一个多维表格文档，添加「日期」列（类型选「日期」）。</li>
<li>点击表格上方「＋ 行」新增一行，填写标题。</li>
<li>在该行上点击右键 →「添加到日历」。</li>
<li>切到「日历」视图，点击今天 →「当日待办」中即可看到这一行。</li>
</ol>
<blockquote>
<p>反向也成立：日历中新建的待办会带日期，回到表格/大纲同样能看到。</p>
</blockquote>
<h3>3.2 卡片、看板、画廊、时间线</h3>
<p>多维表格支持多种展示方式：在表格页顶部切换「表格 / 看板 / 画廊 / 时间线 / 图表」，筛选、排序、汇总、列显隐都在同一条工具栏完成。</p>
<hr />
<h2>4. 配置本地备份文件夹</h2>
<p>JU 支持把完整备份自动写到你自己选择的本地文件夹，便于纳入网盘 / 移动硬盘备份。</p>
<ol>
<li>打开「设置」（顶部右侧齿轮 / 「设置」按钮；桌面版为右下角设置面板）。</li>
<li>找到「<strong>备份位置</strong>」，右侧为「浏览」按钮与「恢复默认路径」。</li>
<li>点击「<strong>浏览</strong>」，选择一个专用文件夹（建议独立目录，例如 <code>D:\\JU-Backup</code>）。</li>
<li>浏览器会请求文件夹读写权限，选择「允许」。</li>
<li>之后每次关闭应用、以及手动触发备份时，都会在该目录生成一份完整 JSON 备份。</li>
<li>需要改回默认位置时，点击「<strong>恢复默认路径</strong>」。</li>
</ol>
<p>小建议：</p>
<ul>
<li>备份目录不要放在系统盘临时目录；</li>
<li>若使用 OneDrive / 坚果云等同步盘，建议选择「仅备份」目录，避免多端同时写；</li>
<li>定期检查目录中是否持续产生新备份文件。</li>
</ul>
<hr />
<h2>5. 恢复数据</h2>
<h3>5.1 从备份文件夹恢复（推荐）</h3>
<ol>
<li>打开「设置」→「<strong>从备份恢复</strong>」→「导入备份（JSON / .db）」。</li>
<li>选择备份目录中最新的 <code>.json</code> 文件（桌面版也支持 <code>.db</code>）。</li>
<li>应用会提示「导入会覆盖当前数据，已自动备份当前数据」，确认后继续。</li>
<li>恢复完成后会自动重新渲染，检查节点数量与最近编辑内容是否一致。</li>
</ol>
<h3>5.2 从导出文件恢复</h3>
<ol>
<li>先导出一份当前数据：设置 / 菜单 → 导出 →「JSON 备份」。</li>
<li>换机或重装后，用「导入备份」选择该 JSON 文件即可。</li>
<li>也支持导入 Markdown / OPML / HTML / DOCX 作为<strong>新文档</strong>（不会覆盖已有数据）。</li>
</ol>
<h3>5.3 误删恢复</h3>
<ul>
<li>删除的节点会进入「回收站」，在左侧「回收站」中可<strong>恢复</strong>或<strong>彻底删除</strong>。</li>
<li>版本历史：右侧栏「历史」可查看并恢复较早的快照（桌面版保存在本地 SQLite）。</li>
</ul>
<hr />
<h2>6. 全库加密（可选）</h2>
<ol>
<li>打开「设置」→ 打开「<strong>全库加密</strong>」开关。</li>
<li>输入主密码并确认（至少 6 位）。<strong>忘记密码将无法恢复数据</strong>，请先做一份备份。</li>
<li>启用后，本地只保留密文；刷新或重启会先出现解锁界面。</li>
<li>输入正确密码即可进入；密码错误会被拒绝，不会损坏数据。</li>
</ol>
<p>建议：</p>
<ul>
<li>主密码使用独立、较长的口令；</li>
<li>开启加密后仍要定期导出备份（备份文件同样是密文）；</li>
<li>公共电脑使用完毕请关闭应用或点击锁定。</li>
</ul>
<hr />
<h2>7. 导入与导出</h2>
<table>
<thead>
<tr><th>操作</th><th>入口</th><th>说明</th></tr>
</thead>
<tbody>
<tr><td>导出 Markdown</td><td>菜单 / 侧栏「导出 Markdown」</td><td>生成 <code>.md</code>，保留层级与日期</td></tr>
<tr><td>导出 HTML / Word</td><td>导出菜单</td><td>适合打印 / 分享</td></tr>
<tr><td>导出 Excel</td><td>多维表格导出</td><td>数值列按数字类型导出</td></tr>
<tr><td>导出 ICS</td><td>日历「下载 ICS」</td><td>导入到系统日历</td></tr>
<tr><td>导入</td><td>拖拽文件到窗口 /「导入」</td><td>JSON 为整库恢复；Markdown / OPML / HTML / DOCX 为新文档</td></tr>
</tbody>
</table>
<hr />
<h2>8. 常见问题</h2>
<p><strong>Q1：数据存在哪里？会不会上传？</strong><br />本机应用数据目录（桌面版 SQLite）或浏览器本地存储（网页版）。应用默认不联网，也不采集内容。</p>
<p><strong>Q2：升级会不会覆盖我的笔记？</strong><br />不会。覆盖安装只替换程序文件，数据目录保留；升级前仍建议做一次备份。</p>
<p><strong>Q3：换电脑怎么迁移？</strong><br />旧机导出 JSON 备份 → 新机安装 v2.1 →「导入备份」选择该 JSON。</p>
<p><strong>Q4：多人能一起编辑同一份笔记吗？</strong><br />v2.1 暂不支持协同编辑与云同步；可通过导出 / 导入备份在设备间传递。</p>
<p><strong>Q5：设置里找不到某个开关怎么办？</strong><br />v2.1 桌面版部分设置面板仍在迁移中；数据层功能（加密、备份、导入导出）不受影响。可先使用「从备份恢复」完成数据迁移。</p>
<p><strong>Q6：杀毒软件报警 / SmartScreen 提示未知发布者？</strong><br />将 exe 加入信任（或按安装指南核对 SHA-256 后放行）；官方发布包哈希见 <code>JU-v2.1-checksums.txt</code>。</p>
<hr />
<h2>9. 数据安全小贴士</h2>
<ol>
<li>「3-2-1」备份：至少 3 份副本、2 种介质、1 份异地。</li>
<li>加密 + 备份同时使用：备份文件为密文，仍需妥善保管主密码。</li>
<li>定期检查回收站与版本历史，避免长期堆积占用空间。</li>
<li>公共电脑使用后退出应用，必要时清除本地数据（先备份）。</li>
</ol>`;

/** 模态标题栏文案（与面板行「帮助」呼应） */
const MANUAL_MODAL_TITLE = 'JU · 用户手册';

/** 清空模态栈中已脱离文档的死引用（与 common 的 isConnected 口径一致） */
function pruneModalStack(): void {
  for (let i = _modalStack.length - 1; i >= 0; i -= 1) {
    const m = _modalStack[i];
    if (!m || !m.isConnected) _modalStack.splice(i, 1);
  }
}

/**
 * 打开帮助手册弹窗（全屏遮罩 + 大尺寸对话框）。
 *
 * - 单例：`#manualModal` 已存在时直接返回，避免重复堆叠；
 * - 关闭：✕ 按钮 / 遮罩点击 / ESC（仅栈顶）；
 * - 内容：`USER_MANUAL_HTML` 只渲染一次，关闭即销毁。
 */
export function openManualModal(): void {
  if (document.getElementById('manualModal')) return;
  pruneModalStack();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay manual-overlay';
  overlay.id = 'manualModal';
  overlay.innerHTML =
    '<div class="modal manual-modal" role="dialog" aria-modal="true" aria-label="' + MANUAL_MODAL_TITLE + '">' +
    '<div class="modal-head"><span>' + MANUAL_MODAL_TITLE + '</span>' +
    '<button class="modal-close" id="manualClose" type="button" aria-label="关闭手册">✕</button></div>' +
    '<div class="modal-body manual-doc" id="manualBody">' + USER_MANUAL_HTML + '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  _modalStack.push(overlay);
  _syncAppInert(); /* 背景 #app 退出交互树（与 appConfirm / appPrompt 同口径） */

  const isTop = (): boolean => _modalStack[_modalStack.length - 1] === overlay;
  const onKey = (e: KeyboardEvent): void => {
    if (!isTop()) return; /* 非栈顶模态不响应 ESC */
    if (e.key !== 'Escape') return;
    e.preventDefault();
    close();
  };
  function close(): void {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    const i = _modalStack.indexOf(overlay);
    if (i >= 0) _modalStack.splice(i, 1);
    _syncAppInert();
  }

  const closeBtn = overlay.querySelector('#manualClose') as HTMLElement | null;
  if (closeBtn) closeBtn.onclick = close;
  overlay.onclick = (e: MouseEvent): void => {
    if (e.target === overlay && isTop()) close();
  };
  document.addEventListener('keydown', onKey);
  if (closeBtn) closeBtn.focus();
}

/**
 * 绑定设置面板「帮助 → 查看手册」按钮（`#btnViewManual`）。
 *
 * 幂等：覆盖赋值 onclick；按钮缺失时静默返回（迁移期骨架容错）。
 */
export function bindManualModal(): void {
  const btn = document.getElementById('btnViewManual') as HTMLElement | null;
  if (!btn) return;
  btn.onclick = (): void => {
    openManualModal();
  };
}
