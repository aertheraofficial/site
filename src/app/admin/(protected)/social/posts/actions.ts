"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseShopLocalDateTime } from "@/lib/datetime";
import { requirePermission } from "@/lib/staff-auth";
import {
  createStudioPost,
  deleteStudioPost,
  isStudioPlatform,
  isStudioPostStatus,
  updateStudioPost,
  type StudioPlatform,
} from "@/lib/social/studio-posts";

const POSTS_PATH = "/admin/social/posts";

/**
 * Errors travel as short codes, never as a raw exception message: the page
 * turns the code into wording staff can act on, and nothing internal leaks into
 * a URL that ends up in a screenshot or a bookmark.
 */
function fail(code: string): never {
  redirect(`${POSTS_PATH}?error=${code}`);
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readPlatforms(formData: FormData): StudioPlatform[] {
  return formData.getAll("platforms").map(String).filter(isStudioPlatform);
}

function readPostId(formData: FormData) {
  const id = Number(text(formData, "id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function createStudioPostAction(formData: FormData) {
  const actor = await requirePermission("social", POSTS_PATH);

  const title = text(formData, "title");
  const content = text(formData, "content");
  const platforms = readPlatforms(formData);

  if (!title || !content) fail("missing-fields");
  if (platforms.length === 0) fail("no-platform");

  const scheduledInput = text(formData, "scheduledAt");
  const scheduledAt = scheduledInput ? parseShopLocalDateTime(scheduledInput) : null;
  // A time we cannot read must not silently become a draft — the post would sit
  // there looking saved and never go out.
  if (scheduledInput && !scheduledAt) fail("bad-schedule");

  await createStudioPost({
    title,
    content,
    caption: text(formData, "caption") || null,
    niche: text(formData, "niche") || null,
    platforms,
    scheduledAt,
    createdBy: actor.type === "admin" ? "admin" : actor.staff.id,
  });

  revalidatePath(POSTS_PATH);
  redirect(`${POSTS_PATH}?created=1`);
}

export async function deleteStudioPostAction(formData: FormData) {
  await requirePermission("social", POSTS_PATH);

  const id = readPostId(formData);
  if (!id) fail("missing-post");

  await deleteStudioPost(id);

  revalidatePath(POSTS_PATH);
  redirect(`${POSTS_PATH}?deleted=1`);
}

export async function setStudioPostStatusAction(formData: FormData) {
  await requirePermission("social", POSTS_PATH);

  const id = readPostId(formData);
  if (!id) fail("missing-post");

  const status = text(formData, "status");
  if (!isStudioPostStatus(status)) fail("bad-status");

  // Sending a post back to draft has to clear its slot too, otherwise the
  // publisher would still see a time in the past and fire it.
  await updateStudioPost(id, {
    status,
    ...(status === "draft" ? { scheduledAt: null } : {}),
  });

  revalidatePath(POSTS_PATH);
  redirect(`${POSTS_PATH}?saved=1`);
}
