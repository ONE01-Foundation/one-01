import type { Metadata, Viewport } from "next";
import "./globals.css";
// Flaticon Uicons — regular-rounded family only (one bundled webfont, no CDN).
// Used for the concept/network icons instead of emoji. Covered by the account's
// Flaticon Premium license, so no attribution credit is required.
import "@flaticon/flaticon-uicons/css/regular/rounded.css";

export const metadata: Metadata = {
  title: "ONE01 — your digital representative",
  description:
    "ONE01 is building the network of ONES — digital representatives that understand, communicate, and act on behalf of people and businesses.",
  icons: {
    // The real app icon (same mark shipped to the App Store / Play Store).
    icon: "/app-icon.png",
    apple: "/app-icon.png",
  },
  openGraph: {
    title: "ONE01 — your digital representative",
    description:
      "Digital representatives that understand, communicate, and act on behalf of people and businesses.",
  },
};

export const viewport: Viewport = {
  // theme-color is set from the saved theme in the pre-paint script below (iOS reads it once, at load).
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set the theme BEFORE first paint (from saved choice, else time of
            day) so nothing — including the opening splash — flashes the wrong
            background on load/refresh. Kept in sync afterwards by the page. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var s=localStorage.getItem('one_web_theme');var d;if(s==='dark'){d=true}else if(s==='light'){d=false}else{var h=new Date().getHours();d=h>=18||h<6}document.documentElement.dataset.theme=d?'dark':'light';var at=localStorage.getItem('one_theme');var ad=at==='dark'?true:at==='light'?false:d;var c=ad?'#0b0b0d':'#fafaf8';var ms=document.querySelectorAll('meta[name=theme-color]');for(var i=0;i<ms.length;i++){ms[i].parentNode.removeChild(ms[i])}var m=document.createElement('meta');m.setAttribute('name','theme-color');m.setAttribute('content',c);document.head.appendChild(m);var sb=document.createElement('meta');sb.setAttribute('name','apple-mobile-web-app-status-bar-style');sb.setAttribute('content',ad?'black':'default');document.head.appendChild(sb)}catch(e){}})();",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,600;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
