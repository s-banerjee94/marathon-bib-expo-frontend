import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { BASE_URI } from '../../shared/constants/api.constant';
import { NormalizedImage, normalizeAvatar, normalizeLogo } from '../../shared/utils/image.util';
import {
  AttachUploadRequest,
  PresignUploadRequest,
  PresignUploadResponse,
} from '../models/media.model';
import { Organization } from '../models/organization.model';
import { Event } from '../models/event.model';
import { User } from '../models/user.model';
import { SKIP_AUTH } from '../interceptors/http-context-tokens';

/**
 * Drives the presigned-S3 image flow for users (avatar), organizations and events
 * (logo). Each "replace" normalizes the file client-side, requests a presigned
 * upload URL, PUTs the bytes straight to S3 (bypassing our auth interceptor), then
 * confirms the upload and returns the updated entity (carrying a fresh presigned
 * view URL). "remove" deletes the stored object.
 */
@Injectable({
  providedIn: 'root',
})
export class ImageUploadService {
  private http = inject(HttpClient);
  private usersUrl = `${BASE_URI}/users`;
  private organizationsUrl = `${BASE_URI}/organizations`;
  private eventsUrl = `${BASE_URI}/events`;

  // ── Users (profile picture / avatar) ──────────────────────────────────────

  replaceUserAvatar(userId: number, file: File): Observable<User> {
    const base = `${this.usersUrl}/${userId}/profile-picture`;
    return this.replaceImage<User>(base, normalizeAvatar(file));
  }

  removeUserAvatar(userId: number): Observable<User> {
    return this.http.delete<User>(`${this.usersUrl}/${userId}/profile-picture`);
  }

  // ── Organizations (logo) ──────────────────────────────────────────────────

  replaceOrganizationLogo(organizationId: number, file: File): Observable<Organization> {
    const base = `${this.organizationsUrl}/${organizationId}/logo`;
    return this.replaceImage<Organization>(base, normalizeLogo(file));
  }

  removeOrganizationLogo(organizationId: number): Observable<Organization> {
    return this.http.delete<Organization>(`${this.organizationsUrl}/${organizationId}/logo`);
  }

  // ── Events (logo) ─────────────────────────────────────────────────────────

  replaceEventLogo(eventId: number, file: File): Observable<Event> {
    const base = `${this.eventsUrl}/${eventId}/logo`;
    return this.replaceImage<Event>(base, normalizeLogo(file, 1024));
  }

  removeEventLogo(eventId: number): Observable<Event> {
    return this.http.delete<Event>(`${this.eventsUrl}/${eventId}/logo`);
  }

  // ── Shared 3-step flow ────────────────────────────────────────────────────

  /**
   * presign -> direct S3 PUT -> attach. `imagePromise` resolves to the normalized
   * bytes + Content-Type the bytes must be uploaded with.
   */
  private replaceImage<T>(baseUrl: string, imagePromise: Promise<NormalizedImage>): Observable<T> {
    return from(imagePromise).pipe(
      switchMap((image) =>
        this.presign(baseUrl, image.contentType).pipe(
          switchMap((presigned) =>
            this.uploadToS3(presigned, image.blob).pipe(
              switchMap(() => this.attach<T>(baseUrl, presigned.objectKey)),
            ),
          ),
        ),
      ),
    );
  }

  private presign(baseUrl: string, contentType: string): Observable<PresignUploadResponse> {
    const body: PresignUploadRequest = { contentType };
    return this.http.post<PresignUploadResponse>(`${baseUrl}/upload-url`, body);
  }

  private uploadToS3(presigned: PresignUploadResponse, blob: Blob): Observable<unknown> {
    // Direct to S3: skip our auth/CSRF/cookies, and send the exact signed Content-Type.
    // responseType 'text' avoids JSON-parsing S3's empty 200 body.
    return this.http.put(presigned.uploadUrl, blob, {
      headers: { 'Content-Type': presigned.contentType },
      context: new HttpContext().set(SKIP_AUTH, true),
      responseType: 'text',
    });
  }

  private attach<T>(baseUrl: string, objectKey: string): Observable<T> {
    const body: AttachUploadRequest = { objectKey };
    return this.http.put<T>(baseUrl, body);
  }
}
