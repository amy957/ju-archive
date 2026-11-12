/**
 * M1-1 · 核心 Produce（结构共享 immutable 原语）模块
 *
 * 来源：6.P0-T3基线\v2.0-t3.html:1507-1717（script1 「Store」区原文逐行对应）
 * 约束：函数体逻辑、全部防御性注释（Proxy 泄漏修复 / BUG 系列 / F-1 等）、错误消息字面量、
 *       console 前缀逐字保留；仅追加 export 与 TS 类型注解（泛型 <T> / any 为纯类型层，
 *       运行期无任何行为差异）。防御性分支一律不精简。
 */
import { safeClone } from './utils';

/* 【P0-L3 结构共享】CreateDataProperty 语义复制原语（模块级，供 __juProduce 与 commit 共用）：
   defineProperty 定义自有键，保留 JSON.parse 产生的自有 __proto__ 数据键
   （避免 Object.assign 的 [[Set]] 走原型 setter）。不保原型（state 约定为普通对象，见 immutable-adapter §5.2）。 */
export function copyPlain(src: any): any {
  const tgt:any={};
  for(const key of Reflect.ownKeys(src)){
    if(typeof key==='symbol')continue; /* L17-W4 · P2-3：Symbol 键仅用于内部派生计数（如 _SIDECOUNTS），复制时跳过以免带入缓存 */
    Object.defineProperty(tgt,key,{value:src[key],writable:true,enumerable:true,configurable:true});
  }
  return tgt;
}
/* 【P0-L3 结构共享】自研结构共享 immutable 原语（Proxy + 路径复制）。
   选型：不引入 Immer（见 P0-L3/选型记录.md）；由整体克隆升级为结构共享版。
   语义：
   - base 为普通对象/数组 → 返回 Proxy draft；recipe 内直接修改、delete、数组 splice/push 等；
   - 未修改分支返回原引用（Immer 式未修改返回原引用）；
   - 已修改分支仅复制变更路径，未变更子树保持原引用；
   - recipe 抛错不污染 base；
   - recipe 返回非 undefined 时，直接作为结果返回。
   边界：
   - state 应保持普通对象/数组/原始值；Date/Map/Set/RegExp 回退 safeClone，不保证结构共享。
   - finalize 用 done 映射防循环引用死循环（state 为树、无环，防御性兜底）。 */
export function __juProduce<T>(base: T, recipe: (draft: any) => void | T): T {
  if(typeof recipe!=='function')throw new TypeError('__juProduce: recipe 必须是函数');
  if(base==null||typeof base!=='object'){
    const ret=recipe(base);
    return (ret===undefined?base:ret) as T;
  }
  if(base instanceof Date||base instanceof Map||base instanceof Set||base instanceof RegExp){
    const draft=safeClone(base);
    const ret=recipe(draft);
    return (ret===undefined?draft:ret) as T;
  }
  const recMap=new WeakMap<object, any>();
  function getRec(obj: any): any {
    let rec=recMap.get(obj);
    if(!rec){
      rec={base:obj,copy:null,modified:false,deleted:null,parent:null,proxy:null,aliased:false};
      recMap.set(obj,rec);
    }
    return rec;
  }
  function markModified(rec: any): void {
    let cur=rec;
    while(cur&&!cur.modified){
      cur.modified=true;
      cur=cur.parent;
    }
  }
  function ensureCopy(rec: any): any {
    if(!rec.copy)rec.copy=Array.isArray(rec.base)?rec.base.slice():copyPlain(rec.base);
    return rec.copy;
  }
  function wrap(rec: any): any {
    if(rec.proxy)return rec.proxy;
    rec.proxy=new Proxy(rec.base,{
      get(target,prop){
        if(prop==='__isJuDraft')return true;
        if(prop==='__juBase')return target;
        /* 【F-1】删除中间态：已删键 → 视同不存在，返回 undefined（不回落 target 旧值） */
        if(rec.deleted&&rec.deleted.has(prop))return undefined;
        let src=target;
        if(rec.copy&&Object.prototype.hasOwnProperty.call(rec.copy,prop))src=rec.copy;
        let value=src[prop];
        /* 【Proxy 泄漏修复 A】上一轮泄漏进 state 的子 Proxy 先解包为原始 target，
           避免此处 getRec(proxy) 再次 new Proxy(proxy) 造成 proxy-of-proxy 嵌套 */
        if(value&&typeof value==='object'&&value.__isJuDraft===true)value=value.__juBase;
        if(value&&typeof value==='object'){
          const childRec=getRec(value);
          /* 【BUG-3】别名检测（防御性，不阻断）：同一对象出现在多个父节点下时，
             markModified 沿最后一次 get 的 parent 链传播，结构共享语义不保证。
             真正修复是保证 state 无别名（repairTreeConsistency 的职责）。 */
          if(childRec.parent&&childRec.parent!==rec){
            childRec.aliased=true;
            if(typeof console!=='undefined'&&console.warn){
              console.warn('[JU] 同一对象出现在多个父节点下，结构共享语义不保证',value);
            }
          }
          childRec.parent=rec;
          return wrap(childRec);
        }
        return value;
      },
      set(target,prop,value){
        /* 【Proxy 泄漏修复 B】数组方法（unshift/splice/slice/filter）先把元素经 get 读成
           子 Proxy，再经 set 写回 copy；此处还原为原始 target，
           使 finalize 的 recMap.get(原始对象) 能命中并正确还原 */
        if(value&&typeof value==='object'&&value.__isJuDraft===true)value=value.__juBase;
        /* 删后重设：键重新存在，从删除集移除 */
        if(rec.deleted&&rec.deleted.has(prop))rec.deleted.delete(prop);
        const copy=ensureCopy(rec);
        const isArray=Array.isArray(copy);
        const oldLen=isArray?copy.length:-1;
        const existing=Object.getOwnPropertyDescriptor(copy,prop);
        if(existing){
          if(existing.get||existing.set){
            /* 尊重显式定义的访问器（走 [[Set]] 调 setter） */
            copy[prop]=value;
          }else{
            /* 数据属性：保留原 flags 仅写值；数组 length 走此路径同样触发截断 */
            Object.defineProperty(copy,prop,{...existing,value});
          }
        }else{
          /* CreateDataProperty 语义（对标 copyPlain / immutable-adapter §5.3）：
             __proto__ 写为自有数据键，不再经 Object.prototype 访问器替换原型 */
          Object.defineProperty(copy,prop,{value,writable:true,enumerable:true,configurable:true});
        }
        /* 【BUG-2】数组 length 截断同步 deleted：越界索引在 draft 中不可见、ownKeys 剔除 */
        if(isArray&&prop==='length'&&typeof value==='number'&&value<oldLen){
          if(!rec.deleted)rec.deleted=new Set();
          for(let i=value;i<oldLen;i++)rec.deleted.add(String(i));
        }
        markModified(rec);
        return true;
      },
      deleteProperty(target,prop){
        const copy=ensureCopy(rec);
        delete copy[prop];
        if(!rec.deleted)rec.deleted=new Set();
        rec.deleted.add(prop);
        markModified(rec);
        return true;
      },
      has(target,prop){
        /* 【F-1】已删键 → 返回 false */
        if(rec.deleted&&rec.deleted.has(prop))return false;
        if(rec.copy&&Object.prototype.hasOwnProperty.call(rec.copy,prop))return true;
        return Reflect.has(target,prop);
      },
      ownKeys(target){
        const keys=new Set(Reflect.ownKeys(target));
        if(rec.copy)Reflect.ownKeys(rec.copy).forEach(k=>keys.add(k));
        /* 【F-1】剔除已删键 */
        if(rec.deleted)rec.deleted.forEach((k: string | symbol)=>keys.delete(k));
        return Array.from(keys);
      },
      getOwnPropertyDescriptor(target,prop){
        /* 【F-1】已删键 → 返回 undefined（视同不存在） */
        if(rec.deleted&&rec.deleted.has(prop))return undefined;
        if(rec.copy&&Object.prototype.hasOwnProperty.call(rec.copy,prop)){
          /* 回真实描述符：数组 length 等非枚举/不可配置属性如实上报，
             否则违反 Proxy 不变量（Object.keys/JSON.stringify 抛 TypeError） */
          const d=Object.getOwnPropertyDescriptor(rec.copy,prop);
          if(d)return d;
        }
        return Reflect.getOwnPropertyDescriptor(target,prop);
      },
      defineProperty(target,prop,desc){
        /* 删后重定义：键重新存在，从删除集移除 */
        if(rec.deleted&&rec.deleted.has(prop))rec.deleted.delete(prop);
        const copy=ensureCopy(rec);
        Object.defineProperty(copy,prop,desc);
        markModified(rec);
        return true;
      }
    });
    return rec.proxy;
  }
  const rootRec=getRec(base);
  const draft=wrap(rootRec);
  const ret=recipe(draft);
  if(ret!==undefined)return ret as T;
  const done=new WeakMap<object, any>();
  /* 【Proxy 泄漏修复 C-3】就地清洗"元素是子 Proxy 的普通数组"：
     slice/filter/concat 等数组方法经 get trap 读出子 Proxy 后返回的是普通数组，
     该容器本身不在 recMap 中（不会被 finalize 递归），若不在此清洗，
     子 Proxy 会以数组元素形态残留进最终 state（activity 桶 slice(-200) / templates、dbFields filter 重建）。
     元素命中 recMap 时仍递归 finalize，保留该子树的修改。 */
  function cleanDraftElems(arr: any[]): void {
    for(let i=0;i<arr.length;i++){
      const e=arr[i];
      if(e&&typeof e==='object'&&e.__isJuDraft===true){
        const eb=e.__juBase;
        const er=recMap.get(eb);
        arr[i]=er?finalize(er):eb;
      }
    }
  }
  function finalize(rec: any): any {
    if(!rec.modified)return rec.base;
    if(done.has(rec))return done.get(rec);
    const copy=rec.copy||(Array.isArray(rec.base)?rec.base.slice():copyPlain(rec.base));
    done.set(rec,copy);
    for(const key of Reflect.ownKeys(copy)){
      let val=copy[key];
      /* 【Proxy 泄漏修复 C-1】解包：copy 中残留的子 Proxy 还原为原始 target */
      if(val&&typeof val==='object'&&val.__isJuDraft===true)val=val.__juBase;
      if(val&&typeof val==='object'){
        const childRec=recMap.get(val);
        if(childRec)val=finalize(childRec);
        /* 【Proxy 泄漏修复 C-3】普通数组容器：逐元素解包（slice/filter 产物） */
        else if(Array.isArray(val))cleanDraftElems(val);
      }
      /* 【Proxy 泄漏修复 C-2】兜底：即使某处仍漏网也写回原始对象，
         保证 finalize 之后任意层级 val.__isJuDraft !== true */
      if(copy[key]!==val)copy[key]=val;
    }
    return copy;
  }
  return finalize(rootRec) as T;
}
/* 【P0-L3 结构共享】带回滚语义的变体：recipe 抛错时返回 {ok:false,base,error}，
   调用方据此保持原引用不变（不替换 state）。结构共享 produce 不污染 base，
   天然无回滚需求；commit 全部路径统一经此入口。 */
export function __juProduceSafe<T>(
  base: T,
  recipe: (draft: any) => void | T
): { ok: boolean; next?: any; base?: any; error?: any } {
  try{
    return{ok:true,next:__juProduce(base,recipe)};
  }catch(e){
    return{ok:false,base,error:e};
  }
}
