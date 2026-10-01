import { ReactNode } from "react";
import RoutePermission from "@/components/auth/route-permission";

export default function QCLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoutePermission permission="qc.view">
      {children}
    </RoutePermission>
  );
}