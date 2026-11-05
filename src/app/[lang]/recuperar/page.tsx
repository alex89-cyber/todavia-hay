import { Suspense } from "react";
import { AuthPage } from "@/components/AuthPage";

export default function RecuperarPage(props: PageProps<"/[lang]/recuperar">) {
  return (
    <Suspense>
      <AuthPage {...props} mode="forgot" />
    </Suspense>
  );
}
