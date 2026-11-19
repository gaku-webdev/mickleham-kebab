export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2] px-4 py-10 text-[#29261F] sm:px-8 sm:py-14">
      <article className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8F482F]">
          Draft placeholder
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl">Terms &amp; Conditions</h1>
        <p className="mt-4 border-l-2 border-[#8F482F] pl-4 text-sm leading-6 text-stone-700">
          This draft is not a finalized agreement. Replace every bracketed
          item, confirm that each term matches the business&apos;s actual
          practices, and obtain appropriate legal review before publication.
        </p>
        <p className="mt-6 text-sm text-stone-600">
          Effective date: [Insert date]
        </p>

        <div className="mt-10 space-y-8 leading-7">
          <section>
            <h2 className="text-2xl">Business and contact details</h2>
            <p className="mt-2">
              These terms apply to orders placed with [legal business name]
              trading as Mickleham Kebab &amp; Grill through this website.
              Contact: [business contact email and phone]. Add [ABN or other
              registration details] and the business address.
            </p>
          </section>

          <section>
            <h2 className="text-2xl">Orders and payment</h2>
            <p className="mt-2">
              Explain when an online order is accepted, how menu availability
              and prices are confirmed, which payment methods are supported,
              and how order changes or cancellations are handled: [insert the
              verified process and applicable time limits].
            </p>
          </section>

          <section>
            <h2 className="text-2xl">Collection and opening hours</h2>
            <p className="mt-2">
              State the pickup process, estimated preparation times, current
              collection address, trading hours, and what happens if an order
              is placed near closing or the restaurant cannot fulfil it:
              [complete with current business policy].
            </p>
          </section>

          <section>
            <h2 className="text-2xl">Menu and allergen information</h2>
            <p className="mt-2">
              Describe how menu changes, substitutions, and allergen enquiries
              are handled. Add accurate cross-contamination information and
              direct customers with dietary requirements to [verified contact
              or process]. Do not promise an allergen-free preparation
              environment unless that can be guaranteed.
            </p>
          </section>

          <section>
            <h2 className="text-2xl">Complaints and other terms</h2>
            <p className="mt-2">
              Provide the complaint and refund process, applicable consumer
              rights, governing law, and any permitted limitations or
              disclaimers: [complete after legal review]. Nothing in these
              terms should exclude rights that cannot legally be excluded.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
