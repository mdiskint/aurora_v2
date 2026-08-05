import { DefaultSession } from "next-auth";

/**
 * The NextAuth `session` callback (lib/auth.ts) sets `session.user.id` from the
 * JWT subject. Augment the default Session type so client code can read the
 * authenticated account id (used to namespace browser persistence in BETA-06).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id?: string | null;
    } & DefaultSession["user"];
  }
}