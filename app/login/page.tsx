import { Suspense } from "react";
import LoginClient from "@/components/auth/LoginClient";
import { FullPageSpinner } from "@/components/ui";

export default function LoginPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <LoginClient />
    </Suspense>
  );
}
