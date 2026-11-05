import { Suspense } from "react";
import { AuthPage } from "@/components/AuthPage";

export default function RegistroPage(props: PageProps<"/[lang]/registro">) {
  return (
    <Suspense>
      <AuthPage {...props} mode="signup" />
    </Suspense>
  );
}
