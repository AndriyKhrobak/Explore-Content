import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Explore Content — AI Shorts Generator',
  description:
    'Нарізає довгі відео на віральні Shorts / TikTok / Reels за допомогою AI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
