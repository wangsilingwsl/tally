import { describe, it, expect } from 'vitest';
import { validateItemForm, isValid, type ItemFormData } from './validation';

/** 构造完整的合法表单数据 */
function validFormData(overrides: Partial<ItemFormData> = {}): ItemFormData {
  return {
    name: '测试物品',
    brand: '',
    model: '',
    purchaseDate: '2024-01-15',
    purchasePrice: '299.99',
    purchaseChannel: '',
    resalePrice: '',
    soldPrice: '',
    status: 'IN_USE',
    warrantyDate: '',
    expiryDate: '',
    note: '',
    ...overrides,
  };
}

describe('validateItemForm', () => {
  it('合法数据校验通过', () => {
    const errors = validateItemForm(validFormData());
    expect(isValid(errors)).toBe(true);
  });

  it('名称为空时返回错误', () => {
    const errors = validateItemForm(validFormData({ name: '' }));
    expect(errors.name).toBeDefined();
  });

  it('名称仅空格时返回错误', () => {
    const errors = validateItemForm(validFormData({ name: '   ' }));
    expect(errors.name).toBeDefined();
  });

  it('购买日期为空时返回错误', () => {
    const errors = validateItemForm(validFormData({ purchaseDate: '' }));
    expect(errors.purchaseDate).toBeDefined();
  });

  it('购买价格为空时返回错误', () => {
    const errors = validateItemForm(validFormData({ purchasePrice: '' }));
    expect(errors.purchasePrice).toBeDefined();
  });

  it('购买价格为负数时返回错误', () => {
    const errors = validateItemForm(validFormData({ purchasePrice: '-10' }));
    expect(errors.purchasePrice).toBeDefined();
  });

  it('购买价格为非数值时返回错误', () => {
    const errors = validateItemForm(validFormData({ purchasePrice: 'abc' }));
    expect(errors.purchasePrice).toBeDefined();
  });

  it('购买价格为 0 时校验通过', () => {
    const errors = validateItemForm(validFormData({ purchasePrice: '0' }));
    expect(errors.purchasePrice).toBeUndefined();
  });

  it('二手回收价格为负数时返回错误', () => {
    const errors = validateItemForm(validFormData({ resalePrice: '-5' }));
    expect(errors.resalePrice).toBeDefined();
  });

  it('二手回收价格为非数值时返回错误', () => {
    const errors = validateItemForm(validFormData({ resalePrice: 'xyz' }));
    expect(errors.resalePrice).toBeDefined();
  });

  it('二手回收价格为空时不报错（选填）', () => {
    const errors = validateItemForm(validFormData({ resalePrice: '' }));
    expect(errors.resalePrice).toBeUndefined();
  });

  it('物品状态为空时返回错误', () => {
    const errors = validateItemForm(validFormData({ status: '' }));
    expect(errors.status).toBeDefined();
  });

  it('物品状态为非法值时返回错误', () => {
    const errors = validateItemForm(validFormData({ status: 'INVALID' }));
    expect(errors.status).toBeDefined();
  });

  it('所有合法状态值均通过校验', () => {
    for (const status of ['IN_USE', 'IDLE', 'DISCARDED']) {
      const errors = validateItemForm(validFormData({ status }));
      expect(errors.status).toBeUndefined();
    }
    // SOLD 状态需要填写出售价格
    const soldErrors = validateItemForm(validFormData({ status: 'SOLD', soldPrice: '100' }));
    expect(soldErrors.status).toBeUndefined();
  });

  it('状态为 SOLD 时出售价格为空返回错误', () => {
    const errors = validateItemForm(validFormData({ status: 'SOLD', soldPrice: '' }));
    expect(errors.soldPrice).toBeDefined();
  });

  it('状态为 SOLD 时出售价格为负数返回错误', () => {
    const errors = validateItemForm(validFormData({ status: 'SOLD', soldPrice: '-1' }));
    expect(errors.soldPrice).toBeDefined();
  });

  it('状态为 SOLD 时出售价格为 0 校验通过', () => {
    const errors = validateItemForm(validFormData({ status: 'SOLD', soldPrice: '0' }));
    expect(errors.soldPrice).toBeUndefined();
  });

  it('状态非 SOLD 时出售价格为空不报错', () => {
    const errors = validateItemForm(validFormData({ status: 'IN_USE', soldPrice: '' }));
    expect(errors.soldPrice).toBeUndefined();
  });
});

describe('isValid', () => {
  it('空对象返回 true', () => {
    expect(isValid({})).toBe(true);
  });

  it('有错误字段返回 false', () => {
    expect(isValid({ name: '必填' })).toBe(false);
  });
});
