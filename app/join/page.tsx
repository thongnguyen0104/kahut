import { Suspense } from "react";
import JoinClient from "@/components/player/JoinClient";
import { FullPageSpinner } from "@/components/ui";

export default function JoinPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <JoinClient />
    </Suspense>
  );
}
