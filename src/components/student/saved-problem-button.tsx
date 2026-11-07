"use client";

import { createContext, useActionState, useContext, type ReactNode } from "react";
import { Bookmark, BookmarkCheck, LoaderCircle } from "lucide-react";
import {
  toggleSavedProblemAction,
  type SavedProblemActionState,
} from "@/app/student/problems/actions";
import { Button } from "@/components/ui/button";

type SavedProblemFormAction = (formData: FormData) => void;

type SavedProblemsFeedbackContextValue = {
  action: SavedProblemFormAction;
  isPending: boolean;
};

const SavedProblemsFeedbackContext =
  createContext<SavedProblemsFeedbackContextValue | null>(null);

export function SavedProblemsFeedbackProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, action, isPending] = useActionState<
    SavedProblemActionState,
    FormData
  >(toggleSavedProblemAction, { error: null, message: null });

  return (
    <SavedProblemsFeedbackContext.Provider value={{ action, isPending }}>
      {children}
      {!isPending && state.error && (
        <p
          aria-live="assertive"
          className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}
      {!isPending && state.message && (
        <p
          aria-live="polite"
          className="mt-4 rounded-lg bg-success/10 px-3 py-2 text-sm text-success"
          role="status"
        >
          {state.message}
        </p>
      )}
    </SavedProblemsFeedbackContext.Provider>
  );
}

function SavedProblemSubmitButton({
  isSaved,
  pending,
}: {
  isSaved: boolean;
  pending: boolean;
}) {
  return (
    <Button
      aria-label={isSaved ? "Bỏ lưu bài toán" : "Lưu bài toán"}
      className="w-full motion-reduce:transition-none"
      disabled={pending}
      name="intent"
      type="submit"
      variant="outline"
      value={isSaved ? "remove" : "save"}
    >
      {pending ? (
        <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
      ) : isSaved ? (
        <BookmarkCheck aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Bookmark aria-hidden="true" className="h-4 w-4" />
      )}
      <span aria-live="polite">
        {pending ? (isSaved ? "Đang bỏ lưu..." : "Đang lưu...") : isSaved ? "Đã lưu · Bỏ lưu" : "Lưu bài toán"}
      </span>
    </Button>
  );
}

function StandaloneSavedProblemButton({
  problemId,
  isSaved,
}: {
  problemId: string;
  isSaved: boolean;
}) {
  const [state, formAction, isPending] = useActionState<
    SavedProblemActionState,
    FormData
  >(toggleSavedProblemAction, { error: null, message: null });

  return (
    <form action={formAction} className="space-y-2">
      <input name="problemId" type="hidden" value={problemId} />
      <SavedProblemSubmitButton isSaved={isSaved} pending={isPending} />
      {!isPending && state.error && (
        <p
          aria-live="assertive"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}
      {!isPending && state.message && (
        <p
          aria-live="polite"
          className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success"
          role="status"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

function SavedProblemsListButton({
  problemId,
  isSaved,
  action,
  isPending,
}: {
  problemId: string;
  isSaved: boolean;
  action: SavedProblemFormAction;
  isPending: boolean;
}) {
  return (
    <form action={action} className="space-y-2">
      <input name="problemId" type="hidden" value={problemId} />
      <SavedProblemSubmitButton isSaved={isSaved} pending={isPending} />
    </form>
  );
}

export function SavedProblemButton({
  problemId,
  isSaved,
}: {
  problemId: string;
  isSaved: boolean;
}) {
  const sharedFeedback = useContext(SavedProblemsFeedbackContext);

  if (sharedFeedback) {
    return (
      <SavedProblemsListButton
        action={sharedFeedback.action}
        isPending={sharedFeedback.isPending}
        isSaved={isSaved}
        problemId={problemId}
      />
    );
  }

  return <StandaloneSavedProblemButton isSaved={isSaved} problemId={problemId} />;
}
