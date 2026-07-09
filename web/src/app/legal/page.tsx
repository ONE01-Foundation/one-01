import type { Metadata } from "next";
import { DocsView } from "@/components/DocsView";

export const metadata: Metadata = { title: "Legal — ONE" };

export default function LegalPage() {
  return <DocsView group="legal" />;
}
