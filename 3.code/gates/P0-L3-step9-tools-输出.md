# Step9 · 审计工具运行记录（2026-10-09）

## 运行命令

```bash
node tools/audit-commit-callbacks.js && node tools/audit-indirect-calls.js
```

## stdout

```
[audit-commit-callbacks] html: /home/user/Doubao/chats/38445869379338242/v2.0-l3.html.html
[audit-commit-callbacks] csv : /home/user/Doubao/chats/38445869379338242/P0-L3/commit-callback-audit.csv
[audit-commit-callbacks] total: 84
[audit-commit-callbacks] risk : {"OK":74,"P1":5,"P2":5}
[audit-commit-callbacks] flags: {"light":4,"noRollback":3,"snapshot":76,"silent":9,"persistOnly":9,"noHistory":6}
--- exit=0 ---
[audit-indirect-calls] total: 99
[audit-indirect-calls] actions: addDbField,addDbRow,addNode,clearNodeSchedule,createDoc,logActivity,moveNode,moveToTrash,purgeTrash,removeDbField,removeNode,removeTemplate,renameDbField,restoreFromTrash,setDbCell,setDbColumnWidth,setDbRowHeight,setNodeDate,setStar,toggleCollapse,toggleDone,updateText
[audit-indirect-calls] out  : /home/user/Doubao/chats/38445869379338242/P0-L3/commit-callback-indirect.csv
--- exit=0 ---
```

## 产物

| 文件 | 大小（B） |
|---|---:|
| `P0-L3/commit-callback-audit.csv` | 18395 |
| `P0-L3/commit-callback-indirect.csv` | 15432 |

## 与既有记录的关系

- `结构共享验收记录.md` §三 的"92 调用点"为 `verify-commit-callbacks.mjs` 的**文本匹配口径**；本文件 84 / 99 为 `tools/*.js` 的**剥离注释后口径**，两者不同源（见 `结构共享验收记录.md` §二 D-4 口径说明）。
- `fix-map.json` L3-11 的 evidence 指向本文件（原为命令字符串，信息量不足，已替换）。
- 运行环境：Node v22.23.2，`package.json` 含 `"type": "module"`（两工具已 ESM 化 + `__dirname` shim，见 §11.2 连锁适配）。
