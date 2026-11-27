export function siteRole() {
  const explicit = process.env.P3D_SITE_ROLE?.trim();
  if (explicit) return explicit;
  return process.env.VERCEL ? "all" : "customer";
}

export function isCombinedSite() {
  return siteRole() === "all";
}

export function isAdminSite() {
  const role = siteRole();
  return role === "admin" || role === "all";
}

export function isAdminEmail(email) {
  if (!email) return false;
  return (process.env.P3D_ADMIN_EMAILS || "").split(",").some((entry) => entry.trim().toLowerCase() === email.toLowerCase());
}

export function adminOrigin() {
  return (
    process.env.P3D_ADMIN_URL ||
    (isAdminSite() ? process.env.AUTH_URL : undefined) ||
    (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3001")
  );
}

export function customerOrigin() {
  return (
    process.env.P3D_CUSTOMER_URL ||
    process.env.AUTH_URL ||
    (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000")
  );
}
