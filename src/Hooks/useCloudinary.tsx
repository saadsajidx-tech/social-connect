import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { launchImageLibrary, ImagePickerResponse, Asset } from 'react-native-image-picker';
import { showToast } from '../helper/toast';
import {
  cloudinaryService,
  ImageUploadProgress,
  UploadedImage,
} from '../services/cloudinaryService';

// ─── Config ───────────────────────────────────────────────────────────────────
const CLOUDINARY_CONFIG = {
  cloudName: 'dypyuqwbn',
  uploadPreset: 'posts_unsigned_v1',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface UploadProgress {
  uri: string;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  url?: string;
  error?: string;
}

export interface AvatarUploadResult {
  url: string;
  publicId: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useCloudinary = () => {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // ── Avatar upload progress state (separate from post upload progress) ────────
  const [avatarProgress, setAvatarProgress] = useState<ImageUploadProgress | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // ── Pick images from library ─────────────────────────────────────────────────
  const pickImages = useCallback(async (maxImages: number = 4): Promise<Asset[] | null> => {
    try {
      const result: ImagePickerResponse = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: maxImages,
        includeBase64: false,
      });

      if (result.didCancel) return null;

      if (result.errorCode) {
        showToast('Failed to pick images. Please try again.');
        return null;
      }

      if (result.assets) {
        return result.assets.filter(asset => !!asset.uri);
      }

      return null;
    } catch (error) {
      console.error('[useCloudinary] pickImages error:', error);
      showToast('Failed to pick images. Please try again.');
      return null;
    }
  }, []);

  // ── Upload single image ──────────────────────────────────────────────────────
  const uploadImage = useCallback(
    async (uri: string, fileName?: string): Promise<string | null> => {
      try {
        setUploads(prev => [...prev, { uri, progress: 0, status: 'uploading' }]);

        const formData = new FormData();
        formData.append('file', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          type: 'image/jpeg',
          name: fileName ?? `upload_${Date.now()}.jpg`,
        } as unknown as Blob);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
          {
            method: 'POST',
            body: formData,
            headers: { 'Content-Type': 'multipart/form-data' },
          },
        );

        if (!response.ok) {
          throw new Error(`Upload failed with status ${response.status}`);
        }

        const data = await response.json();

        setUploads(prev =>
          prev.map(upload =>
            upload.uri === uri
              ? { ...upload, progress: 100, status: 'success', url: data.secure_url }
              : upload,
          ),
        );

        return data.secure_url;
      } catch (error) {
        console.error('[useCloudinary] uploadImage error:', error);
        setUploads(prev =>
          prev.map(upload =>
            upload.uri === uri ? { ...upload, status: 'error', error: 'Upload failed' } : upload,
          ),
        );
        showToast('Failed to upload image. Please try again.');
        return null;
      }
    },
    [],
  );

  // ── Upload multiple images ───────────────────────────────────────────────────
  const uploadImages = useCallback(
    async (assets: Asset[]): Promise<string[]> => {
      try {
        setIsUploading(true);

        const results = await Promise.all(
          assets.map(asset => {
            if (!asset.uri) return Promise.resolve(null);
            return uploadImage(asset.uri, asset.fileName ?? undefined);
          }),
        );

        const successful = results.filter((url): url is string => url !== null);

        if (successful.length === 0) {
          showToast('Failed to upload any images. Please try again.');
        } else if (successful.length < assets.length) {
          showToast(`${assets.length - successful.length} image(s) failed to upload.`);
        }

        return successful;
      } catch (error) {
        console.error('[useCloudinary] uploadImages error:', error);
        showToast('Failed to upload images. Please try again.');
        return [];
      } finally {
        setIsUploading(false);
      }
    },
    [uploadImage],
  );

  // ── Upload avatar (profile photo) ────────────────────────────────────────────
  // Uses a stable public_id (avatars/{userId}/profile) so re-uploads
  // automatically overwrite the previous photo — no orphaned assets.
  // CDN cache is invalidated via `invalidate: true` inside cloudinaryService.
  const uploadAvatar = useCallback(
    async (userId: string, localUri: string): Promise<AvatarUploadResult | null> => {
      try {
        setIsUploadingAvatar(true);
        setAvatarProgress({ uri: localUri, progress: 0, status: 'uploading' });

        const result: UploadedImage = await cloudinaryService.uploadAvatar(
          userId,
          localUri,
          progress => setAvatarProgress(progress),
        );

        return { url: result.url, publicId: result.publicId };
      } catch (error) {
        console.error('[useCloudinary] uploadAvatar error:', error);
        setAvatarProgress(prev =>
          prev ? { ...prev, status: 'error', error: 'Avatar upload failed' } : null,
        );
        showToast('Failed to upload profile photo. Please try again.');
        return null;
      } finally {
        setIsUploadingAvatar(false);
      }
    },
    [],
  );

  // ── Delete avatar (used on account deletion) ─────────────────────────────────
  const deleteAvatar = useCallback(async (userId: string): Promise<boolean> => {
    return cloudinaryService.deleteAvatar(userId);
  }, []);

  // ── Delete single image by publicId ─────────────────────────────────────────
  const deleteImage = useCallback(async (publicId: string): Promise<boolean> => {
    return cloudinaryService.deleteImage(publicId);
  }, []);

  // ── Delete multiple images by publicId ──────────────────────────────────────
  const deleteMultipleImages = useCallback(async (publicIds: string[]): Promise<void> => {
    if (publicIds.length === 0) return;
    await cloudinaryService.deleteMultipleImages(publicIds);
  }, []);

  // ── Delete entire post folder ────────────────────────────────────────────────
  const deletePostFolder = useCallback(
    async (userId: string, postId: string, publicIds: string[]): Promise<void> => {
      await cloudinaryService.deletePostFolder(userId, postId, publicIds);
    },
    [],
  );

  // ── Clear local upload state ─────────────────────────────────────────────────
  const clearUploads = useCallback(() => {
    setUploads([]);
    setAvatarProgress(null);
  }, []);

  // ── Overall progress across all active post uploads ──────────────────────────
  const getOverallProgress = useCallback((): number => {
    if (uploads.length === 0) return 0;
    const total = uploads.reduce((sum, u) => sum + u.progress, 0);
    return Math.round(total / uploads.length);
  }, [uploads]);

  return {
    // Post image actions (unchanged)
    pickImages,
    uploadImage,
    uploadImages,
    deleteImage,
    deleteMultipleImages,
    deletePostFolder,
    clearUploads,
    // Post image state (unchanged)
    uploads,
    isUploading,
    overallProgress: getOverallProgress(),
    // Avatar actions (new)
    uploadAvatar,
    deleteAvatar,
    // Avatar state (new)
    avatarProgress,
    isUploadingAvatar,
  };
};
