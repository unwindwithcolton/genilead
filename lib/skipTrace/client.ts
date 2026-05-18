// lib/skipTrace/client.ts

import { SkipTraceInput, BatchDataRawResponse } from './types';

const BATCHDATA_API_URL = 'https://api.batchdata.com/api/v1/property/skip-trace';

// ─── Mock (active until real API key is set) ──────────────────────────────────

const MOCK_RESPONSE: BatchDataRawResponse = {
  status: 'match',
  matchScore: 87,
  phones: [
    { number: '3125550100', type: 'mobile',   isPrimary: true,  dnc: false },
    { number: '3125550199', type: 'landline',  isPrimary: false, dnc: false },
  ],
  emails: [
    { address: 'owner@gmail.com', isValid: true, isPrimary: true },
  ],
  nameMatch:    { input: 'Smith John',  matched: 'John Smith',      score: 85 },
  addressMatch: { input: '123 Main St', matched: '123 Main Street', score: 92 },
};

// ─── Client ───────────────────────────────────────────────────────────────────

export const batchDataClient = {
  async lookup(
    input: SkipTraceInput
  ): Promise<{ data: BatchDataRawResponse | null; error: string | null }> {

    // Use mock when no API key is present — swap to real fetch in Step 9
    if (!process.env.BATCHDATA_API_KEY) {
      console.warn('[skipTrace] BATCHDATA_API_KEY not set — returning mock response');
      return { data: MOCK_RESPONSE, error: null };
    }

    try {
      const res = await fetch(BATCHDATA_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.BATCHDATA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              propertyAddress: {
                street: input.address,
                city:   input.city,
                state:  input.state,
                zip:    input.zip,
              },
              name: input.owner_name,
            },
          ],
        }),
        signal: AbortSignal.timeout(10_000), // 10s — BatchData can be slow
      });

      if (!res.ok) {
        const text = await res.text();
        // 4xx = bad request on our side, don't retry
        if (res.status >= 400 && res.status < 500) {
          return { data: null, error: `BatchData client error ${res.status}: ${text}` };
        }
        // 5xx = their problem, caller can retry
        return { data: null, error: `BatchData server error ${res.status}` };
      }

      const json = await res.json();
      return { data: json as BatchDataRawResponse, error: null };

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        return { data: null, error: 'BatchData request timed out' };
      }
      return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },
};