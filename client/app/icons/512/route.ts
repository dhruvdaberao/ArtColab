import { renderFrogIcon } from "@/app/icon-template";

export function GET() {
  return renderFrogIcon({ width: 512, height: 512, padding: "13%" });
}
