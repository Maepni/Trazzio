import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      role: string
      workerId: string | null
      workerName: string | null
    }
  }
}
