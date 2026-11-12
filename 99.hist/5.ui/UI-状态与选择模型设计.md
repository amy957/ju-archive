# UI 状态与选择模型设计（v2.1-dev）

来源：《JU软件设计框架规范》1.3 状态管理模型、7.3 UI 状态、8.1 commit 唯一入口；《细节要求描述文档》2.1/2.2 v2.1-dev 新增。

## 1. UI 状态扩展

### 1.1 必须持久化（新增）

| 字段 | 说明 |
| --- | --- |
| 左栏宽 | 主侧边栏宽度 |
| 右栏宽 | 检查器面板宽度 |
| 浮窗位置 | 浮窗坐标 |
| 浮窗尺寸 | 浮窗宽高 |
| 分区折叠 | 可折叠分区折叠状态 |
| 分区顺序 | 可折叠分区排列顺序 |
| 沉浸模式 | 是否处于沉浸模式 |
| 同时折叠状态 | 左右侧栏同时折叠状态 |

持久化到 UI 状态存储（juju.ui.v31 / 加密 juju.ui.enc），防抖 150ms 写入。

### 1.2 仅内存（新增）

| 字段 | 说明 |
| --- | --- |
| ui.selection | 选择模型（见 §2） |
| anchorId | Shift 范围选择锚点 |
| 拖拽临时几何 | 拖拽过程中的临时位置/尺寸 |
| hover 淡化状态 | 沉浸模式按钮淡化显示状态 |
| 正在调整大小状态 | resize 进行中标记 |

仅内存，刷新清空，不持久化，不入撤销栈。

### 1.3 禁止

- 在 UI 上挂业务数据
- 将 ui.selection 写入 state.nodes 或持久化存储

## 2. 选择模型

```text
ui.selection = {
  type,      // 视图类型：outline / database / sidebar
  ids,       // 选中的节点 id 集合
  anchorId,  // Shift 范围选择锚点
  mode       // 选择模式：single / additive / range / all
}
```

- 仅内存，刷新清空，不持久化，不入撤销栈
- Ctrl/Cmd 点击：切换单个选中
- Shift 点击：范围选择
- Ctrl+A：全选当前视图模型
- 全选基于视图模型，不基于 DOM，确保虚拟滚动下不漏选

## 3. 批量操作与 commit

- 多选/全选后的移动、缩进、反缩进、删除、改状态、加标签必须合并为一次 commit
- 逆操作记录每个节点的原 parent、原 index、原顺序
- 纯 UI 调整（面板宽高、浮窗位置尺寸、分区高度顺序、沉浸模式切换）使用 light:true 或 persistOnly:true，不入撤销栈
- 业务操作（文档节点移动、日历事项拖拽、数据库行批量改状态）使用 snapshot:true，一次操作一次 commit

## 4. 维护规则

- 新增 UI 状态必须加入 applyUIFields 与 _saveUINow
- 新增 DOM 元素 id 必须全局唯一
- 修改 renderSidebar / renderMain / updateRightSidebar 必须回归：光标保持、多选状态、虚拟滚动、沉浸模式、打印隐藏非内容元素
