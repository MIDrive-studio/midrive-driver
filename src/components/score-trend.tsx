import { View, Text } from "react-native";
import Svg, { Polyline, Circle, Line as SvgLine, Text as SvgText } from "react-native-svg";

// A driver's score over the weeks we have, drawn by hand because recharts is a
// web library and there is no point pulling a charting framework in for one
// line.
//
// Deliberately plain: a fixed 0-100 axis so a good week and a bad one are the
// same shape every time, gridlines only where the tier bands fall, and the most
// recent point emphasised because that is the one being explained above it.

type Point = { label: string; score: number };

export function ScoreTrend({
  points,
  bands = [],
  height = 160,
}: {
  points: Point[];
  bands?: { at: number }[];
  height?: number;
}) {
  // Two points make a line; one makes a dot nobody can read a trend from.
  if (points.length < 2) return null;

  const PAD_L = 30;
  const PAD_R = 10;
  const PAD_T = 10;
  const PAD_B = 22;

  // A viewBox rather than measured pixels, so the chart scales to whatever
  // width it is given without a layout pass.
  const W = 320;
  const H = height;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const x = (i: number) => PAD_L + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (score: number) => PAD_T + plotH - (Math.min(100, Math.max(0, score)) / 100) * plotH;

  const line = points.map((p, i) => `${x(i)},${y(p.score)}`).join(" ");
  const last = points[points.length - 1];

  // Every label would collide on a narrow phone once there are more than a
  // handful of weeks, so thin them rather than overlap them.
  const every = Math.ceil(points.length / 6);

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {[0, 50, 100].map((v) => (
          <SvgLine key={`g${v}`} x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
        ))}

        {/* The tier boundaries this driver is actually judged against. */}
        {bands.map((b) => (
          <SvgLine
            key={`b${b.at}`}
            x1={PAD_L}
            y1={y(b.at)}
            x2={W - PAD_R}
            y2={y(b.at)}
            stroke="#cbd5e1"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ))}

        {[0, 50, 100].map((v) => (
          <SvgText key={`t${v}`} x={PAD_L - 6} y={y(v) + 4} fontSize={9} fill="#94a3b8" textAnchor="end">
            {String(v)}
          </SvgText>
        ))}

        <Polyline points={line} fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => (
          <Circle
            key={p.label + i}
            cx={x(i)}
            cy={y(p.score)}
            r={i === points.length - 1 ? 5 : 3}
            fill={i === points.length - 1 ? "#ffffff" : "#f59e0b"}
            stroke="#f59e0b"
            strokeWidth={i === points.length - 1 ? 2.5 : 0}
          />
        ))}

        {points.map((p, i) =>
          i % every === 0 || i === points.length - 1 ? (
            <SvgText key={`x${p.label}${i}`} x={x(i)} y={H - 6} fontSize={9} fill="#94a3b8" textAnchor="middle">
              {p.label}
            </SvgText>
          ) : null
        )}
      </Svg>

      <Text className="mt-1 text-center text-xs text-slate-400">
        {points.length} weeks · latest {last.score.toFixed(1)}
      </Text>
    </View>
  );
}
