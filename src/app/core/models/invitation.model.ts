import { UserRole } from './user.model';

/**
 * Channels the backend can deliver an invite link on. Omit/empty for manual
 * (the URL is just returned for the issuer to share). Selecting a phone channel
 * makes recipientPhone required. EMAIL is delivery-only and never selectable
 * here — it can still appear in a DeliveryResult.
 */
export type DeliveryChannel = 'WHATSAPP' | 'SMS';

/**
 * Issue a one-time invite link (POST /api/users/invitations). The role and
 * organization are fixed in the link and cannot be changed by the invitee.
 * organizationId is required for ORGANIZER_ADMIN, ORGANIZER_USER, DISTRIBUTOR.
 * ROOT is never invitable — only ADMIN and below. deliveryChannels/recipientPhone
 * are optional: when a channel is selected the backend also sends the link and
 * recipientPhone becomes required (it also pre-fills the accept form).
 */
export interface CreateInvitationRequest {
  role: UserRole;
  organizationId?: number;
  deliveryChannels?: DeliveryChannel[];
  recipientPhone?: string;
}

/** Outcome of delivering the invite over one channel (per DeliveryResult). */
export interface DeliveryResult {
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  sent: boolean;
  /** Failure detail when not sent; null/absent on success. */
  detail?: string;
}

/**
 * Issued invite link (POST /api/users/invitations response). deliveries holds
 * the per-channel outcome and is empty when no channels were requested.
 */
export interface InvitationLinkResponse {
  inviteUrl: string;
  deliveries?: DeliveryResult[];
}

/**
 * Fixed details of a pending invite (GET /api/auth/invitations/{token}),
 * read by the public accept form. organizationId/Name are null for
 * system-level roles (ADMIN). recipientPhone pre-fills the phone field when
 * the invite was sent over a phone channel.
 */
export interface InvitationDetailsResponse {
  role: UserRole;
  organizationId?: number;
  organizationName?: string;
  recipientPhone?: string;
  expiresAt: string;
}

/**
 * Invitee's own account details (PUT /api/auth/invitations/{token}). email and
 * phoneNumber are required unless the invited role is DISTRIBUTOR. The role and
 * organization come from the link, so they are not part of this payload.
 */
export interface AcceptInvitationRequest {
  username: string;
  password: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
}
