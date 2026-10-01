import { ReactNode } from "react";
import RoutePermission from "@/components/auth/route-permission";

export default function TrackingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoutePermission permission="tracking.view">
      {children}
    </RoutePermission>
  );
}