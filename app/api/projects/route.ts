import { NextResponse } from 'next/server';
import { createProject } from '@/lib/projects';

export const runtime = 'nodejs';

type Body = { name?: string };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (name.length > 80) {
    return NextResponse.json({ error: 'name too long (max 80)' }, { status: 400 });
  }

  const project = createProject(name);
  return NextResponse.json({ id: project.id, name: project.name });
}
