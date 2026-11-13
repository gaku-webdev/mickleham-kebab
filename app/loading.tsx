import Loader from "@/components/Loader";

export default function Loading() {
  return (
    <main className="flex min-h-[70vh] flex-1 items-center justify-center bg-[#FAF7F2] px-4 text-[#1C1917]">
      <Loader label="Loading page..." />
    </main>
  );
}
