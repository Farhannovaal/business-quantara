import { ReactNode } from "react";
import RoutePermission from "@/components/auth/route-permission";

export default function SPKLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoutePermission permission="spk.view">
      {children}
    </RoutePermission>
  );
}