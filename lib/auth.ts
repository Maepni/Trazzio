import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { username, password } = parsed.data

        const user = await prisma.user.findUnique({
          where: { username },
          include: { worker: true },
        })

        if (!user) return null

        const passwordMatch = await bcrypt.compare(password, user.password)
        if (!passwordMatch) return null

        return {
          id: user.id,
          username: user.username,
          role: user.role,
          workerId: user.worker?.id ?? null,
          workerName: user.worker?.name ?? null,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.username = (user as any).username
        token.workerId = (user as any).workerId
        token.workerName = (user as any).workerName
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub!
      session.user.username = token.username as string
      session.user.role = token.role as string
      session.user.workerId = token.workerId as string | null
      session.user.workerName = token.workerName as string | null
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
})
