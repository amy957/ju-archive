/**
 * L9-W1 · Worker 消息协议（请求 / 响应形状）
 * ----------------------------------------------------------------------------
 * 设计依据：`reports/t9-design-2026-10-14.md` §五（Worker 骨架）/ §9.1（S-1 真契约）
 *          + L7 Worker 范式（`__juIndexWorker{…}` 请求/响应/ready）。
 *
 * 请求：{ id:number|string, type:string, payload?:any }
 * 响应：{ id, type:'ack'|'result'|'error', ... } / 生命周期 { type:'ready' }
 *
 * L9-W3：补齐 `RESULT`（关联响应）与 `DISPOSE`（生命周期请求）的形状构造 / 校验函数；
 *   既有导出（REQ/RES/makeRequest/isRequest/makeAck/makeError）**名称与语义逐字保留**
 *   （向后兼容 W1/W2 契约，不重命名、不移除任何消息类型）。
 *
 * 性质：影子层（shadow / 默认关闭）；协议为纯数据形状，无副作用。
 */

export const REQ = {
  PATCH: 'patch_nodes',   /* 增量落盘批（真契约 {changed,deleted,seq,baseRev}） */
  SAVE: 'save_state',     /* 全量 checkpoint */
  LOAD: 'load_state',     /* 读取投影 */
  PING: 'ping',
  DISPOSE: 'dispose',
};

export const RES = {
  ACK: 'ack',
  RESULT: 'result',
  ERROR: 'error',
  READY: 'ready',         /* 生命周期握手 */
};

/** 构造请求 */
export function makeRequest(id, type, payload) { return { id, type, payload }; }

/** 请求形状校验 */
export function isRequest(m) {
  return !!m && typeof m === 'object'
    && (typeof m.id === 'number' || typeof m.id === 'string')
    && typeof m.type === 'string';
}

/** 构造 ack（成功响应） */
export function makeAck(id, extra) { return Object.assign({ id, type: RES.ACK }, extra || {}); }

/** 构造 error 响应 */
export function makeError(id, err) {
  return { id, type: RES.ERROR, error: String((err && err.message) || err) };
}

/* ── L9-W3 · RESULT / DISPOSE 形状 ────────────────────────────────────────── */

/** 可关联的响应类型（READY 为生命周期握手，不参与请求→响应关联） */
export const RESPONSE_TYPES = [RES.ACK, RES.RESULT, RES.ERROR];

/** 构造 result（关联响应：id 与服务端请求 id 一致） */
export function makeResult(id, extra) { return Object.assign({ id, type: RES.RESULT }, extra || {}); }

/** 响应形状校验（ack / result / error；须带 id） */
export function isResponse(m) {
  return !!m && typeof m === 'object'
    && RESPONSE_TYPES.indexOf(m.type) !== -1
    && (typeof m.id === 'number' || typeof m.id === 'string');
}

/** 构造 DISPOSE 请求（生命周期：幂等 teardown） */
export function makeDispose(id) { return { id, type: REQ.DISPOSE, payload: null }; }

/** 是否为 DISPOSE 请求 */
export function isDispose(m) { return !!m && typeof m === 'object' && m.type === REQ.DISPOSE; }
