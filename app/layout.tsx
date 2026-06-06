import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WalletGate from "@/components/wallet/WalletGate";

export const metadata: Metadata = {
  title: "GenBirds — Physics Puzzle on GenLayer",
  description: "Launch original arcade birds. Smash structures. Verified on GenLayer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
          <div className="cloud w-64 h-16 top-24 left-10 animate-floaty" />
          <div className="cloud w-80 h-20 top-48 right-20 animate-floaty" style={{ animationDelay: "1s" }} />
          <div className="cloud w-56 h-14 top-[60%] left-[30%] animate-floaty" style={{ animationDelay: "2s" }} />
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-grass-gb/90" style={{ clipPath: "polygon(0 40%, 10% 30%, 25% 45%, 40% 25%, 60% 40%, 78% 22%, 92% 38%, 100% 30%, 100% 100%, 0 100%)" }} />
        </div>
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <WalletGate />
      </body>
    </html>
  );
}
