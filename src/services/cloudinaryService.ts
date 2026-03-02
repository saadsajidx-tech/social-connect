import { Platform } from 'react-native';
import { launchImageLibrary, ImagePickerResponse, Asset } from 'react-native-image-picker';
import CryptoJS from 'crypto-js';

// ─── Config ───────────────────────────────────────────────────────────────────
const CLOUDINARY_CONFIG = {
  cloudName: 'dypyuqwbn',
  uploadPreset: 'posts_unsigned_v1',
  apiKey: '444557399785489',
  apiSecret: 'dcR3DgU-YCFXCkhPLfX8OwNKq3k', // ⚠️ Move to Firebase Cloud Function in production
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
  size: number;
}

export interface ImageUploadProgress {
  uri: string;
  progress: number; // 0–100
  status: 'idle' | 'uploading' | 'success' | 'error';
  url?: string;
  error?: string;
}

interface ImageInput {
  uri: string;
  type?: string;
  name?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────
class CloudinaryService {
  private readonly baseUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}`;

  // ── Pick images from device gallery ─────────────────────────────────────────
  async pickImages(maxImages: number = 4): Promise<Asset[] | null> {
    try {
      const result: ImagePickerResponse = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: maxImages,
        includeBase64: false,
      });

      if (result.didCancel) return null;
      if (result.errorCode) throw new Error(result.errorMessage ?? 'Image picker error');

      const valid = (result.assets ?? []).filter(a => !!a.uri);
      return valid.length > 0 ? valid : null;
    } catch (err) {
      console.error('[Cloudinary] pickImages error:', err);
      return null;
    }
  }

  // ── Upload a single image (XHR for real progress reporting) ──────────────────
  uploadImage(
    image: ImageInput,
    folder?: string,
    onProgress?: (progress: ImageUploadProgress) => void,
  ): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const uri = Platform.OS === 'ios' ? image.uri.replace('file://', '') : image.uri;

      const formData = new FormData();
      formData.append('file', {
        uri,
        type: image.type ?? 'image/jpeg',
        name: image.name ?? `image_${Date.now()}.jpg`,
      } as unknown as Blob);
      formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
      if (folder) formData.append('folder', folder);

      onProgress?.({ uri: image.uri, progress: 0, status: 'uploading' });

      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress?.({ uri: image.uri, progress, status: 'uploading' });
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const res = JSON.parse(xhr.responseText);
          const uploaded: UploadedImage = {
            url: res.secure_url,
            publicId: res.public_id,
            width: res.width,
            height: res.height,
            size: res.bytes,
          };
          onProgress?.({ uri: image.uri, progress: 100, status: 'success', url: uploaded.url });
          resolve(uploaded);
        } else {
          const errMsg = `Upload failed (${xhr.status}): ${xhr.responseText}`;
          onProgress?.({ uri: image.uri, progress: 0, status: 'error', error: errMsg });
          reject(new Error(errMsg));
        }
      };

      xhr.onerror = () => {
        const errMsg = 'Network error during upload';
        onProgress?.({ uri: image.uri, progress: 0, status: 'error', error: errMsg });
        reject(new Error(errMsg));
      };

      xhr.open('POST', `${this.baseUrl}/image/upload`);
      xhr.send(formData);
    });
  }

  // ── Upload multiple images concurrently ──────────────────────────────────────
  async uploadImages(
    images: ImageInput[],
    folder?: string,
    onProgress?: (index: number, progress: ImageUploadProgress) => void,
  ): Promise<UploadedImage[]> {
    const results = await Promise.allSettled(
      images.map((img, i) => this.uploadImage(img, folder, p => onProgress?.(i, p))),
    );

    return results
      .filter((r): r is PromiseFulfilledResult<UploadedImage> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  // ── Upload all images for a specific post ────────────────────────────────────
  // Stored under posts/{userId}/{postId}/ — enables folder deletion on post delete.
  async uploadPostImages(
    userId: string,
    postId: string,
    images: ImageInput[],
    onProgress?: (index: number, progress: ImageUploadProgress) => void,
  ): Promise<UploadedImage[]> {
    const folder = `posts/${userId}/${postId}`;
    return this.uploadImages(images, folder, onProgress);
  }

  // ── Upload profile avatar ─────────────────────────────────────────────────────
  // Stored under avatars/{userId}/ folder.
  // Unsigned presets do not allow `public_id` or `overwrite` — so we use `folder`
  // to keep assets organised. The returned publicId is saved to Firestore so the
  // previous avatar can be deleted (via signed deleteImage) before the new one lands.
  uploadAvatar(
    userId: string,
    localUri: string,
    onProgress?: (progress: ImageUploadProgress) => void,
  ): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const uri = Platform.OS === 'ios' ? localUri.replace('file://', '') : localUri;

      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      } as unknown as Blob);
      formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
      // Folder keeps avatars organised; public_id is auto-generated (unsigned requirement)
      formData.append('folder', `profileAvatars/${userId}`);

      onProgress?.({ uri: localUri, progress: 0, status: 'uploading' });

      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress?.({ uri: localUri, progress, status: 'uploading' });
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const res = JSON.parse(xhr.responseText);
          const uploaded: UploadedImage = {
            url: res.secure_url,
            publicId: res.public_id,
            width: res.width,
            height: res.height,
            size: res.bytes,
          };
          onProgress?.({ uri: localUri, progress: 100, status: 'success', url: uploaded.url });
          resolve(uploaded);
        } else {
          const errMsg = `Avatar upload failed (${xhr.status}): ${xhr.responseText}`;
          onProgress?.({ uri: localUri, progress: 0, status: 'error', error: errMsg });
          reject(new Error(errMsg));
        }
      };

      xhr.onerror = () => {
        const errMsg = 'Network error during avatar upload';
        onProgress?.({ uri: localUri, progress: 0, status: 'error', error: errMsg });
        reject(new Error(errMsg));
      };

      xhr.open('POST', `${this.baseUrl}/image/upload`);
      xhr.send(formData);
    });
  }

  // ── Delete avatar (on account deletion) ──────────────────────────────────────
  async deleteAvatar(userId: string): Promise<boolean> {
    const publicId = `profileAvatars/${userId}/profile`;
    return this.deleteImage(publicId);
  }

  // ── Delete a single image by publicId ────────────────────────────────────────
  async deleteImage(publicId: string): Promise<boolean> {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const signatureString = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_CONFIG.apiSecret}`;
      const signature = CryptoJS.SHA1(signatureString).toString();

      const formData = new FormData();
      formData.append('public_id', publicId);
      formData.append('timestamp', String(timestamp));
      formData.append('api_key', CLOUDINARY_CONFIG.apiKey);
      formData.append('signature', signature);

      const response = await fetch(`${this.baseUrl}/image/destroy`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.result !== 'ok') {
        console.warn(`[Cloudinary] deleteImage failed for "${publicId}":`, data);
        return false;
      }
      return true;
    } catch (err) {
      console.error(`[Cloudinary] deleteImage error for "${publicId}":`, err);
      return false;
    }
  }

  // ── Delete multiple images concurrently ──────────────────────────────────────
  async deleteMultipleImages(publicIds: string[]): Promise<void> {
    if (publicIds.length === 0) return;
    const results = await Promise.allSettled(publicIds.map(id => this.deleteImage(id)));
    const failed = publicIds.filter((_, i) => results[i].status === 'rejected');
    if (failed.length > 0) {
      console.warn('[Cloudinary] Some deletions failed:', failed);
    }
  }

  // ── Delete entire post folder (images + the folder itself) ───────────────────
  async deletePostFolder(userId: string, postId: string, publicIds: string[]): Promise<void> {
    const folderPath = `posts/${userId}/${postId}`;

    if (publicIds.length > 0) {
      await this.deleteMultipleImages(publicIds);
    }

    try {
      const credentials = CryptoJS.enc.Base64.stringify(
        CryptoJS.enc.Utf8.parse(`${CLOUDINARY_CONFIG.apiKey}:${CLOUDINARY_CONFIG.apiSecret}`),
      );
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/folders/${folderPath}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Basic ${credentials}` },
        },
      );

      const data = await response.json();
      if (response.ok) {
        console.log(`[Cloudinary] Folder deleted: ${folderPath}`);
      } else {
        console.warn(`[Cloudinary] Folder deletion failed for "${folderPath}":`, data);
      }
    } catch (err) {
      console.error(`[Cloudinary] Folder deletion error for "${folderPath}":`, err);
    }
  }
}

export const cloudinaryService = new CloudinaryService();
