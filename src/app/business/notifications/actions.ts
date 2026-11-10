"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function openNotificationAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Vui lòng đăng nhập để xem thông báo.");
  }

  const notificationId = formData.get("notificationId");
  if (typeof notificationId !== "string" || notificationId.length === 0) {
    throw new Error("Không tìm thấy thông báo.");
  }

  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId: session.user.id },
    select: { id: true, href: true },
  });
  if (!notification) {
    throw new Error("Không tìm thấy thông báo của tài khoản này.");
  }

  const destination = notification.href.trim();
  if (!destination.startsWith("/")) {
    throw new Error("Thông báo này không còn hợp lệ để mở.");
  }

  await prisma.notification.updateMany({
    where: { id: notification.id, userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  redirect(destination);
}
