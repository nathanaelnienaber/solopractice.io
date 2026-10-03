import type { Metadata } from "next";
import { DownloadPageContent } from "./download-page-content";

export const metadata: Metadata = {
  title: "Download SoloPractice",
  description:
    "Download the SoloPractice desktop app for Mac, Windows, or Linux.",
};

export default function DownloadPage() {
  return <DownloadPageContent />;
}
