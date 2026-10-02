import type { Metadata } from "next";
import "./globals.css";
import SiteNavbar from "@/app/site-navbar";

export const metadata: Metadata = {
  title: "Tuition Media | Learn with the right tutor",
  description: "Find trusted tutors or connect with students on Tuition Media.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col">
        <SiteNavbar />
        {children}
      </body>
    </html>
  );
}
