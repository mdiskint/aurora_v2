import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import prisma from "@/lib/prisma"

export const authOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
        // Microsoft provider will be added later when Azure setup is complete
        // AzureADProvider({
        //   clientId: process.env.AZURE_AD_CLIENT_ID!,
        //   clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
        //   tenantId: process.env.AZURE_AD_TENANT_ID!,
        // }),
    ],
    session: {
        strategy: "jwt" as const,
    },
    pages: {
        signIn: '/auth/signin',
    },
    callbacks: {
        async session({ session, token }: any) {
            if (session.user) {
                session.user.id = token.sub
            }
            return session
        }
    }
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
