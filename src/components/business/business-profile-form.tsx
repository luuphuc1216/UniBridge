"use client";

import {
  useEffect,
  useActionState,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  Building2,
  CheckCircle2,
  Globe2,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import {
  saveBusinessProfileAction,
  type BusinessProfileActionState,
} from "@/app/business/profile/actions";
import { BusinessLogo } from "@/components/business/business-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Profile = {
  companyName: string;
  industry: string;
  industries: string;
  logo: string | null;
  website: string | null;
  description: string;
  address: string;
  contactEmail: string | null;
  phone: string | null;
  representative: string;
};

type TextFieldName =
  | "companyName"
  | "industry"
  | "industries"
  | "logo"
  | "website"
  | "address"
  | "contactEmail"
  | "phone"
  | "representative"
  | "description";

type TextField = {
  name: Exclude<TextFieldName, "description">;
  label: string;
  required?: boolean;
  placeholder?: string;
  helper?: string;
};

const businessFields: TextField[] = [
  {
    name: "companyName",
    label: "Tên doanh nghiệp",
    required: true,
    placeholder: "Ví dụ: Công ty Cổ phần ABC",
  },
  {
    name: "industry",
    label: "Lĩnh vực hoạt động",
    required: true,
    placeholder: "Ví dụ: Công nghệ giáo dục",
  },
  {
    name: "industries",
    label: "Các lĩnh vực bổ sung",
    placeholder: "Phân cách các lĩnh vực bằng dấu phẩy",
    helper: "Có thể để trống nếu doanh nghiệp chỉ hoạt động trong một lĩnh vực.",
  },
  {
    name: "address",
    label: "Địa chỉ",
    placeholder: "Địa chỉ trụ sở hoặc văn phòng",
  },
];

const contactFields: TextField[] = [
  {
    name: "contactEmail",
    label: "Email liên hệ",
    placeholder: "ten@doanhnghiep.vn",
  },
  {
    name: "phone",
    label: "Số điện thoại",
    placeholder: "Số điện thoại liên hệ",
  },
  {
    name: "representative",
    label: "Người đại diện",
    placeholder: "Họ và tên",
  },
  {
    name: "website",
    label: "Website",
    placeholder: "https://doanhnghiep.vn",
    helper: "Nhập địa chỉ website bắt đầu bằng http:// hoặc https://.",
  },
];

function isInternalLogo(logo: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(logo);
}

export function BusinessProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<
    BusinessProfileActionState,
    FormData
  >(saveBusinessProfileAction, { error: null, success: null });
  const [values, setValues] = useState<Record<TextFieldName, string>>({
    companyName: profile.companyName,
    industry: profile.industry,
    industries: profile.industries,
    logo: "",
    website: profile.website ?? "",
    address: profile.address,
    contactEmail: profile.contactEmail ?? "",
    phone: profile.phone ?? "",
    representative: profile.representative,
    description: profile.description,
  });
  const [removeLogo, setRemoveLogo] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const syncFileSelection = window.setTimeout(() => {
      setSelectedFileName(
        logoFileInputRef.current?.files?.[0]?.name ?? "",
      );
    }, 0);

    return () => window.clearTimeout(syncFileSelection);
  }, [state]);

  function updateTextField(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.currentTarget;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function updateLogoFile(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFileName(event.currentTarget.files?.[0]?.name ?? "");
  }

  function clearLogoFile() {
    if (logoFileInputRef.current) logoFileInputRef.current.value = "";
    setSelectedFileName("");
  }

  function renderTextField({ name, label, required, placeholder, helper }: TextField) {
    return (
      <div className="space-y-2" key={name}>
        <label className="block text-sm font-semibold text-foreground" htmlFor={name}>
          {label}
          {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
        </label>
        <Input
          autoComplete={name === "contactEmail" ? "email" : undefined}
          disabled={name === "logo" ? removeLogo : undefined}
          id={name}
          name={name}
          onChange={updateTextField}
          placeholder={placeholder}
          required={required}
          value={values[name]}
          className="h-12 text-base"
        />
        {helper && <p className="text-sm leading-5 text-muted-foreground">{helper}</p>}
      </div>
    );
  }

  const currentLogoIsInternal = profile.logo
    ? isInternalLogo(profile.logo)
    : false;

  return (
    <form action={action} className="mt-8 space-y-5 sm:space-y-6">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-base sm:text-lg">Thông tin doanh nghiệp</CardTitle>
            <CardDescription>
              Giới thiệu tên gọi, lĩnh vực hoạt động và địa chỉ của doanh nghiệp.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-x-5 gap-y-5 sm:grid-cols-2 sm:p-6 sm:pt-0">
          {businessFields.map(renderTextField)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UserRound aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-base sm:text-lg">Thông tin liên hệ</CardTitle>
            <CardDescription>
              Thông tin liên hệ được sử dụng theo quyền truy cập hiện hành của nền tảng.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-x-5 gap-y-5 sm:grid-cols-2 sm:p-6 sm:pt-0">
          {contactFields.map(renderTextField)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ImagePlus aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-base sm:text-lg">Nhận diện thương hiệu</CardTitle>
            <CardDescription>
              Giữ logo hiện tại nếu bạn không chọn thay đổi. Có thể dùng URL HTTPS hoặc tải
              tệp PNG/JPG mới.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 sm:p-6 sm:pt-0">
          <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background">
              {profile.logo ? (
                <BusinessLogo
                  alt={`Logo ${profile.companyName}`}
                  src={profile.logo}
                />
              ) : (
                <Building2
                  aria-hidden="true"
                  className="h-8 w-8 text-muted-foreground"
                />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-semibold text-foreground">
                {profile.logo ? "Logo hiện tại" : "Chưa có logo"}
              </p>
              {profile.logo ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {currentLogoIsInternal ? "Đã tải lên" : "Logo từ URL"}
                  </Badge>
                  <span className="break-all text-sm text-muted-foreground">
                    {currentLogoIsInternal
                      ? "Tệp được lưu trên UniBridge"
                      : profile.logo}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tải logo lên hoặc nhập URL để bổ sung nhận diện cho hồ sơ.
                </p>
              )}
            </div>
            {profile.logo && (
              <label
                className={`flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-primary/20 ${
                  removeLogo
                    ? "border-destructive/40 bg-destructive/5 text-destructive"
                    : "border-border bg-background text-foreground hover:bg-muted/50"
                }`}
              >
                <Checkbox
                  checked={removeLogo}
                  disabled={Boolean(selectedFileName || values.logo)}
                  name="removeLogo"
                  onChange={(event) => setRemoveLogo(event.currentTarget.checked)}
                  value="true"
                  aria-label="Xóa logo hiện tại"
                />
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Xóa logo
              </label>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground" htmlFor="logo">
                URL logo mới
              </label>
              <div className="relative">
                <Globe2
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  disabled={removeLogo || Boolean(selectedFileName)}
                  id="logo"
                  name="logo"
                  onChange={updateTextField}
                  placeholder="https://doanhnghiep.vn/logo.png"
                  value={values.logo}
                  className="h-12 pl-10 text-base"
                />
              </div>
              <p className="text-sm leading-5 text-muted-foreground">
                Chỉ dùng HTTPS. Để trống để giữ nguyên logo hiện tại.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground" htmlFor="logoFile">
                Tải logo mới
              </label>
              <div className="relative">
                <Input
                  accept="image/png,image/jpeg"
                  className="h-12 cursor-pointer py-2.5 pr-2 text-base file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary"
                  disabled={removeLogo || Boolean(values.logo)}
                  id="logoFile"
                  name="logoFile"
                  onChange={updateLogoFile}
                  ref={logoFileInputRef}
                  type="file"
                  aria-describedby="logoFile-help"
                />
              </div>
              <div
                aria-live="polite"
                className="flex min-h-5 items-center gap-2 text-sm"
                id="logoFile-help"
              >
                {selectedFileName ? (
                  <>
                    <Upload aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate font-medium text-foreground">
                      {selectedFileName}
                    </span>
                    <Button
                      className="ml-auto shrink-0"
                      onClick={clearLogoFile}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                      Bỏ tệp
                    </Button>
                  </>
                ) : (
                  <span className="text-muted-foreground">Chấp nhận ảnh PNG hoặc JPG.</span>
                )}
              </div>
            </div>
          </div>

          {removeLogo && (
            <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Logo sẽ được xóa khi bạn lưu thay đổi.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MapPin aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-base sm:text-lg">Giới thiệu doanh nghiệp</CardTitle>
            <CardDescription>
              Chia sẻ ngắn gọn về hoạt động, thế mạnh và những lĩnh vực doanh nghiệp quan tâm.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 sm:p-6 sm:pt-0">
          <label
            className="block text-sm font-semibold text-foreground"
            htmlFor="description"
          >
            Mô tả doanh nghiệp
          </label>
          <Textarea
            id="description"
            name="description"
            onChange={updateTextField}
            placeholder="Giới thiệu về doanh nghiệp, sản phẩm hoặc dịch vụ, kinh nghiệm và định hướng hợp tác..."
            value={values.description}
            className="min-h-40 resize-y text-base leading-7"
          />
          <p className="text-sm leading-5 text-muted-foreground">
            Nội dung rõ ràng, dễ hiểu sẽ giúp sinh viên nắm bắt tốt hơn về doanh nghiệp.
          </p>
        </CardContent>
      </Card>

      {state.error && (
        <div
          className="flex flex-col gap-1 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive sm:flex-row sm:gap-3"
          role="alert"
        >
          <span className="font-semibold">Chưa thể lưu hồ sơ.</span>
          <span>{state.error}</span>
          {selectedFileName && (
            <span className="sr-only">
              Hãy chọn lại tệp logo nếu trường tải tệp đã được làm mới.
            </span>
          )}
        </div>
      )}
      {state.success && (
        <div
          className="flex items-start gap-3 rounded-xl border border-success/20 bg-success/5 p-4 text-sm text-foreground"
          role="status"
        >
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-success"
          />
          <span>{state.success}</span>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
        <a
          className={buttonVariants({ variant: "outline", size: "lg" })}
          href="/business/profile"
        >
          Hủy
        </a>
        <Button
          className="w-full sm:w-auto"
          disabled={pending}
          size="lg"
          type="submit"
          aria-busy={pending}
        >
          {pending ? (
            <>
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              Đang lưu hồ sơ...
            </>
          ) : (
            "Lưu thay đổi"
          )}
        </Button>
      </div>
    </form>
  );
}
