import { NextResponse } from 'next/server';
import { getProject, updateProject } from '@/lib/projects';
import { exchangeCode } from '@/lib/youtube';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return NextResponse.redirect(`${url.origin}/?error=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${url.origin}/?error=missing_code_or_state`);
  }

  const project = getProject(state);
  if (!project) {
    return NextResponse.redirect(`${url.origin}/?error=project_not_found`);
  }

  try {
    const connection = await exchangeCode(url.origin, code);
    updateProject(state, (p) => ({ ...p, youtube: connection }));
    return NextResponse.redirect(`${url.origin}/project/${state}?connected=1`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'oauth_failed';
    return NextResponse.redirect(
      `${url.origin}/project/${state}?error=${encodeURIComponent(msg)}`,
    );
  }
}
