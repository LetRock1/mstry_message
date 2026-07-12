import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })
  const { pathname } = request.nextUrl

  // If user is logged in and tries to access auth pages
  if (
    token &&
    (pathname.startsWith('/signin') ||
      pathname.startsWith('/signup') ||
      pathname.startsWith('/verify'))
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // If user is NOT logged in and tries to access protected routes
  if (
    !token &&
    pathname.startsWith('/dashboard')
  ) {
    return NextResponse.redirect(new URL('/signin', request.url))
  }

  // Otherwise allow request
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/signin',
    '/signup',
    '/verify/:path*',
    '/dashboard/:path*'
  ]
}
