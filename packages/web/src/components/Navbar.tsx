import { Link, NavLink, useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import ReminderBell from './ReminderBell';
import './Navbar.css';

/**
 * 顶部导航栏
 * 包含 Logo、主导航链接、网络状态指示、提醒铃铛、用户菜单
 */
export default function Navbar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const online = useSyncStore((s) => s.online);
  const syncing = useSyncStore((s) => s.syncing);

  /** 退出登录：清除 Token，跳转到登录页 */
  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          归物 · Tally
        </Link>

        {/* 主导航链接 */}
        <div className="navbar-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            总览
          </NavLink>
          <NavLink to="/items" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            物品
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            统计
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            设置
          </NavLink>
        </div>

        {/* 右侧：网络状态 + 提醒铃铛 + 用户菜单 */}
        <div className="navbar-actions">
          {/* 网络状态指示 */}
          <span
            className={`network-indicator ${online ? 'online' : 'offline'}`}
            title={syncing ? '同步中...' : online ? '在线' : '离线'}
          >
            <span className={`network-dot ${online ? 'online' : 'offline'} ${syncing ? 'syncing' : ''}`} />
            <span className="network-label">{syncing ? '同步中' : online ? '在线' : '离线'}</span>
          </span>

          {/* 提醒通知铃铛 */}
          <ReminderBell />

          {/* 用户菜单 */}
          <div className="navbar-user">
            <span className="navbar-email">{user?.email}</span>
            <button className="btn-secondary navbar-logout" onClick={handleLogout}>
              退出
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
