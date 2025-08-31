import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default function Page() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-x-hidden">
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 h-14 border-b bg-background/60 backdrop-blur flex items-center gap-2 px-4">
            <SidebarTrigger />
            <div className="text-sm text-muted-foreground">Overview</div>
          </header>
          <main className="flex-1 min-w-0 p-6">
            <div className="card p-6">
              <h1 className="text-lg font-semibold mb-2">Welcome</h1>
              <p className="text-sm text-muted-foreground">Use the Docs section to write and organize your documentation.</p>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
