import { convolve } from './convolve';

export interface SolveInput {
  /** 观测波形：非负整数，长度 m */
  waveform: number[];
  /** 响应核：非负整数、首尾为正，长度 k */
  kernel: number[];
  /** 每个采样点的脉冲数上限，0..4 */
  maxPulses: number;
}

export interface SolveResult {
  /** 波形长度 m */
  m: number;
  /** 潜在脉冲序列长度 n = m − k + 1 */
  n: number;
  /** 第一层最优：绝对残差总和的最小值 */
  bestAbs: number;
  /** 第二层最优：同优下脉冲总数的最小值 */
  bestPulses: number;
  /** 规范解：全部双层同优解中字典序最小的脉冲向量 */
  canonical: number[];
  /** 每个脉冲位置在全部双层同优解中的可取计数集合（升序、精确） */
  achievable: number[][];
  /** 规范解卷积出的重建波形 */
  reconstruction: number[];
  /** 有符号残差：观测 − 重建 */
  residual: number[];
  /** 求解耗时（毫秒） */
  elapsedMs: number;
}

/**
 * 双层最优解卷积（精确动态规划，非近似）：
 *   1) 最小化 Σ_t |w[t] − y[t]|，y 为零边界卷积；
 *   2) 在第一层同优解中最小化 Σ_j x[j]；
 *   3) 仍并列时取脉冲向量字典序最小者作为规范解；
 *   并给出每个位置在全部双层同优解中可取的精确计数集合。
 *
 * 由于 y[t] 只依赖 x[t−k+1..t]，以「最近 k−1 个脉冲取值」为状态做动态规划。
 * 每点脉冲上限 P ≤ 4、核长 k ≤ 7，故状态数 (P+1)^(k−1) ≤ 5^6 = 15625。
 * 反向扫一遍求最优完成代价；正向扫一遍维护「可由双层最优前缀到达」的状态
 * 集合，逐位置统计同优可取计数（不逐一枚举同优解——同优解数量随相互独立
 * 的同优片段指数增长，枚举会导致页面长时间无响应）；最后按字典序贪心构造
 * 规范解。整体复杂度 O(m · 状态数 · (P+1))，与同优解总数无关。
 */
export function solve(input: SolveInput): SolveResult {
  const started = performance.now();
  const { waveform, kernel, maxPulses } = input;
  const m = waveform.length;
  const k = kernel.length;
  const n = m - k + 1;
  if (!Number.isInteger(k) || k < 2) throw new Error('响应核长度必须为 ≥ 2 的整数');
  if (!Number.isInteger(m) || n < 1) throw new Error('波形长度必须不小于响应核长度');
  if (!Number.isInteger(maxPulses) || maxPulses < 0 || maxPulses > 4) {
    throw new Error('每点脉冲上限必须为 0..4 的整数');
  }

  const base = maxPulses + 1;
  const stateCount = base ** (k - 1);
  const h0 = kernel[0];

  // 状态 s 的 base 进制数码 d[i] = x[t−1−i]（i = 0..k−2，低位对应更近期的脉冲）。
  // convPart[s]：历史脉冲对当前采样 y[t] 的贡献 Σ_{i≥1} d[i−1]·h[i]；
  // nextState[s][v]：当前选择 x[t]=v 之后的新状态（滑窗左移，最旧一位丢弃）。
  const convPart = new Float64Array(stateCount);
  const nextState = new Uint32Array(stateCount * base);
  const keepMask = stateCount / base; // = base^(k−2)，去掉最旧数码后保留的部分
  for (let s = 0; s < stateCount; s++) {
    let rest = s;
    let conv = 0;
    for (let i = 0; i < k - 1; i++) {
      const d = rest % base;
      rest = (rest - d) / base;
      conv += d * kernel[i + 1];
    }
    convPart[s] = conv;
    const shifted = (s % keepMask) * base;
    const row = s * base;
    for (let v = 0; v < base; v++) nextState[row + v] = shifted + v;
  }

  // 反向动态规划：gAbs[t][s] / gPul[t][s] 表示在采样点 t 之前处于状态 s 时，
  // 完成残差 t..m−1 的最优（绝对残差和, 脉冲数）二元组。t ≥ n 时脉冲被强制为 0。
  const gAbs: Float64Array[] = new Array<Float64Array>(m + 1);
  const gPul: Float64Array[] = new Array<Float64Array>(m + 1);
  gAbs[m] = new Float64Array(stateCount);
  gPul[m] = new Float64Array(stateCount);
  for (let t = m - 1; t >= 0; t--) {
    const curA = new Float64Array(stateCount);
    const curP = new Float64Array(stateCount);
    const nxtA = gAbs[t + 1];
    const nxtP = gPul[t + 1];
    const w = waveform[t];
    const vMax = t < n ? maxPulses : 0;
    for (let s = 0; s < stateCount; s++) {
      const conv = convPart[s];
      const row = s * base;
      let bestA = Infinity;
      let bestP = Infinity;
      for (let v = 0; v <= vMax; v++) {
        const ns = nextState[row + v];
        const a = Math.abs(w - (conv + h0 * v)) + nxtA[ns];
        const p = v + nxtP[ns];
        if (a < bestA || (a === bestA && p < bestP)) {
          bestA = a;
          bestP = p;
        }
      }
      curA[s] = bestA;
      curP[s] = bestP;
    }
    gAbs[t] = curA;
    gPul[t] = curP;
  }

  const bestAbs = gAbs[0][0];
  const bestPulses = gPul[0][0];

  // 正向扫描：reachable[s] 表示「采样点 t 之前处于状态 s」能否由某条逐步与
  // 双层最优完成代价衔接的脉冲前缀到达。一条完整路径是双层最优解，当且仅当
  // 它的每一步取值都满足衔接条件（该步残差/脉冲与 g 值精确相等）；因此位置 t
  // 的可取计数，恰好是某个可达状态在采样点 t 处满足衔接条件的取值。同优解
  // 数量随独立同优片段指数增长，而本扫描保持 O(n · 状态数 · (P+1))。
  const valueSets = Array.from({ length: n }, () => new Set<number>());
  let reachable = new Uint8Array(stateCount);
  let reachableNext = new Uint8Array(stateCount);
  reachable[0] = 1;
  for (let t = 0; t < n; t++) {
    reachableNext.fill(0);
    const w = waveform[t];
    const curA = gAbs[t];
    const curP = gPul[t];
    const nxtA = gAbs[t + 1];
    const nxtP = gPul[t + 1];
    const values = valueSets[t];
    for (let s = 0; s < stateCount; s++) {
      if (reachable[s] === 0) continue;
      const conv = convPart[s];
      const wantA = curA[s];
      const wantP = curP[s];
      const row = s * base;
      for (let v = 0; v <= maxPulses; v++) {
        const ns = nextState[row + v];
        const a = Math.abs(w - (conv + h0 * v)) + nxtA[ns];
        if (a !== wantA) continue;
        const p = v + nxtP[ns];
        if (p !== wantP) continue;
        values.add(v);
        reachableNext[ns] = 1;
      }
    }
    const swap = reachable;
    reachable = reachableNext;
    reachableNext = swap;
  }

  // 字典序最小规范解：从初始状态出发逐位贪心，取仍与双层最优完成代价衔接的
  // 最小计数。衔接条件保证剩余部分必然能补全为双层最优解，故逐位最小即整体
  // 字典序最小。
  const canonical = new Array<number>(n).fill(0);
  let state = 0;
  for (let t = 0; t < n; t++) {
    const w = waveform[t];
    const conv = convPart[state];
    const wantA = gAbs[t][state];
    const wantP = gPul[t][state];
    const row = state * base;
    for (let v = 0; v <= maxPulses; v++) {
      const ns = nextState[row + v];
      const a = Math.abs(w - (conv + h0 * v)) + gAbs[t + 1][ns];
      if (a !== wantA) continue;
      const p = v + gPul[t + 1][ns];
      if (p !== wantP) continue;
      canonical[t] = v;
      state = ns;
      break;
    }
  }

  const achievable = valueSets.map((values) => [...values].sort((a, b) => a - b));

  const reconstruction = convolve(canonical, kernel, m);
  const residual = waveform.map((w, t) => w - reconstruction[t]);
  return {
    m,
    n,
    bestAbs,
    bestPulses,
    canonical,
    achievable,
    reconstruction,
    residual,
    elapsedMs: performance.now() - started,
  };
}
