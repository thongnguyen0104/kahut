import { Suspense } from "react";
import HostClient from "@/components/host/HostClient";
import { FullPageSpinner } from "@/components/ui";

export default function HostPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <HostClient />
    </Suspense>
  );
}
