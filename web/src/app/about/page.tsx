import type { Metadata } from "next";
import { DocsView } from "@/components/DocsView";

export const metadata: Metadata = { title: "About — ONE" };

export default function AboutPage() {
  return <DocsView group="about" />;
}
