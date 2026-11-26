import { Suspense } from "react";
import EditorClient from "@/components/editor/EditorClient";
import { FullPageSpinner } from "@/components/ui";

export default function EditQuizPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <EditorClient />
    </Suspense>
  );
}
