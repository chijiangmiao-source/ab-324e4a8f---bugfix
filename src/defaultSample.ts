/**
 * 默认示例：24 点波形 + 核 [1, 1]。
 * 其中两段 [3, 1, 3] 图样在双层最优下存在并列同优解
 * （对应位置可取计数集合为 {0, 1}），便于演示同优计数审计。
 */
export const DEFAULT_WAVEFORM: number[] = [
  0, 0, 3, 1, 3, 0, 0, 0, 2, 2, 0, 0, 3, 1, 3, 0, 0, 1, 2, 2, 1, 0, 0, 0,
];
export const DEFAULT_KERNEL: number[] = [1, 1];
export const DEFAULT_MAX_PULSES = 4;

export const DEFAULT_WAVEFORM_TEXT = DEFAULT_WAVEFORM.join(', ');
export const DEFAULT_KERNEL_TEXT = DEFAULT_KERNEL.join(', ');
export const DEFAULT_MAX_PULSES_TEXT = String(DEFAULT_MAX_PULSES);
