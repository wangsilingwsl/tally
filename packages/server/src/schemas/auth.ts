/**
 * 认证模块 JSON Schema 校验规则
 * 用于 Fastify 路由的请求参数校验
 */

/** 邮箱格式正则 */
const EMAIL_PATTERN = '^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$';

/** 密码强度正则：至少 8 位，包含字母和数字 */
const PASSWORD_PATTERN = '^(?=.*[a-zA-Z])(?=.*\\d).{8,}$';

/** 注册请求 Schema */
export const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        pattern: EMAIL_PATTERN,
        maxLength: 255,
      },
      password: {
        type: 'string',
        pattern: PASSWORD_PATTERN,
        minLength: 8,
        maxLength: 128,
      },
    },
    additionalProperties: false,
  },
} as const;

/** 登录请求 Schema */
export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255,
      },
      password: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
      },
    },
    additionalProperties: false,
  },
} as const;
