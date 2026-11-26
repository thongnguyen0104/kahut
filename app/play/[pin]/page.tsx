import { Suspense } from "react";
import PlayClient from "@/components/player/PlayClient";
import { FullPageSpinner } from "@/components/ui";

export default function PlayPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <PlayClient />
    </Suspense>
  );
}
