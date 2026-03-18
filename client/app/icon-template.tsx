import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

const frogIconBase64 = readFileSync(
  join(process.cwd(), "..", "frog icon.png"),
).toString("base64");
const frogIconDataUrl = `data:image/png;base64,${frogIconBase64}`;
const ICON_BACKGROUND = "#f8f4e8";
const ICON_SCALE = 0.74;

export function renderFrogIcon({
  width,
  height,
  padding = "13%",
}: {
  width: number;
  height: number;
  padding?: string;
}) {
  const innerSize = `${ICON_SCALE * 100}%`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: ICON_BACKGROUND,
        padding,
        boxSizing: "border-box",
      }}
    >
      <img
        src={frogIconDataUrl}
        alt="Froddle frog icon"
        style={{
          width: innerSize,
          height: innerSize,
          objectFit: "contain",
          objectPosition: "center",
        }}
      />
    </div>,
    {
      width,
      height,
    },
  );
}
