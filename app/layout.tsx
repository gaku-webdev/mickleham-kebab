import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/lib/auth-context";
import Header from "@/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mickleham Kebab & Grill",
  description:
    "Big Flavor, Hot Grill, and Your Favourite Kebabs and Burgers in Mickleham, Victoria.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <CartProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-[#F8F6F0] focus:px-4 focus:py-3 focus:text-[#29261F] focus:shadow-lg"
            >
              Skip to main content
            </a>
            {/* Header must be INSIDE CartProvider, */}
            {/* because it uses useCart() to show the item count. */}
            <Header />
            <div id="main-content" tabIndex={-1} className="flex-1">
              {children}
            </div>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}