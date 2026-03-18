import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Froddle',
    short_name: 'Froddle',
    description: 'Playful real-time collaborative drawing rooms with frog-powered energy',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f8f4e8',
    theme_color: '#19a7ff',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
