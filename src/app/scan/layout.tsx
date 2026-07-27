import type { Metadata } from "next";
import ServiceWorkerRegistrar from "@/components/service-worker";

export const metadata: Metadata = {
  title: "Scanner",
  // The scanner is a staff tool behind a login. Nothing here should ever
  // appear in search results.
  robots: { index: false, follow: false },
};

// No background colour is set here on purpose. The camera screens are black
// edge-to-edge; the community screen uses the site's normal light surface. A
// background on the shared shell would fight one or the other.
export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col">
      <ServiceWorkerRegistrar />
      {children}
    </div>
  );
}
