import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

async function refreshGoogleAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const refreshed = await response.json();

  if (!response.ok) {
    throw new Error(refreshed.error_description ?? "Failed to refresh Google access token");
  }

  return {
    accessToken: refreshed.access_token as string,
    expiresAt: Math.floor(Date.now() / 1000) + (refreshed.expires_in as number),
    // Google only returns a new refresh_token occasionally; keep the old one otherwise.
    refreshToken: (refreshed.refresh_token as string | undefined) ?? refreshToken,
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: `openid email profile ${DRIVE_READONLY_SCOPE}`,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: persist tokens issued alongside the OAuth account.
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }

      if (typeof token.expiresAt === "number" && Date.now() < token.expiresAt * 1000) {
        return token;
      }

      if (!token.refreshToken) {
        return { ...token, error: "MissingRefreshToken" as const };
      }

      try {
        const refreshed = await refreshGoogleAccessToken(token.refreshToken as string);
        return {
          ...token,
          accessToken: refreshed.accessToken,
          expiresAt: refreshed.expiresAt,
          refreshToken: refreshed.refreshToken,
          error: undefined,
        };
      } catch {
        return { ...token, error: "RefreshAccessTokenError" as const };
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.error = token.error as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});
