import { useMemo, useState } from 'react';
import { solve } from './solver/solve';
import {
  validateWaveformText,
  validateKernelText,
  validateMaxPulsesText,
  KERNEL_MAX,
  KERNEL_MIN,
  MAX_PULSES_MAX,
  MAX_PULSES_MIN,
  WAVEFORM_MAX,
  WAVEFORM_MIN,
  type FieldError,
} from './solver/validate';
import {
  DEFAULT_KERNEL,
  DEFAULT_KERNEL_TEXT,
  DEFAULT_MAX_PULSES,
  DEFAULT_MAX_PULSES_TEXT,
  DEFAULT_WAVEFORM,
  DEFAULT_WAVEFORM_TEXT,
} from './defaultSample';
import { PulseChart, ResidualChart, WaveformChart } from './components/Charts';

function FieldErrors({ errors }: { errors: FieldError[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="field-errors" role="alert">
      <div className="field-errors-note">输入无效，已保留最近一次有效值参与计算。原因：</div>
      <ul>
        {errors.map((e, i) => (
          <li key={i}>{e.message}</li>
        ))}
      </ul>
    </div>
  );
}

export default function App() {
  const [waveText, setWaveText] = useState(DEFAULT_WAVEFORM_TEXT);
  const [kernelText, setKernelText] = useState(DEFAULT_KERNEL_TEXT);
  const [mpText, setMpText] = useState(DEFAULT_MAX_PULSES_TEXT);

  // 已生效（最近一次合法）的求解输入；非法编辑不会覆盖它们。
  const [waveform, setWaveform] = useState<number[]>(DEFAULT_WAVEFORM);
  const [kernel, setKernel] = useState<number[]>(DEFAULT_KERNEL);
  const [maxPulses, setMaxPulses] = useState<number>(DEFAULT_MAX_PULSES);

  const [hover, setHover] = useState<number | null>(null);

  const waveCheck = useMemo(() => validateWaveformText(waveText), [waveText]);
  const kernelCheck = useMemo(() => validateKernelText(kernelText), [kernelText]);
  const mpCheck = useMemo(() => validateMaxPulsesText(mpText), [mpText]);

  const result = useMemo(
    () => solve({ waveform, kernel, maxPulses }),
    [waveform, kernel, maxPulses],
  );

  const tiedPositions = useMemo(
    () =>
      result.achievable
        .map((values, j) => (values.length > 1 ? j : -1))
        .filter((j) => j >= 0),
    [result],
  );

  const onWaveInput = (text: string) => {
    setWaveText(text);
    const r = validateWaveformText(text);
    if (r.ok) setWaveform(r.value);
  };
  const onKernelInput = (text: string) => {
    setKernelText(text);
    const r = validateKernelText(text);
    if (r.ok) setKernel(r.value);
  };
  const onMpInput = (text: string) => {
    setMpText(text);
    const r = validateMaxPulsesText(text);
    if (r.ok) setMaxPulses(r.value);
  };
  const resetDefaults = () => {
    setWaveText(DEFAULT_WAVEFORM_TEXT);
    setKernelText(DEFAULT_KERNEL_TEXT);
    setMpText(DEFAULT_MAX_PULSES_TEXT);
    setWaveform(DEFAULT_WAVEFORM);
    setKernel(DEFAULT_KERNEL);
    setMaxPulses(DEFAULT_MAX_PULSES);
  };

  const k = kernel.length;
  const hoverContrib =
    hover === null
      ? null
      : {
          lo: Math.max(0, hover - k + 1),
          hi: Math.min(hover, result.n - 1),
        };

  return (
    <div className="page">
      <header className="page-header">
        <h1>闪烁探测器波形解卷积审计</h1>
        <p>
          高计数率下相邻光子脉冲堆叠成一条波形。本页在浏览器内离线重算：先最小化绝对残差总和，
          同优时再最小化脉冲总数，仍并列时取脉冲向量字典序最小者为规范解；并枚举每个位置在全部
          双层同优解中的精确可取计数集合。卷积越界项一律按零处理。
        </p>
      </header>

      <section className="panel inputs">
        <div className="field">
          <label htmlFor="waveform">
            观测波形（非负整数，长度 {WAVEFORM_MIN}–{WAVEFORM_MAX}，当前生效 {waveform.length} 点）
          </label>
          <textarea
            id="waveform"
            rows={3}
            value={waveText}
            onChange={(e) => onWaveInput(e.target.value)}
            className={waveCheck.ok ? '' : 'invalid'}
            spellCheck={false}
          />
          {!waveCheck.ok && <FieldErrors errors={waveCheck.errors} />}
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="kernel">
              响应核（非负整数，长度 {KERNEL_MIN}–{KERNEL_MAX}，首尾为正）
            </label>
            <input
              id="kernel"
              type="text"
              value={kernelText}
              onChange={(e) => onKernelInput(e.target.value)}
              className={kernelCheck.ok ? '' : 'invalid'}
              spellCheck={false}
            />
            {!kernelCheck.ok && <FieldErrors errors={kernelCheck.errors} />}
          </div>
          <div className="field">
            <label htmlFor="maxPulses">
              每点脉冲上限（{MAX_PULSES_MIN}–{MAX_PULSES_MAX}）
            </label>
            <input
              id="maxPulses"
              type="text"
              inputMode="numeric"
              value={mpText}
              onChange={(e) => onMpInput(e.target.value)}
              className={mpCheck.ok ? '' : 'invalid'}
              spellCheck={false}
            />
            {!mpCheck.ok && <FieldErrors errors={mpCheck.errors} />}
          </div>
        </div>
        <button type="button" className="reset" onClick={resetDefaults}>
          恢复示例数据
        </button>
      </section>

      <section className="panel summary">
        <h2>求解摘要</h2>
        <dl>
          <div>
            <dt>波形长度 m</dt>
            <dd>{result.m}</dd>
          </div>
          <div>
            <dt>核长 k</dt>
            <dd>{k}</dd>
          </div>
          <div>
            <dt>脉冲序列长 n = m−k+1</dt>
            <dd>{result.n}</dd>
          </div>
          <div>
            <dt>最小绝对残差和</dt>
            <dd>{result.bestAbs}</dd>
          </div>
          <div>
            <dt>同优下最小脉冲总数</dt>
            <dd>{result.bestPulses}</dd>
          </div>
          <div>
            <dt>存在同优计数的位置</dt>
            <dd>
              {tiedPositions.length === 0
                ? '无'
                : `${tiedPositions.length} 处：${tiedPositions.join(', ')}`}
            </dd>
          </div>
          <div>
            <dt>求解耗时</dt>
            <dd>{result.elapsedMs.toFixed(1)} ms</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h2>观测 vs 重建</h2>
        <div className="legend">
          <span className="swatch sw-observed" /> 观测
          <span className="swatch sw-recon" /> 重建（规范解卷积）
        </div>
        <WaveformChart
          observed={waveform}
          reconstruction={result.reconstruction}
          hover={hover}
          onHover={setHover}
        />
      </section>

      <section className="panel">
        <h2>有符号残差（观测 − 重建）</h2>
        <div className="legend">
          <span className="swatch sw-pos" /> 观测偏高
          <span className="swatch sw-neg" /> 重建偏高
        </div>
        <ResidualChart residual={result.residual} hover={hover} onHover={setHover} />
      </section>

      <section className="panel">
        <h2>规范脉冲序列与同优计数集合</h2>
        <div className="legend">
          <span className="swatch sw-pulse" /> 规范解计数（柱）
          <span className="swatch sw-canonical" /> 规范解取值（大点）
          <span className="swatch sw-achievable" /> 其他同优可取计数（小点）
          <span className="swatch sw-tied" /> 存在同优计数的位置
        </div>
        <PulseChart
          m={result.m}
          canonical={result.canonical}
          achievable={result.achievable}
          maxPulses={maxPulses}
          hover={hover}
          onHover={setHover}
        />
      </section>

      <section className="panel detail">
        <h2>位置明细</h2>
        {hover === null ? (
          <p className="muted">将指针移到任一图表上查看该采样点的联动明细。</p>
        ) : (
          <dl>
            <div>
              <dt>采样点</dt>
              <dd>{hover}</dd>
            </div>
            <div>
              <dt>观测 / 重建 / 残差</dt>
              <dd>
                {waveform[hover]} / {result.reconstruction[hover]} / {result.residual[hover]}
              </dd>
            </div>
            {hover < result.n && hoverContrib !== null && (
              <>
                <div>
                  <dt>规范脉冲计数</dt>
                  <dd>{result.canonical[hover]}</dd>
                </div>
                <div>
                  <dt>全部同优解可取计数</dt>
                  <dd>
                    {'{ '}
                    {result.achievable[hover].join(', ')}
                    {' }'}
                    {result.achievable[hover].length > 1 && (
                      <span className="tied-tag">同优多值</span>
                    )}
                  </dd>
                </div>
              </>
            )}
            {hoverContrib !== null && hoverContrib.lo <= hoverContrib.hi && (
              <div>
                <dt>影响该采样的脉冲位置</dt>
                <dd>
                  {hoverContrib.lo} … {hoverContrib.hi}
                </dd>
              </div>
            )}
          </dl>
        )}
      </section>

      <footer className="page-footer">
        全部计算在本地浏览器完成，不发送任何数据；结果可由复核员修改输入后即时重算。
      </footer>
    </div>
  );
}
