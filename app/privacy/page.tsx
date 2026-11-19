export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2] px-4 py-10 text-[#29261F] sm:px-8 sm:py-14">
      <article className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8F482F]">
          Draft placeholder
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl">Privacy Policy</h1>
        <p className="mt-4 border-l-2 border-[#8F482F] pl-4 text-sm leading-6 text-stone-700">
          This draft is not a finalized privacy policy. Replace every bracketed
          item, confirm the practices described below, and have the final policy
          reviewed before publication.
        </p>
        <p className="mt-6 text-sm text-stone-600">
          Effective date: [Insert date]
        </p>

        <div className="mt-10 space-y-8 leading-7">
          <section>
            <h2 className="text-2xl">Who we are</h2>
            <p className="mt-2">
              This website is operated by [legal business name] trading as
              Mickleham Kebab &amp; Grill. Contact us at [privacy contact email]
              or [postal address]. Add the business registration details
              required for your jurisdiction: [ABN or other registration
              details].
            </p>
          </section>

          <section>
            <h2 className="text-2xl">Information we handle</h2>
            <p className="mt-2">
              Confirm and describe the information the website actually
              collects, such as [account and contact details], [order and
              reservation details], [payment information handled by the
              payment provider], and [technical, cookie, or analytics data].
              Do not list information that is not collected.
            </p>
          </section>

          <section>
            <h2 className="text-2xl">How information is used and shared</h2>
            <p className="mt-2">
              Explain the purposes for using information and identify the
              service providers or other recipients involved, including
              [hosting], [ordering and payment services], and [analytics or
              communications providers, if used]. State any overseas
              disclosures and applicable legal bases or notices: [complete
              after review].
            </p>
          </section>

          <section>
            <h2 className="text-2xl">Retention, security, and your choices</h2>
            <p className="mt-2">
              Describe how long information is retained, the safeguards used,
              and how visitors can request access, correction, deletion, or
              raise a privacy concern: [insert verified retention periods,
              safeguards, and request process].
            </p>
          </section>

          <section>
            <h2 className="text-2xl">Cookies and updates</h2>
            <p className="mt-2">
              List the cookies and similar technologies in use, explain how
              visitors can manage them, and state how policy changes will be
              communicated: [complete after checking the live website and
              services].
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
