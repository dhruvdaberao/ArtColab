import { renderFrogIcon } from "./icon-template";

export const contentType = "image/png";
export const size = {
  width: 180,
  height: 180,
};

export default function AppleIcon() {
  return renderFrogIcon({ ...size, padding: "14%" });
}
