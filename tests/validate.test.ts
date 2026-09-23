import { describe, expect, it } from 'vitest';
import {
  validateKernelText,
  validateMaxPulsesText,
  validateWaveformText,
} from '../src/solver/validate';

const okWave = (n: number) => Array.from({ length: n }, (_, i) => i % 5).join(', ');

describe('输入校验', () => {
  it('波形长度下界：11 点拒绝并说明原因，12 点接受', () => {
    const bad = validateWaveformText(okWave(11));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0].message).toContain('12');
    expect(validateWaveformText(okWave(12)).ok).toBe(true);
  });

  it('波形长度上界：300 点接受，301 点拒绝', () => {
    expect(validateWaveformText(okWave(300)).ok).toBe(true);
    const bad = validateWaveformText(okWave(301));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0].message).toContain('301');
  });

  it('非整数与负数项被拒绝并定位到序号', () => {
    const bad = validateWaveformText(`${okWave(12)}, abc`);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors[0].index).toBe(13);
      expect(bad.errors[0].message).toContain('abc');
    }
    const neg = validateWaveformText('1, 2, -3, 4, 5, 6, 7, 8, 9, 10, 11, 12');
    expect(neg.ok).toBe(false);
    if (!neg.ok) expect(neg.errors[0].index).toBe(3);
  });

  it('响应核长度限 2–7', () => {
    expect(validateKernelText('1, 1').ok).toBe(true);
    expect(validateKernelText('1, 0, 0, 0, 0, 0, 1').ok).toBe(true);
    expect(validateKernelText('5').ok).toBe(false);
    expect(validateKernelText('1, 1, 1, 1, 1, 1, 1, 1').ok).toBe(false);
  });

  it('响应核首尾必须为正，中间允许为零', () => {
    expect(validateKernelText('1, 0, 1').ok).toBe(true);
    const head = validateKernelText('0, 1, 1');
    expect(head.ok).toBe(false);
    if (!head.ok) expect(head.errors[0].index).toBe(1);
    const tail = validateKernelText('1, 1, 0');
    expect(tail.ok).toBe(false);
    if (!tail.ok) expect(tail.errors[0].index).toBe(3);
  });

  it('脉冲上限限 0–4 的整数', () => {
    expect(validateMaxPulsesText('0').ok).toBe(true);
    expect(validateMaxPulsesText('4').ok).toBe(true);
    expect(validateMaxPulsesText('5').ok).toBe(false);
    expect(validateMaxPulsesText('-1').ok).toBe(false);
    expect(validateMaxPulsesText('2.5').ok).toBe(false);
    expect(validateMaxPulsesText('').ok).toBe(false);
  });
});
