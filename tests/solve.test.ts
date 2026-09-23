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

  it('短记录：少量重复同优片段的多解集合与字典序规范解', () => {
    // 3 段 [0,0,3,1,3,0,0,0]：每段的双层同优解为在 8g+2 / 8g+3 二取一放 1 个脉冲，
    // 段间被足够长的零采样隔离，互不干扰。
    const segment = [0, 0, 3, 1, 3, 0, 0, 0];
    const waveform = Array.from({ length: 3 }, () => segment).flat();
    expect(waveform).toHaveLength(24);
    const r = solve({ waveform, kernel: [1, 1], maxPulses: 4 });
    expect(r.bestAbs).toBe(15);
    expect(r.bestPulses).toBe(3);
    // 字典序最小 ⇒ 每组都在 8g+3 处放脉冲
    const wantCanonical = new Array<number>(r.n).fill(0);
    for (let g = 0; g < 3; g++) wantCanonical[8 * g + 3] = 1;
    expect(r.canonical).toEqual(wantCanonical);
    // 同优计数集合：8g+2 与 8g+3 为 {0,1}，其余位置只能取 {0}
    r.achievable.forEach((set, j) => {
      if (j % 8 === 2 || j % 8 === 3) expect(set).toEqual([0, 1]);
      else expect(set).toEqual([0]);
    });
    expect(r.reconstruction).toEqual(convolve(wantCanonical, [1, 1], 24));
    expect(r.residual).toEqual(waveform.map((w, t) => w - r.reconstruction[t]));
  });

  it('短记录对拍：2 段重复片段（上限 1）与暴力枚举完全一致', () => {
    const segment = [0, 0, 3, 1, 3, 0, 0, 0];
    const waveform = Array.from({ length: 2 }, () => segment).flat();
    const got = solve({ waveform, kernel: [1, 1], maxPulses: 1 });
    const want = bruteForce(waveform, [1, 1], 1);
    expect(got.bestAbs).toBe(10);
    expect(got.bestPulses).toBe(2);
    expect(got.canonical).toEqual(want.canonical);
    expect(got.achievable).toEqual(want.achievable);
  });

  it('长记录：25 个彼此隔离的同优片段（200 点）在常规时限内返回完整结果', () => {
    // 同优解共 2^25 个；逐一枚举必然超时，动态规划须直接给出精确汇总。
    const segment = [0, 0, 3, 1, 3, 0, 0, 0];
    const waveform = Array.from({ length: 25 }, () => segment).flat();
    expect(waveform).toHaveLength(200);
    const r = solve({ waveform, kernel: [1, 1], maxPulses: 4 });
    expect(r.elapsedMs).toBeLessThan(2000);
    expect(r.m).toBe(200);
    expect(r.n).toBe(199);
    expect(r.bestAbs).toBe(125);
    expect(r.bestPulses).toBe(25);
    // 规范解：每组在 8g+3 处取 1，其余位置取 0
    const wantCanonical = new Array<number>(199).fill(0);
    for (let g = 0; g < 25; g++) wantCanonical[8 * g + 3] = 1;
    expect(r.canonical).toEqual(wantCanonical);
    // 精确可取计数集合：8g+2 与 8g+3 为 {0,1}，其余 149 个位置恰为 {0}
    expect(r.achievable).toHaveLength(199);
    r.achievable.forEach((set, j) => {
      if (j % 8 === 2 || j % 8 === 3) expect(set).toEqual([0, 1]);
      else expect(set).toEqual([0]);
    });
    // 重建波形与有符号残差必须和规范解的卷积一致
    const wantRecon = convolve(wantCanonical, [1, 1], 200);
    expect(r.reconstruction).toEqual(wantRecon);
    expect(r.residual).toEqual(waveform.map((w, t) => w - wantRecon[t]));
    expect(r.residual.reduce((a, v) => a + Math.abs(v), 0)).toBe(125);
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

  it('非法输入抛出异常', () => {
    expect(() => solve({ waveform: [1, 2], kernel: [1, 1, 1], maxPulses: 4 })).toThrow();
    expect(() => solve({ waveform: [1, 2, 3], kernel: [1], maxPulses: 4 })).toThrow();
    expect(() => solve({ waveform: [1, 2, 3], kernel: [1, 1], maxPulses: 5 })).toThrow();
  });
});
