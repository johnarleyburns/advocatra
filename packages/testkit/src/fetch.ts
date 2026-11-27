// SPDX-License-Identifier: AGPL-3.0-only

export interface RecordedRequest {
  url: string;
  init: RequestInit | undefined;
}

/**
 * A programmable stand-in for the global `fetch`, for code (like
 * `createStripeCheckout`) that takes a `typeof fetch` as an injected port
 * rather than calling `fetch` directly. Records every call for assertions
 * and returns the next programmed response in order.
 */
export class FakeFetch {
  readonly requests: RecordedRequest[] = [];
  private readonly responses: Response[] = [];

  queueJson(status: number, body: unknown): this {
    this.responses.push(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
    return this;
  }

  readonly fetch = async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    this.requests.push({ url: String(url), init });
    const response = this.responses.shift();
    if (!response) throw new Error("FakeFetch: no queued response left");
    return response;
  };
}
