import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
export const metadata: Metadata = { title: "Missed Call AI", description: "Automatically respond to missed calls with a text message." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><SessionProvider>{children}</SessionProvider></body></html>;
}