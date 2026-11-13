"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  formatDateOnly,
  formatClockTime,
  getMelbourneDateParts,
  toDateInputValue,
} from "@/lib/date-time";

interface BookingResult {
  reference: string;
  fullName: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  specialNotes?: string;
}

// Evening times from 5:30 PM
const EVENING_TIMES = [
  { value: "17:30:00", label: "5:30 pm" },
  { value: "18:00:00", label: "6:00 pm" },
  { value: "18:30:00", label: "6:30 pm" },
  { value: "19:00:00", label: "7:00 pm" },
  { value: "19:30:00", label: "7:30 pm" },
  { value: "20:00:00", label: "8:00 pm" },
  { value: "20:30:00", label: "8:30 pm" },
  { value: "21:00:00", label: "9:00 pm" },
  { value: "21:30:00", label: "9:30 pm" },
  { value: "22:00:00", label: "10:00 pm" },
  { value: "22:30:00", label: "10:30 pm" },
];

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

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

export default function ReservationPage() {
  const { user } = useAuth();
  const [todayStr, setTodayStr] = useState("");
  const [currentMinutes, setCurrentMinutes] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("18:30:00");
  const [selectedGuests, setSelectedGuests] = useState<number>(4);
  const [isCustomGuests, setIsCustomGuests] = useState(false);
  const [customGuestsCount, setCustomGuestsCount] = useState("8");
  const [specialRequests, setSpecialRequests] = useState("");

  // Modals state
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date | null>(null);

  // Customer Contact Details state (Requirement 10.2)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Submission state
  const [loading, setLoading] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rlsHelp, setRlsHelp] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  // Initialize today's date and pre-fill user info if logged in
  useEffect(() => {
    const today = getMelbourneDateParts();
    const iso = toDateInputValue(today);
    setTodayStr(iso);
    setSelectedDate(iso);
    setCalendarMonth(new Date(Date.UTC(today.year, today.month - 1, 1)));
    setCurrentMinutes(today.hour * 60 + today.minute + 15);

    if (user) {
      if (user.user_metadata?.full_name) {
        const parts = user.user_metadata.full_name.split(" ");
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
      }
      if (user.email) {
        setEmail(user.email);
      }
      if (user.user_metadata?.phone) {
        setPhone(user.user_metadata.phone.replace("+61", "").trim());
      }
    }
  }, [user]);

  // Generate 5 consecutive quick date pills from today
  const quickDatePills = useMemo(() => {
    if (!todayStr) return [];
    const pills = [];
    const [y, m, d] = todayStr.split("-").map(Number);
    for (let i = 0; i < 5; i++) {
      const dateObj = new Date(Date.UTC(y, m - 1, d + i));
      const iso = toDateInputValue({
        year: dateObj.getUTCFullYear(),
        month: dateObj.getUTCMonth() + 1,
        day: dateObj.getUTCDate(),
      });
      const weekday = formatDateOnly(iso, { weekday: "short" });
      const dayMonth =
        i === 0
          ? "Today"
          : formatDateOnly(iso, { day: "2-digit", month: "short" });
      pills.push({
        iso,
        weekday,
        dayMonth,
      });
    }
    return pills;
  }, [todayStr]);

  // Check if a time slot has already passed today (Requirement 10.4)
  const isTimeSlotPassedToday = (timeValue: string) => {
    if (!todayStr || selectedDate !== todayStr || currentMinutes === null) return false;
    const [h, m] = timeValue.split(":").map(Number);
    const slotMinutes = h * 60 + m;
    return slotMinutes <= currentMinutes;
  };

  // Open "Your details" modal
  const handleProceed = () => {
    setErrorMessage(null);
    setIsDetailsModalOpen(true);
  };

  // Confirm booking submission to Supabase
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setRlsHelp(false);
    setLoading(true);

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const finalGuests = isCustomGuests
      ? parseInt(customGuestsCount, 10) || 8
      : selectedGuests;

    const newId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : undefined;

    const refNumber = newId
      ? `MK-${newId.replace(/-/g, "").substring(0, 6).toUpperCase()}`
      : `MK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    try {
      const insertPayload: Record<string, unknown> = {
        user_id: user?.id || null,
        customer_name: fullName,
        customer_email: email.trim(),
        customer_phone: phone.trim().startsWith("+")
          ? phone.trim()
          : `+61 ${phone.trim()}`,
        reservation_date: selectedDate,
        reservation_time: selectedTime,
        party_size: finalGuests,
        special_requests: specialRequests.trim() || null,
        status: "pending",
      };

      if (newId) {
        insertPayload.id = newId;
      }

      const { error } = await supabase
        .from("reservations")
        .insert([insertPayload]);

      if (error) {
        if (
          error.message.includes("row-level security") ||
          error.code === "42501"
        ) {
          setRlsHelp(true);
        }
        setErrorMessage(error.message);
      } else {
        setConfirmedBooking({
          reference: refNumber,
          fullName,
          email: email.trim(),
          phone: phone.trim().startsWith("+") ? phone.trim() : `+61 ${phone.trim()}`,
          date: selectedDate,
          time: selectedTime,
          guests: finalGuests,
          specialNotes: specialRequests.trim() || undefined,
        });

        setIsDetailsModalOpen(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred while booking.");
      }
    } finally {
      setLoading(false);
    }
  };

  const copyReference = () => {
    if (confirmedBooking?.reference) {
      navigator.clipboard.writeText(confirmedBooking.reference);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const resetAll = () => {
    setConfirmedBooking(null);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setSpecialRequests("");
    setSelectedDate(todayStr);
    setSelectedTime("18:30:00");
    setSelectedGuests(4);
    setIsCustomGuests(false);
    setErrorMessage(null);
  };

  // Calendar Modal Days Builder
  const calendarDays = useMemo(() => {
    if (!calendarMonth || !todayStr) return [];
    const year = calendarMonth.getUTCFullYear();
    const month = calendarMonth.getUTCMonth();

    const firstDayIndex = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const totalDaysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNumber: null, iso: null, disabled: true });
    }

    const [tY, tM, tD] = todayStr.split("-").map(Number);
    const todayDate = Date.UTC(tY, tM - 1, tD);

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, "0");
      const dayStr = String(d).padStart(2, "0");
      const iso = `${year}-${monthStr}-${dayStr}`;
      const thisDate = Date.UTC(year, month, d);
      const isPast = thisDate < todayDate;

      days.push({
        dayNumber: d,
        iso,
        disabled: isPast,
        isToday: iso === todayStr,
        isSelected: iso === selectedDate,
      });
    }

    return days;
  }, [calendarMonth, todayStr, selectedDate]);

  const prevMonth = () => {
    setCalendarMonth((prev) => {
      const current = prev || new Date(Date.UTC(2026, 10, 1));
      return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1));
    });
  };

  const nextMonth = () => {
    setCalendarMonth((prev) => {
      const current = prev || new Date(Date.UTC(2026, 10, 1));
      return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1));
    });
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917] flex flex-col font-sans">
      {/* Main Reservation Section */}
      <main className="flex-1 flex flex-col items-center justify-start py-8 sm:py-12 px-4">
        <div className="w-full max-w-4xl">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 font-medium mb-4 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-3.5 h-3.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
            <span>Back to Home</span>
          </Link>

          {/* Header Row (Pic 3) */}
          <div className="flex items-center justify-between mb-2.5 px-1">
            <span className="text-xs font-black uppercase tracking-wider text-gray-900">
              TABLE BOOKING
            </span>
            <Link
              href="/reservations"
              className="text-xs font-semibold text-[#0284C7] hover:underline flex items-center gap-1.5"
            >
              <span>📅</span> My Bookings
            </Link>
          </div>

          {/* Restaurant Banner Card (Pic 3) */}
          <div className="bg-white rounded-2xl border border-[#EBE6DD] p-5 sm:p-6 mb-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
                Mickleham Kebab &amp; Grill
              </h1>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                <span>📍</span> 2/9-33 Errol Bvd, Mickleham, Vic
              </p>
              <p className="text-xs font-bold text-gray-800 mt-1 flex items-center gap-1">
                <span className="text-amber-500 text-sm">★</span> 4.8{" "}
                <span className="font-normal text-gray-400">(60)</span>
              </p>
            </div>

            <div>
              {user ? (
                <div className="flex items-center gap-2 text-xs bg-[#FAF7F2] px-3.5 py-2 rounded-xl border border-[#EBE6DD]">
                  <span className="text-gray-500">Signed in as</span>
                  <span className="font-bold text-gray-900">
                    {user.user_metadata?.full_name || user.email}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 font-medium">
                    Already have an account?
                  </span>
                  <Link
                    href="/login"
                    className="px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-lg text-xs font-extrabold tracking-wider uppercase transition-colors shadow-xs"
                  >
                    SIGN IN
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Booking Confirmation View (Requirement 10.3) */}
          {confirmedBooking ? (
            <div className="bg-white rounded-2xl shadow-sm border border-[#EBE6DD] p-6 sm:p-10 max-w-xl mx-auto space-y-6">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  className="w-7 h-7"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
              </div>

              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C1917]">
                  Reservation Confirmed!
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-gray-600">
                  Confirmation dispatched to{" "}
                  <strong className="text-gray-900 font-semibold">
                    {confirmedBooking.email}
                  </strong>{" "}
                  and SMS to{" "}
                  <strong className="text-gray-900 font-semibold">
                    {confirmedBooking.phone}
                  </strong>
                  .
                </p>
              </div>

              <div className="bg-[#FAF7F2] border border-[#EBE6DD] rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#EBE6DD] pb-3.5">
                  <div>
                    <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">
                      Booking Reference
                    </p>
                    <p className="text-xl font-extrabold text-[#C2410C] tracking-wide font-mono mt-0.5">
                      {confirmedBooking.reference}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyReference}
                    className="px-3 py-1.5 bg-white border border-gray-300 hover:border-gray-400 rounded-lg text-xs font-semibold text-gray-700 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    {copiedRef ? (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-3.5 h-3.5 text-emerald-600"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 0 0-1.414 0L8 12.586 4.707 9.293a1 1 0 1 0-1.414 1.414l4 4a1 1 0 0 0 1.414 0l8-8a1 1 0 0 0 0-1.414Z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-3.5 h-3.5 text-gray-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy Ref
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 py-1 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-gray-100">
                    <p className="text-[11px] text-gray-500 font-medium">Date</p>
                    <p className="text-xs sm:text-sm font-bold text-gray-900 mt-0.5">
                      {formatDisplayDate(confirmedBooking.date)}
                    </p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-gray-100">
                    <p className="text-[11px] text-gray-500 font-medium">Time</p>
                    <p className="text-xs sm:text-sm font-bold text-gray-900 mt-0.5">
                      {formatTime12(confirmedBooking.time)}
                    </p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-gray-100">
                    <p className="text-[11px] text-gray-500 font-medium">Party Size</p>
                    <p className="text-xs sm:text-sm font-bold text-[#C2410C] mt-0.5">
                      {confirmedBooking.guests}{" "}
                      {confirmedBooking.guests === 1 ? "Guest" : "Guests"}
                    </p>
                  </div>
                </div>

                <div className="border-t border-[#EBE6DD] pt-3 text-xs text-gray-600 space-y-1">
                  <p>
                    <span className="font-semibold text-gray-700">Guest Name:</span>{" "}
                    {confirmedBooking.fullName}
                  </p>
                  <p>
                    <span className="font-semibold text-gray-700">Contact:</span>{" "}
                    {confirmedBooking.phone} • {confirmedBooking.email}
                  </p>
                  {confirmedBooking.specialNotes && (
                    <p className="pt-1 text-gray-700 italic">
                      <span className="font-semibold not-italic text-gray-700">
                        Special Requests:
                      </span>{" "}
                      &ldquo;{confirmedBooking.specialNotes}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-3 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 rounded-xl font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  Print Details
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  className="flex-1 py-3 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center cursor-pointer shadow-xs"
                >
                  Book Another Table
                </button>
              </div>
            </div>
          ) : (
            /* Card-Based Booking System (Matching Uploaded Screenshots) */
            <div className="bg-white rounded-2xl shadow-sm border border-[#EBE6DD] p-6 sm:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                {/* Left Column: Date & Time */}
                <div className="space-y-8">
                  {/* Choose a date */}
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1C1917] mb-3">
                      Choose a date
                    </h2>
                    <div className="flex flex-wrap gap-2.5 items-center">
                      {quickDatePills.map((p) => {
                        const isSelected = selectedDate === p.iso;
                        return (
                          <button
                            key={p.iso}
                            type="button"
                            onClick={() => setSelectedDate(p.iso)}
                            className={`min-w-[76px] px-3.5 py-2.5 rounded-xl border text-center transition-all cursor-pointer ${isSelected
                                ? "border-red-500 bg-red-50/80 text-red-600 shadow-xs font-semibold ring-1 ring-red-400"
                                : "border-gray-200 bg-white hover:border-gray-300 text-gray-800 hover:bg-gray-50"
                              }`}
                          >
                            <div className="text-xs font-medium leading-none mb-1">
                              {p.weekday}
                            </div>
                            <div className="text-xs font-bold leading-none">
                              {p.dayMonth}
                            </div>
                          </button>
                        );
                      })}

                      {/* Later Button */}
                      <button
                        type="button"
                        onClick={() => setIsCalendarModalOpen(true)}
                        className={`min-w-[76px] px-3.5 py-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${!quickDatePills.some((p) => p.iso === selectedDate)
                            ? "border-red-500 bg-red-50 text-red-600 font-semibold ring-1 ring-red-400"
                            : "border-gray-200 bg-white hover:border-gray-300 text-gray-800 hover:bg-gray-50"
                          }`}
                      >
                        <span className="text-xs font-bold flex items-center gap-1">
                          Later
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-3.5 h-3.5 text-gray-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </span>
                        {!quickDatePills.some((p) => p.iso === selectedDate) && (
                          <span className="text-[10px] text-red-600 font-semibold leading-none">
                            {formatDisplayDate(selectedDate).split(",")[1]}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Choose a time (Evening Slots only from 5:30 PM as requested) */}
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1C1917] mb-1">
                      Choose a time
                    </h2>
                    <p className="text-xs font-semibold text-gray-500 mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <span className="font-medium text-gray-400">
                        Melbourne local time ·
                      </span>
                      <span>Evening</span>
                      <span className="text-[11px] font-normal text-gray-400">
                        (Peak Dinner Service)
                      </span>
                    </p>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                      {EVENING_TIMES.map((slot) => {
                        const isSelected = selectedTime === slot.value;
                        const isPassed = isTimeSlotPassedToday(slot.value);

                        return (
                          <button
                            key={slot.value}
                            type="button"
                            disabled={isPassed}
                            onClick={() => setSelectedTime(slot.value)}
                            className={`py-2.5 px-2 rounded-xl border text-xs text-center transition-all cursor-pointer ${isPassed
                                ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed line-through"
                                : isSelected
                                  ? "border-red-500 bg-red-50/80 text-red-600 font-bold shadow-xs ring-1 ring-red-400"
                                  : "border-gray-200 bg-white hover:border-gray-300 text-gray-800 hover:bg-gray-50 font-medium"
                              }`}
                          >
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Guests, Special Requests, Proceed Button */}
                <div className="space-y-8 flex flex-col justify-between">
                  {/* Number of guests */}
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1C1917] mb-3">
                      Number of guests
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {GUEST_OPTIONS.map((num) => {
                        const isSelected = !isCustomGuests && selectedGuests === num;
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => {
                              setSelectedGuests(num);
                              setIsCustomGuests(false);
                            }}
                            className={`w-10 h-10 rounded-xl border text-sm font-semibold transition-all cursor-pointer flex items-center justify-center ${isSelected
                                ? "border-red-500 bg-red-50 text-red-600 shadow-xs ring-1 ring-red-400"
                                : "border-gray-200 bg-white hover:border-gray-300 text-gray-800 hover:bg-gray-50"
                              }`}
                          >
                            {num}
                          </button>
                        );
                      })}

                      {/* Custom Guests Pill */}
                      <button
                        type="button"
                        onClick={() => setIsCustomGuests(true)}
                        className={`px-3 h-10 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${isCustomGuests
                            ? "border-red-500 bg-red-50 text-red-600 shadow-xs ring-1 ring-red-400"
                            : "border-gray-200 bg-white hover:border-gray-300 text-gray-800 hover:bg-gray-50"
                          }`}
                      >
                        Custom
                      </button>
                    </div>

                    {isCustomGuests && (
                      <div className="mt-3 flex items-center gap-2">
                        <label
                          htmlFor="customGuestsInput"
                          className="text-xs font-semibold text-gray-700"
                        >
                          Party size:
                        </label>
                        <input
                          id="customGuestsInput"
                          type="number"
                          min="1"
                          max="50"
                          value={customGuestsCount}
                          onChange={(e) => setCustomGuestsCount(e.target.value)}
                          className="w-20 px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-semibold text-center"
                        />
                        <span className="text-xs text-gray-500">Guests</span>
                      </div>
                    )}
                  </div>

                  {/* Special requests */}
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1C1917] mb-2">
                      Special requests
                    </h2>
                    <textarea
                      rows={3}
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                      placeholder="e.g. allergies, seating, celebrations"
                      className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none"
                    />
                  </div>

                  {/* Summary Snippet & PROCEED Button */}
                  <div className="pt-2">
                    <div className="mb-3 px-3.5 py-2 bg-[#FAF7F2] rounded-xl border border-[#EBE6DD] flex items-center justify-between text-xs text-gray-600">
                      <span>
                        <strong>Date &amp; Time:</strong> {formatDisplayDate(selectedDate)} at{" "}
                        {formatTime12(selectedTime)}
                      </span>
                      <span>
                        <strong>Guests:</strong>{" "}
                        {isCustomGuests ? customGuestsCount : selectedGuests}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleProceed}
                      className="w-full py-3.5 px-6 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl font-extrabold text-sm tracking-wider uppercase transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
                    >
                      PROCEED
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL 1: "Your details" (Matching Image 2) */}
      {isDetailsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-sm p-6 relative animate-in fade-in zoom-in-95 duration-150">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsDetailsModalOpen(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Modal Title */}
            <h2 className="text-xl font-bold text-[#1C1917] mb-5">
              Your details
            </h2>

            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <p className="font-semibold">Could not complete reservation:</p>
                <p className="mt-0.5">{errorMessage}</p>
                {rlsHelp && (
                  <div className="mt-2 p-2 bg-white border border-red-200 rounded font-mono text-[11px] text-gray-800">
                    <code>
                      CREATE POLICY &quot;Allow anon insert&quot; ON
                      public.reservations FOR INSERT TO anon WITH CHECK (true);
                    </code>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleConfirmBooking} className="space-y-4">
              {/* First Name */}
              <div className="relative">
                <label
                  htmlFor="firstName"
                  className="block text-xs font-semibold text-gray-700 mb-1"
                >
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. John"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                />
              </div>

              {/* Last Name */}
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-xs font-semibold text-gray-700 mb-1"
                >
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Doe"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                />
              </div>

              {/* Email ID */}
              <div>
                <label
                  htmlFor="emailId"
                  className="block text-xs font-semibold text-gray-700 mb-1"
                >
                  Email ID
                </label>
                <input
                  id="emailId"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                />
              </div>

              {/* Phone with Australia Flag */}
              <div>
                <label
                  htmlFor="phoneInput"
                  className="block text-xs font-semibold text-gray-700 mb-1"
                >
                  Contact Number
                </label>
                <div className="flex items-center rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-500 overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-50 border-r border-gray-300 text-xs font-semibold text-gray-700 select-none">
                    <span className="text-[10px] bg-[#002B7F] text-white font-black px-1.5 py-0.5 rounded-xs leading-none tracking-wider">
                      AU
                    </span>
                    <span>+61</span>
                  </div>
                  <input
                    id="phoneInput"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="400 000 000"
                    className="flex-1 px-3 py-2.5 text-sm text-gray-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Account Sign In Prompt */}
              <p className="text-center text-xs text-gray-500 pt-1">
                Already have an account?{" "}
                <Link
                  href="/login"
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="text-[#0284C7] font-bold hover:underline cursor-pointer"
                >
                  Sign in
                </Link>
              </p>

              {/* Confirm Booking Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-lg font-bold text-sm tracking-wide uppercase transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
                    Confirming...
                  </>
                ) : (
                  "CONFIRM BOOKING"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: "Choose a date" Calendar Picker (Matching Image 3) */}
      {isCalendarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-xs p-5 relative animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#1C1917]">
                Choose a date
              </h2>
              <button
                type="button"
                onClick={() => setIsCalendarModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 hover:bg-gray-100 rounded text-red-600 transition-colors cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <span className="text-sm font-semibold text-gray-800">
                {formatDateOnly(
                  toDateInputValue({
                    year: (calendarMonth || new Date(Date.UTC(2026, 10, 1))).getUTCFullYear(),
                    month:
                      (calendarMonth || new Date(Date.UTC(2026, 10, 1))).getUTCMonth() +
                      1,
                    day: 1,
                  }),
                  { month: "short", year: "numeric" }
                )}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 hover:bg-gray-100 rounded text-red-600 transition-colors cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-500 py-2 border-b border-gray-100">
              <span>S</span>
              <span>M</span>
              <span>T</span>
              <span>W</span>
              <span>T</span>
              <span>F</span>
              <span>S</span>
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 text-center gap-y-1.5 pt-2 text-xs">
              {calendarDays.map((item, idx) => {
                if (!item.dayNumber) {
                  return <div key={`empty-${idx}`} />;
                }

                return (
                  <button
                    key={item.iso}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => {
                      if (item.iso) {
                        setSelectedDate(item.iso);
                        setIsCalendarModalOpen(false);
                      }
                    }}
                    className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center transition-all cursor-pointer ${item.disabled
                        ? "text-gray-300 cursor-not-allowed"
                        : item.isSelected
                          ? "bg-[#C2410C] text-white font-bold shadow-xs"
                          : item.isToday
                            ? "bg-gray-300 text-gray-900 font-bold"
                            : "text-gray-700 hover:bg-gray-100 font-medium"
                      }`}
                  >
                    {item.dayNumber}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
