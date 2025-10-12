import { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

const FolderCreateSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().max(120).optional(),
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
  const ensured = await ensureDbUser();
  if (ensured.status !== 200) return Response.json(ensured.body, { status: ensured.status });
  const dbUser = ensured.user;

  let input: z.infer<typeof FolderCreateSchema>;
  try {
    const json = await req.json();
    input = FolderCreateSchema.parse(json);
  } catch {
    return Response.json({ error: "Invalid request body" } satisfies Err, { status: 400 });
  }

  const id = input.id;
  const name = (input.name?.trim() ?? "") || "New Folder";

  try {
    const created = await prisma.folder.create({
      data: {
        id,
        userId: dbUser.id,
        name,
      },
    });
    return Response.json(created, { status: 201 });
  } catch (e) {
    console.error("Create folder error", e);
    return Response.json({ error: "Failed to create folder" } satisfies Err, { status: 500 });
  }
}
