import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center p-8">
      <h1 className="text-4xl font-bold">Mickleham Kebab & Grill</h1>
      <p className="mt-4 text-lg text-gray-600">
        Fresh kebabs and grills, made your way.
      </p>
      <a
        href="/menu"
        className="mt-8 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold"
      >
        Order Now
      </a>
    </main>
  );
}
