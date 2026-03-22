import MarkdownEditor from "@/components/markdown-editor";
import RightSidebar from "@/components/right-sidebar";
import ThemeToggle from "@/components/theme-toggle";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BellIcon, GearIcon } from "@phosphor-icons/react";

export default async function DocsPage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Welcome to Snipply</h1>
          <p className="text-muted-foreground">Please sign in to access your documentation</p>
          <SignInButton mode="modal">
            <Button>Sign In</Button>
          </SignInButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen w-full overflow-x-hidden">
      <header className="sticky top-0 z-20 h-14 border-b bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40 flex items-center px-6">
        <div className="flex items-center gap-6 w-full max-w-[1400px] mx-auto">
          <Link href="/" className="font-semibold tracking-tight text-xl text-primary">
            Snipply
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium mx-auto">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link>
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
            <Link href="/docs" className="text-foreground transition-colors border-b-2 border-primary py-4 -mb-[1px]">Capsules</Link>
          </nav>
          <div className="flex items-center gap-3 ml-auto">
            <button className="text-muted-foreground hover:text-foreground"></button>
            <ThemeToggle />
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-0">
        <section className="min-h-0 min-w-0 h-[calc(100vh-56px)] overflow-hidden">
          <MarkdownEditor />
        </section>
        <RightSidebar />
      </main>
    </div>
  );
}
