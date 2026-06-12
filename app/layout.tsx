import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beacon — AEO Discoverability Platform",
  description:
    "Run CSV prompts across Claude, ChatGPT, Gemini and Perplexity to see if your brand is getting seen in AI answers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
