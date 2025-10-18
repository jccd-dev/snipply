import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

type Err = { error: string };

async function ensureDbUser() {
  const { userId } = await auth();
  if (!userId) return { status: 401 as const, body: { error: "Unauthorized" } satisfies Err };

  const existing = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (existing) return { status: 200 as const, user: existing, isNew: false } as const;

  const cu = await currentUser();
  if (!cu) return { status: 401 as const, body: { error: "Unauthorized" } satisfies Err };

  const created = await prisma.user.create({
    data: {
      clerkUserId: cu.id,
      email: cu.primaryEmailAddress?.emailAddress,
      firstName: cu.firstName ?? undefined,
      lastName: cu.lastName ?? undefined,
      imageUrl: cu.imageUrl ?? undefined,
      role: (cu.publicMetadata?.role as string | undefined) ?? "user",
    },
  });
  return { status: 200 as const, user: created, isNew: true } as const;
}

export async function GET() {
  const ensured = await ensureDbUser();
  if (ensured.status !== 200) return NextResponse.json(ensured.body, { status: ensured.status });
  const dbUser = ensured.user;
  const isNew = (ensured as { isNew?: boolean }).isNew === true;

  try {
    if (isNew) {
      // Only seed once at user provision time
      const count = await prisma.capsule.count({ where: { userId: dbUser.id } });
      if (count === 0) {
        const gettingStartedContent = `# Getting Started\n\nWelcome to Snipply! This editor supports GitHub-flavored Markdown, KaTeX math, and Mermaid diagrams.\n\n## Basics\n- **Bold**: **text**\n- *Italic*: *text*\n- Inline code: \`const x = 1\`\n- Links: [Markdown Guide](https://www.markdownguide.org/basic-syntax/)\n\n## Lists\n- Item 1\n- Item 2\n\n## Table\n| Feature | Support |\n|--------|---------|\n| Markdown | ✅ |\n| KaTeX | ✅ |\n| Mermaid | ✅ |\n\n## KaTeX / Math\nInline: $E=mc^2$\n\nBlock math:\n$$\n\\int_{0}^{\\pi} \\sin x\\, dx = 2\n$$\n\n## Mermaid Diagram\n\n\`\`\`mermaid\ngraph TD\nA[Start] --> B{Choose}\nB -->|Yes| C[Do thing]\nB -->|No| D[Do other]\n\`\`\`\n\n## Tips\n- Use the toolbar to insert common syntax.\n- Toggle Preview to see formatted output.\n- Use Save/Cancel to control commits.`;
        await prisma.capsule.create({
          data: {
            userId: dbUser.id,
            folderId: null,
            title: "Getting Started",
            content: gettingStartedContent,
          },
        });
      }
    }

    const [folders, capsules] = await Promise.all([
      prisma.folder.findMany({ where: { userId: dbUser.id }, orderBy: { createdAt: "asc" } }),
      prisma.capsule.findMany({ where: { userId: dbUser.id }, orderBy: { createdAt: "asc" } }),
    ]);

    return NextResponse.json({
      folders: folders.map((f) => ({ id: f.id, name: f.name, createdAt: f.createdAt.toISOString() })),
      capsules: capsules.map((c) => ({
        id: c.id,
        title: c.title,
        content: c.content,
        folderId: c.folderId,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("Library fetch error", e);
    return NextResponse.json({ error: "Failed to load library" } satisfies Err, { status: 500 });
  }
}
