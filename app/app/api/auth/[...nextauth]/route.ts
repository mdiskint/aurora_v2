import NextAuth from "next-auth";
import { authOptions, assertAuthEnv } from "@/lib/auth";

// Fail closed: in production, reject startup when required env names are
// missing (OAuth, NEXTAUTH_SECRET, DATABASE_URL, NEXTAUTH_URL).
assertAuthEnv();

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };