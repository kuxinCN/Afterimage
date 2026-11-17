import localFont from "next/font/local";
import "./globals.css";
import { StoryProvider } from "@/store/StoryContext";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata = {
  title: "余像 Afterimage",
  description: "把真实的生活资料，重构成可以再次进入的记忆空间。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <StoryProvider>{children}</StoryProvider>
      </body>
    </html>
  );
}
