import { ReactNode } from "react";
import RoutePermission from "@/components/auth/route-permission";

export default function TailorRatesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoutePermission permission="tailor-rate.view">
      {children}
    </RoutePermission>
  );
}