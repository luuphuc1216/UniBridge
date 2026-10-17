"use client";

import { useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload, X } from "lucide-react";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_COUNT,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENT_TOTAL_BYTES,
} from "@/lib/business-attachments/config";
import { validateSelectedAttachments } from "@/lib/business-attachments/client-validation";

type FilePickerProps = {
  name: string;
  label?: string;
  limits?: {
    count: number;
    fileSizeBytes: number;
    totalBytes: number;
  };
  existingCount?: number;
  existingBytes?: number;
  onFilesChange?: () => void;
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function setInputFiles(input: HTMLInputElement, files: File[]) {
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
}

export function FilePicker({
  name,
  label = "Tệp đính kèm",
  limits = {
    count: MAX_ATTACHMENT_COUNT,
    fileSizeBytes: MAX_ATTACHMENT_SIZE_BYTES,
    totalBytes: MAX_ATTACHMENT_TOTAL_BYTES,
  },
  existingCount = 0,
  existingBytes = 0,
  onFilesChange,
}: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const errorId = useId();
  const allowedFormats = ALLOWED_ATTACHMENT_EXTENSIONS.map(
    (extension) => ALLOWED_ATTACHMENT_TYPES[extension as keyof typeof ALLOWED_ATTACHMENT_TYPES].label,
  ).join(", ");
  const remainingCount = Math.max(0, limits.count - existingCount);
  const totalSelectedBytes = files.reduce((total, file) => total + file.size, 0);

  function addFiles(incomingFiles: File[]) {
    const nextFiles = [...files, ...incomingFiles];
    const validationError = validateSelectedAttachments(
      nextFiles,
      existingCount,
      existingBytes,
      limits,
    );
    if (validationError) {
      setError(validationError);
      if (inputRef.current) setInputFiles(inputRef.current, files);
      return;
    }
    setFiles(nextFiles);
    setError(null);
    if (inputRef.current) setInputFiles(inputRef.current, nextFiles);
    onFilesChange?.();
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.currentTarget.files ?? []));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  function removeFile(index: number) {
    const nextFiles = files.filter((_, fileIndex) => fileIndex !== index);
    setFiles(nextFiles);
    setError(null);
    if (inputRef.current) setInputFiles(inputRef.current, nextFiles);
    onFilesChange?.();
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <div
        className={`relative rounded-xl border-2 border-dashed p-5 text-center transition sm:p-7 ${
          isDragging
            ? "border-primary bg-primary/10"
            : "border-border bg-muted/20 hover:border-primary/70 hover:bg-primary/5"
        } focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsDragging(false);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          accept={ALLOWED_ATTACHMENT_EXTENSIONS.join(",")}
          aria-describedby={error ? errorId : undefined}
          aria-label={label}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          multiple
          name={name}
          onChange={handleInputChange}
          ref={inputRef}
          type="file"
        />
        <Upload aria-hidden="true" className="mx-auto h-8 w-8 text-primary" />
        <p className="mt-2 font-semibold">Bấm để chọn tệp hoặc kéo thả vào đây</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Định dạng: {allowedFormats}. Tối đa {remainingCount} tệp, mỗi tệp{" "}
          {formatSize(limits.fileSizeBytes)}, tổng dung lượng{" "}
          {formatSize(limits.totalBytes - existingBytes)}.
        </p>
      </div>

      {files.length > 0 && (
        <ul aria-label="Danh sách tệp đã chọn" className="mt-3 space-y-2">
          {files.map((file, index) => (
            <li
              className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
            >
              <span className="min-w-0">
                <span className="block break-all font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
              </span>
              <button
                aria-label={`Xóa tệp ${file.name}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => removeFile(index)}
                type="button"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                Xóa
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-2 text-sm text-destructive" id={errorId} role="alert">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Đã chọn {files.length} tệp · {formatSize(totalSelectedBytes)}
        </p>
      )}
    </div>
  );
}
