import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TopBar } from "@/features/events/components/navigation/TopBar";
import "@/styles/index.css";

export const metadata: Metadata = {
  title: "Pharm",
  description:
    "Streamline retail pharmacy operations with an intuitive dashboard for sales tracking, inventory management, member analysis, and staff oversight.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <TopBar />
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
