import "./globals.css";
import AppProviders from "@/providers/AppProviders";

export const metadata = {
  title: "BidX — Live auctions, without the noise",
  description:
    "Discover live auctions, place secure real-time bids, sell products, and manage payments from one focused marketplace.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><AppProviders>{children}</AppProviders></body>
    </html>
  );
}
