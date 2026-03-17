import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

const CapsuleCreateSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().optional().default(""),
  folderId: z.string().min(1).optional().nullable(),
});

type Err = { error: string };

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" } satisfies Err, { status: 401 });

  let input: z.infer<typeof CapsuleCreateSchema>;
  try {
    const json = await req.json();
    input = CapsuleCreateSchema.parse(json);
  } catch {
    return Response.json({ error: "Invalid request body" } satisfies Err, { status: 400 });
  }

  const title = (input.title?.trim() ?? "") || "Untitled";
  const content = input.content ?? "";
  const folderId: string | null = input.folderId ?? null;

  if (folderId) {
    const folder = await prisma.folder.findFirst({ where: { id: folderId, clerkUserId: userId } });
    if (!folder) return Response.json({ error: "Folder not found" } satisfies Err, { status: 404 });
  }

  try {
    const created = await prisma.capsule.create({
      data: {
        clerkUserId: userId,
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
