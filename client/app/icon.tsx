import { renderFrogIcon } from "./icon-template";

export const contentType = "image/png";
export const size = {
  width: 512,
  height: 512,
};

export default function Icon() {
  return renderFrogIcon(size);
}
