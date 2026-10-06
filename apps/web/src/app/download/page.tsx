import type { Metadata } from "next";
import { DownloadPageContent } from "./download-page-content";

export const metadata: Metadata = {
  title: "Download SoloPractice",
  description:
    "Download the SoloPractice desktop app for Windows, Mac, or Linux. Clinical notes stay on your computer.",
};

export default function DownloadPage() {
  return <DownloadPageContent />;
}
