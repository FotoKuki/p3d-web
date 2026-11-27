import { NextResponse } from "next/server";
import { adminOrigin, customerOrigin, isAdminSite, isCombinedSite } from "./lib/site-role";

export function proxy(request) {
  if (isCombinedSite()) return NextResponse.next();

  const path = request.nextUrl.pathname;
  const adminPath = path === "/admin" || path.startsWith("/admin/");
  if (!isAdminSite()) {
    if (!adminPath) return NextResponse.next();
    if (request.method !== "GET" && request.method !== "HEAD") return new NextResponse(null, { status: 404 });
    return NextResponse.redirect(new URL(path + request.nextUrl.search, adminOrigin()));
  }

  const authPath = path === "/api/auth" || path.startsWith("/api/auth/");
  if (adminPath || authPath) return NextResponse.next();
  if (path === "/") return NextResponse.redirect(new URL("/admin/orders", adminOrigin()));
  if (request.method !== "GET" && request.method !== "HEAD") return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(new URL(path + request.nextUrl.search, customerOrigin()));
}

export const config = { matcher: ["/", "/admin/:path*", "/account", "/estimate", "/checkout", "/orders/:path*", "/api/:path*"] };
