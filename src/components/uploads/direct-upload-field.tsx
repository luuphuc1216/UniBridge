"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";
import {
  discardPendingUploads,
  uploadFilesDirectly,
} from "@/lib/storage/direct-upload";
import type { UploadScope } from "@/lib/storage/upload-grants";

type DirectUploadFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "name" | "onChange" | "type"
> & {
  name: string;
  scope: UploadScope;
  onUploadStateChange?: (uploading: boolean) => void;
  onUploadComplete?: (fileNames: string[]) => void;
  resetSignal?: number;
  allowRemove?: boolean;
};

export function DirectUploadField({
  resetSignal,
  onUploadComplete,
  ...props
}: DirectUploadFieldProps) {
  const previousResetSignal = useRef(resetSignal);
  useEffect(() => {
    if (previousResetSignal.current === resetSignal) return;
    previousResetSignal.current = resetSignal;
    onUploadComplete?.([]);
  }, [onUploadComplete, resetSignal]);

  return (
    <DirectUploadFieldInstance
      key={`${props.name}:${resetSignal ?? 0}`}
      {...props}
      onUploadComplete={onUploadComplete}
    />
  );
}

function DirectUploadFieldInstance({
  name,
  scope,
  onUploadStateChange,
  onUploadComplete,
  allowRemove = false,
  ...inputProps
}: Omit<DirectUploadFieldProps, "resetSignal">) {
  const [tokens, setTokens] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; size: number }[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const tokensRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      void discardPendingUploads(tokensRef.current);
    };
  }, []);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const handleSubmit = (event: Event) => {
      if (uploadingRef.current) {
        event.preventDefault();
        return;
      }
    };
    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, []);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) return;
    const allFiles = [...selectedFiles, ...files];
    const maxCount =
      scope.kind === "business-logo" || scope.kind === "portfolio" ? 1 : 3;
    if (allFiles.length > maxCount) {
      setError(`Chỉ được tải lên tối đa ${maxCount} tệp.`);
      return;
    }
    if (allFiles.some((file) => file.size > 20 * 1024 * 1024)) {
      setError("Mỗi tệp không được vượt quá 20 MB.");
      return;
    }
    if (allFiles.reduce((sum, file) => sum + file.size, 0) > 60 * 1024 * 1024) {
      setError("Tổng dung lượng tài liệu vượt quá 60 MB.");
      return;
    }
    setUploading(true);
    uploadingRef.current = true;
    onUploadStateChange?.(true);
    setError("");
    setStatus("");
    try {
      const newTokens = await uploadFilesDirectly(files, scope);
      tokensRef.current = [...tokensRef.current, ...newTokens];
      setTokens((current) => [...current, ...newTokens]);
      setSelectedFiles(allFiles);
      onUploadComplete?.(files.map(({ name: fileName }) => fileName));
      setStatus(
        files.length === 1
          ? `Đã tải lên ${files[0]?.name ?? "tệp"}.`
          : `Đã tải lên ${files.length} tệp.`,
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Không thể tải tệp lên. Vui lòng thử lại.",
      );
    } finally {
      setUploading(false);
      uploadingRef.current = false;
      onUploadStateChange?.(false);
    }
  }

  function removeFile(index: number) {
    const token = tokens[index];
    if (token) void discardPendingUploads([token]);
    const nextTokens = tokens.filter((_, fileIndex) => fileIndex !== index);
    tokensRef.current = nextTokens;
    const nextFiles = selectedFiles.filter((_, fileIndex) => fileIndex !== index);
    setTokens(nextTokens);
    setSelectedFiles(nextFiles);
    onUploadComplete?.(nextFiles.map(({ name }) => name));
  }

  return (
    <>
      <input
        {...inputProps}
        disabled={uploading || inputProps.disabled}
        onChange={handleChange}
        ref={inputRef}
        type="file"
      />
      <input
        name={`${name}UploadTokens`}
        type="hidden"
        value={JSON.stringify(tokens)}
      />
      {allowRemove && selectedFiles.length > 0 && (
        <ul className="space-y-1 text-xs font-normal">
          {selectedFiles.map((file, index) => (
            <li className="flex items-center justify-between gap-2" key={`${file.name}-${index}`}>
              <span className="break-all">{file.name}</span>
              <button
                className="shrink-0 text-destructive underline"
                onClick={() => removeFile(index)}
                type="button"
              >
                Bỏ
              </button>
            </li>
          ))}
        </ul>
      )}
      <span aria-live="polite" className="text-sm" role={error ? "alert" : "status"}>
        {error || (uploading ? "Đang tải tệp..." : status)}
      </span>
    </>
  );
}
