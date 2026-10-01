import { ReactNode } from "react";
import RoutePermission from "@/components/auth/route-permission";

export default function TailorsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoutePermission permission="tailor.view">
      {children}
    </RoutePermission>
  );
}