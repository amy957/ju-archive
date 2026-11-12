/**
 * M0-7 · 生命周期注册表（与 canonical v2.0-t3.html 内 J.lifecycle 逐字对齐）
 *
 * 产品侧定义（6.P0-T3基线\v2.0-t3.html:1323-1339，script1 顶部 IIFE 内）：
 *   add:function(fn){if(typeof fn==='function')_disposers.push(fn);},
 *   on:function(target,type,handler,opts){ if(!target||!target.addEventListener)return;
 *     target.addEventListener(type,handler,opts);
 *     _disposers.push(function(){target.removeEventListener(type,handler,opts);});},
 *   dispose:function(){ while(_disposers.length){ var fn=_disposers.pop();
 *     try{fn();}catch(e){console.warn('[JU.lifecycle]',e);} } }
 *
 * 对齐约束：栈序（push/pop）语义、console.warn 前缀 '[JU.lifecycle]' 字面量不得改动。
 */

type Disposer = () => void;

interface ListenableTarget {
  addEventListener: (type: string, handler: unknown, opts?: unknown) => void;
  removeEventListener: (type: string, handler: unknown, opts?: unknown) => void;
}

const disposers: Disposer[] = [];

/** 登记一个释放函数；非函数入参静默忽略（对应产品 typeof fn==='function' 守卫）。 */
export function add(fn: () => void): void {
  if (typeof fn === 'function') disposers.push(fn);
}

/** 登记 DOM 监听并同时登记其 removeEventListener 闭包，供 dispose 统一释放。 */
export function on(
  target: ListenableTarget | null | undefined,
  type: string,
  handler: unknown,
  opts?: unknown
): void {
  if (!target || !target.addEventListener) return;
  target.addEventListener(type, handler, opts);
  disposers.push(() => {
    target.removeEventListener(type, handler, opts);
  });
}

/** 逆序（栈语义）释放全部登记项；单项抛错不阻断后续释放。 */
export function dispose(): void {
  while (disposers.length) {
    const fn = disposers.pop() as Disposer;
    try {
      fn();
    } catch (e) {
      console.warn('[JU.lifecycle]', e);
    }
  }
}

/** 形状对拍用的聚合导出（与产品 J.lifecycle 一一对应）。 */
export const lifecycle = { add, on, dispose };
