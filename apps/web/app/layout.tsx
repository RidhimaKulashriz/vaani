import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Vaani-Dalal — Your voice. Their phone. Handled.", template: "%s | Vaani-Dalal" },
  description: "A thoughtful AI call agent for appointments and everyday calls. Simulated by default; you stay in control.",
  openGraph: { title: "Vaani-Dalal", description: "Thoughtful calls. Human control.", type: "website", images: ["/brand-mark.svg"] },
  twitter: { card: "summary", title: "Vaani-Dalal", description: "Thoughtful calls. Human control." },
};
export default function RootLayout({ children }: Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
