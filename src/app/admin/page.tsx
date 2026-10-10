export default function AdminDashboard() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-primary">Khu vực quản trị</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Tổng quan</h1>
      <section className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
        <h2 className="text-lg font-semibold">Bảng điều khiển quản trị</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Dashboard đang sẵn sàng. Các hoạt động kiểm duyệt và quản lý sẽ hiển thị tại đây.
        </p>
      </section>
    </main>
  );
}
