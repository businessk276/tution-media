import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tuition Media | Learn with the right tutor",
  description: "Find trusted tutors or connect with students on Tuition Media.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
