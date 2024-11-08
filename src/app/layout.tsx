import "~/styles/globals.css";
import { Roboto_Mono } from 'next/font/google'

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400'],
  style: ['normal'],
})

import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "NextJS - TailwindCSS - Realtime Console",
  description: "Created by steno.ai",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${robotoMono.className} text-sm`}>
      <body>{children}</body>
    </html>
  );
}
