import type { YouTubeConnection } from './projects';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
].join(' ');

export function isOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function isDemoConnectEnabled(): boolean {
  return process.env.DEMO_YOUTUBE_CONNECT === 'true' || !isOAuthConfigured();
}

function redirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/youtube/callback`;
}

export function buildAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
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

export async function exchangeCode(origin: string, code: string): Promise<YouTubeConnection> {
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const tokens = (await res.json()) as TokenResponse;
  const channel = await fetchChannelInfo(tokens.access_token).catch(() => undefined);

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    channelTitle: channel?.title,
    channelId: channel?.id,
  };
}

export async function refreshAccessToken(conn: YouTubeConnection): Promise<YouTubeConnection> {
  if (!conn.refreshToken) throw new Error('No refresh token stored');

  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: conn.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  const tokens = (await res.json()) as TokenResponse;
  return {
    ...conn,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
}

export async function ensureFreshToken(conn: YouTubeConnection): Promise<YouTubeConnection> {
  if (conn.expiresAt - Date.now() > 60_000) return conn;
  return refreshAccessToken(conn);
}

async function fetchChannelInfo(
  accessToken: string,
): Promise<{ id: string; title: string } | undefined> {
  const res = await fetch(`${YOUTUBE_API}/channels?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const data = (await res.json()) as {
    items?: Array<{ id: string; snippet: { title: string } }>;
  };
  const first = data.items?.[0];
  return first ? { id: first.id, title: first.snippet.title } : undefined;
}

export async function uploadVideo(input: {
  connection: YouTubeConnection;
  clipUrl: string;
  title: string;
  description: string;
  tags?: string[];
  privacyStatus?: 'public' | 'unlisted' | 'private';
}): Promise<{ videoId: string; url: string }> {
  const conn = await ensureFreshToken(input.connection);

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
      Authorization: `Bearer ${conn.accessToken}`,
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
