import { ReactNode } from "react";
import RoutePermission from "@/components/auth/route-permission";

export default function RulesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoutePermission permission="rule.view">
      {children}
    </RoutePermission>
  );
}