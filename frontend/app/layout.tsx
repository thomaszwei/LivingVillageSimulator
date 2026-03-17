import type { Metadata } from "next";
import "./globals.css";

// Force dynamic rendering so process.env.DISPLAY_MODE is read on every
// request rather than baked in at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Living Village Simulator",
  description: "A real-time village simulation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read at runtime by the Node.js server — no rebuild required to toggle.
  const displayMode = process.env.DISPLAY_MODE === "true";
  return (
    <html lang="en">
      <body className="min-h-screen">
        {displayMode && (
          // Inline script runs synchronously before React hydrates, so the
          // client-side useState() initialiser can read it without a flash.
          <script dangerouslySetInnerHTML={{ __html: "window.__DISPLAY_MODE__=true;" }} />
        )}
        {children}
      </body>
    </html>
  );
}
