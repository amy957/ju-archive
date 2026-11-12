/**
 * M0-7 · 全局挂载点类型声明
 *
 * 逐项来源：canonical v2.0-t3.html:1342-1375 的 @typedef {Window & typeof globalThis & {...}} JuWindow
 * （产品脚本内的每一条字段均在下方 Window 接口中一一对应声明，未作增删）。
 */
export {};

/**
 * M3 · 批次 AW · 全局 UI 状态对象（产品件 `ui` 单例）类型声明。
 *
 * 只声明本批次需要约束的键；其余键仍按产品件 `ui` 的自由形状保留（索引签名），
 * 避免为类型完备性而虚构尚未迁移的字段。
 */
export interface JuUI {
  view?: string;
  currentDocId?: any;
  encrypted?: boolean;
  locked?: boolean;
  [key: string]: any;
}

declare global {
  interface Window {
    /** 全局 UI 单例（产品件 `ui`；由 src/main.ts 装配为共享占位对象） */
    ui?: JuUI;
    _popAnchor: { x: number; y: number } | null;
    __juInMerge: boolean;
    JU: any;
    JU_MODULES: any;
    JU_DND: any;
    JU_SLIDES: any;
    TAURI: any;
    /* M1-1 · 批次 L：产品件 v2.0-t3.html:20021 / 20033 / 20064 直接读取 window.__TAURI__（桌面壳探测） */
    __TAURI__: any;
    electron: any;
    nw: any;
    __juLog: any[];
    __juConfig: any;
    __juFlushErrors: () => void;
    __juLogDownload: () => void;
    __juVsMetrics: () => any;
    __juIndexShadowMismatch: any[];
    __juIndexWorkerMode: string;
    __juIndexWorker: any;
    __juIndexProgress: any;
    __juIndexProgressBuf: any[];
    __juSkeleton: any;
    __juPersistFailures: any[];
    __juPersistProbe: any;
    __juPatchFailures: any[];
    __juIndexFailures: any[];
    __juL9Shadow: any;
    __juL10D1: any;
    __juL10D1Seam: boolean;
    __juL10D1Status: any;
    _l14: any;
    __juL14: any;
    /* M1-1 · 批次 N：产品件 v2.0-t3.html:15586 / 15586 的 `window._juMSelKeyBound`
       （多选键盘监听只绑定一次的幂等哨兵） */
    _juMSelKeyBound: boolean;
  }
}
