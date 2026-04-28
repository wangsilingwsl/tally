import { create } from 'zustand';
import { stopSyncEngine } from '../db/sync';

/** 用户信息类型 */
interface User {
  id: string;
  email: string;
  createdAt: string;
}

/** 认证状态 */
interface AuthState {
  /** JWT Token */
  token: string | null;
  /** 当前用户信息 */
  user: User | null;
  /** 是否正在加载 */
  loading: boolean;

  /** 设置登录信息（Token + 用户） */
  setAuth: (token: string, user: User) => void;
  /** 退出登录：清除 Token 和用户信息 */
  logout: () => void;
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void;
}

/** localStorage 中 Token 的存储键名 */
const TOKEN_KEY = 'tally_token';

/**
 * 认证状态管理
 * 使用 Zustand 管理登录状态和 JWT Token
 */
export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  loading: false,

  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({ token, user, loading: false });
  },

  logout: () => {
    stopSyncEngine();
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null, loading: false });
  },

  setLoading: (loading) => set({ loading }),
}));
