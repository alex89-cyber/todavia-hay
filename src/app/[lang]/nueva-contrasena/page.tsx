import { Suspense } from "react";
import { AuthPage } from "@/components/AuthPage";

export default function NuevaContrasenaPage(props: PageProps<"/[lang]/nueva-contrasena">) {
  return (
    <Suspense>
      <AuthPage {...props} mode="reset" />
    </Suspense>
  );
}
