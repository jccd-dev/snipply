import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

type Err = { error: string };

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" } satisfies Err, { status: 401 });

  try {
    const count = await prisma.capsule.count({ where: { clerkUserId: userId } });

    if (count === 0) {
      const gettingStartedContent = `# Getting Started\n\nWelcome to Snipply! This editor supports GitHub-flavored Markdown, KaTeX math, and Mermaid diagrams.\n\n## Basics\n- **Bold**: **text**\n- *Italic*: *text*\n- Inline code: \`const x = 1\`\n- Links: [Markdown Guide](https://www.markdownguide.org/basic-syntax/)\n\n## Lists\n- Item 1\n- Item 2\n\n## Table\n| Feature | Support |\n|--------|---------|\n| Markdown | ✅ |\n| KaTeX | ✅ |\n| Mermaid | ✅ |\n\n## KaTeX / Math\nInline: $E=mc^2$\n\nBlock math:\n$\n\\int_{0}^{\\pi} \\sin x\\, dx = 2\n$\n\n## Mermaid Diagram\n\n\`\`\`mermaid\ngraph TD\nA[Start] --> B{Choose}\nB -->|Yes| C[Do thing]\nB -->|No| D[Do other]\n\`\`\`\n\n## Tips\n- Use the toolbar to insert common syntax.\n- Toggle Preview to see formatted output.\n- Use Save/Cancel to control commits.`;
      await prisma.capsule.create({
        data: {
          clerkUserId: userId,
          folderId: null,
          title: "Getting Started",
          content: gettingStartedContent,
        },
      });
    }

    const [folders, capsules] = await Promise.all([
      prisma.folder.findMany({ where: { clerkUserId: userId }, orderBy: { createdAt: "asc" } }),
      prisma.capsule.findMany({ where: { clerkUserId: userId }, orderBy: { createdAt: "asc" } }),
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
