import { useAuthStore } from '../stores/authStore';

/** API 响应错误类型 */
export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

/**
 * 封装 fetch 请求，自动附加 JWT Token 和错误处理
 */
export async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // 401 未认证，自动退出登录
  if (response.status === 401) {
    useAuthStore.getState().logout();
    throw new ApiError401('登录已过期，请重新登录');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = (body as ApiError)?.message || `请求失败 (${response.status})`;
    throw new ApiRequestError(response.status, message);
  }

  return response.json() as Promise<T>;
}

/** 401 未认证错误 */
export class ApiError401 extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError401';
  }
}

/** 通用请求错误 */
export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}
