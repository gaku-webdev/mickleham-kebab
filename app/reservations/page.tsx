"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  formatDateOnly,
  formatClockTime,
  formatMelbourneDateTime,
  getMelbourneDateParts,
  toDateInputValue,
} from "@/lib/date-time";

interface Reservation {
  id: string;
  user_id?: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  special_requests?: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
}

// Evening times from 5:30 PM (Task 10.4)
const EVENING_TIMES = [
  { value: "17:30:00", label: "05:30 pm" },
  { value: "18:00:00", label: "06:00 pm" },
  { value: "18:30:00", label: "06:30 pm" },
  { value: "19:00:00", label: "07:00 pm" },
  { value: "19:30:00", label: "07:30 pm" },
  { value: "20:00:00", label: "08:00 pm" },
  { value: "20:30:00", label: "08:30 pm" },
  { value: "21:00:00", label: "09:00 pm" },
  { value: "21:30:00", label: "09:30 pm" },
  { value: "22:00:00", label: "10:00 pm" },
  { value: "22:30:00", label: "10:30 pm" },
];

function formatDisplayDate(dateStr: string): string {
  return formatDateOnly(dateStr, {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime12(timeVal: string): string {
  return formatClockTime(timeVal);
}

export default function ReservationsManagePage() {
  const { user, loading: authLoading } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search state (Email or Phone ONLY)
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // Modify Modal state
  const [modifyingBooking, setModifyingBooking] = useState<Reservation | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editGuests, setEditGuests] = useState<number>(2);
  const [editRequests, setEditRequests] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [modifyError, setModifyError] = useState<string | null>(null);

  // Cancel Confirmation Modal state
  const [cancellingBooking, setCancellingBooking] = useState<Reservation | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Guest Security Prompt Modal state
  const [authPromptBooking, setAuthPromptBooking] = useState<Reservation | null>(null);

  // Fetch reservations dynamically (Strictly email or phone for guest lookups)
  const fetchReservations = useCallback(
    async (searchTerm?: string) => {
      setLoading(true);
      setErrorMessage(null);

      try {
        let query = supabase
          .from("reservations")
          .select("*")
          .order("reservation_date", { ascending: false });

        const clean = searchTerm?.trim();

        if (clean) {
          // Strictly Email or Phone ONLY — prevent searching by arbitrary names
          const isEmail = clean.includes("@");
          const digits = clean.replace(/\D/g, "");

          if (isEmail) {
            query = query.ilike("customer_email", `%${clean}%`);
          } else if (digits.length >= 6) {
            query = query.or(
              `customer_phone.ilike.%${digits}%,customer_phone.ilike.%+61 ${digits}%`
            );
          } else {
            setReservations([]);
            setErrorMessage(
              "Please enter a valid email address or phone number (at least 6 digits) to search."
            );
            setLoading(false);
            return;
          }
        } else if (user) {
          // Logged-in user view: ONLY fetch this user's bookings
          query = query.or(
            `user_id.eq.${user.id},customer_email.ilike.${user.email}`
          );

          // Automatically link unlinked reservations for this email to user_id
          if (user.email) {
            supabase
              .from("reservations")
              .update({ user_id: user.id })
              .eq("customer_email", user.email)
              .is("user_id", null)
              .then(() => {});
          }
        } else {
          // Guest without search: Never expose all reservations
          setReservations([]);
          setLoading(false);
          return;
        }

        const { data, error } = await query;

        if (error) {
          setErrorMessage(error.message);
        } else {
          setReservations(data || []);
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage("An unexpected error occurred while loading reservations.");
        }
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        fetchReservations();
      } else {
        // Guests start with a clean search prompt; do not auto-load database records
        setReservations([]);
        setLoading(false);
      }
    }
  }, [user, authLoading, fetchReservations]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      handleClearSearch();
      return;
    }
    setIsSearching(true);
    setSearched(true);
    await fetchReservations(searchQuery.trim());
    setIsSearching(false);
  };

  const handleClearSearch = async () => {
    setSearchQuery("");
    setSearched(false);
    if (user) {
      await fetchReservations();
    } else {
      setReservations([]);
      setLoading(false);
    }
  };

  // Check if current user is the verified owner of a booking
  const checkOwnership = (booking: Reservation): boolean => {
    if (!user) return false;
    if (booking.user_id && user.id === booking.user_id) return true;
    if (
      user.email &&
      booking.customer_email &&
      user.email.toLowerCase() === booking.customer_email.toLowerCase()
    ) {
      return true;
    }
    return false;
  };

  // Open Modify Modal (Only for verified account owner)
  const openModifyModal = (booking: Reservation) => {
    if (!checkOwnership(booking)) {
      setAuthPromptBooking(booking);
      return;
    }
    setModifyingBooking(booking);
    setEditDate(booking.reservation_date);
    setEditTime(booking.reservation_time);
    setEditGuests(booking.party_size);
    setEditRequests(booking.special_requests || "");
    setModifyError(null);
  };

  // Open Cancel Modal (Only for verified account owner)
  const openCancelModal = (booking: Reservation) => {
    if (!checkOwnership(booking)) {
      setAuthPromptBooking(booking);
      return;
    }
    setCancellingBooking(booking);
  };

  // Save Modifications to Supabase (Protected)
  const handleSaveModification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modifyingBooking) return;

    if (!checkOwnership(modifyingBooking)) {
      setModifyError(
        `Security verification required: You must be signed in with ${modifyingBooking.customer_email} to modify this reservation.`
      );
      return;
    }

    setModifyError(null);
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from("reservations")
        .update({
          reservation_date: editDate,
          reservation_time: editTime,
          party_size: editGuests,
          special_requests: editRequests.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", modifyingBooking.id);

      if (error) {
        setModifyError(error.message);
      } else {
        setSuccessMessage("Reservation updated successfully!");
        setModifyingBooking(null);
        setTimeout(() => setSuccessMessage(null), 4000);
        await fetchReservations(searched ? searchQuery : undefined);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setModifyError(err.message);
      } else {
        setModifyError("Failed to update reservation.");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // Cancel Booking (Protected)
  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;

    if (!checkOwnership(cancellingBooking)) {
      setErrorMessage(
        `Security verification required: You must be signed in with ${cancellingBooking.customer_email} to cancel this reservation.`
      );
      setCancellingBooking(null);
      return;
    }

    setIsCancelling(true);

    try {
      const { error } = await supabase
        .from("reservations")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", cancellingBooking.id);

      if (error) {
        setErrorMessage(error.message);
      } else {
        setSuccessMessage("Reservation has been cancelled.");
        setCancellingBooking(null);
        setTimeout(() => setSuccessMessage(null), 4000);
        await fetchReservations(searched ? searchQuery : undefined);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Failed to cancel reservation.");
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "pending").toLowerCase();
    if (s === "confirmed") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Confirmed
        </span>
      );
    }
    if (s === "cancelled") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Cancelled
        </span>
      );
    }
    if (s === "completed") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Completed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Pending Confirmation
      </span>
    );
  };

  const [todayStr, setTodayStr] = useState("");

  useEffect(() => {
    setTodayStr(toDateInputValue(getMelbourneDateParts()));
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917] flex flex-col font-sans">
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8">
        {/* Header Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 font-medium mb-1.5 transition-colors"
            >
              ← Back to Home
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C1917]">
              Manage Reservations
            </h1>
          </div>

          <Link
            href="/reservation"
            className="self-start sm:self-auto px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors"
          >
            + Book New Table
          </Link>
        </div>

        {/* Global Notifications */}
        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs sm:text-sm text-emerald-800 flex items-center justify-between animate-in fade-in">
            <span className="font-semibold">✓ {successMessage}</span>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-600 hover:text-emerald-800 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Search Bar (Email or Phone only) */}
        <div className="mb-8 p-5 bg-white rounded-2xl border border-[#EBE6DD] shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                {user ? "Your Bookings" : "Find Your Reservation"}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {user
                  ? `Showing reservations for ${user.email}. Enter a different email or phone to search.`
                  : "Search strictly by the email address or phone number used during table booking."}
              </p>
            </div>
            {!user && (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter email (e.g. ss@ff.com) or phone number (e.g. 0412 345 678)..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-300 bg-[#FAF7F2] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-700 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="px-5 py-2.5 bg-[#1C1917] hover:bg-black text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {isSearching ? "Searching..." : "Search"}
            </button>

            {searched && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </form>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mb-3" />
            <p className="text-xs text-gray-500 font-medium">Looking up reservations...</p>
          </div>
        )}

        {/* Guest Initial State (No search performed yet) */}
        {!loading && !searched && !user && reservations.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#EBE6DD] p-8 sm:p-12 text-center shadow-xs">
            <div className="w-14 h-14 bg-[#FDEEE7] text-[#EA580C] rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">
              🔍
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              Search for Your Reservation
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto mt-1 mb-6">
              Enter your booking <strong>email address</strong> or <strong>phone number</strong> above to view your table reservation details.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors"
              >
                Sign In to Your Account
              </Link>
              <Link
                href="/reservation"
                className="px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors"
              >
                Book a New Table
              </Link>
            </div>
          </div>
        )}

        {/* Empty state when searched or user has 0 bookings */}
        {!loading && (searched || user) && reservations.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#EBE6DD] p-8 sm:p-10 text-center shadow-xs">
            <div className="w-14 h-14 bg-orange-50 text-[#EA580C] rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">
              🍽️
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              No Bookings Found
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto mt-1 mb-6">
              {searched
                ? `No reservations found matching "${searchQuery}". Please verify your email or phone number.`
                : "You don't have any table reservations booked yet. Reserve a dining table for fresh kebabs and charcoal grills."}
            </p>
            <Link
              href="/reservation"
              className="px-5 py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors inline-block"
            >
              Book a Table Now
            </Link>
          </div>
        )}

        {/* Reservations List */}
        {!loading && reservations.length > 0 && (
          <div className="space-y-5">
            <div className="text-xs text-gray-500 px-1 flex items-center justify-between">
              <span>
                Found <strong>{reservations.length}</strong> {reservations.length === 1 ? "reservation" : "reservations"}
              </span>
              {!user && (
                <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-medium">
                  🔒 Guest View · Sign in required to modify or cancel
                </span>
              )}
            </div>

            {reservations.map((booking) => {
              const isCancelled = booking.status.toLowerCase() === "cancelled";
              const refId = `MK-${booking.id.replace(/-/g, "").substring(0, 6).toUpperCase()}`;
              const isOwner = checkOwnership(booking);

              return (
                <div
                  key={booking.id}
                  className={`bg-white rounded-2xl border ${
                    isCancelled ? "border-gray-200 opacity-75" : "border-[#EBE6DD]"
                  } shadow-xs overflow-hidden transition-all`}
                >
                  {/* Card Header */}
                  <div className="bg-[#FAF7F2] border-b border-[#EBE6DD] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs sm:text-sm font-bold text-[#C2410C]">
                        {refId}
                      </span>
                      {getStatusBadge(booking.status)}
                      {isOwner && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                          ✓ Verified Account Booking
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 font-medium">
                      Booked on {formatMelbourneDateTime(booking.created_at)}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-3 flex-1">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs text-gray-400 font-medium">Date</p>
                          <p className="text-sm font-bold text-gray-900 mt-0.5">
                            {formatDisplayDate(booking.reservation_date)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 font-medium">
                            Time · Melbourne
                          </p>
                          <p className="text-sm font-bold text-gray-900 mt-0.5">
                            {formatTime12(booking.reservation_time)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 font-medium">Party Size</p>
                          <p className="text-sm font-bold text-[#EA580C] mt-0.5">
                            {booking.party_size}{" "}
                            {booking.party_size === 1 ? "Guest" : "Guests"}
                          </p>
                        </div>
                      </div>

                      <div className="text-xs text-gray-600 space-y-0.5 pt-1 border-t border-gray-100">
                        <p>
                          <strong className="text-gray-800 font-semibold">
                            Guest Name:
                          </strong>{" "}
                          {booking.customer_name} ({booking.customer_phone})
                        </p>
                        <p>
                          <strong className="text-gray-800 font-semibold">
                            Email:
                          </strong>{" "}
                          {booking.customer_email}
                        </p>
                        {booking.special_requests && (
                          <p className="text-gray-600 italic mt-1">
                            <span className="font-semibold not-italic text-gray-700">
                              Special Requests:
                            </span>{" "}
                            &ldquo;{booking.special_requests}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons: Locked for guests, unlocked for verified account owner */}
                    {!isCancelled && (
                      <div className="flex sm:flex-col gap-2 shrink-0 self-end md:self-center">
                        {isOwner ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openModifyModal(booking)}
                              className="px-4 py-2 bg-white border border-gray-300 hover:border-orange-500 hover:text-orange-700 rounded-xl text-xs font-bold text-gray-700 transition-colors shadow-2xs cursor-pointer"
                            >
                              Modify Booking
                            </button>
                            <button
                              type="button"
                              onClick={() => openCancelModal(booking)}
                              className="px-4 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                            >
                              Cancel Booking
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setAuthPromptBooking(booking)}
                              className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                              title="Sign in with this reservation's email to modify"
                            >
                              <span>🔒</span> Sign in to Modify
                            </button>
                            <button
                              type="button"
                              onClick={() => setAuthPromptBooking(booking)}
                              className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                              title="Sign in with this reservation's email to cancel"
                            >
                              <span>🔒</span> Sign in to Cancel
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL: Guest Security Sign-In Prompt */}
      {authPromptBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-sm p-6 relative animate-in fade-in zoom-in-95 duration-150 text-center">
            <button
              type="button"
              onClick={() => setAuthPromptBooking(null)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3 text-xl">
              🔒
            </div>

            <h3 className="text-lg font-bold text-gray-900">
              Sign In Required
            </h3>

            <p className="text-xs text-gray-600 mt-2 mb-4 leading-relaxed">
              To protect this reservation from unauthorized changes or cancellations, you must be signed in with the reservation email:
              <br />
              <strong className="text-gray-900 font-bold mt-1 inline-block bg-gray-100 px-2 py-0.5 rounded text-xs">
                {authPromptBooking.customer_email}
              </strong>
            </p>

            <div className="space-y-2">
              <Link
                href={`/login?email=${encodeURIComponent(authPromptBooking.customer_email)}`}
                className="w-full py-2.5 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl font-bold text-xs sm:text-sm block transition-colors shadow-xs"
              >
                Sign In to Account
              </Link>
              <Link
                href={`/register?email=${encodeURIComponent(authPromptBooking.customer_email)}&name=${encodeURIComponent(authPromptBooking.customer_name)}&phone=${encodeURIComponent(authPromptBooking.customer_phone)}`}
                className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-semibold text-xs sm:text-sm block transition-colors"
              >
                Create Account with this Email
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Modify Booking (Requirement 10.5) */}
      {modifyingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setModifyingBooking(null)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            >
              ✕
            </button>

            <h2 className="text-xl font-extrabold text-[#1C1917] mb-1">
              Modify Reservation
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Update booking details for {modifyingBooking.customer_name} ({modifyingBooking.customer_email})
            </p>

            {modifyError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {modifyError}
              </div>
            )}

            <form onSubmit={handleSaveModification} className="space-y-4">
              {/* Date */}
              <div>
                <label
                  htmlFor="editDate"
                  className="block text-xs font-semibold text-gray-700 mb-1"
                >
                  Reservation Date
                </label>
                <input
                  id="editDate"
                  type="date"
                  required
                  min={todayStr}
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
                />
              </div>

              {/* Time (Evening slots) */}
              <div>
                <label
                  htmlFor="editTime"
                  className="block text-xs font-semibold text-gray-700 mb-1"
                >
                  Time Slot (Evening from 5:30 PM)
                </label>
                <select
                  id="editTime"
                  required
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
                >
                  {EVENING_TIMES.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Party Size */}
              <div>
                <label
                  htmlFor="editGuests"
                  className="block text-xs font-semibold text-gray-700 mb-1"
                >
                  Number of Guests
                </label>
                <select
                  id="editGuests"
                  required
                  value={editGuests}
                  onChange={(e) => setEditGuests(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "Guest" : "Guests"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Special Requests */}
              <div>
                <label
                  htmlFor="editRequests"
                  className="block text-xs font-semibold text-gray-700 mb-1"
                >
                  Special Requests or Seating Preferences
                </label>
                <textarea
                  id="editRequests"
                  rows={3}
                  value={editRequests}
                  onChange={(e) => setEditRequests(e.target.value)}
                  placeholder="e.g. outdoor seating, high chair, birthday..."
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModifyingBooking(null)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-semibold text-xs sm:text-sm rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {isUpdating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Cancel Booking Confirmation (Requirement 10.5) */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-sm p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
              !
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900">
              Cancel Reservation?
            </h3>
            <p className="text-xs text-center text-gray-500 mt-1 mb-5">
              Are you sure you want to cancel the table reservation on{" "}
              <strong className="text-gray-800">
                {formatDisplayDate(cancellingBooking.reservation_date)}
              </strong>{" "}
              at{" "}
              <strong className="text-gray-800">
                {formatTime12(cancellingBooking.reservation_time)}
              </strong>{" "}
              for{" "}
              <strong className="text-gray-800">
                {cancellingBooking.party_size} guests
              </strong>
              ?
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCancellingBooking(null)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-semibold text-xs rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                Keep Booking
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-60"
              >
                {isCancelling ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
