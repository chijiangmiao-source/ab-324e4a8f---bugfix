export const WAVEFORM_MIN = 12;
export const WAVEFORM_MAX = 300;
export const KERNEL_MIN = 2;
export const KERNEL_MAX = 7;
export const MAX_PULSES_MIN = 0;
export const MAX_PULSES_MAX = 4;

export interface FieldError {
  /** 出错项序号（从 1 开始）；整体性问题（如长度）时缺省 */
  index?: number;
  message: string;
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldError[] };

/** 把逗号 / 空白 / 分号分隔的文本解析为非负整数列表，逐项定位非法原因。 */
export function parseIntegerList(text: string): {
  values: number[];
  errors: FieldError[];
} {
  const tokens = text.split(/[\s,;，、]+/).filter((t) => t.length > 0);
  const values: number[] = [];
  const errors: FieldError[] = [];
  tokens.forEach((tok, i) => {
    if (!/^\d+$/.test(tok)) {
      errors.push({ index: i + 1, message: `第 ${i + 1} 项「${tok}」不是非负整数` });
      return;
    }
    const v = Number(tok);
    if (!Number.isSafeInteger(v)) {
      errors.push({ index: i + 1, message: `第 ${i + 1} 项「${tok}」超出安全整数范围` });
      return;
    }
    values.push(v);
  });
  return { values, errors };
}

/** 波形：长度 12–300 的非负整数序列。 */
export function validateWaveformText(text: string): ParseResult<number[]> {
  const { values, errors } = parseIntegerList(text);
  if (errors.length > 0) return { ok: false, errors };
  if (values.length < WAVEFORM_MIN || values.length > WAVEFORM_MAX) {
    return {
      ok: false,
      errors: [
        { message: `波形长度须为 ${WAVEFORM_MIN}–${WAVEFORM_MAX}，当前为 ${values.length}` },
      ],
    };
  }
  return { ok: true, value: values };
}

/** 响应核：长度 2–7 的非负整数序列，且首项与末项必须为正。 */
export function validateKernelText(text: string): ParseResult<number[]> {
  const { values, errors } = parseIntegerList(text);
  if (errors.length > 0) return { ok: false, errors };
  if (values.length < KERNEL_MIN || values.length > KERNEL_MAX) {
    return {
      ok: false,
      errors: [
        { message: `响应核长度须为 ${KERNEL_MIN}–${KERNEL_MAX}，当前为 ${values.length}` },
      ],
    };
  }
  if (values[0] <= 0) {
    return { ok: false, errors: [{ index: 1, message: '响应核首项（第 1 项）必须为正整数' }] };
  }
  if (values[values.length - 1] <= 0) {
    return {
      ok: false,
      errors: [
        { index: values.length, message: `响应核末项（第 ${values.length} 项）必须为正整数` },
      ],
    };
  }
  return { ok: true, value: values };
}

/** 每个采样点的脉冲数上限：0–4 的整数。 */
export function validateMaxPulsesText(text: string): ParseResult<number> {
  const t = text.trim();
  if (!/^\d+$/.test(t)) {
    return { ok: false, errors: [{ message: `脉冲上限「${t}」不是非负整数` }] };
  }
  const v = Number(t);
  if (v < MAX_PULSES_MIN || v > MAX_PULSES_MAX) {
    return {
      ok: false,
      errors: [{ message: `脉冲上限须为 ${MAX_PULSES_MIN}–${MAX_PULSES_MAX} 的整数，当前为 ${v}` }],
    };
  }
  return { ok: true, value: v };
}
