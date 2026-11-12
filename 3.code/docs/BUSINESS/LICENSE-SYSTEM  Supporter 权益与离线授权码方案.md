# M0-13 · JU Supporter 权益与离线授权码方案（v1 草稿）

> 文件状态：**方案草稿（Draft v1.0）**，待商业化评审 + 法务复核后定稿。
> 编制日期：2026-10-24　对应里程碑：**M0-13（Track B 商业线）**
> 关联文档：[`QUESTIONNAIRE.md`](./QUESTIONNAIRE.md)（付费意愿与档位输入）、
> [`../EULA.md`](../EULA.md)（最终用户许可协议）、[`../PRIVACY.md`](../PRIVACY.md)（本地优先与数据边界）、
> [`../LEGAL/C1-TRADEMARK.md`](../LEGAL/C1-TRADEMARK.md)（第 9/42 类商品服务项目，与 Pro 功能口径一致性）。

> **免责声明**：本文件为内部产品/技术方案草案，不构成法律意见；定价、退款、发票与消费者权益条款须经法务确认后生效。

---

## 一、设计前提（为什么是「离线授权码」而不是账号体系）

| 前提 | 说明 | 对授权方案的约束 |
| --- | --- | --- |
| 本地优先（local-first） | 笔记正文与结构只存在本机（localStorage / IndexedDB / 桌面 SQLite），无云端账号 | 校验**不得依赖登录态**，必须可完全离线完成 |
| 无强制联网 | 断网 / 内网 / 离线笔记本是核心使用场景 | 授权码必须**一次输入、长期有效**，无逐次心跳 |
| 隐私承诺 | [`../PRIVACY.md`](../PRIVACY.md) 承诺不采集笔记正文、不采集设备指纹用于画像 | device_id 只能是**不可逆哈希**，且仅用于「授权与设备绑定」，不上报正文 |
| 单文件分发 | Web 端为单 HTML，桌面端为 Tauri x64 安装包 | 公钥可内置进产物；**私钥绝不进产物** |
| 可审计 | 付费用户需要「我买了什么」的凭证 | 校验结果与原始令牌都要可导出、可复核 |

**结论**：采用 **非对称签名令牌（Ed25519）+ 内置公钥验签** 的离线授权码方案。
服务端（或线下签名机）持私钥签发；客户端只持公钥验签，**无需联网、无需存储用户密码**。

---

## 二、权益分层（Supporter / Pro）

> 口径：**免费版功能不减损**（本地优先的承诺），付费解锁的是「规模化、跨端、表达力」三类增量能力。

| 权益点 | 免费版 | Supporter（个人） | Pro（进阶个人） | 说明 |
| --- | --- | --- | --- | --- |
| 本地笔记 / 大纲 / 导图 / 图谱 | ✅ 不限 | ✅ | ✅ | 核心能力永久免费 |
| 日历 / 待办 / 多维表格 | ✅ 不限 | ✅ | ✅ | 核心能力永久免费 |
| **大库优化（> 100,000 节点）** | ⚠️ 可用但为「标准索引路径」 | ✅ 大库快路径 | ✅ | 超过阈值启用增量索引 + 分片构建 + 更激进的缓存预算（见 §5.1） |
| **多端同步（自托管 / 局域网点对点）** | ❌ | ❌ | ✅ | 同步协议本身开源，Pro 解锁「同步编排与冲突面板」（见 §5.2） |
| **特定主题（高级主题包）** | 基础主题（日/夜/护眼） | ✅ 全部主题 | ✅ 全部主题 + 未来新主题 | 主题令牌见 [`../../src/ui/theme.ts`](../../src/ui/theme.ts) |
| **导出增强（批量 / 模板化 / 无水印）** | 单次导出 | ✅ 批量导出 | ✅ + 自定义导出模板 | 与 [`../../src/io/export.ts`](../../src/io/export.ts) 对接 |
| **版本历史（超出 30 天）** | 30 天 | 180 天 | 永久（本机） | 版本快照保存在本机，不额外上传 |
| 授权设备数 | — | 3 台 | 5 台 | 由签发端写入 `max_dev` |
| 更新通道 | 稳定版 | 稳定版 + Beta | 稳定版 + Beta + 内测 | 与 [`../../src/app/updater.ts`](../../src/app/updater.ts) 对接 |
| 支持优先级 | 社区 | 邮件（7 个工作日） | 邮件（3 个工作日）+ 迁移协助 | 人工成本随档位 |
| 价格锚点（待问卷校准） | 0 | 【待定】/年 或 买断 | 【待定】/年 | 见 [`QUESTIONNAIRE.md`](./QUESTIONNAIRE.md) §二 |

**命名口径**：对外统一称 **「JU Supporter（支持者授权）」**，避免「Pro 锁功能」的负面叙事；
技术字段仍用 `license_type = supporter | pro`。

---

## 三、令牌结构（License Token v1）

### 3.1 载荷（payload，明文可见，不含敏感信息）

```jsonc
{
  "v": 1,                      // 令牌版本（跨版本兼容的解析入口）
  "kid": "ju-2026-10",         // 签名密钥 ID（公钥轮换用；客户端内置一组受信 kid）
  "lid": "JUS-7Q4M-2XKD",      // 授权码短 ID（展示 / 客服查询用，不含个人信息）
  "uid": "u_9f2c1a...",        // user_id（购买者标识；邮箱等 PII 的 sha256 前缀，可逆性=0）
  "lt": "supporter",           // license_type: supporter | pro | team | trial
  "exp": 1798761600,           // expire_date（Unix 秒；0 = 永久）
  "iat": 1761321600,           // 签发时间
  "did": "d_5b8e0c...",        // device_id（安装实例指纹的哈希，见 §3.3）
  "max_dev": 3,                // 允许绑定的设备数（由签发端控制，客户端仅提示）
  "feats": ["biglib", "themes"], // 可选能力位（缺省时按 lt 推导）
  "order": "2026-10-24-000123" // 订单号（客服对账用，不含支付信息）
}
```

**载荷设计要点**

1. **载荷不加密**：Ed25519 只保证完整性/来源，不保证机密性。因此载荷**禁止**出现邮箱明文、
   真实姓名、支付流水、地址等 PII；`uid` 为哈希，客服对账凭 `lid` / `order`。
2. **exp 语义**：`0` 表示永久授权（买断）；大于 0 为到期时间戳。客户端以**本地时钟**判定，
   允许 `+72h` 时钟偏差宽容（§4.4）。
3. **did 绑定**：见 §3.3；`did` 为空字符串表示「不绑定设备」（仅用于团队/离线批量场景，需显式签发）。
4. **前向兼容**：客户端遇到未知 `feats` 元素忽略即可；遇到 `v > 1` 应拒绝并提示升级客户端，
   避免旧客户端误判新语义。

### 3.2 令牌编码（Compact 形式，便于手抄 / 粘贴）

```
JUS1.<base64url(payload_json)>.<base64url(ed25519_signature)>
```

- 前缀 `JUS1` 为格式魔数（JU Supporter v1），用于拒绝误粘贴的其它内容；
- `base64url`：无填充（去掉 `=`），字符集 `A-Za-z0-9-_`；
- 签名对象 = **`JUS1.` + base64url(payload) 的 UTF-8 字节**（把前缀一并签入，防格式混淆）；
- 展示形态：UI 以 `JUS1.xxxx…xxxx` 截断显示，并支持「复制完整码」「导出 `.ju-license` 文件」（JSON 包装）。
- 长度估算：载荷约 200–320 字节 → 令牌总量约 **400–500 字符**，可整段粘贴。

### 3.3 device_id 生成规则（隐私优先）

```
device_id = "d_" + base36( sha256( appSalt || osMachineGuidOrInstallUuid || installNonce ) ).slice(0, 16)
```

| 项 | 取值 | 说明 |
| --- | --- | --- |
| `appSalt` | 编译期内置常量（每大版本轮换） | 使哈希无法跨应用/跨版本被关联 |
| `osMachineGuidOrInstallUuid` | 桌面端读系统 MachineGuid；Web 端用 `crypto.randomUUID()` 首次生成并持久化 | Web 端不具备稳定硬件标识，故为「安装实例 ID」 |
| `installNonce` | 安装时生成的随机数 | 防同机克隆后 did 完全一致 |
| 上报 | **不上报** | did 只出现在用户自己粘贴的令牌里；客户端不向任何服务器发送 did |

> 结论：device_id 是**单向哈希 + 本地生成**，既满足「一码一机」的轻量绑定，也不构成
> [`../PRIVACY.md`](../PRIVACY.md) 意义上的设备指纹采集。

---

## 四、验签逻辑（客户端，纯离线）

### 4.1 算法与密钥

- 签名算法：**Ed25519**（`EdDSA`，曲线 `Ed25519`）；
- 私钥：仅存在于签发端（见 §6），**永不进入客户端产物**；
- 公钥：以 JWK 形式内置进客户端常量表（按 `kid` 索引），随版本发布更新；
- 运行时：浏览器 / Tauri WebView 均可用 **WebCrypto**（`crypto.subtle.importKey('raw'|'jwk', {name:'Ed25519'})`）。
  对不支持 Ed25519 的旧内核，退回随包内置的纯 JS 实现（体积 ~3KB，仅在能力检测失败时加载）。

### 4.2 参考实现（TypeScript，落地位置建议 `src/core/license.ts`）

```ts
/** 受信公钥表：kid → JWK（公钥可公开分发；私钥仅存签发端） */
const TRUSTED_KEYS: Record<string, JsonWebKey> = {
  'ju-2026-10': { kty: 'OKP', crv: 'Ed25519', x: '【待填：签发端导出的公钥 x】' },
};

export interface LicensePayload {
  v: number; kid: string; lid: string; uid: string;
  lt: 'supporter' | 'pro' | 'team' | 'trial';
  exp: number; iat: number; did: string; max_dev: number;
  feats?: string[]; order?: string;
}

export type LicenseVerdict =
  | { ok: true; payload: LicensePayload; permanent: boolean; daysLeft: number | null }
  | { ok: false; reason: 'format' | 'signature' | 'unknown-key' | 'version' | 'device' | 'expired'; detail?: string };

const B64U = {
  decode: (s: string): Uint8Array => {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
    const out = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
    return out;
  },
};

/** 纯离线验签：不发起任何网络请求 */
export async function verifyLicenseToken(token: string, deviceId: string, nowMs = Date.now()): Promise<LicenseVerdict> {
  const t = (token || '').trim();
  const parts = t.split('.');
  if (parts.length !== 3 || parts[0] !== 'JUS1') return { ok: false, reason: 'format' };

  let payload: LicensePayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(B64U.decode(parts[1])));
  } catch { return { ok: false, reason: 'format' }; }

  if (!payload || payload.v !== 1) return { ok: false, reason: 'version', detail: String(payload && payload.v) };

  const jwk = TRUSTED_KEYS[payload.kid];
  if (!jwk) return { ok: false, reason: 'unknown-key', detail: payload.kid };

  /* 签名对象 = 前缀 + '.' + 载荷段（与签发端逐字节一致） */
  const signed = new TextEncoder().encode(`JUS1.${parts[1]}`);
  const sig = B64U.decode(parts[2]);
  let verified = false;
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['verify']);
    verified = await crypto.subtle.verify({ name: 'Ed25519' }, key, sig, signed);
  } catch (e) {
    return { ok: false, reason: 'signature', detail: String((e as Error).message || e) };
  }
  if (!verified) return { ok: false, reason: 'signature' };

  /* 设备绑定：did 为空 = 不绑定；否则须与本次安装实例一致 */
  if (payload.did && payload.did !== deviceId) return { ok: false, reason: 'device' };

  /* 到期判定：exp=0 永久；允许 72h 时钟回拨/超前宽容 */
  const SKEW_MS = 72 * 3600 * 1000;
  if (payload.exp > 0) {
    const expMs = payload.exp * 1000;
    if (nowMs > expMs + SKEW_MS) return { ok: false, reason: 'expired', detail: new Date(expMs).toISOString() };
    const daysLeft = Math.floor((expMs - nowMs) / 86_400_000);
    return { ok: true, payload, permanent: false, daysLeft };
  }
  return { ok: true, payload, permanent: true, daysLeft: null };
}
```

### 4.3 开机校验流程（与现有启动链对齐）

```
boot() → loadState() → initStore() → [license] 读取本机已存令牌
      ├─ 无令牌            → features = FREE（不打断使用，不弹窗骚扰）
      ├─ 有令牌且验签通过  → features = 由 lt/feats 推导；写入只读缓存，供各视图查表
      ├─ 有令牌但验签失败  → features = FREE + 顶部一次性提示「授权码无效/已被篡改」
      └─ 有令牌但已过期    → features = FREE + 明确提示到期日 + 「续费」入口（不冻结数据）
```

**硬纪律**：授权状态**只影响功能开关**，**绝不**影响：
读取/写入笔记、导出全部数据、打开本地库、进入回收站恢复数据。
即「降级不等于扣押数据」——这是本地优先产品的信任底线。

### 4.4 失败语义与用户可读文案（占位）

| 失败类型 | 代码 | 用户文案（草稿） | 建议动作 |
| --- | --- | --- | --- |
| `format` | 粘贴内容不是授权码 | 「这不是有效的授权码，请确认已完整复制（以 JUS1. 开头）」 | 重试 / 导入 `.ju-license` |
| `signature` | 验签失败（篡改/伪造） | 「授权码校验失败，可能已损坏或被修改」 | 重新粘贴 / 联系客服 |
| `unknown-key` | 客户端不认识 `kid` | 「该授权码由更新版本签发，请先升级应用」 | 打开更新检查 |
| `version` | `v > 1` | 同上 | 打开更新检查 |
| `device` | did 不匹配 | 「该授权码已绑定其他设备（可绑定 N 台，可申请解绑）」 | 解绑工单（§7.3） |
| `expired` | 超过 exp + 72h | 「授权已于 YYYY-MM-DD 到期」 | 续费入口（保留全部数据） |

---

## 五、Pro 功能解锁点（与代码的对接位置）

> 统一开关入口：**`license.has(feature)`**（只读能力表，模块不得自行解析令牌）。
> 令牌只有 `core/license` 解析一次，其余模块只消费布尔能力位，避免验签逻辑分散。

### 5.1 大库优化（> 100,000 节点）

| 项 | 免费版 | Pro |
| --- | --- | --- |
| 索引构建 | 全量重建，分片让出主线程 | 增量维护（changedIds 投影）+ 预构建 |
| 日缓存预算 | 2,000 条 LRU | 20,000 条 LRU + 按视图分区 |
| 搜索 haystack | 惰性构建 | 预构建 + 后台预热 |
| 图谱布局 | 同步布局（大图降采样） | Worker 分帧布局 + 位置持久化 |

**实现锚点**：`views/calendar.ts`（`_calDayCache` / `_renderDayCache` 预算）、
`core/store.ts`（缓存端口）、`views/graph.ts`（布局 Worker）。

### 5.2 多端同步（Pro）

- 协议本身开源（local-first 同步协议、CRDT / LWW 合并规则），**Pro 解锁的是同步编排 UI**：
  设备发现、冲突可视化面板、按文档选择同步范围、同步诊断日志导出；
- 默认零配置（局域网 mDNS + 手动配对码），**不引入必须的云端账号**；
- 传输：局域网直连为用户自管；如走自建中继，中继只转发密文（端到端加密，见 `core/crypto.ts`）。

### 5.3 主题与表达力

- 主题包（高级配色 / 排版方案）随 `feats: ["themes"]` 解锁；
- 主题令牌机制见 [`../../src/ui/theme.ts`](../../src/ui/theme.ts)，主题包以**数据**形式下发（非代码），
  便于新增主题而不发新版本。

### 5.4 其它

| 能力位 | 解锁点 | 代码锚点 |
| --- | --- | --- |
| `biglib` | 大库快路径 | `views/calendar.ts` / `views/outline.ts` |
| `sync` | 多端同步编排 | 规划中（M6+） |
| `themes` | 高级主题包 | `ui/theme.ts` |
| `export_pro` | 批量 / 模板化导出 | `io/export.ts` |
| `history_long` | 版本历史超 30 天 | `core/persist.ts`（版本快照） |

---

## 六、签发端（私钥侧）设计

### 6.1 密钥管理

| 项 | 方案 |
| --- | --- |
| 算法 | Ed25519（私钥 32B，公钥 32B） |
| 私钥存放 | ① 首选：云 KMS / HSM（签名调用，私钥不出域）；② 兜底：离线签名机（气隙机 + 加密私钥文件 + 双人保管） |
| 私钥备份 | 3-2-1 原则，纸质助记词 + 加密 U 盘分置两处，**不入代码仓、不入 CI 变量** |
| 公钥分发 | 导出 JWK → 写入客户端 `TRUSTED_KEYS`（`kid` 索引）→ 随版本发布 |
| 轮换 | 每 12–18 个月或疑似泄露时新增 `kid`；**旧 `kid` 至少保留 5 年**（保证历史授权码继续可用） |
| 泄露处置 | 立即停用该 `kid` 的签发能力 → 发布移除该公钥的版本 → 为受影响用户免费重签 |

### 6.2 签发 API（服务端伪代码）

```ts
/** POST /api/license/issue  （仅在付款成功回调中调用，需后台鉴权，不暴露给客户端） */
function issueLicense(order: Order, deviceId: string): string {
  const payload = {
    v: 1, kid: CURRENT_KID,
    lid: makeReadableId(order.id),            // 例：JUS-7Q4M-2XKD
    uid: 'u_' + sha256(order.buyerRef).slice(0, 24),
    lt: order.tier,                            // supporter | pro
    iat: Math.floor(Date.now() / 1000),
    exp: order.permanent ? 0 : Math.floor(order.expiresAt / 1000),
    did: deviceId,                             // 用户首次激活时上报的哈希（不可逆）
    max_dev: order.tier === 'pro' ? 5 : 3,
    feats: featuresOf(order.tier),
    order: order.number,
  };
  const body = 'JUS1.' + b64url(JSON.stringify(payload));
  const sig = ed25519.sign(Buffer.from(body, 'utf8'), PRIVATE_KEY); // 私钥仅在此处使用
  return body + '.' + b64url(sig);
}
```

### 6.3 签发幂等与审计

- 同一 `order.id` 重复请求返回**同一令牌**（幂等键 = order.id + deviceId）；
- 每次签发写审计日志：`lid / order / kid / iat / did 哈希 / 操作人 / 来源 IP 段`（保留 5 年，供争议处理）；
- 退款 / 撤销：**不重签**，改为登记到「撤销清单」（§7.4），客户端在联网时可选同步该清单。

---

## 七、发行与激活流程

### 7.1 主流程（用户在购买页付款 → 服务端生成 → 用户输入解锁）

```
① 用户选择档位（购买页）
        │  填写邮箱 + 勾选 EULA / 隐私政策
        ▼
② 支付（第三方支付 / 应用商店内购）
        │  支付平台回调 → 订单状态 = PAID
        ▼
③ 服务端生成授权码（§6.2）
        │  lid / uid / lt / exp / did / feats 一并签发
        ▼
④ 交付（三通道并行，互为兜底）
        ├─ 邮件：订单确认信内附完整令牌 + `.ju-license` 附件
        ├─ 订单页：「复制授权码」「下载授权文件」「查看绑定设备」
        └─ 应用内：粘贴框（设置 → 授权）
        ▼
⑤ 用户激活（客户端，完全离线）
        │  首次粘贴 → 生成/读取本机 device_id → 若有 did 绑定需求，先「绑定本机」
        ▼
⑥ 校验成功 → 写入本机授权存储 → 能力位生效 → 顶部一次性「已解锁 Supporter」提示
```

### 7.2 激活入口（UI 规格）

| 元素 | 说明 |
| --- | --- |
| 设置 → 「授权 / 支持者」 | 显示档位、到期日、绑定设备数、`lid`（可复制给客服）、「更换授权码」「解绑本机」 |
| 粘贴框 | 支持粘贴完整令牌 / 拖入 `.ju-license` 文件；即时离线校验并给出 §4.4 文案 |
| 状态徽标 | 顶部/设置内小徽标：`Supporter` / `Pro` / `试用剩余 N 天` / 无（不显示红点施压） |
| 到期提醒 | `exp` 前 14 天 / 前 3 天各提示一次，可关闭；到期后**不锁数据** |

### 7.3 设备绑定与解绑

- 首次激活时，若签发端要求 `did`（默认是），客户端在**用户点击「绑定本机」**后生成并展示 did 短码；
  网页版购买页可让用户输入 did 完成绑定（避免服务端猜测）；
- 解绑：用户在订单页自助解绑（每 12 个月 N 次），或客服工单解绑；解绑后为同一 `lid` 重签新 `did` 的令牌；
- 超过 `max_dev` → 校验返回 `device` 失败，提示「已达设备上限，可先解绑旧设备」。

### 7.4 撤销清单（可选联网增强）

```jsonc
// GET /api/license/revoked → 由私钥签名的精简清单（同样 Ed25519，公钥同上）
{ "v": 1, "kid": "ju-2026-10", "iat": 1761321600, "revoked": ["JUS-7Q4M-2XKD", "..."] }
```

- 客户端**仅在联网且用户未关闭「检查授权状态」**时拉取；离线时完全忽略；
- 撤销仅用于退款/欺诈/明显批量滥用；**不得**用于「到期静默停用」（到期由 `exp` 表达，语义清晰）。

---

## 八、防滥用与「诚实的边界」

| 措施 | 能挡住什么 | 挡不住什么（须如实承认） |
| --- | --- | --- |
| Ed25519 验签 | 手改 `exp` / `lt` / `feats` 的伪造 | 直接改客户端二进制的补丁（客户端强制天然可绕） |
| device_id 绑定 | 一码多机无限扩散 | 同机克隆后 did 一致（由 installNonce 增加难度，非绝对） |
| 撤销清单 | 退款后继续用 | 永久离线的机器 |
| 公钥内置 + kid 轮换 | 私钥泄露后的长期风险 | 已发布的旧版本（需发版收敛） |

**产品立场**：JU 为本地优先工具，**不做侵入式 DRM**（不校验内存完整性、不写隐藏分区、不做强制联网心跳）。
付费的本质是「支持持续开发 + 解锁规模化能力」，而不是「防止用户用自己的数据」。
技术手段只用于**抑制公开扩散**，不用于惩罚合法用户。

---

## 九、合规与隐私

| 事项 | 结论 | 依据/落点 |
| --- | --- | --- |
| 个人信息收集 | **零新增**：不收集姓名、地址、支付信息到客户端；`uid` 为哈希，`did` 为不可逆哈希且不上报 | [`../PRIVACY.md`](../PRIVACY.md) §1 |
| 支付信息 | 由支付服务商处理，服务端只存订单号与档位 | 同上 |
| 授权码是否属个人信息 | 令牌可关联到订单 → 服务端按「订单数据」管理，最小化保留、可删除 | 个人信息保护法「最小必要」 |
| 消费者权益 | 数字商品退款政策须在购买页明示（含例外情形）；**退款后数据仍归用户** | 《消费者权益保护法》第二十五条 + 明示同意 |
| 发票 | 支持开具（平台代开或自开），购买页需提供入口 | 税务合规 |
| 跨端价格一致性 | 应用商店内购价与官网价须说明差异，避免「同物不同价」争议 | 商店政策 + 明示 |
| 出口/加密合规 | Ed25519 属「标准商用密码算法」，随软件出口一般无额外许可；如涉特定辖区需复核 | 法务复核 |

---

## 十、落地清单（M0-13 验收口径）

- [ ] `src/core/license.ts`：`parseToken` / `verifyLicenseToken` / `has(feature)` / `getLicenseState()`（本文件 §4.2 为蓝本）
- [ ] `src/core/constants`：`TRUSTED_KEYS`（公钥表）与 `LICENSE_STORAGE_KEY`（本机存储键，建议 `juju.license.v1`）
- [ ] 设置面板「授权」页：粘贴框 + 状态徽标 + 复制 lid + 解绑说明（§7.2）
- [ ] 能力位消费点接线：`views/calendar.ts`（`biglib` 缓存预算）、`ui/theme.ts`（`themes`）、`io/export.ts`（`export_pro`）
- [ ] 开机链路：`app/boot.ts` 装载令牌 → 验签 → 能力表就绪（失败不阻断启动，§4.3）
- [ ] 签发端脚本（离线签名机）：`scripts/license-issue.mjs`（读订单 JSON → 输出令牌 + 审计行）
- [ ] 单元测试：格式/签名/设备/过期/未知 kid/永久授权 6 条分支（`tests/license.spec.ts`）
- [ ] 购买页与邮件模板：令牌交付 + `.ju-license` 附件 + 退款政策链接
- [ ] 法务复核：EULA 增加「Supporter 授权范围 / 设备绑定 / 退款」条款；隐私政策确认「零新增采集」
- [ ] 客服 SOP：凭 `lid` 查询订单 → 解绑 / 重签 / 退款指引（不索取用户笔记内容）

---

## 十一、变更记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v1.0 | 2026-10-24 | 首版：Ed25519 离线授权码、三档权益、签发/激活/解绑流程、防滥用边界、合规口径 |
