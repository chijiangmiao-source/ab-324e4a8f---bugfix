import { describe, expect, it } from 'vitest';
import { convolve } from '../src/solver/convolve';

describe('零边界卷积', () => {
  it('首位置脉冲只向右展开，左侧越界项按零处理', () => {
    // m=4, k=2, n=3：x[0]=2 → y[0]=2·3, y[1]=2·4，其余为零
    expect(convolve([2, 0, 0], [3, 4], 4)).toEqual([6, 8, 0, 0]);
  });

  it('末位置脉冲的响应在波形末端结束，不环绕、不外溢', () => {
    // m=5, k=3, n=3：x[2]=1 → y[2..4] = [2, 3, 5]
    expect(convolve([0, 0, 1], [2, 3, 5], 5)).toEqual([0, 0, 2, 3, 5]);
  });

  it('与朴素定义逐点一致（含两侧越界按零）', () => {
    const kernel = [2, 1, 3];
    const m = 9;
    const n = m - kernel.length + 1;
    const pulses = [0, 3, 1, 0, 2, 0, 4];
    const y = convolve(pulses, kernel, m);
    for (let t = 0; t < m; t++) {
      let want = 0;
      for (let j = 0; j < n; j++) {
        const i = t - j;
        if (i >= 0 && i < kernel.length) want += pulses[j] * kernel[i];
      }
      expect(y[t]).toBe(want);
    }
  });

  it('全零脉冲得到全零波形', () => {
    expect(convolve([0, 0, 0], [1, 2], 4)).toEqual([0, 0, 0, 0]);
  });
});
