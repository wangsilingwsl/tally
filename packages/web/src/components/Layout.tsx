import { Outlet } from 'react-router';
import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { request } from '../utils/api';
import { scanAndGenerateReminders } from '../utils/reminder';
import Navbar from './Navbar';
import './Layout.css';

/** 获取用户信息响应 */
interface MeResponse {
  user: {
    id: string;
    email: string;
    notifyEmail: string | null;
    emailEnabled: boolean;
    createdAt: string;
  };
}

/**
 * 应用布局框架
 * 包含 Navbar 和主内容区域，登录后自动获取用户信息
 */
export default function Layout() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);

  // 应用加载时扫描提醒（离线也能工作）
  useEffect(() => {
    scanAndGenerateReminders().catch(() => {
      // 扫描失败不影响正常使用
    });
  }, []);

  // 登录后获取用户信息（刷新页面时从 Token 恢复）
  useEffect(() => {
    if (token && !user) {
      request<MeResponse>('/api/auth/me')
        .then((data) => {
          setAuth(token, {
            id: data.user.id,
            email: data.user.email,
            createdAt: data.user.createdAt,
          });
        })
        .catch(() => {
          // Token 无效，退出登录
          logout();
        });
    }
  }, [token, user, setAuth, logout]);

  return (
    <div className="layout">
      <Navbar />
      <main className="layout-main">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
