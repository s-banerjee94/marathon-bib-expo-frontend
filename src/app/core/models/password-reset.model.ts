import { DeliveryChannel, DeliveryResult } from './invitation.model';

/**
 * Issue a password-reset link for a user (POST /users/{userId}/password-reset-link).
 * Omit deliveryChannels to just get the link back for manual sharing; supplying
 * channels also sends it to the user's own registered phone.
 */
export interface IssueResetLinkRequest {
  deliveryChannels?: DeliveryChannel[];
}

/**
 * Issued reset link. deliveries holds the per-channel outcome and is empty
 * when no channels were requested.
 */
export interface PasswordResetLinkResponse {
  resetUrl: string;
  deliveries?: DeliveryResult[];
}

/**
 * Request a reset link while logged out (POST /auth/password-reset/forgot).
 * Always answered 200 whether or not the account exists.
 */
export interface ForgotPasswordRequest {
  /** Username, email, or phone. */
  identifier: string;
}

/**
 * Details of a valid reset token (GET /auth/password-reset/{token}).
 * 404 means the link is invalid, expired, or already used.
 */
export interface PasswordResetTokenStatus {
  username: string;
  fullName: string;
  expiresAt: string;
}

/** Set the new password using a reset token (PUT /auth/password-reset/{token}). */
export interface CompletePasswordResetRequest {
  newPassword: string;
}
