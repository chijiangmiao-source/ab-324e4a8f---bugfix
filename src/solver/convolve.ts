/**
 * 零边界卷积：y[t] = Σ_j x[j] · h[t−j]，凡 j < 0、j ≥ n 或 t−j 超出核长的项一律按零处理。
 *
 * @param pulses 潜在脉冲序列，长度 n = m − k + 1
 * @param kernel 探测器响应核，长度 k
 * @param m      波形长度（输出采样数）
 */
export function convolve(
  pulses: readonly number[],
  kernel: readonly number[],
  m: number,
): number[] {
  const y = new Array<number>(m).fill(0);
  for (let j = 0; j < pulses.length; j++) {
    const x = pulses[j];
    if (x === 0) continue;
    for (let i = 0; i < kernel.length; i++) {
      const t = j + i;
      if (t >= 0 && t < m) y[t] += x * kernel[i];
    }
  }
  return y;
}
