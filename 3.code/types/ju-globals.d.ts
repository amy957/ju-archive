export {};
declare global {
  interface JuLifecycle {
    add(fn: () => void): void;
    on(target: EventTarget, type: string, handler: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions): void;
    dispose(): void;
  }
  interface JuBridge {
    _contract: Record<string, unknown>;
    register(name: string, value: unknown): void;
    require(name: string): unknown;
    constants: Record<string, unknown>;
    lifecycle: JuLifecycle;
    core: Record<string, unknown>;
    outlineCalendar: Record<string, unknown>;
    views: Record<string, unknown>;
    app: Record<string, unknown>;
    initL9Shadow?: (host?: unknown, opts?: unknown) => Promise<unknown>;
    initL10Seam?: () => { ready: boolean; reason: string };
  }
  interface Window { JU: JuBridge; }
}
