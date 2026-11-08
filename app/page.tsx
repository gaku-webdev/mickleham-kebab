export default function Home() {
  return (
    <main className="min-h-screen bg-[#FAF7F2] px-4 py-16 text-center text-[#1C1917] sm:px-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#EBE6DD] bg-white px-6 py-16 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#EA580C]">
          Mickleham Kebab &amp; Grill
        </p>
        <h1 className="mt-4 text-4xl font-extrabold sm:text-5xl">Fresh kebabs and grills</h1>
        <p className="mt-4 text-lg text-gray-600">Made your way, ready when you are.</p>
      <a
        href="/menu"
        className="mt-8 inline-flex rounded-lg bg-[#C2410C] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#9A3412]"
      >
        Order Now
      </a>
      </div>
    </main>
  );
}
