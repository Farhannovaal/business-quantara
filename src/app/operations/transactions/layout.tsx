import { ReactNode } from "react";
import RoutePermission from "@/components/auth/route-permission";

export default function TransactionsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoutePermission permission="transaction.view">
      {children}
    </RoutePermission>
  );
}