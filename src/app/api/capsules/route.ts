import { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

const CapsuleCreateSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().optional().default(""),
  folderId: z.string().min(1).optional().nullable(),
});

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

export async function POST(req: NextRequest) {
  // Auth and ensure user exists in DB
  const ensured = await ensureDbUser();
  if (ensured.status !== 200) {
    return Response.json(ensured.body, { status: ensured.status });
  }
  const dbUser = ensured.user;

  // Validate input
  let input: z.infer<typeof CapsuleCreateSchema>;
  try {
    const json = await req.json();
    input = CapsuleCreateSchema.parse(json);
  } catch {
    return Response.json({ error: "Invalid request body" } satisfies Err, { status: 400 });
  }

  const title = (input.title?.trim() ?? "") || "Untitled";
  const content = input.content ?? "";
  let folderId: string | null = input.folderId ?? null;

  // If folderId provided, ensure it belongs to the user
  if (folderId) {
    const folder = await prisma.folder.findFirst({ where: { id: folderId, userId: dbUser.id } });
    if (!folder) return Response.json({ error: "Folder not found" } satisfies Err, { status: 404 });
  }

  try {
    const created = await prisma.capsule.create({
      data: {
        userId: dbUser.id,
        folderId,
        title,
        content,
      },
    });
    return Response.json(created, { status: 201 });
  } catch (e) {
    console.error("Create capsule error", e);
    return Response.json({ error: "Failed to create capsule" } satisfies Err, { status: 500 });
  }
}
