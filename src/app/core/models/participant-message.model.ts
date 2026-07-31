import { MessagingChannel } from './system-messaging.model';

// Channels a targeted send can actually go out on. Narrower than MessagingChannel:
// the backend rejects EMAIL ("not available yet").
export type ParticipantMessageChannel = 'SMS' | 'WHATSAPP';

export type ParticipantMessageStatus = 'SENT' | 'FAILED';

// POST /api/events/{eventId}/participant-messages — sends one template to named
// participants instead of running a campaign over the whole event. Omitting
// templateId reuses the active bib-collection campaign's template for the channel.
// Campaign send history is untouched: this never marks anyone as covered.
export interface SendParticipantMessagesRequest {
  channel: ParticipantMessageChannel;
  templateId?: number;
  bibNumbers: string[];
}

// Per-bib outcome. `reason` carries the backend's explanation and is null on SENT.
export interface ParticipantMessageResult {
  bibNumber: string;
  status: ParticipantMessageStatus;
  reason?: string;
}

// A 200 does not mean every message went out — each bib is attempted on its own,
// so always read the per-participant results.
export interface ParticipantMessagesResponse {
  channel: MessagingChannel;
  templateId: number;
  templateName: string;
  sentCount: number;
  failedCount: number;
  results: ParticipantMessageResult[];
}
