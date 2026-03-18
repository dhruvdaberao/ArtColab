import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const contentType = 'image/png';
export const size = {
  width: 512,
  height: 512,
};

const frogIconBase64 = readFileSync(join(process.cwd(), '..', 'frog icon.png')).toString('base64');
const frogIconDataUrl = `data:image/png;base64,${frogIconBase64}`;

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8f4e8',
        }}
      >
        <img
          src={frogIconDataUrl}
          alt="Froddle frog icon"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    ),
    size,
  );
}
