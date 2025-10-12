import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import MarkdownEditor from "@/components/markdown-editor";
import RightSidebar from "@/components/right-sidebar";
import ThemeToggle from "@/components/theme-toggle";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

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
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-x-hidden">
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 h-14 border-b border-[var(--border)] bg-background/60 backdrop-blur flex items-center gap-2 px-4">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
            </div>
            <div className="text-sm text-muted-foreground">Docs</div>
          </header>
          <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem] gap-0 min-h-[calc(100vh-56px)]">
            <section className="min-h-0 min-w-0 h-full">
              <MarkdownEditor />
            </section>
            <RightSidebar />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
