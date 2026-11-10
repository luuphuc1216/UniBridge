"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { FileText, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_COUNT,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENT_TOTAL_BYTES,
} from "@/lib/business-attachments/config";
import { validateSelectedAttachments } from "@/lib/business-attachments/client-validation";
import {
  discardPendingUploads,
  uploadFilesDirectly,
} from "@/lib/storage/direct-upload";
import type { UploadScope } from "@/lib/storage/upload-grants";

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
  onUploadStateChange?: (uploading: boolean) => void;
  presentation?: "default" | "business-problem";
  scope: UploadScope;
  resetSignal?: number;
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
  resetSignal,
  ...props
}: FilePickerProps) {
  return (
    <FilePickerInstance
      key={`${props.name}:${resetSignal ?? 0}`}
      {...props}
    />
  );
}

function FilePickerInstance({
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
  onUploadStateChange,
  presentation = "default",
  scope,
}: Omit<FilePickerProps, "resetSignal">) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTokens, setUploadTokens] = useState<string[]>([]);
  const uploadTokensRef = useRef<string[]>([]);
  const isUploadingRef = useRef(false);
  const errorId = useId();
  const allowedFormats = ALLOWED_ATTACHMENT_EXTENSIONS.map(
    (extension) => ALLOWED_ATTACHMENT_TYPES[extension as keyof typeof ALLOWED_ATTACHMENT_TYPES].label,
  ).join(", ");
  const isBusinessProblemPresentation = presentation === "business-problem";
  const totalSelectedBytes = files.reduce((total, file) => total + file.size, 0);
  const remainingCount = Math.max(0, limits.count - existingCount);
  const availableCount = Math.max(
    0,
    limits.count - existingCount - files.length,
  );
  const remainingBytes = Math.max(
    0,
    limits.totalBytes - existingBytes - totalSelectedBytes,
  );
  const remainingSizeLabel =
    remainingBytes === 0 ? "0 MB" : formatSize(remainingBytes);

  useEffect(() => {
    return () => {
      void discardPendingUploads(uploadTokensRef.current);
    };
  }, []);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const handleSubmit = (event: Event) => {
      if (isUploadingRef.current) {
        event.preventDefault();
        return;
      }
    };
    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, []);

  async function addFiles(incomingFiles: File[]) {
    if (isUploading || incomingFiles.length === 0) return;
    const nextFiles = [...files, ...incomingFiles];
    const validationError = validateSelectedAttachments(
      nextFiles,
      existingCount,
      existingBytes,
      limits,
    );
    if (validationError) {
      setError(validationError);
      if (inputRef.current) setInputFiles(inputRef.current, []);
      return;
    }
    setError(null);
    setIsUploading(true);
    isUploadingRef.current = true;
    onUploadStateChange?.(true);
    try {
      const newTokens = await uploadFilesDirectly(incomingFiles, scope);
      setFiles(nextFiles);
      uploadTokensRef.current = [...uploadTokensRef.current, ...newTokens];
      setUploadTokens((current) => [...current, ...newTokens]);
      if (inputRef.current) setInputFiles(inputRef.current, []);
      onFilesChange?.();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Không thể tải tệp lên. Vui lòng thử lại.",
      );
      if (inputRef.current) setInputFiles(inputRef.current, []);
    } finally {
      setIsUploading(false);
      isUploadingRef.current = false;
      onUploadStateChange?.(false);
    }
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
    const removedToken = uploadTokens[index];
    if (removedToken) void discardPendingUploads([removedToken]);
    const nextTokens = uploadTokens.filter((_, fileIndex) => fileIndex !== index);
    uploadTokensRef.current = nextTokens;
    setUploadTokens(nextTokens);
    setFiles(nextFiles);
    setError(null);
    if (inputRef.current) setInputFiles(inputRef.current, []);
    onFilesChange?.();
  }

  return (
    <div>
      {!isBusinessProblemPresentation && (
        <span className="mb-1.5 block text-sm font-medium">{label}</span>
      )}
      <div
        className={`relative rounded-xl border-2 border-dashed p-5 text-center transition ${
          isBusinessProblemPresentation
            ? "min-h-48 motion-reduce:transition-none sm:min-h-52"
            : ""
        } ${
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
          disabled={isUploading}
          onChange={handleInputChange}
          ref={inputRef}
          type="file"
        />
        <Upload aria-hidden="true" className="mx-auto h-8 w-8 text-primary" />
        {isBusinessProblemPresentation ? (
          <>
            <p className="mt-3 font-semibold">{label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Chọn tệp từ thiết bị hoặc kéo thả vào khu vực này.
            </p>
            <span className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm">
              Chọn tệp
            </span>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Hỗ trợ: {allowedFormats}.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Tối đa {limits.count} tệp ({availableCount} vị trí còn lại), mỗi tệp{" "}
              {formatSize(limits.fileSizeBytes)}, tổng {formatSize(limits.totalBytes)}{" "}
              ({remainingSizeLabel} còn trống).
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 font-semibold">Bấm để chọn tệp hoặc kéo thả vào đây</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Định dạng: {allowedFormats}. Tối đa {remainingCount} tệp, mỗi tệp{" "}
              {formatSize(limits.fileSizeBytes)}, tổng dung lượng{" "}
              {formatSize(Math.max(0, limits.totalBytes - existingBytes))}.
            </p>
          </>
        )}
      </div>

        {isBusinessProblemPresentation && files.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Chưa có tệp mới nào được chọn.
          </p>
        )}

        {files.length > 0 && (
          <ul
            aria-label={
              isBusinessProblemPresentation
                ? "Danh sách tệp mới đã chọn"
                : "Danh sách tệp đã chọn"
            }
            className="mt-3 space-y-2"
          >
            {files.map((file, index) => (
              <li
                className={
                  isBusinessProblemPresentation
                    ? "flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3 text-sm shadow-sm"
                    : "flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
                }
                key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              >
                {isBusinessProblemPresentation ? (
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="mt-0.5 shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
                      <FileText aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-all font-medium">{file.name}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatSize(file.size)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{file.name.split(".").pop()?.toUpperCase()}</span>
                        <Badge
                          className="motion-reduce:transition-none"
                          variant="secondary"
                        >
                          Tệp mới
                        </Badge>
                      </span>
                    </span>
                  </div>
                ) : (
                  <span className="min-w-0">
                    <span className="block break-all font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
                  </span>
                )}
                <button
                  aria-label={`Xóa tệp ${file.name}`}
                  className={
                    isBusinessProblemPresentation
                      ? "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none"
                      : "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  }
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
        {isUploading && (
          <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">
            Đang tải tệp trực tiếp lên kho lưu trữ...
          </p>
        )}

      <input
        name={`${name}UploadTokens`}
        type="hidden"
        value={JSON.stringify(uploadTokens)}
      />
      {error && (
        <p
          className={
            isBusinessProblemPresentation
              ? "mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              : "mt-2 text-sm text-destructive"
          }
          id={errorId}
          role="alert"
        >
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
