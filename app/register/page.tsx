"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      const nameParam = params.get("name");
      const phoneParam = params.get("phone");
      if (emailParam) setEmail(emailParam.trim());
      if (nameParam) setFullName(nameParam.trim());
      if (phoneParam) {
        setPhone(phoneParam.replace("+61", "").trim());
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address (e.g. name@example.com).");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const formattedPhone = phone.trim().startsWith("+")
        ? phone.trim()
        : phone.trim()
        ? `+61 ${phone.trim()}`
        : "";

      const { error, user } = await signUp({
        email: cleanEmail,
        password,
        fullName: fullName.trim(),
        phone: formattedPhone,
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        // If email confirmation is required:
        if (user && !user.confirmed_at && user.identities?.length) {
          setSuccessNotice(
            "Account created! Please check your email inbox to confirm your address before signing in."
          );
        } else {
          router.push("/orders");
          router.refresh();
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred during registration.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 min-h-[calc(100vh-73px)] bg-[#FAF7F2] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-[#EBE6DD] p-7 sm:p-9">
        {/* Brand Icon */}
        <div className="w-12 h-12 rounded-xl bg-[#FDEEE7] flex items-center justify-center mx-auto mb-4 text-[#EA580C]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6"
          >
            <path
              fillRule="evenodd"
              d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.177 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-extrabold text-center text-[#1C1917]">
          Create an Account
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-center text-gray-500">
          Track orders, save favorite kebab items &amp; manage bookings easily.
        </p>

        {errorMessage && (
          <div className="mt-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successNotice ? (
          <div className="mt-5 p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              ✓
            </div>
            <h3 className="text-sm font-bold text-emerald-900">
              Registration Successful!
            </h3>
            <p className="text-xs text-emerald-700">{successNotice}</p>
            <Link
              href="/login"
              className="inline-block mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
            >
              Go to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="regName"
                className="block text-xs font-semibold text-gray-700 mb-1.5"
              >
                Full Name
              </label>
              <input
                id="regName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#FAF7F2] border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="regEmail"
                className="block text-xs font-semibold text-gray-700 mb-1.5"
              >
                Email Address
              </label>
              <input
                id="regEmail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#FAF7F2] border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="regPhone"
                className="block text-xs font-semibold text-gray-700 mb-1.5"
              >
                Mobile Number
              </label>
              <div className="flex items-center rounded-xl bg-[#FAF7F2] border border-gray-200 focus-within:ring-2 focus-within:ring-[#EA580C]/20 focus-within:border-[#EA580C] focus-within:bg-white overflow-hidden transition-all">
                <div className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-50 border-r border-gray-200 text-xs font-semibold text-gray-700 select-none">
                  <span className="text-[10px] bg-[#002B7F] text-white font-black px-1.5 py-0.5 rounded-xs leading-none tracking-wider">
                    AU
                  </span>
                  <span>+61</span>
                </div>
                <input
                  id="regPhone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0400 000 000"
                  className="flex-1 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none bg-transparent"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="regPassword"
                className="block text-xs font-semibold text-gray-700 mb-1.5"
              >
                Password (min. 6 characters)
              </label>
              <input
                id="regPassword"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#FAF7F2] border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="regConfirmPassword"
                className="block text-xs font-semibold text-gray-700 mb-1.5"
              >
                Confirm Password
              </label>
              <input
                id="regConfirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#FAF7F2] border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] focus:bg-white transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl font-bold text-sm tracking-wide transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-gray-600">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-bold text-[#EA580C] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

