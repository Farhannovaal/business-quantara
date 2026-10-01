import { ReactNode } from "react";
import RoutePermission from "@/components/auth/route-permission";

export default function ProductsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoutePermission permission="product.view">
      {children}
    </RoutePermission>
  );
}