import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CRM WhatsApp",
  description: "Gerencie seus contatos e conversas do WhatsApp",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className} suppressHydrationWarning>
        <nav className="nav">
          <div className="nav-logo">CRM<span>.</span>app</div>
          <div className="nav-links">
            <Link href="/instances" className="nav-link">⚡ Instâncias</Link>
            <Link href="/chat" className="nav-link">💬 Chat</Link>
          </div>
        </nav>
        <div className="page-wrapper">
          {children}
        </div>
      </body>
    </html>
  );
}
