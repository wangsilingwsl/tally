import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { request, ApiRequestError } from '../utils/api';
import './auth.css';

/** 注册响应类型 */
interface RegisterResponse {
  token: string;
  user: {
    id: string;
    email: string;
    createdAt: string;
  };
}

/** 表单字段错误 */
interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

/**
 * 注册页面
 * 校验邮箱格式、密码强度（至少 8 位，包含字母和数字），校验失败在字段下方显示错误提示
 */
export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  /** 表单校验 */
  function validate(): FormErrors {
    const errs: FormErrors = {};

    if (!email.trim()) {
      errs.email = '请输入邮箱';
    } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      errs.email = '邮箱格式不正确';
    }

    if (!password) {
      errs.password = '请输入密码';
    } else if (password.length < 8) {
      errs.password = '密码至少 8 位';
    } else if (!/[a-zA-Z]/.test(password)) {
      errs.password = '密码需包含字母';
    } else if (!/\d/.test(password)) {
      errs.password = '密码需包含数字';
    }

    if (!confirmPassword) {
      errs.confirmPassword = '请确认密码';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = '两次密码不一致';
    }

    return errs;
  }

  /** 提交注册 */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const data = await request<RegisterResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      setAuth(data.token, data.user);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrors({ general: err.message });
      } else {
        setErrors({ general: '网络错误，请稍后重试' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="auth-title">归物 · Tally</h1>
        <p className="auth-subtitle">创建新账号</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {errors.general && (
            <div className="auth-error-banner">{errors.general}</div>
          )}

          <div className="form-field">
            <label htmlFor="email">邮箱</label>
            <input
              id="email"
              type="email"
              placeholder="请输入邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              placeholder="至少 8 位，包含字母和数字"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="confirmPassword">确认密码</label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <span className="field-error">{errors.confirmPassword}</span>
            )}
          </div>

          <button type="submit" className="btn-primary auth-submit" disabled={submitting}>
            {submitting ? '注册中...' : '注册'}
          </button>
        </form>

        <p className="auth-footer">
          已有账号？<Link to="/login">去登录</Link>
        </p>
      </div>
    </div>
  );
}
