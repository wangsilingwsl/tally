import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useAuthStore } from './stores/authStore';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ItemForm from './pages/ItemForm';
import ItemList from './pages/ItemList';
import ItemDetail from './pages/ItemDetail';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

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
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 公开路由 */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* 需认证的路由 */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            {/* 主页：资产统计 + 物品列表 */}
            <Route path="/" element={<ItemList />} />
            <Route path="/items/new" element={<ItemForm />} />
            <Route path="/items/:id" element={<ItemDetail />} />
            <Route path="/items/:id/edit" element={<ItemForm />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
