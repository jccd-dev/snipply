import Link from "next/link"
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs"
import ThemeToggle from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles, Files, ShieldCheck } from "lucide-react"

export default function Page() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Decorative gradient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* soft mesh gradient blobs aligned to theme */}
        <div className="absolute -top-48 -left-32 h-[36rem] w-[36rem] rounded-full blur-3xl opacity-30 bg-[radial-gradient(closest-side,theme(colors.violet.500/.6),transparent)] dark:opacity-25" />
        <div className="absolute -top-24 right-[-10%] h-[28rem] w-[28rem] rounded-full blur-3xl opacity-30 bg-[radial-gradient(closest-side,theme(colors.indigo.500/.6),transparent)] dark:opacity-20" />
        <div className="absolute bottom-[-20%] left-1/2 -translate-x-1/2 h-[40rem] w-[60rem] rounded-full blur-3xl opacity-25 bg-[radial-gradient(closest-side,theme(colors.fuchsia.500/.5),transparent)] dark:opacity-20" />
        {/* subtle top-to-bottom wash */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-background" />
        {/* grid overlay for depth */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,theme(colors.border)/60_1px,transparent_1px),linear-gradient(to_bottom,theme(colors.border)/60_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <Link href="/" className="font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-violet-500 via-indigo-500 to-fuchsia-500 bg-clip-text text-transparent">Snipply</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <Link href="/docs" className="hover:text-foreground transition-colors">Docs</Link>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <SignedIn>
              <Link href="/dashboard" className="hidden sm:inline-flex">
                <Button size="sm" variant="default">Dashboard</Button>
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <Link href="/sign-in">
                <Button size="sm" variant="ghost">Sign in</Button>
              </Link>
              <Link href="/sign-up" className="hidden sm:inline-flex">
                <Button size="sm" variant="default">Sign up</Button>
              </Link>
            </SignedOut>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative mx-auto max-w-7xl px-4">
        <section className="relative py-20 sm:py-24 md:py-28">
          {/* Accent ring */}
          <div aria-hidden className="absolute left-1/2 top-6 -z-10 h-40 w-40 -translate-x-1/2 rounded-full bg-[conic-gradient(from_90deg_at_50%_50%,theme(colors.violet.500/.6),theme(colors.fuchsia.500/.6),theme(colors.indigo.500/.6),theme(colors.violet.500/.6))] opacity-30 blur-2xl" />

          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              Streamline your knowledge — one snippet at a time
            </div>
            <h1 className="mt-6 bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-4xl font-semibold leading-tight text-transparent sm:text-5xl md:text-6xl">
              Organize, write, and share documentation brilliantly
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Snipply is a focused workspace for teams to capture ideas, code, and process docs — fast. Beautiful editor, flexible structure, and effortless sharing.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <SignedIn>
                <Link href="/dashboard">
                  <Button size="lg" className="group">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </Link>
              </SignedIn>
              <SignedOut>
                <Link href="/sign-up">
                  <Button size="lg" className="group">
                    Get started free
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </Link>
              </SignedOut>
              <Link href="/docs">
                <Button size="lg" variant="ghost">View Docs</Button>
              </Link>
            </div>
          </div>

          {/* Showcase card */}
          <div className="mx-auto mt-12 max-w-5xl rounded-xl border bg-background/50 p-6 shadow-sm backdrop-blur">
            <div className="grid gap-6 md:grid-cols-3">
              <Feature
                icon={<Files className="h-5 w-5 text-indigo-500" />}
                title="Effortless structure"
                description="Organize content with simple, flexible hierarchy that grows with your team."
              />
              <Feature
                icon={<Sparkles className="h-5 w-5 text-violet-500" />}
                title="Delightful editor"
                description="Markdown-first with syntax highlighting, diagrams, and inline previews."
              />
              <Feature
                icon={<ShieldCheck className="h-5 w-5 text-fuchsia-500" />}
                title="Secure by default"
                description="Auth, roles, and protected routes powered by Clerk — built-in."
              />
            </div>
          </div>
        </section>

        {/* Features section */}
        <section id="features" className="relative border-t py-16">
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            <Feature
              icon={<Files className="h-5 w-5 text-indigo-500" />}
              title="Snippets that scale"
              description="From quick notes to living docs — keep everything cohesive and searchable."
            />
            <Feature
              icon={<Sparkles className="h-5 w-5 text-violet-500" />}
              title="Beautiful by default"
              description="Thoughtful spacing, pastel accents, and accessible typography."
            />
            <Feature
              icon={<ShieldCheck className="h-5 w-5 text-fuchsia-500" />}
              title="Private when it matters"
              description="Granular access controls, secure sessions, and robust middleware."
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4">
          <p>© {new Date().getFullYear()} Snipply</p>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="hover:text-foreground transition-colors">Docs</Link>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group rounded-lg border bg-background/60 p-5 transition-colors hover:bg-background/80">
      <div className="inline-flex items-center gap-2 rounded-md border bg-background/70 px-2 py-1 text-xs text-muted-foreground">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
