import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../stores/authStore';

/**
 * 路由守卫组件
 * 未登录用户访问需认证页面时，重定向到 /login
 */
export default function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
