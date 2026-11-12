#!/usr/bin/env node
/**
 * JU 大库基准夹具生成器
 *
 * 用法：
 *   node tools/gen-bench.js 30k
 *   node tools/gen-bench.js 100k
 *
 * 输出：
 *   ju-bench-30k.json        完整备份（可经「导入」加载）
 *   ju-bench-30k.state.json  纯 state（Playwright 注入用）
 *   ju-bench-30k.load.js     浏览器控制台加载脚本
 */
const fs = require('fs');
const path = require('path');
const NOW = Date.now();
const DAY = 86400000;
// ── 随机工具 ──────────────────────────────────────────────
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function uid(i) {
  return 'n' + i.toString(36) + Math.random().toString(36).slice(2, 6);
}
// ── 词库 ──────────────────────────────────────────────────
const WORDS = [
  '项目', '任务', '笔记', '想法', '计划', '总结', '复盘', '灵感',
  '资料', '参考', '设计', '开发', '测试', '发布', '会议', '讨论',
  '决策', '风险', '问题', '方案', '需求', '架构', '性能', '安全'
];
const TAGS = [
  '设计', '开发', '重要', '紧急', '待办', '资料', '灵感',
  '会议', '复盘', '学习', '生活', '工作'
];
const STATUSES = ['进行', '待办', '完成', '放弃'];
const PRIORITIES = ['高', '中', '低'];
// ── 节点工厂 ──────────────────────────────────────────────
function makeNode(id, parent, text, opts = {}) {
  return {
    id,
    text,
    parent,
    children: [],
    collapsed: false,
    done: false,
    date: null,
    tags: [],
    priority: 0,
    recur: null,
    habit: null,
    time: null,
    note: null,
    color: null,
    showInCal: true,
    createdAt: NOW - randInt(0, 365) * DAY,
    updatedAt: NOW - randInt(0, 30) * DAY,
    ...opts
  };
}
// ── 生成 state ────────────────────────────────────────────
function generateState(totalNodes, docCount) {
  const nodes = {};
  let counter = 0;
  const root = makeNode('root', null, '我的文档', {
    createdAt: NOW,
    updatedAt: NOW
  });
  nodes.root = root;
  // 1) 创建文档
  const docIds = [];
  for (let i = 0; i < docCount; i++) {
    const id = 'doc' + i;
    const doc = makeNode(id, 'root', `文档 ${i + 1}`, {
      _isFolder: false
    });
    nodes[id] = doc;
    root.children.push(id);
    docIds.push(id);
  }
  // 2) 计算每个文档的目标节点数
  const remaining = totalNodes - 1 - docCount;
  const docNodeCounts = new Array(docCount).fill(0);
  for (let i = 0; i < remaining; i++) {
    docNodeCounts[i % docCount]++;
  }
  // 3) 为每个文档生成子树
  let nodeIndex = 0;
  docIds.forEach((docId, di) => {
    const target = docNodeCounts[di];
    if (target <= 0) return;
    const doc = nodes[docId];
    const queue = [{ parentId: docId, depth: 1 }];
    let created = 0;
    while (created < target) {
      if (queue.length === 0) {
        queue.push({ parentId: docId, depth: 1 });
      }
      const { parentId, depth } = queue.shift();
      const parent = nodes[parentId];
      if (!parent) continue;
      const maxChildren = Math.min(5, target - created);
      const childCount = Math.max(1, Math.min(maxChildren, randInt(1, 4)));
      for (let c = 0; c < childCount && created < target; c++) {
        const id = uid(++nodeIndex);
        const word = pick(WORDS);
        let text = `${word} ${created + 1}`;
        const opts = {};
        // 20% 完成
        if (Math.random() < 0.2) opts.done = true;
        // 10% 带标签
        if (Math.random() < 0.1) {
          const tagCount = Math.random() < 0.3 ? 2 : 1;
          const tags = [];
          for (let t = 0; t < tagCount; t++) {
            const tag = pick(TAGS);
            if (!tags.includes(tag)) tags.push(tag);
          }
          opts.tags = tags;
          text += ' ' + tags.map(t => '#' + t).join(' ');
        }
        // 5% 有日期
        if (Math.random() < 0.05) {
          const d = new Date(NOW - randInt(0, 365) * DAY);
          opts.date = d.toISOString().slice(0, 10);
          if (Math.random() < 0.5) {
            const h = randInt(0, 23);
            const m = randInt(0, 11) * 5;
            opts.time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          }
        }
        // 5% 优先级
        if (Math.random() < 0.05) opts.priority = randInt(1, 5);
        // 5% 重复
        if (Math.random() < 0.05) opts.recur = { freq: 'weekly', interval: 1 };
        const node = makeNode(id, parentId, text, opts);
        nodes[id] = node;
        parent.children.push(id);
        created++;
        if (depth < 6) {
          queue.push({ parentId: id, depth: depth + 1 });
        }
      }
    }
  });
  // 4) 日历根 + 少量待办
  const calRootId = 'calroot';
  const calRoot = makeNode(calRootId, 'root', '日历待办', {
    _isCalRoot: true,
    _isFolder: true,
    showInCal: false
  });
  nodes[calRootId] = calRoot;
  root.children.push(calRootId);
  const calTodoCount = Math.min(500, Math.floor(totalNodes * 0.005));
  for (let i = 0; i < calTodoCount; i++) {
    const id = uid(++nodeIndex);
    const d = new Date(NOW - randInt(0, 30) * DAY);
    const date = d.toISOString().slice(0, 10);
    const node = makeNode(id, calRootId, `日历待办 ${i + 1}`, {
      date,
      time: Math.random() < 0.5 ? `${String(randInt(8, 19)).padStart(2, '0')}:00` : null,
      showInCal: true,
      done: Math.random() < 0.3
    });
    nodes[id] = node;
    calRoot.children.push(id);
  }
  // 5) 数据库根 + 表格
  const dbRootId = 'dbroot';
  const dbRoot = makeNode(dbRootId, 'root', '数据库', {
    _isDbRoot: true,
    _isFolder: true,
    dbRoot: true
  });
  nodes[dbRootId] = dbRoot;
  root.children.push(dbRootId);
  const tableId = 'dbtable0';
  const table = makeNode(tableId, dbRootId, '任务表', { dbRoot: true });
  nodes[tableId] = table;
  dbRoot.children.push(tableId);
  const dbRowCount = Math.min(2000, Math.floor(totalNodes * 0.02));
  for (let i = 0; i < dbRowCount; i++) {
    const id = uid(++nodeIndex);
    const node = makeNode(id, tableId, `记录 ${i + 1}`, {
      db: {
        '状态': pick(STATUSES),
        '优先级': pick(PRIORITIES),
        '时间': new Date(NOW - randInt(0, 365) * DAY).toISOString().slice(0, 10),
        '星级': randInt(1, 5)
      }
    });
    nodes[id] = node;
    table.children.push(id);
  }
  return {
    nodes,
    rootId: 'root',
    dbFields: ['标题', '优先级', '状态', '时间', '地点', '人物', '内容', '星级', '评价', '备注'],
    dbColumnWidths: {},
    dbRowHeights: {},
    trashed: [],
    activity: {},
    templates: [],
    contacts: [],
    tagColors: {},
    updatedAt: NOW,
    _localCreated: [],
    _ver: 18
  };
}
// ── 完整备份包装 ──────────────────────────────────────────
function makeFullBackup(state) {
  return {
    app: 'juju',
    ver: 'fixed23',
    type: 'full-backup',
    exportedAt: new Date().toISOString(),
    state,
    ui: {
      theme: 'day',
      scale: 1,
      view: 'auto',
      sidebarLeftCollapsed: false,
      sidebarRightCollapsed: false,
      sidebarLeftWidth: 230,
      sidebarRightWidth: 250,
      collapsedDocs: {},
      navExpanded: { starred: false, files: true, database: false, tags: false },
      floatCal: false,
      pomoVisible: true,
      filesSort: 'name',
      collapsedPanels: { today: false, added: false, stats: false, note: false },
      logCollapsed: { add: false, mod: false, del: false },
      calColWidths: { note: null, today: null },
      dbView: 'table',
      dbHiddenFields: {},
      dbSortsMap: {},
      dbFiltersMap: {},
      dbSummary: { on: false, mode: 'sum' },
      maxCalNodes: 3,
      calView: 'month',
      calTagFilter: '',
      reminderEnabled: false,
      selectedDate: new Date().toISOString().slice(0, 10),
      currentDocId: state.rootId,
      uiVersion: 3
    },
    graphpos: {},
    versions: null
  };
}
// ── 主流程 ────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const target = args[0] || '30k';
  const totalNodes = target === '100k' ? 100000 : 30000;
  const docCount = target === '100k' ? 200 : 100;
  console.log(`生成 ${target} 节点测试库，文档数 ${docCount}...`);
  const t0 = Date.now();
  const state = generateState(totalNodes, docCount);
  const actual = Object.keys(state.nodes).length;
  console.log(`实际节点数：${actual}（耗时 ${Date.now() - t0}ms）`);
  const backup = makeFullBackup(state);
  const outDir = path.join(__dirname, '..');
  const fullFile = path.join(outDir, `ju-bench-${target}.json`);
  const stateFile = path.join(outDir, `ju-bench-${target}.state.json`);
  const loadFile = path.join(outDir, `ju-bench-${target}.load.js`);
  // 完整备份（紧凑 JSON，控制体积）
  fs.writeFileSync(fullFile, JSON.stringify(backup), 'utf-8');
  // 纯 state
  fs.writeFileSync(stateFile, JSON.stringify(state), 'utf-8');
  // 控制台加载脚本
  const loadScript = `/* JU 大库基准夹具加载脚本：在浏览器控制台执行 */
(async () => {
  const state = ${JSON.stringify(state)};
  if (typeof initStore !== 'function') {
    console.error('未找到 initStore，请确认页面已加载 v2.0-frozen.html');
    return;
  }
  localStorage.clear();
  initStore(state);
  if (typeof ensureCalendarRoot === 'function') ensureCalendarRoot();
  if (typeof forceRender === 'function') forceRender();
  console.log('已加载基准库，节点数：', Object.keys(state.nodes).length);
})();
`;
  fs.writeFileSync(loadFile, loadScript, 'utf-8');
  const sizeFull = (fs.statSync(fullFile).size / 1024 / 1024).toFixed(2);
  const sizeState = (fs.statSync(stateFile).size / 1024 / 1024).toFixed(2);
  console.log(`已生成：`);
  console.log(`  ${fullFile} (${sizeFull} MB)`);
  console.log(`  ${stateFile} (${sizeState} MB)`);
  console.log(`  ${loadFile}`);
}
main();
