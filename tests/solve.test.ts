import { describe, expect, it } from 'vitest';
import { convolve } from '../src/solver/convolve';
import { solve } from '../src/solver/solve';
import {
  DEFAULT_KERNEL,
  DEFAULT_MAX_PULSES,
  DEFAULT_WAVEFORM,
} from '../src/defaultSample';

/** 暴力枚举全部脉冲向量，独立复算三层规则与同优计数集合（仅用于小规模对拍）。 */
function bruteForce(waveform: number[], kernel: number[], maxPulses: number) {
  const m = waveform.length;
  const n = m - kernel.length + 1;
  let bestAbs = Infinity;
  let bestPulses = Infinity;
  let canonical: number[] = [];
  const achievable: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
  const x = new Array<number>(n).fill(0);

  const visit = () => {
    const y = convolve(x, kernel, m);
    let abs = 0;
    for (let t = 0; t < m; t++) abs += Math.abs(waveform[t] - y[t]);
    const pulses = x.reduce((a, b) => a + b, 0);
    if (abs < bestAbs || (abs === bestAbs && pulses < bestPulses)) {
      bestAbs = abs;
      bestPulses = pulses;
      canonical = [...x];
      achievable.forEach((s) => s.clear());
      for (let j = 0; j < n; j++) achievable[j].add(x[j]);
    } else if (abs === bestAbs && pulses === bestPulses) {
      for (let j = 0; j < n; j++) {
        if (x[j] !== canonical[j]) {
          if (x[j] < canonical[j]) canonical = [...x];
          break;
        }
      }
      for (let j = 0; j < n; j++) achievable[j].add(x[j]);
    }
  };

  const rec = (j: number) => {
    if (j === n) {
      visit();
      return;
    }
    for (let v = 0; v <= maxPulses; v++) {
      x[j] = v;
      rec(j + 1);
    }
  };
  rec(0);
  return {
    bestAbs,
    bestPulses,
    canonical,
    achievable: achievable.map((s) => [...s].sort((a, b) => a - b)),
  };
}

/** 可复现的伪随机序列（LCG）。 */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('双层最优解卷积', () => {
  it('卷积边界：仅首尾位置有脉冲时仍精确还原（越界按零）', () => {
    const kernel = [2, 3, 1];
    const m = 12;
    const n = m - kernel.length + 1;
    const pulses = new Array<number>(n).fill(0);
    pulses[0] = 3;
    pulses[n - 1] = 2;
    const w = convolve(pulses, kernel, m);
    const r = solve({ waveform: w, kernel, maxPulses: 4 });
    expect(r.bestAbs).toBe(0);
    expect(r.canonical).toEqual(pulses);
    expect(r.reconstruction).toEqual(w);
  });

  it('第一层规则：绝对残差和优先于脉冲总数', () => {
    // w=[3,1,3], k=[1,1]：全零解脉冲数为 0 但残差 7；
    // 最优残差 5 需要 1 个脉冲 → 必须选后者。
    const r = solve({ waveform: [3, 1, 3], kernel: [1, 1], maxPulses: 4 });
    expect(r.bestAbs).toBe(5);
    expect(r.bestPulses).toBe(1);
  });

  it('第二层规则：残差并列时取脉冲总数更小者', () => {
    // w=[1,0,1], k=[1,1]：[0,0]、[1,0]、[0,1]、[1,1] 的残差和都是 2，
    // 脉冲总数分别为 0/1/1/2 → 规范解必须是不放脉冲的 [0,0]。
    const r = solve({ waveform: [1, 0, 1], kernel: [1, 1], maxPulses: 4 });
    expect(r.bestAbs).toBe(2);
    expect(r.bestPulses).toBe(0);
    expect(r.canonical).toEqual([0, 0]);
  });

  it('字典序规范解与同优计数集合：w=[3,1,3] 存在并列同优解', () => {
    // 双层同优解为 [0,1] 与 [1,0]（残差 5、脉冲 1）：
    // 规范解取字典序最小 [0,1]；两个位置的可取计数集合都是 {0,1}。
    const r = solve({ waveform: [3, 1, 3], kernel: [1, 1], maxPulses: 4 });
    expect(r.bestAbs).toBe(5);
    expect(r.bestPulses).toBe(1);
    expect(r.canonical).toEqual([0, 1]);
    expect(r.achievable).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it('脉冲上限为 0 时只能全零', () => {
    const w = [0, 2, 5, 1, 0, 0, 3, 3, 0, 1, 0, 0];
    const r = solve({ waveform: w, kernel: [1, 2, 1], maxPulses: 0 });
    expect(r.bestPulses).toBe(0);
    expect(r.canonical).toEqual(new Array(r.n).fill(0));
    expect(r.bestAbs).toBe(w.reduce((a, b) => a + b, 0));
    expect(r.achievable.every((s) => s.length === 1 && s[0] === 0)).toBe(true);
  });

  it('默认示例：双层最优值与同优计数位置符合手工核算', () => {
    const r = solve({
      waveform: DEFAULT_WAVEFORM,
      kernel: DEFAULT_KERNEL,
      maxPulses: DEFAULT_MAX_PULSES,
    });
    expect(r.m).toBe(24);
    expect(r.n).toBe(23);
    expect(r.bestAbs).toBe(10);
    expect(r.bestPulses).toBe(7);
    // 两段 [3,1,3] 图样各产生两个同优多值位置，集合均为 {0,1}
    const tied = r.achievable.map((s, j) => (s.length > 1 ? j : -1)).filter((j) => j >= 0);
    expect(tied).toEqual([2, 3, 12, 13]);
    expect(r.achievable[2]).toEqual([0, 1]);
    expect(r.achievable[13]).toEqual([0, 1]);
    // 字典序最小 ⇒ 同优位置取 0
    expect(r.canonical[2]).toBe(0);
    expect(r.canonical[3]).toBe(1);
  });

  it('自洽性：规范解的残差和与脉冲总数等于报告的双层最优值', () => {
    const rand = lcg(20260922);
    const m = 60;
    const k = 5;
    const n = m - k + 1;
    const kernel = [1, 3, 2, 4, 1];
    const pulses = Array.from({ length: n }, () => Math.floor(rand() * 3));
    const w = convolve(pulses, kernel, m).map((v) => v + Math.floor(rand() * 2));
    const r = solve({ waveform: w, kernel, maxPulses: 3 });
    const recon = convolve(r.canonical, kernel, m);
    expect(recon.reduce((a, y, t) => a + Math.abs(w[t] - y), 0)).toBe(r.bestAbs);
    expect(r.canonical.reduce((a, b) => a + b, 0)).toBe(r.bestPulses);
    r.canonical.forEach((v, j) => expect(r.achievable[j]).toContain(v));
    r.achievable.forEach((s) => {
      expect(s.length).toBeGreaterThan(0);
      s.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(3);
      });
    });
  });

  it('小规模随机案例与暴力枚举完全一致（含同优计数集合）', () => {
    const rand = lcg(42);
    for (let trial = 0; trial < 30; trial++) {
      const k = 2 + Math.floor(rand() * 2); // 2..3
      const n = 3 + Math.floor(rand() * 4); // 3..6
      const m = n + k - 1;
      const P = 1 + Math.floor(rand() * 2); // 1..2
      const kernel = Array.from({ length: k }, () => Math.floor(rand() * 4));
      kernel[0] = 1 + Math.floor(rand() * 3);
      kernel[k - 1] = 1 + Math.floor(rand() * 3);
      const waveform = Array.from({ length: m }, () => Math.floor(rand() * 7));
      const got = solve({ waveform, kernel, maxPulses: P });
      const want = bruteForce(waveform, kernel, P);
      expect(got.bestAbs).toBe(want.bestAbs);
      expect(got.bestPulses).toBe(want.bestPulses);
      expect(got.canonical).toEqual(want.canonical);
      expect(got.achievable).toEqual(want.achievable);
    }
  });

  it('重复 25 段隔离同优片段（200 点、2^25 条同优解）：性能不随同优解数量退化', () => {
    // 单段 w=[0,0,3,1,3,0,0,0]，核 [1,1]：位置 2/3 可在 {0,1} 中互换，
    // 产生 2 条同优解；25 段彼此隔离 ⇒ 2^25 ≈ 3.3×10^7 条同优解。
    // 旧实现逐条枚举路径会长期无响应；修复后只传播状态集合，应即时返回。
    const block = [0, 0, 3, 1, 3, 0, 0, 0];
    const groups = 25;
    const waveform = Array.from({ length: groups }, () => block).flat();
    const kernel = [1, 1];
    const maxPulses = 4;

    const startedAt = performance.now();
    const r = solve({ waveform, kernel, maxPulses });
    const wallMs = performance.now() - startedAt;

    expect(r.m).toBe(200);
    expect(r.n).toBe(199);
    expect(r.bestAbs).toBe(125); // 每段 5（t=+3、t=+2 两处不可消除残差）
    expect(r.bestPulses).toBe(25); // 每段恰 1 个脉冲
    expect(wallMs).toBeLessThan(1000); // 常规测试时限内必须返回
    expect(r.elapsedMs).toBeLessThan(1000);

    // 零基脉冲位置 8g+2、8g+3 可取 {0,1}，其余只能取 {0}
    const tied: number[] = [];
    for (let j = 0; j < r.n; j++) {
      if (r.achievable[j].length > 1) tied.push(j);
    }
    expect(tied).toEqual(
      Array.from({ length: groups }, (_, g) => [8 * g + 2, 8 * g + 3]).flat(),
    );
    for (let g = 0; g < groups; g++) {
      expect(r.achievable[8 * g + 2]).toEqual([0, 1]);
      expect(r.achievable[8 * g + 3]).toEqual([0, 1]);
      for (const off of [0, 1, 4, 5, 6, 7]) {
        const j = 8 * g + off;
        if (j < r.n) expect(r.achievable[j]).toEqual([0]);
      }
    }

    // 规范解：每组 8g+3 取 1，其余取 0（字典序最小，脉冲放在靠后的并列位置）
    const expectedCanonical = new Array<number>(r.n).fill(0);
    for (let g = 0; g < groups; g++) expectedCanonical[8 * g + 3] = 1;
    expect(r.canonical).toEqual(expectedCanonical);

    // 重建波形与有符号残差必须与规范向量一致：
    // 每段重建仅在 8g+3、8g+4 为 1；残差为 8g+2 处 +3、8g+4 处 +2。
    const expectedRecon = new Array<number>(200).fill(0);
    const expectedResidual = new Array<number>(200).fill(0);
    for (let g = 0; g < groups; g++) {
      expectedRecon[8 * g + 3] = 1;
      expectedRecon[8 * g + 4] = 1;
      expectedResidual[8 * g + 2] = 3;
      expectedResidual[8 * g + 4] = 2;
    }
    expect(r.reconstruction).toEqual(expectedRecon);
    expect(r.residual).toEqual(expectedResidual);
    expect(r.reconstruction).toEqual(convolve(r.canonical, kernel, 200));
    expect(r.residual.every((v, t) => v === waveform[t] - r.reconstruction[t])).toBe(true);
    expect(r.residual.reduce((a, v) => a + Math.abs(v), 0)).toBe(r.bestAbs);
    expect(r.canonical.reduce((a, v) => a + v, 0)).toBe(r.bestPulses);
  });

  it('短记录单段同优：w=[0,0,3,1,3,0,0,0] 的多解集合与规范解', () => {
    // 单段短记录：脉冲位置 2 与 3 在 {0,1} 间互换，共 2 条双层同优解；
    // 规范解字典序最小，脉冲放在位置 3。
    const waveform = [0, 0, 3, 1, 3, 0, 0, 0];
    const r = solve({ waveform, kernel: [1, 1], maxPulses: 4 });
    expect(r.bestAbs).toBe(5);
    expect(r.bestPulses).toBe(1);
    expect(r.canonical).toEqual([0, 0, 0, 1, 0, 0, 0]);
    expect(r.achievable).toEqual([
      [0],
      [0],
      [0, 1],
      [0, 1],
      [0],
      [0],
      [0],
    ]);
    expect(r.reconstruction).toEqual([0, 0, 0, 1, 1, 0, 0, 0]);
    expect(r.residual).toEqual([0, 0, 3, 0, 2, 0, 0, 0]);
  });

  it('非法输入抛出异常', () => {
    expect(() => solve({ waveform: [1, 2], kernel: [1, 1, 1], maxPulses: 4 })).toThrow();
    expect(() => solve({ waveform: [1, 2, 3], kernel: [1], maxPulses: 4 })).toThrow();
    expect(() => solve({ waveform: [1, 2, 3], kernel: [1, 1], maxPulses: 5 })).toThrow();
  });
});
