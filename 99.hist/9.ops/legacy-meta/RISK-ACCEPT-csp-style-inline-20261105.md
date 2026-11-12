# RISK-ACCEPT · CSP style-src 放行 unsafe-inline

- 日期：2026-11-05
- 编号：ISSUE-007 / RISK-CSP-STYLE-INLINE-20261105
- 状态：已接受
- 发布阻塞：否（2026-11-06 项目负责人签署接受）
- 签字状态：已签署（项目负责人 · 2026-11-06，依据任务卡 0.131 决策记录）

## 范围与放行原因
生产 CSP 的 style-src 含 'unsafe-inline'：运行时按状态注入内联样式（动态主题变量 / 计算尺寸 / think 组件），无法全部预生成静态类；本批重写注入点超出预算。

## 影响面评估
- 仅样式注入，无脚本执行：style-src 的 unsafe-inline 不授予 script-src 能力，不放开 eval / 外链脚本。
- 注入内容来自内部状态，非用户可控 HTML；残余风险仅为布局/视觉欺骗，不影响数据与凭证。

## 签字人
- 签字人：项目负责人
- 签署日期：2026-11-06
- 签字范围：`tauri.conf.json:66` 的 `style-src 'unsafe-inline'`，及 dist 运行期内联 style 61 处（`<style>` 4 块 / inline css 118729 字符）
- 记录人：Code 模式本批执行（代记，不代签）

## 复审条件
内联样式 ≤20 处且 check-inline-style.mjs 维持 hard 门禁（hex ≤130 / !important ≤72）时，复核移除 'unsafe-inline' 并改用 nonce/hash。
