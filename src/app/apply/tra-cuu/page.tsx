import { TrackForm } from "./track-form";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function TrackPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold">Tra cứu hồ sơ tuyển sinh</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nhập mã tra cứu nhận được sau khi nộp hồ sơ (dạng TSXXXXXX)
        </p>
      </header>
      <TrackForm />
    </main>
  );
}
