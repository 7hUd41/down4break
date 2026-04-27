"use client";

// Slider de durée en minutes. Le track + le thumb prennent la couleur d'accent
// du site via la propriété CSS native `accent-color`, qui marche partout
// (Chrome/Safari/Firefox modernes).

import { formatMinutes } from "@/lib/format";

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}

export default function DurationSlider({
  label, value, onChange, min, max, step = 1,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted">{label}</span>
        <span className="text-base font-semibold tabular-nums">
          {formatMinutes(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 cursor-pointer"
        // accent-color colore le track rempli + le thumb avec notre couleur d'accent
        // sans devoir styler ::-webkit-slider-thumb / ::-moz-range-thumb à la main.
        style={{ accentColor: "var(--accent)" }}
        aria-label={label}
      />
      <div className="flex justify-between text-xs text-muted/70 tabular-nums">
        <span>{formatMinutes(min)}</span>
        <span>{formatMinutes(max)}</span>
      </div>
    </div>
  );
}
