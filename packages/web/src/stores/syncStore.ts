import { create } from 'zustand';
import { getLastSyncTime, onSyncStateChange } from '../db/sync';

/** 同步状态 */
interface SyncState {
  /** 是否在线 */
  online: boolean;
  /** 是否正在同步 */
  syncing: boolean;
  /** 最近同步时间（ISO 字符串） */
  lastSyncAt: string | null;

  /** 更新在线状态 */
  setOnline: (online: boolean) => void;
  /** 更新同步中状态 */
  setSyncing: (syncing: boolean) => void;
  /** 刷新最近同步时间 */
  refreshLastSyncAt: () => void;
  /** 初始化监听器 */
  init: () => () => void;
}

/**
 * 同步状态管理
 * 管理网络在线状态、同步进行状态、最近同步时间
 */
export const useSyncStore = create<SyncState>((set) => ({
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  syncing: false,
  lastSyncAt: getLastSyncTime(),

  setOnline: (online) => set({ online }),
  setSyncing: (syncing) => set({ syncing }),
  refreshLastSyncAt: () => set({ lastSyncAt: getLastSyncTime() }),

  init: () => {
    // 监听浏览器在线/离线事件
    const handleOnline = () => set({ online: true });
    const handleOffline = () => set({ online: false });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 监听同步状态变更
    const unsubSync = onSyncStateChange((syncing) => {
      set({ syncing });
      // 同步完成后刷新最近同步时间
      if (!syncing) {
        set({ lastSyncAt: getLastSyncTime() });
      }
    });

    // 返回清理函数
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubSync();
    };
  },
}));
