import { ReactNode } from "react";
import RoutePermission from "@/components/auth/route-permission";

export default function WorkflowsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoutePermission permission="workflow.view">
      {children}
    </RoutePermission>
  );
}