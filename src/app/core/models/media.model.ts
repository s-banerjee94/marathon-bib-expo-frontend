/**
 * Media upload contracts shared by every presigned-S3 image flow
 * (user profile picture, organization logo, event logo).
 *
 * Flow:
 *  1. POST {entity}/upload-url  with { contentType }  -> PresignUploadResponse
 *  2. PUT  uploadUrl            (raw bytes, matching Content-Type, direct to S3)
 *  3. PUT  {entity}/image       with { objectKey }    -> updated entity
 */

/** Body for requesting a presigned upload URL. */
export interface PresignUploadRequest {
  contentType: string;
}

/**
 * Presigned S3 upload target. PUT the file bytes to `uploadUrl` with the exact
 * `contentType`, then attach the upload with `objectKey`.
 */
export interface PresignUploadResponse {
  uploadUrl: string;
  objectKey: string;
  contentType: string;
  expiresInSeconds: number;
}

/** Body for confirming/attaching a completed upload. */
export interface AttachUploadRequest {
  objectKey: string;
}
