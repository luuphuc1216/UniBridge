"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { openNotificationAction } from "@/app/business/notifications/actions";

export type BusinessNotification = {
  id: string;
  title: string;
  message: string;
  href: string;
  readAt: Date | null;
  createdAt: Date;
};

export function NotificationBell({
  notifications,
  variant = "default",
}: {
  notifications: BusinessNotification[];
  variant?: "default" | "business";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(({ readAt }) => readAt === null).length;
  const isBusinessVariant = variant === "business";

  return (
    <div
      className="relative"
      onKeyDown={
        isBusinessVariant
          ? (event) => {
              if (event.key === "Escape" && isOpen) {
                setIsOpen(false);
                event.currentTarget.querySelector("button")?.focus();
              }
            }
          : undefined
      }
    >
      <button
        aria-expanded={isOpen}
        aria-controls={isBusinessVariant ? "business-notifications" : undefined}
        aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ""}`}
        className={
          isBusinessVariant
            ? "relative grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            : "relative grid size-10 place-items-center rounded-lg border border-border bg-card hover:bg-muted"
        }
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <Bell aria-hidden="true" className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <section
          aria-label="Danh sách thông báo"
          className={
            isBusinessVariant
              ? "absolute right-0 top-14 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-3 shadow-lg"
              : "absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-3 shadow-xl"
          }
          id={isBusinessVariant ? "business-notifications" : undefined}
          role={isBusinessVariant ? "region" : undefined}
        >
          <h2
            className={
              isBusinessVariant
                ? "px-2 py-2 text-sm font-semibold text-foreground"
                : "px-2 py-1 text-sm font-semibold"
            }
          >
            Thông báo
          </h2>
          {notifications.length === 0 ? (
            <p
              className={
                isBusinessVariant
                  ? "px-2 py-5 text-sm text-muted-foreground"
                  : "px-2 py-4 text-sm text-muted-foreground"
              }
            >
              Bạn chưa có thông báo nào.
            </p>
          ) : (
            <ul
              className={
                isBusinessVariant
                  ? "max-h-[min(24rem,calc(100dvh-8rem))] space-y-1 overflow-y-auto"
                  : "mt-1 max-h-96 space-y-1 overflow-y-auto"
              }
            >
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <form action={openNotificationAction}>
                    <input
                      name="notificationId"
                      type="hidden"
                      value={notification.id}
                    />
                    <button
                      className={
                        isBusinessVariant
                          ? `w-full rounded-xl p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none ${
                              notification.readAt === null ? "bg-primary/5" : "bg-transparent"
                            }`
                          : `w-full rounded-lg p-3 text-left hover:bg-muted ${
                              notification.readAt === null ? "bg-primary/5" : ""
                            }`
                      }
                      type="submit"
                    >
                      <span className="flex items-start gap-2">
                        {notification.readAt === null && (
                          <span
                            aria-label="Chưa đọc"
                            className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                          />
                        )}
                        <span className="min-w-0">
                          <span
                            className={
                              isBusinessVariant
                                ? `block break-words text-sm ${
                                    notification.readAt === null
                                      ? "font-semibold text-foreground"
                                      : "font-medium text-muted-foreground"
                                  }`
                                : "block text-sm font-semibold"
                            }
                          >
                            {notification.title}
                          </span>
                          <span
                            className={
                              isBusinessVariant
                                ? "mt-1 block break-words text-xs leading-5 text-muted-foreground"
                                : "mt-1 block text-xs leading-5 text-muted-foreground"
                            }
                          >
                            {notification.message}
                          </span>
                          <span className="mt-1 block text-[11px] text-muted-foreground">
                            {new Intl.DateTimeFormat("vi-VN", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(notification.createdAt)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
