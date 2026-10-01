import { ReactNode } from "react";
import RoutePermission from "@/components/auth/route-permission";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoutePermission permission="dashboard.view">
      {children}
    </RoutePermission>
  );
}