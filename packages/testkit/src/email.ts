// SPDX-License-Identifier: AGPL-3.0-only

export interface SentEmail {
  to: string;
  subject: string;
  text: string;
}

/** Records every "sent" email instead of making a real SMTP/API call. */
export class FakeEmail {
  readonly sent: SentEmail[] = [];

  async send(message: SentEmail): Promise<void> {
    this.sent.push(message);
  }
}
