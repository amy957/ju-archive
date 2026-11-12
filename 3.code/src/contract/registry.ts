/**
 * M0-7 · 契约注册表单例（与 canonical v2.0-t3.html 内 J.register / J.require 逐字对齐）
 *
 * 产品侧定义（6.P0-T3基线\v2.0-t3.html:1320-1321，script1 顶部 IIFE 内）：
 *   J.register=function(name,value){if(name)J._contract[name]=value;};
 *   J.require=function(name){if(!(name in J._contract))throw new Error('JU.require missing: '+name);return J._contract[name];};
 *
 * 对齐约束：错误消息字面量必须逐字保持 'JU.require missing: '+name（批次 B3 静态对拍）。
 */
const store = new Map<string, unknown>();

/** 注册契约项；name 为空串 / null / undefined 时直接返回（对应产品 if(name) 守卫）。 */
export function register(name: string, value: unknown): void {
  if (name) store.set(name, value);
}

/** 取值；缺失时抛出与产品逐字一致的错误消息。 */
export function require<T>(name: string): T {
  if (!store.has(name)) throw new Error('JU.require missing: ' + name);
  return store.get(name) as T;
}

/** 单例注册表本体（等价于产品的 J._contract）。 */
export const JU_REGISTRY = store;

/** 形状对拍用的聚合导出（与产品 J.register / J.require 一一对应）。 */
export const registry = { register, require };
