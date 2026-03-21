import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET
  });
}

const extractPublicId = (assetUrl: string): string | null => {
  try {
    const url = new URL(assetUrl);
    const marker = '/upload/';
    const uploadIndex = url.pathname.indexOf(marker);
    if (uploadIndex === -1) return null;

    const assetPath = url.pathname.slice(uploadIndex + marker.length).replace(/^v\d+\//, '');
    const lastDot = assetPath.lastIndexOf('.');
    return lastDot >= 0 ? assetPath.slice(0, lastDot) : assetPath;
  } catch {
    return null;
  }
};

export const uploadProfileImage = async (dataUri: string): Promise<string> => {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary is not configured.');
  }

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'cloudcanvas/profiles',
    overwrite: true,
    resource_type: 'image'
  });

  return result.secure_url;
};

export const destroyProfileImage = async (assetUrl: string): Promise<void> => {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) return;

  const publicId = extractPublicId(assetUrl);
  if (!publicId) return;

  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
};
