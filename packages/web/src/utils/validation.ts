/**
 * 物品数据校验纯函数
 * 提取为独立模块，便于单元测试和属性测试
 */

/** 校验错误映射：字段名 → 错误信息 */
export type ValidationErrors = {
  [key: string]: string | undefined;
  name?: string;
  purchaseDate?: string;
  purchasePrice?: string;
  resalePrice?: string;
  status?: string;
};

/** 物品表单数据（校验输入） */
export interface ItemFormData {
  name: string;
  brand: string;
  model: string;
  purchaseDate: string;
  purchasePrice: string;
  purchaseChannel: string;
  resalePrice: string;
  status: string;
  warrantyDate: string;
  expiryDate: string;
  note: string;
}

/** 合法的物品状态值 */
const VALID_STATUSES = ['IN_USE', 'IDLE', 'SOLD', 'DISCARDED'];

/**
 * 校验物品表单数据
 * @returns 错误映射，空对象表示校验通过
 */
export function validateItemForm(data: ItemFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  // 名称：必填
  if (!data.name.trim()) {
    errors.name = '请输入物品名称';
  }

  // 购买日期：必填
  if (!data.purchaseDate) {
    errors.purchaseDate = '请选择购买日期';
  }

  // 购买价格：必填，非负数值
  if (!data.purchasePrice && data.purchasePrice !== '0') {
    errors.purchasePrice = '请输入购买价格';
  } else {
    const price = Number(data.purchasePrice);
    if (isNaN(price)) {
      errors.purchasePrice = '购买价格必须为数值';
    } else if (price < 0) {
      errors.purchasePrice = '购买价格不能为负数';
    }
  }

  // 预估二手回收价格：选填，但填写时必须为非负数值
  if (data.resalePrice !== '') {
    const resale = Number(data.resalePrice);
    if (isNaN(resale)) {
      errors.resalePrice = '二手回收价格必须为数值';
    } else if (resale < 0) {
      errors.resalePrice = '二手回收价格不能为负数';
    }
  }

  // 物品状态：必填，必须为合法值
  if (!data.status) {
    errors.status = '请选择物品状态';
  } else if (!VALID_STATUSES.includes(data.status)) {
    errors.status = '物品状态不合法';
  }

  return errors;
}

/**
 * 判断校验结果是否通过（无错误）
 */
export function isValid(errors: ValidationErrors): boolean {
  return Object.keys(errors).length === 0;
}
