import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

type Err = { error: string };

async function ensureDbUser() {
  const { userId } = await auth();
  if (!userId) return { status: 401 as const, body: { error: "Unauthorized" } satisfies Err };

  const existing = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (existing) return { status: 200 as const, user: existing };

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
  return { status: 200 as const, user: created };
}

export async function GET() {
  const ensured = await ensureDbUser();
  if (ensured.status !== 200) return NextResponse.json(ensured.body, { status: ensured.status });
  const dbUser = ensured.user;

  try {
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
