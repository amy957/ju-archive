/** 本地副本键单点登记处：新增副本键须同时登记 LOCAL_COPY_KEYS 与 purgeLocalCopies 的 all 列表（check-deps-wired 断言覆盖）；键值不得改名。 */
export const LOCAL_COPY_KEYS = {
  STORE: 'juju.store.v31', PENDING: 'juju.pending.v1', PREIMPORT: 'juju.backup.preimport', ENC: 'juju.enc.v1',
  UI: 'juju.ui.v31', UI_ENC: 'juju.ui.enc', VERS: 'juju.vers.v31', VERS_ENC: 'juju.vers.enc',
  VERS_LEGACY: 'juju.versions', VERS_ENC_LEGACY: 'juju.versions.enc', PENDING_LEGACY: 'juju.pending', PUSH: 'juju.push',
  GRAPH_POS: 'juju.graphpos', MUSIC_VOL: 'juju.musicvol', MUSIC_SRC: 'juju.music.src', REMIND_SENT: 'juju.remind.sent',
  FT_POS: 'juju.ftpos', FC_POS: 'juju.fcpos', SETTINGS_POS: 'juju.settingspos', THEME_MANUAL: 'juju.theme.manual', SLIDES: 'juju.slides.v1',
} as const;

export type LocalCopyScope = 'all' | 'data' | 'ui';

function _removeOne(key: string): void { try { localStorage.removeItem(key); } catch (e) { console.warn('[JU] purge local copy failed', key, e); } }

/** 单键清除（PREIMPORT 消费场景用）：失败只告警，不抛错。 */
export function purgeLocalCopy(key: keyof typeof LOCAL_COPY_KEYS): void { _removeOne(LOCAL_COPY_KEYS[key]); }
/** all=全部；data=数据类；ui=UI 类；每个 removeItem 独立 try/catch。 */
export function purgeLocalCopies(scope: LocalCopyScope = 'all'): void {
  const keys = scope === 'ui' ? [LOCAL_COPY_KEYS.UI, LOCAL_COPY_KEYS.UI_ENC] : scope === 'data' ? [LOCAL_COPY_KEYS.STORE, LOCAL_COPY_KEYS.PENDING, LOCAL_COPY_KEYS.PREIMPORT, LOCAL_COPY_KEYS.ENC, LOCAL_COPY_KEYS.VERS, LOCAL_COPY_KEYS.VERS_ENC, LOCAL_COPY_KEYS.VERS_LEGACY, LOCAL_COPY_KEYS.VERS_ENC_LEGACY, LOCAL_COPY_KEYS.PENDING_LEGACY] : [LOCAL_COPY_KEYS.STORE, LOCAL_COPY_KEYS.PENDING, LOCAL_COPY_KEYS.PREIMPORT, LOCAL_COPY_KEYS.ENC, LOCAL_COPY_KEYS.UI, LOCAL_COPY_KEYS.UI_ENC, LOCAL_COPY_KEYS.VERS, LOCAL_COPY_KEYS.VERS_ENC, LOCAL_COPY_KEYS.VERS_LEGACY, LOCAL_COPY_KEYS.VERS_ENC_LEGACY, LOCAL_COPY_KEYS.PENDING_LEGACY, LOCAL_COPY_KEYS.PUSH, LOCAL_COPY_KEYS.GRAPH_POS, LOCAL_COPY_KEYS.MUSIC_VOL, LOCAL_COPY_KEYS.MUSIC_SRC, LOCAL_COPY_KEYS.REMIND_SENT, LOCAL_COPY_KEYS.FT_POS, LOCAL_COPY_KEYS.FC_POS, LOCAL_COPY_KEYS.SETTINGS_POS, LOCAL_COPY_KEYS.THEME_MANUAL, LOCAL_COPY_KEYS.SLIDES];
  for (const key of keys) _removeOne(key);
}
