import type { Metadata } from "next";
import { DocsView } from "@/components/DocsView";

export const metadata: Metadata = { title: "Support — ONE" };

export default function SupportPage() {
  return <DocsView initialGroup="support" />;
}
