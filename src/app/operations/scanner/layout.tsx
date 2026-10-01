import { ReactNode } from "react";
import RoutePermission from "@/components/auth/route-permission";

export default function ScannerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoutePermission permission="scanner.view">
      {children}
    </RoutePermission>
  );
}