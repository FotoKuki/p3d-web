import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import LINE from "next-auth/providers/line";
import { accountAdapter } from "./lib/account-store";
import { notifyCustomerLineConnected } from "./lib/line-notify";
import { currentLineProvider, lineOaEnabled } from "./lib/line-provider";
import { adminOrigin, isAdminEmail, isAdminSite, isCombinedSite } from "./lib/site-role";

const adminOnlySite = isAdminSite() && !isCombinedSite();
export const googleEnabled = Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
const originalLineEnabled = !adminOnlySite && Boolean(process.env.AUTH_SECRET && process.env.AUTH_LINE_ID?.trim() && process.env.AUTH_LINE_SECRET?.trim());
export const legacyLineEnabled = originalLineEnabled && lineOaEnabled;
export const lineEnabled = !adminOnlySite && (originalLineEnabled || lineOaEnabled);

function adminCookies() {
  const secure = adminOrigin().startsWith("https:");
  const names = {
    sessionToken: "session-token", callbackUrl: "callback-url", csrfToken: "csrf-token",
    pkceCodeVerifier: "pkce", state: "state", nonce: "nonce",
  };
  return Object.fromEntries(Object.entries(names).map(([key, name]) => [
    key, {
      name: (secure ? "__Secure-" : "") + "p3d-admin." + name,
      options: { httpOnly: true, sameSite: "lax", path: "/", secure,
        ...(["pkceCodeVerifier", "state", "nonce"].includes(key) ? { maxAge: 15 * 60 } : {}) },
    },
  ]));
}

function isAdminGoogleCallback(request) {
  if (!request || !isCombinedSite() || request.nextUrl.pathname !== "/api/auth/callback/google") return false;
  const cookieName = (request.nextUrl.protocol === "https:" ? "__Secure-" : "") + "authjs.callback-url";
  const returnUrl = request.cookies.get(cookieName)?.value;
  if (!returnUrl) return false;
  try {
    const target = new URL(returnUrl);
    return target.origin === request.nextUrl.origin && target.pathname === "/admin/orders";
  } catch {
    return false;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(request => {
  const adminFlow = adminOnlySite || isAdminGoogleCallback(request);
  return {
    trustHost: true,
    providers: [
      ...(googleEnabled ? [Google] : []),
      ...(originalLineEnabled ? [LINE({
        clientId: process.env.AUTH_LINE_ID?.trim(),
        clientSecret: process.env.AUTH_LINE_SECRET?.trim(),
        authorization: { params: { scope: "openid profile", bot_prompt: "aggressive" } },
      })] : []),
      ...(!adminOnlySite && lineOaEnabled ? [LINE({
        id: "line-oa",
        clientId: process.env.P3D_LINE_OA_ID.trim(),
        clientSecret: process.env.P3D_LINE_OA_SECRET.trim(),
        authorization: { params: { scope: "openid profile", bot_prompt: "aggressive" } },
      })] : []),
    ],
    adapter: accountAdapter,
    session: { strategy: "jwt", ...(adminOnlySite ? { maxAge: 8 * 60 * 60 } : {}) },
    ...(adminOnlySite ? { cookies: adminCookies() } : {}),
    events: {
      async linkAccount({ user, account }) {
        if (account.provider === currentLineProvider) await notifyCustomerLineConnected(user.id);
      },
    },
    callbacks: {
      signIn({ account, profile }) {
        return !adminFlow || (account?.provider === "google" && profile?.email_verified === true && isAdminEmail(profile.email));
      },
      jwt({ token, account, profile }) {
        if (account) token.adminGoogle = account.provider === "google" && profile?.email_verified === true;
        return token;
      },
      async session({ session, token }) {
        const account = token.sub && (await accountAdapter.getUser(token.sub));
        if (account && (!adminOnlySite || (token.adminGoogle === true && isAdminEmail(account.email)))) {
          session.user = {
            id: account.id, name: account.name, email: account.email, image: account.image,
            verifiedGoogleSignIn: token.adminGoogle === true,
          };
        } else {
          session.user = null;
        }
        return session;
      },
    },
    pages: {
      signIn: adminOnlySite ? "/admin/sign-in" : "/account",
      error: adminFlow ? "/admin/sign-in" : "/account",
    },
  };
});
