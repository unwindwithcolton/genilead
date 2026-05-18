// app/api/skip-trace/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { skipTraceService } from '@/lib/skipTrace/service';
import { SkipTraceInput } from '@/lib/skipTrace/types';

export async function POST(req: NextRequest) {
  const body = await req.json() as SkipTraceInput;

  if (!body.listing_id || !body.owner_name || !body.address) {
    return NextResponse.json(
      { error: 'Missing required fields: listing_id, owner_name, address' },
      { status: 400 }
    );
  }

  const result = await skipTraceService.trace(body, 'auto');

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ui: result.ui });
}