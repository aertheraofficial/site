"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/staff-auth";
import { createLink, deleteLink, updateLink } from "@/lib/social/studio-links";

const LINKS_PATH = "/admin/social/linktree";

function fail(code: string): never {
  redirect(`${LINKS_PATH}?error=${code}`);
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readId(formData: FormData) {
  const id = Number(text(formData, "id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Only http(s), so a link tree cannot be turned into a javascript: payload. */
function isSafeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function createLinkAction(formData: FormData) {
  await requirePermission("social", LINKS_PATH);

  const title = text(formData, "title");
  const url = text(formData, "url");
  if (!title || !url) fail("missing-fields");
  if (!isSafeUrl(url)) fail("bad-url");

  const sortOrder = Number(text(formData, "sortOrder"));

  await createLink({
    title,
    url,
    platform: text(formData, "platform") || "instagram",
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
  });

  revalidatePath(LINKS_PATH);
  revalidatePath("/links");
  redirect(`${LINKS_PATH}?created=1`);
}

export async function toggleLinkAction(formData: FormData) {
  await requirePermission("social", LINKS_PATH);

  const id = readId(formData);
  if (!id) fail("missing-link");

  await updateLink(id, { isActive: text(formData, "isActive") === "true" });

  revalidatePath(LINKS_PATH);
  revalidatePath("/links");
  redirect(`${LINKS_PATH}?saved=1`);
}

export async function deleteLinkAction(formData: FormData) {
  await requirePermission("social", LINKS_PATH);

  const id = readId(formData);
  if (!id) fail("missing-link");

  await deleteLink(id);

  revalidatePath(LINKS_PATH);
  revalidatePath("/links");
  redirect(`${LINKS_PATH}?deleted=1`);
}
