import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import MarkdownEditor from "@/components/markdown-editor";
import RightSidebar from "@/components/right-sidebar";
import ThemeToggle from "@/components/theme-toggle";

export default function DocsPage() {
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
