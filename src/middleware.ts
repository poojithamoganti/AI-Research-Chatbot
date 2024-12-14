// TODO: Implement the code here to add rate limiting with Redis
// Refer to the Next.js Docs: https://nextjs.org/docs/app/building-your-application/routing/middleware
// Refer to Redis docs on Rate Limiting: https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

// Create a new ratelimiter that allows 5 requests per 10 seconds
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '10 s'),
  analytics: true,
  prefix: '@upstash/ratelimit',
})

// Helper function to get IP address from request
function getIP(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  const xRealIP = request.headers.get('x-real-ip')
  if (xRealIP) {
    return xRealIP
  }
  
  return '127.0.0.1' // Fallback IP
}


export async function middleware(request: NextRequest) {
  try {
    // Get IP address from request
    const ip = getIP(request)
    
    // Only rate limit the chat API endpoint
    if (request.nextUrl.pathname === '/api/chat') {
      // Create identifier based on IP
      const identifier = `${ip}:${request.nextUrl.pathname}`
      
      // Check rate limit
      const { success, limit, reset, remaining } = await ratelimit.limit(identifier)
      
      // Return rate limit headers with response
      const response = success 
        ? NextResponse.next()
        : NextResponse.json(
            { error: 'Too many requests' },
            { status: 429 }
          )
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', limit.toString())
      response.headers.set('X-RateLimit-Remaining', remaining.toString())
      response.headers.set('X-RateLimit-Reset', reset.toString())
      
      if (!success) {
        response.headers.set('Retry-After', Math.ceil((reset - Date.now()) / 1000).toString())
      }
      
      return response
    }
    
    // Don't rate limit other routes
    return NextResponse.next()
  } catch (error) {
    console.error('Middleware Error:', error)
    
    // If rate limiting fails, allow the request through but log the error
    return NextResponse.next()
  }
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Exclude static files and images
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

