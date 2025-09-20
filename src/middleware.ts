import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define which routes are public (no auth required)
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/clerk(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect everything that is not explicitly public
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
}, {
  // Helpful during local development to understand auth flow
  debug: process.env.NODE_ENV === 'development',
  // Mitigate local machine clock drift that can invalidate session tokens
  clockSkewInMs: 60_000,
});

// Standard Next.js matcher to run middleware on all routes except static assets and _next
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};