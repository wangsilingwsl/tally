import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useAuthStore } from './stores/authStore';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ItemForm from './pages/ItemForm';

/**
 * 占位页面组件，后续任务中替换为实际页面
 */
function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <h2>{title}</h2>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
        此页面将在后续任务中实现
      </p>
    </div>
  );
}

/**
 * 公开路由守卫：已登录用户访问登录/注册页时重定向到首页
 */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (token) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

/**
 * 应用根组件
 * 配置 React Router 路由表，实现认证路由守卫
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 公开路由：登录、注册 */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />

        {/* 需认证的路由 */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Placeholder title="资产总览" />} />
            <Route path="/items" element={<Placeholder title="物品列表" />} />
            <Route path="/items/new" element={<ItemForm />} />
            <Route path="/items/:id" element={<Placeholder title="物品详情" />} />
            <Route path="/items/:id/edit" element={<ItemForm />} />
            <Route path="/analytics" element={<Placeholder title="消费统计" />} />
            <Route path="/settings" element={<Placeholder title="设置" />} />
          </Route>
        </Route>

        {/* 未匹配路由重定向到首页 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
