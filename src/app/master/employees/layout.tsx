import { ReactNode } from "react";
import RoutePermission from "@/components/auth/route-permission";

export default function EmployeesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoutePermission permission="employee.view">
      {children}
    </RoutePermission>
  );
}