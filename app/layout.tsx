export const metadata = {
  title: '로얄 클래시 (Royal Clash)',
  description: '최고의 실시간 카드 배틀 전략 게임',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '로얄 클래시',
  },
  icons: {
    apple: '/icon-512.png',
    shortcut: '/icon-512.png',
    icon: '/icon-512.png',
  },
  themeColor: '#020617',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  viewportFit: 'cover',
};

import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <main className="w-full h-full overflow-hidden bg-slate-900 absolute inset-0">
          {children}
        </main>
      </body>
    </html>
  );
}
