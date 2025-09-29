// 简单的测试用例，验证Jest环境是否正常工作
describe('简单测试', () => {
  test('1 + 1 应该等于 2', () => {
    expect(1 + 1).toBe(2);
  });

  test('字符串测试', () => {
    expect('hello').toContain('h');
  });

  test('数组测试', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
  });
});