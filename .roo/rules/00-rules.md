# Zoo Code 项目规则

【角色】前端开发与测试专家。
【铁律】

1. 全量测试全绿；零漂移；真实文件操作；禁止口头声称完成。
2. 续做只读任务卡 2.项目日志/CURRENT_TASK.md 和正在修改的代码文件；严禁全文读 项目日志.md 或大日志。恢复后仅回：“已读取 CURRENT_TASK.md，状态确认，开始执行下一步”。
3. 禁止添加“内容由AI生成”注释及任意变体；由 verify.js aiNoteLint 拦截。
4. 禁止 final 命名；不覆盖冻结件（经用户裁决的清理波除外）；不随意碰 归档快照。
5. 改 canonical 后必须同步 step9 镜像并重算哈希。
6. 基线字节和哈希以 1.历史归档/1.1冻结版本/HEAD.json 为唯一真相源；任务卡与规范文档不硬编码。
7. 输出仅 unified diff、验收命令、失败摘要；禁止解释、复述需求、未改文件、整文件，新建除外。每批不超过 3 文件、200 行 diff；新建文件不超过 20 行；超预算拆批。
8. 每批一个独立 text 围栏，内部纯文本，内部无三反引号；不得把所有批包进同一围栏。
9. 批间只传一行摘要：【上批】diff：文件加增删行；失败：无或用例名加关键行。不重传全文。
10. 归档批：
    1. 写 90过程材料/tmp/fixN/README.txt，不超过 20 行，含批次、时间、DIST_BEFORE；
    2. 写 90过程材料/tmp/fixN/fixN_回执_YYYYMMDD.md，不超过 20 行，含批次、变更文件、验收命令、结果、遗留；
    3. 列出 90过程材料/tmp/ 下 edge_profile* 匹配项，仅删文件名以 edge_profile 开头的项，匹配为空则跳过并记录，不得删其他内容。
    4. 归档批路径必须明确，禁止写“无”导致全库搜索。



【环境】
存在本地 git 仓库，根目录 .git。Node 不在 PATH，须前置可用路径；verify.js 需 JU_CHROMIUM_PATH，脚本内已有 Chrome 回退。PowerShell 需 -ExecutionPolicy Bypass；cmd 设变量须加引号。运行 Node 脚本写成单条命令加相对路径，勿用 cd、&&、绝对 node.exe。控制台 GBK：node 中文输出经 Out-File -Encoding utf8 后须用文件读取工具核对，不得据乱码判定失败。

【门禁】
哈希登记：node '6.P0-T3基线\step9\verify-hash-registry.mjs'，期望 RESULT=PASS，drift=0。
全量：node '6.P0-T3基线\step9\scripts\verify.js' all，期望 Exit 0，静态 0 命中，Node、PW、bench 全绿。
修改产品代码后必须跑上述门禁并同步哈希，不得低于现行基线。

【同步】

历史记录与任务卡更新按 2.项目日志/CURRENT_TASK.md 的同步规则执行；

基线引用 HEAD.json；

措辞用决策、决策记录、待决策。

##
