/**
 * 分类模块 JSON Schema 校验规则
 * 用于 Fastify 路由的请求参数校验
 */

/** 创建分类请求 Schema */
export const createCategorySchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 50,
      },
    },
    additionalProperties: false,
  },
} as const;

/** 更新分类请求 Schema */
export const updateCategorySchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 50,
      },
    },
    additionalProperties: false,
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
} as const;

/** 删除分类请求 Schema */
export const deleteCategorySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
} as const;
