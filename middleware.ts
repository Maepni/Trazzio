import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session

  const isLoginPage = nextUrl.pathname === "/login"
  const isAdminRoute = nextUrl.pathname.startsWith("/dashboard") ||
    nextUrl.pathname.startsWith("/companies") ||
    nextUrl.pathname.startsWith("/stock") ||
    nextUrl.pathname.startsWith("/workers") ||
    nextUrl.pathname.startsWith("/assignments") ||
    nextUrl.pathname.startsWith("/settlements") ||
    nextUrl.pathname.startsWith("/reports")
  const isWorkerRoute = nextUrl.pathname.startsWith("/home") ||
    nextUrl.pathname === "/settle" || nextUrl.pathname.startsWith("/settle/")

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  if (isLoggedIn && isLoginPage) {
    const role = session?.user?.role
    if (role === "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }
    return NextResponse.redirect(new URL("/home", nextUrl))
  }

  if (isLoggedIn && isAdminRoute && session?.user?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/home", nextUrl))
  }

  if (isLoggedIn && isWorkerRoute && session?.user?.role !== "WORKER") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}
