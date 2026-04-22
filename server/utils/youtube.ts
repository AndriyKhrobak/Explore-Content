import type { YouTubeConnection } from '@prisma/client';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
].join(' ');

function cfg() {
  return useRuntimeConfig();
}

export function isOAuthConfigured(): boolean {
  const c = cfg();
  return Boolean(c.googleClientId && c.googleClientSecret);
}

export function isDemoConnectEnabled(): boolean {
  return cfg().demoYoutubeConnect === true || !isOAuthConfigured();
}

function redirectUri(origin: string): string {
  return cfg().googleRedirectUri || `${origin}/api/youtube/callback`;
}

export function buildAuthUrl(origin: string, state: string): string {
  const c = cfg();
  const params = new URLSearchParams({
    client_id: c.googleClientId as string,
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
    include_granted_scopes: 'true',
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
};

type ExchangedTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  channelId?: string;
  channelTitle?: string;
};

export async function exchangeCode(origin: string, code: string): Promise<ExchangedTokens> {
  const c = cfg();
  const tokens = await $fetch<TokenResponse>(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.googleClientId as string,
      client_secret: c.googleClientSecret as string,
      redirect_uri: redirectUri(origin),
      grant_type: 'authorization_code',
    }).toString(),
  });

  const channel = await fetchChannelInfo(tokens.access_token).catch(() => undefined);

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    channelId: channel?.id,
    channelTitle: channel?.title,
  };
}

export async function refreshAccessToken(conn: YouTubeConnection): Promise<ExchangedTokens> {
  if (!conn.refreshToken) throw new Error('No refresh token stored');
  const c = cfg();

  const tokens = await $fetch<TokenResponse>(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.googleClientId as string,
      client_secret: c.googleClientSecret as string,
      refresh_token: conn.refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  return {
    accessToken: tokens.access_token,
    refreshToken: conn.refreshToken,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    channelId: conn.channelId ?? undefined,
    channelTitle: conn.channelTitle ?? undefined,
  };
}

async function fetchChannelInfo(
  accessToken: string,
): Promise<{ id: string; title: string } | undefined> {
  try {
    const data = await $fetch<{ items?: Array<{ id: string; snippet: { title: string } }> }>(
      `${YOUTUBE_API}/channels?part=snippet&mine=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const first = data.items?.[0];
    return first ? { id: first.id, title: first.snippet.title } : undefined;
  } catch {
    return undefined;
  }
}

export async function ensureFreshToken(
  conn: YouTubeConnection,
): Promise<{ accessToken: string }> {
  if (conn.expiresAt.getTime() - Date.now() > 60_000) {
    return { accessToken: conn.accessToken };
  }
  const fresh = await refreshAccessToken(conn);
  await prisma.youTubeConnection.update({
    where: { id: conn.id },
    data: { accessToken: fresh.accessToken, expiresAt: fresh.expiresAt },
  });
  return { accessToken: fresh.accessToken };
}

export async function uploadVideoToYouTube(input: {
  connection: YouTubeConnection;
  clipUrl: string;
  title: string;
  description: string;
  tags?: string[];
  privacyStatus?: 'public' | 'unlisted' | 'private';
}): Promise<{ videoId: string; url: string }> {
  const { accessToken } = await ensureFreshToken(input.connection);

  const clipRes = await fetch(input.clipUrl);
  if (!clipRes.ok) throw new Error(`Failed to download clip (HTTP ${clipRes.status})`);
  const clipBuffer = Buffer.from(await clipRes.arrayBuffer());

  const boundary = `--boundary_${Math.random().toString(36).slice(2)}`;
  const metadata = {
    snippet: {
      title: input.title.slice(0, 100),
      description: input.description.slice(0, 5000),
      tags: input.tags ?? ['shorts', 'ai-clipped'],
      categoryId: '22',
    },
    status: {
      privacyStatus: input.privacyStatus ?? 'private',
      selfDeclaredMadeForKids: false,
    },
  };

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    Buffer.from(JSON.stringify(metadata)),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`),
    clipBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const uploadRes = await fetch(`${YOUTUBE_UPLOAD}?uploadType=multipart&part=snippet,status`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(body.length),
    },
    body,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`YouTube upload failed: ${uploadRes.status} ${text}`);
  }

  const result = (await uploadRes.json()) as { id?: string };
  if (!result.id) throw new Error('YouTube did not return video ID');

  return { videoId: result.id, url: `https://youtu.be/${result.id}` };
}
