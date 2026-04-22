import { NextResponse } from 'next/server';
import { getProject, updateProject } from '@/lib/projects';
import { buildAuthUrl, isDemoConnectEnabled, isOAuthConfigured } from '@/lib/youtube';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const project = getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (!isOAuthConfigured()) {
    if (isDemoConnectEnabled()) {
      updateProject(projectId, (p) => ({
        ...p,
        youtube: {
          accessToken: 'demo-access-token',
          expiresAt: Date.now() + 3600_000,
          channelTitle: 'Demo Channel',
          channelId: 'demo-channel-id',
        },
      }));
      return NextResponse.redirect(`${url.origin}/project/${projectId}?connected=demo`);
    }
    return NextResponse.json(
      { error: 'Google OAuth not configured (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)' },
      { status: 500 },
    );
  }

  const authUrl = buildAuthUrl(url.origin, projectId);
  return NextResponse.redirect(authUrl);
}
