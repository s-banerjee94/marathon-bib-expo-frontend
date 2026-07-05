import { DeliveryChannel } from '../../core/models/invitation.model';

/**
 * Display metadata for the phone delivery channels the backend can send links
 * on (invites, password-reset links). EMAIL is delivery-only — never offered
 * as an option, but it can still appear in a DeliveryResult.
 */
export const DELIVERY_CHANNEL_OPTIONS: { label: string; value: DeliveryChannel; icon: string }[] = [
  { label: 'WhatsApp', value: 'WHATSAPP', icon: 'pi pi-whatsapp' },
  { label: 'SMS', value: 'SMS', icon: 'pi pi-comment' },
];

export const DELIVERY_CHANNEL_META: Record<string, { label: string; icon: string }> = {
  WHATSAPP: { label: 'WhatsApp', icon: 'pi pi-whatsapp' },
  SMS: { label: 'SMS', icon: 'pi pi-comment' },
  EMAIL: { label: 'Email', icon: 'pi pi-envelope' },
};
