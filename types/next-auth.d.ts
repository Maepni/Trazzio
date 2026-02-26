import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      role: string
      workerId: string | null
      workerName: string | null
    }
  }
}
