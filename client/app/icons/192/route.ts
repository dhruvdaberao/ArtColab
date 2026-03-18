import { renderFrogIcon } from "@/app/icon-template";

export function GET() {
  return renderFrogIcon({ width: 192, height: 192, padding: "13%" });
}
