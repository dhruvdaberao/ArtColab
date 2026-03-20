"use client";

import { Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type HsvColor = { h: number; s: number; v: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const normalizeHex = (value: string) => {
  const raw = value.trim().replace("#", "");
  if (raw.length === 3) {
    const expanded = raw
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
    return `#${expanded}`.toLowerCase();
  }
  return /^([0-9a-f]{6})$/i.test(raw) ? `#${raw.toLowerCase()}` : "#000000";
};

const hexToHsv = (hex: string): HsvColor => {
  const normalized = normalizeHex(hex).slice(1);
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }

  return {
    h: (h + 360) % 360,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
};

const hsvToHex = ({ h, s, v }: HsvColor) => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

interface ColorWheelPickerProps {
  isOpen: boolean;
  title: string;
  initialColor: string;
  recentColors: string[];
  presetColors?: string[];
  onClose: () => void;
  onApply: (color: string) => void;
}

export function ColorWheelPicker({
  isOpen,
  title,
  initialColor,
  recentColors,
  presetColors = [],
  onClose,
  onApply,
}: ColorWheelPickerProps) {
  const [draft, setDraft] = useState<HsvColor>(() => hexToHsv(initialColor));
  const [hexInput, setHexInput] = useState(normalizeHex(initialColor));
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const squareRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const next = hexToHsv(initialColor);
    setDraft(next);
    setHexInput(normalizeHex(initialColor));
  }, [initialColor, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const preview = useMemo(() => hsvToHex(draft), [draft]);
  const hueRadians = (draft.h - 90) * (Math.PI / 180);
  const wheelThumbStyle = {
    left: `${50 + Math.cos(hueRadians) * 42}%`,
    top: `${50 + Math.sin(hueRadians) * 42}%`,
  };
  const squareThumbStyle = {
    left: `${draft.s * 100}%`,
    top: `${(1 - draft.v) * 100}%`,
  };

  const updateHueFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const wheel = wheelRef.current;
      if (!wheel) return;
      const rect = wheel.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const angle = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
      setDraft((current) => ({ ...current, h: (angle + 450) % 360 }));
    },
    [],
  );

  const updateSquareFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const square = squareRef.current;
      if (!square) return;
      const rect = square.getBoundingClientRect();
      const nextS = clamp((clientX - rect.left) / rect.width, 0, 1);
      const nextV = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
      setDraft((current) => ({ ...current, s: nextS, v: nextV }));
    },
    [],
  );

  const bindDrag = (
    startEvent: React.PointerEvent<HTMLDivElement>,
    updater: (clientX: number, clientY: number) => void,
  ) => {
    startEvent.preventDefault();
    updater(startEvent.clientX, startEvent.clientY);
    const pointerId = startEvent.pointerId;
    const target = startEvent.currentTarget as HTMLElement;
    target.setPointerCapture(pointerId);

    const handleMove = (event: PointerEvent) =>
      updater(event.clientX, event.clientY);
    const handleUp = () => {
      target.releasePointerCapture(pointerId);
      target.removeEventListener("pointermove", handleMove);
      target.removeEventListener("pointerup", handleUp);
      target.removeEventListener("pointercancel", handleUp);
    };

    target.addEventListener("pointermove", handleMove);
    target.addEventListener("pointerup", handleUp);
    target.addEventListener("pointercancel", handleUp);
  };

  const handleHexCommit = () => {
    const normalized = normalizeHex(hexInput);
    setHexInput(normalized);
    setDraft(hexToHsv(normalized));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(15,23,42,0.42)] px-3 py-6 backdrop-blur-sm sm:px-6"
      onPointerDown={onClose}
    >
      <div
        className="w-full max-w-[380px] rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,255,0.98))] p-4 shadow-[0_26px_80px_rgba(15,23,42,0.24)] sm:p-4.5"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Custom color
            </p>
            <h3 className="mt-1 text-lg font-black text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:text-slate-900"
            aria-label="Close custom color picker"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_128px] sm:items-start">
            <div className="rounded-[24px] border border-white/80 bg-white/80 p-3 shadow-[0_12px_26px_rgba(15,23,42,0.08)]">
              <div className="relative mx-auto aspect-square w-full max-w-[260px]">
                <div
                  ref={wheelRef}
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      "conic-gradient(#ff4d4d, #ffd84d, #66d36e, #3bc9ff, #5b7cff, #c084fc, #ff4db8, #ff4d4d)",
                  }}
                  onPointerDown={(event) =>
                    bindDrag(event, updateHueFromPointer)
                  }
                />
                <div className="absolute inset-[18%] rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7),0_8px_30px_rgba(15,23,42,0.08)]" />
                <div
                  className="absolute left-1/2 top-1/2 aspect-square w-[54%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[24px] border border-white/80 shadow-[0_14px_30px_rgba(15,23,42,0.16)]"
                  ref={squareRef}
                  onPointerDown={(event) =>
                    bindDrag(event, updateSquareFromPointer)
                  }
                  style={{ backgroundColor: `hsl(${draft.h} 100% 50%)` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                </div>
                <div
                  className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-transparent shadow-[0_2px_12px_rgba(15,23,42,0.28)]"
                  style={wheelThumbStyle}
                />
                <div
                  className="pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_2px_12px_rgba(15,23,42,0.28)]"
                  style={{ ...squareThumbStyle, backgroundColor: preview }}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-[22px] border border-white/80 bg-white/88 p-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Preview
                </p>
                <div className="mt-3 flex flex-col items-center gap-3 text-center">
                  <span
                    className="h-16 w-16 rounded-full border border-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_12px_26px_rgba(15,23,42,0.14)]"
                    style={{ backgroundColor: preview }}
                  />
                  <div>
                    <p className="font-black text-slate-900">
                      {preview.toUpperCase()}
                    </p>
                    <p className="text-xs text-slate-500">
                      H {Math.round(draft.h)}° · S {Math.round(draft.s * 100)}%
                      · V {Math.round(draft.v * 100)}%
                    </p>
                  </div>
                </div>
              </div>

              <label className="block rounded-[22px] border border-white/80 bg-white/88 px-3 py-3 text-sm shadow-sm">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Hex
                </span>
                <input
                  value={hexInput}
                  onChange={(event) => setHexInput(event.target.value)}
                  onBlur={handleHexCommit}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleHexCommit();
                  }}
                  className="mt-1 w-full bg-transparent font-black uppercase tracking-[0.08em] text-slate-900 outline-none"
                  maxLength={7}
                />
              </label>

              <button
                type="button"
                onClick={() => onApply(preview)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
              >
                <Check size={16} /> Use this color
              </button>
            </div>
          </div>

          {!!recentColors.length && (
            <div className="rounded-[22px] border border-white/80 bg-white/88 p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Recent
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {recentColors.map((color) => {
                  const selected = normalizeHex(color) === preview;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        const normalized = normalizeHex(color);
                        setDraft(hexToHsv(normalized));
                        setHexInput(normalized);
                      }}
                      className={`relative h-10 w-10 rounded-full border transition ${selected ? "border-slate-900 ring-2 ring-slate-200" : "border-slate-200"}`}
                      style={{ backgroundColor: color }}
                      aria-label={`Use recent color ${color}`}
                    >
                      {selected ? (
                        <Check
                          size={14}
                          className="absolute right-0.5 top-0.5 text-white drop-shadow"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!!presetColors.length && (
            <div className="rounded-[22px] border border-white/80 bg-white/88 p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Swatches
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      const normalized = normalizeHex(color);
                      setDraft(hexToHsv(normalized));
                      setHexInput(normalized);
                    }}
                    className="h-10 w-10 rounded-full border border-slate-200 transition hover:-translate-y-0.5"
                    style={{ backgroundColor: color }}
                    aria-label={`Use swatch ${color}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
