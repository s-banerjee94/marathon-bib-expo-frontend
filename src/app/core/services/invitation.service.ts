import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BASE_URI } from '../../shared/constants/api.constant';
import {
  AcceptInvitationRequest,
  CreateInvitationRequest,
  InvitationDetailsResponse,
  InvitationLinkResponse,
} from '../models/invitation.model';
import { User } from '../models/user.model';

/**
 * User-invite lifecycle. Issuing a link is authenticated (the issuer must be
 * allowed to create the requested role); reading and accepting an invite are
 * public, no-auth endpoints opened by the invitee via the link.
 */
@Injectable({ providedIn: 'root' })
export class InvitationService {
  private http = inject(HttpClient);

  /** Issue a one-time invite link for a fixed role + organization. */
  createInvitation(request: CreateInvitationRequest): Observable<InvitationLinkResponse> {
    return this.http.post<InvitationLinkResponse>(`${BASE_URI}/users/invitations`, request);
  }

  /** Read a pending invite's fixed role/org so the accept form can render. */
  getInvitation(token: string): Observable<InvitationDetailsResponse> {
    return this.http.get<InvitationDetailsResponse>(
      `${BASE_URI}/auth/invitations/${encodeURIComponent(token)}`,
    );
  }

  /** Accept an invite, creating the invitee's account. */
  acceptInvitation(token: string, request: AcceptInvitationRequest): Observable<User> {
    return this.http.put<User>(
      `${BASE_URI}/auth/invitations/${encodeURIComponent(token)}`,
      request,
    );
  }
}
