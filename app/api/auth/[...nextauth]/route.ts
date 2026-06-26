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
    ],
    session: {
        strategy: "jwt" as const,
    },
    pages: {
        signIn: '/auth/signin',
    },
    callbacks: {
        async signIn({ user }: any) {
            if (!user.email) return false
            // ponytail: skip gate in dev so you can test without beta signup
            if (process.env.NODE_ENV === 'development') return true
            const signup = await prisma.betaSignup.findUnique({ where: { email: user.email } })
            return !!signup
        },
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
