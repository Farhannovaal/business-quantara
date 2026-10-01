import { ReactNode } from "react";
import RoutePermission from "@/components/auth/route-permission";

export default function TailorBillingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoutePermission permission="tailor-billing.view">
      {children}
    </RoutePermission>
  );
}