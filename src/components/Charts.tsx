import type React from 'react';

/** 三个图表共用的视图宽度（SVG viewBox 坐标系）。 */
const W = 1000;
const PAD_L = 46;
const PAD_R = 14;

export interface Hoverable {
  hover: number | null;
  onHover: (index: number | null) => void;
}

function indexFromMouse(
  e: React.MouseEvent<SVGSVGElement>,
  count: number,
  onHover: (i: number | null) => void,
) {
  const rect = e.currentTarget.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * W;
  const i = Math.round(((px - PAD_L) / (W - PAD_L - PAD_R)) * (count - 1));
  onHover(i >= 0 && i < count ? i : null);
}

function xAt(i: number, count: number): number {
  return PAD_L + (i / Math.max(1, count - 1)) * (W - PAD_L - PAD_R);
}

function xTicks(count: number): number[] {
  const n = Math.min(8, count);
  const out: number[] = [];
  for (let t = 0; t < n; t++) out.push(Math.round((t * (count - 1)) / (n - 1)));
  return [...new Set(out)];
}

/* ------------------------------------------------------------------ */
/* 观测 vs 重建                                                        */
/* ------------------------------------------------------------------ */

export function WaveformChart({
  observed,
  reconstruction,
  hover,
  onHover,
}: Hoverable & { observed: number[]; reconstruction: number[] }) {
  const m = observed.length;
  const H = 240;
  const PAD_T = 14;
  const PAD_B = 26;
  const yMax = Math.max(1, ...observed, ...reconstruction);
  const yAt = (v: number) => PAD_T + (1 - v / yMax) * (H - PAD_T - PAD_B);
  const toLine = (data: number[]) =>
    data.map((v, i) => `${xAt(i, m).toFixed(2)},${yAt(v).toFixed(2)}`).join(' ');
  const gridVals = [0, 1, 2, 3, 4].map((t) => (t / 4) * yMax);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="chart"
      role="img"
      aria-label="观测与重建波形"
      onMouseMove={(e) => indexFromMouse(e, m, onHover)}
      onMouseLeave={() => onHover(null)}
    >
      {gridVals.map((v) => (
        <g key={v}>
          <line x1={PAD_L} x2={W - PAD_R} y1={yAt(v)} y2={yAt(v)} className="grid" />
          <text x={PAD_L - 6} y={yAt(v) + 4} className="tick" textAnchor="end">
            {Math.round(v)}
          </text>
        </g>
      ))}
      {xTicks(m).map((i) => (
        <text key={i} x={xAt(i, m)} y={H - 8} className="tick" textAnchor="middle">
          {i}
        </text>
      ))}
      <polyline points={toLine(observed)} className="line-observed" />
      <polyline points={toLine(reconstruction)} className="line-recon" />
      {hover !== null && (
        <g className="guide">
          <line x1={xAt(hover, m)} x2={xAt(hover, m)} y1={PAD_T} y2={H - PAD_B} />
          <circle cx={xAt(hover, m)} cy={yAt(observed[hover])} r={4.5} className="dot-observed" />
          <circle cx={xAt(hover, m)} cy={yAt(reconstruction[hover])} r={4.5} className="dot-recon" />
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 有符号残差（观测 − 重建）                                            */
/* ------------------------------------------------------------------ */

export function ResidualChart({ residual, hover, onHover }: Hoverable & { residual: number[] }) {
  const m = residual.length;
  const H = 170;
  const PAD_T = 12;
  const PAD_B = 26;
  const absMax = Math.max(1, ...residual.map(Math.abs));
  const yAt = (v: number) => PAD_T + ((absMax - v) / (2 * absMax)) * (H - PAD_T - PAD_B);
  const bw = Math.max(1.5, ((W - PAD_L - PAD_R) / m) * 0.7);
  const gridVals = [-absMax, -absMax / 2, 0, absMax / 2, absMax];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="chart"
      role="img"
      aria-label="有符号残差"
      onMouseMove={(e) => indexFromMouse(e, m, onHover)}
      onMouseLeave={() => onHover(null)}
    >
      {gridVals.map((v) => (
        <g key={v}>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={yAt(v)}
            y2={yAt(v)}
            className={v === 0 ? 'grid-zero' : 'grid'}
          />
          <text x={PAD_L - 6} y={yAt(v) + 4} className="tick" textAnchor="end">
            {Math.round(v)}
          </text>
        </g>
      ))}
      {xTicks(m).map((i) => (
        <text key={i} x={xAt(i, m)} y={H - 8} className="tick" textAnchor="middle">
          {i}
        </text>
      ))}
      {residual.map((r, i) => (
        <rect
          key={i}
          x={xAt(i, m) - bw / 2}
          y={Math.min(yAt(0), yAt(r))}
          width={bw}
          height={Math.max(1, Math.abs(yAt(r) - yAt(0)))}
          className={r > 0 ? 'bar-pos' : r < 0 ? 'bar-neg' : 'bar-zero'}
        />
      ))}
      {hover !== null && (
        <line
          x1={xAt(hover, m)}
          x2={xAt(hover, m)}
          y1={PAD_T}
          y2={H - PAD_B}
          className="guide"
        />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 规范脉冲 + 全部同优解的可取计数集合                                   */
/* ------------------------------------------------------------------ */

export function PulseChart({
  m,
  canonical,
  achievable,
  maxPulses,
  hover,
  onHover,
}: Hoverable & {
  m: number;
  canonical: number[];
  achievable: number[][];
  maxPulses: number;
}) {
  const n = canonical.length;
  const BAR_H = 96;
  const PAD_T = 12;
  const ROW_H = 20;
  const stripTop = PAD_T + BAR_H + 18;
  const stripH = (maxPulses + 1) * ROW_H;
  const H = stripTop + stripH + 26;
  const scaleMax = Math.max(1, maxPulses);
  const barH = (v: number) => (v / scaleMax) * BAR_H;
  const rowY = (v: number) => stripTop + (maxPulses - v) * ROW_H + ROW_H / 2;
  const bw = Math.max(1.5, ((W - PAD_L - PAD_R) / m) * 0.55);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="chart"
      role="img"
      aria-label="规范脉冲序列与同优计数集合"
      onMouseMove={(e) => indexFromMouse(e, m, onHover)}
      onMouseLeave={() => onHover(null)}
    >
      {[0, 1, 2, 3, 4].filter((v) => v <= scaleMax).map((v) => (
        <g key={v}>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={PAD_T + BAR_H - barH(v)}
            y2={PAD_T + BAR_H - barH(v)}
            className={v === 0 ? 'grid-zero' : 'grid'}
          />
          <text x={PAD_L - 6} y={PAD_T + BAR_H - barH(v) + 4} className="tick" textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {canonical.map((v, j) =>
        v > 0 ? (
          <rect
            key={j}
            x={xAt(j, m) - bw / 2}
            y={PAD_T + BAR_H - barH(v)}
            width={bw}
            height={barH(v)}
            className="bar-pulse"
          />
        ) : null,
      )}
      {/* 同优计数集合条带：每个位置一行一点表示该计数在全部双层同优解中可取 */}
      {Array.from({ length: maxPulses + 1 }, (_, r) => {
        const v = maxPulses - r;
        return (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={rowY(v)} y2={rowY(v)} className="grid faint" />
            <text x={PAD_L - 6} y={rowY(v) + 4} className="tick" textAnchor="end">
              {v}
            </text>
          </g>
        );
      })}
      {achievable.map((values, j) => {
        const tied = values.length > 1;
        return (
          <g key={j}>
            {tied && (
              <rect
                x={xAt(j, m) - bw / 2}
                y={stripTop + 2}
                width={bw}
                height={stripH - 4}
                className="tied-col"
              />
            )}
            {values.map((v) => (
              <circle
                key={v}
                cx={xAt(j, m)}
                cy={rowY(v)}
                r={v === canonical[j] ? 5 : 3.2}
                className={v === canonical[j] ? 'dot-canonical' : 'dot-achievable'}
              />
            ))}
          </g>
        );
      })}
      {xTicks(m).map((i) => (
        <text key={i} x={xAt(i, m)} y={H - 8} className="tick" textAnchor="middle">
          {i}
        </text>
      ))}
      {hover !== null && hover < n && (
        <line
          x1={xAt(hover, m)}
          x2={xAt(hover, m)}
          y1={PAD_T}
          y2={stripTop + stripH}
          className="guide"
        />
      )}
    </svg>
  );
}
