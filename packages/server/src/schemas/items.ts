/**
 * 物品模块 JSON Schema 校验规则
 * 用于 Fastify 路由的请求参数校验
 */

/** 物品状态枚举值 */
const ITEM_STATUS_ENUM = ['IN_USE', 'IDLE', 'SOLD', 'DISCARDED'];

/** 创建物品请求 Schema */
export const createItemSchema = {
  body: {
    type: 'object',
    required: ['name', 'purchaseDate', 'purchasePrice', 'status'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
      },
      brand: {
        type: 'string',
        maxLength: 255,
      },
      model: {
        type: 'string',
        maxLength: 255,
      },
      purchaseDate: {
        type: 'string',
        format: 'date',
      },
      purchasePrice: {
        type: 'number',
        minimum: 0,
      },
      purchaseChannel: {
        type: 'string',
        maxLength: 255,
      },
      resalePrice: {
        type: 'number',
        minimum: 0,
      },
      soldPrice: {
        type: 'number',
        minimum: 0,
      },
      status: {
        type: 'string',
        enum: ITEM_STATUS_ENUM,
      },
      warrantyDate: {
        type: 'string',
        format: 'date',
      },
      expiryDate: {
        type: 'string',
        format: 'date',
      },
      note: {
        type: 'string',
        maxLength: 2000,
      },
      categoryId: {
        type: 'string',
        format: 'uuid',
      },
      tags: {
        type: 'array',
        items: {
          type: 'string',
          minLength: 1,
          maxLength: 50,
        },
        maxItems: 20,
      },
    },
    additionalProperties: false,
  },
} as const;

/** 更新物品请求 Schema */
export const updateItemSchema = {
  body: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
      },
      brand: {
        type: 'string',
        maxLength: 255,
      },
      model: {
        type: 'string',
        maxLength: 255,
      },
      purchaseDate: {
        type: 'string',
        format: 'date',
      },
      purchasePrice: {
        type: 'number',
        minimum: 0,
      },
      purchaseChannel: {
        type: 'string',
        maxLength: 255,
      },
      resalePrice: {
        type: ['number', 'null'],
        minimum: 0,
      },
      soldPrice: {
        type: ['number', 'null'],
        minimum: 0,
      },
      status: {
        type: 'string',
        enum: ITEM_STATUS_ENUM,
      },
      warrantyDate: {
        type: ['string', 'null'],
        format: 'date',
      },
      expiryDate: {
        type: ['string', 'null'],
        format: 'date',
      },
      note: {
        type: ['string', 'null'],
        maxLength: 2000,
      },
      categoryId: {
        type: ['string', 'null'],
        format: 'uuid',
      },
      tags: {
        type: 'array',
        items: {
          type: 'string',
          minLength: 1,
          maxLength: 50,
        },
        maxItems: 20,
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

/** 获取物品详情请求 Schema */
export const getItemSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
} as const;

/** 删除物品请求 Schema */
export const deleteItemSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
} as const;

/** 物品列表查询参数 Schema */
export const listItemsSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
      search: {
        type: 'string',
        maxLength: 100,
      },
      categoryId: {
        type: 'string',
        format: 'uuid',
      },
      status: {
        type: 'string',
        enum: ITEM_STATUS_ENUM,
      },
      tag: {
        type: 'string',
        maxLength: 50,
      },
    },
    additionalProperties: false,
  },
} as const;
