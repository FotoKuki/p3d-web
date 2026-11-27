import { auth } from "../auth";
import { isAdminEmail, isAdminSite } from "./site-role";

export async function orderViewer() {
  if (!process.env.AUTH_SECRET) return null;
  const user = (await auth())?.user;
  if (!user?.id) return null;
  const canAdmin = user.verifiedGoogleSignIn === true && isAdminEmail(user.email);
  return { id: user.id, email: user.email, canAdmin, admin: isAdminSite() && canAdmin };
}