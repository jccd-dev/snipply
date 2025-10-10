import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

type Err = { error: string };

const CapsuleUpdateSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().optional(),
  folderId: z.string().min(1).nullable().optional(),
});

async function requireUserId() {
  const { userId } = auth();
  if (!userId) return { status: 401 as const, body: { error: "Unauthorized" } satisfies Err };
  const dbUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!dbUser) return { status: 403 as const, body: { error: "User not provisioned" } satisfies Err };
  return { status: 200 as const, user: dbUser };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ensured = await requireUserId();
  if (ensured.status !== 200) return Response.json(ensured.body, { status: ensured.status });
  const dbUser = ensured.user;

  const id = params.id;
  if (!id) return Response.json({ error: "Missing id" } satisfies Err, { status: 400 });

  // Check ownership
  const existing = await prisma.capsule.findFirst({ where: { id, userId: dbUser.id } });
  if (!existing) return Response.json({ error: "Capsule not found" } satisfies Err, { status: 404 });

  // Validate input
  let input: z.infer<typeof CapsuleUpdateSchema>;
  try {
    const json = await req.json();
    input = CapsuleUpdateSchema.parse(json);
  } catch {
    return Response.json({ error: "Invalid request body" } satisfies Err, { status: 400 });
  }

  // If moving between folders, ensure destination belongs to user
  if (input.folderId !== undefined && input.folderId !== null) {
    const folder = await prisma.folder.findFirst({ where: { id: input.folderId, userId: dbUser.id } });
    if (!folder) return Response.json({ error: "Folder not found" } satisfies Err, { status: 404 });
  }

  try {
    const updated = await prisma.capsule.update({
      where: { id },
      data: {
        title: input.title?.trim() ?? undefined,
        content: input.content ?? undefined,
        folderId: input.folderId === undefined ? undefined : input.folderId,
      },
    });
    return Response.json(updated, { status: 200 });
  } catch (e) {
    console.error("Update capsule error", e);
    return Response.json({ error: "Failed to update capsule" } satisfies Err, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ensured = await requireUserId();
  if (ensured.status !== 200) return Response.json(ensured.body, { status: ensured.status });
  const dbUser = ensured.user;

  const id = params.id;
  if (!id) return Response.json({ error: "Missing id" } satisfies Err, { status: 400 });

  const existing = await prisma.capsule.findFirst({ where: { id, userId: dbUser.id } });
  if (!existing) return Response.json({ error: "Capsule not found" } satisfies Err, { status: 404 });

  try {
    await prisma.capsule.delete({ where: { id } });
    return Response.json({} as const, { status: 204 });
  } catch (e) {
    console.error("Delete capsule error", e);
    return Response.json({ error: "Failed to delete capsule" } satisfies Err, { status: 500 });
  }
}