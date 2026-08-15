import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env';

export type StorageBucket =
  | 'course-videos'
  | 'course-notes'
  | 'student-resumes'
  | 'certificates'
  | 'offer-letters'
  | 'profile-images';

export interface StorageFileMetadata {
  bucket: StorageBucket;
  storagePath: string;
  publicUrl?: string;
  size?: number;
  mimeType?: string;
}

export class SupabaseStorageService {
  private client: SupabaseClient | null = null;

  constructor() {
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } else {
      console.warn('⚠️ Supabase credentials missing. SupabaseStorageService operating in fallback mode.');
    }
  }

  /**
   * Ensures all 6 ScholarLogic buckets exist in Supabase Storage
   */
  async ensureBucketsExist(): Promise<void> {
    if (!this.client) return;

    const buckets: StorageBucket[] = [
      'course-videos',
      'course-notes',
      'student-resumes',
      'certificates',
      'offer-letters',
      'profile-images',
    ];

    for (const b of buckets) {
      try {
        const { error } = await this.client.storage.createBucket(b, { public: true });
        if (error && !error.message.includes('already exists')) {
          console.warn(`⚠️ Bucket creation message for ${b}:`, error.message);
        } else {
          console.log(`✅ Supabase Storage bucket verified: ${b}`);
        }
      } catch (err: any) {
        console.warn(`⚠️ Error ensuring bucket ${b}:`, err?.message || err);
      }
    }
  }

  /**
   * Uploads file buffer/stream to Supabase Storage bucket
   */
  async uploadFile(
    bucket: StorageBucket,
    filePath: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<StorageFileMetadata> {
    if (!this.client) {
      return {
        bucket,
        storagePath: filePath,
        publicUrl: `https://scholarlogic.edu/storage-mock/${bucket}/${filePath}`,
      };
    }

    const { data, error } = await this.client.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error(`❌ Supabase upload failed for ${bucket}/${filePath}:`, error.message);
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    const publicUrlData = this.client.storage.from(bucket).getPublicUrl(data.path);

    return {
      bucket,
      storagePath: data.path,
      publicUrl: publicUrlData.data.publicUrl,
      size: fileBuffer.length,
      mimeType,
    };
  }

  /**
   * Deletes a file from specified Supabase Storage bucket
   */
  async deleteFile(bucket: StorageBucket, filePath: string): Promise<boolean> {
    if (!this.client) return true;

    const { error } = await this.client.storage.from(bucket).remove([filePath]);
    if (error) {
      console.error(`❌ Supabase delete failed for ${bucket}/${filePath}:`, error.message);
      return false;
    }
    return true;
  }

  /**
   * Creates a private time-limited signed URL for sensitive PDFs, Resumes, and Offer Letters
   */
  async createSignedUrl(
    bucket: StorageBucket,
    filePath: string,
    expiresInSeconds: number = 3600
  ): Promise<string> {
    if (!this.client) {
      return `https://scholarlogic.edu/signed-mock/${bucket}/${filePath}`;
    }

    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data) {
      console.warn(`⚠️ Supabase signed URL generation fallback for ${bucket}/${filePath}:`, error?.message);
      const pub = this.client.storage.from(bucket).getPublicUrl(filePath);
      return pub.data.publicUrl;
    }

    return data.signedUrl;
  }

  /**
   * Fetches metadata for an object in Supabase Storage
   */
  async getFileMetadata(bucket: StorageBucket, filePath: string): Promise<any> {
    if (!this.client) return null;

    const { data, error } = await this.client.storage.from(bucket).list(filePath.substring(0, filePath.lastIndexOf('/')));
    if (error) return null;

    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
    return data.find((item) => item.name === fileName) || null;
  }
}

export const supabaseStorageService = new SupabaseStorageService();
