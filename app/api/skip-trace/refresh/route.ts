// app/api/skip-trace/refresh/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { skipTraceService } from '@/lib/skipTrace/service';

export async function POST(req: NextRequest) {
  const { listing_id } = await req.json();

  if (!listing_id) {
    return NextResponse.json(
      { error: 'listing_id required' },
      { status: 400 }
    );
  }

  const result = await skipTraceService.refresh(listing_id);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ui: result.ui });
}