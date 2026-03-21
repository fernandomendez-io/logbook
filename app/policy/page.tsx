export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <article className="max-w-3xl mx-auto bg-white p-8 md:p-12 shadow-sm rounded-xl border border-gray-100">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Effective Date: March 20, 2026
        </p>

        <section className="prose prose-emerald max-w-none text-gray-700 space-y-6 text-[14px] leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
              1. Information Collection and Use
            </h2>
            <p>
              The Pilot Logbook App (&quot;the App&quot;) collects only the
              minimum amount of information necessary to facilitate flight
              logging and legality tracking. This includes flight identifiers
              (e.g., flight numbers, tail numbers, and airport codes). We do not
              collect personal identifiers such as your legal name, physical
              address, or phone number unless voluntarily provided for support
              inquiries.
            </p>
          </div>

          <div className="bg-emerald-50/50 p-6 rounded-lg border border-emerald-100">
            <h2 className="text-lg font-bold text-emerald-900 uppercase tracking-wide mb-2">
              2. Google API Disclosure (Limited Use)
            </h2>
            <p className="text-emerald-900 text-sm leading-relaxed italic">
              The App&apos;s use and transfer to any other app of information
              received from Google APIs will adhere to the
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="underline font-bold ml-1 hover:text-emerald-700"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <ul className="list-disc ml-5 mt-3 text-sm text-emerald-900 space-y-2">
              <li>
                <strong>Scope of Access:</strong> We utilize the{" "}
                <code>https://www.googleapis.com/auth/calendar.events</code>{" "}
                scope solely to <strong>export</strong> flight-related data to
                your primary Google Calendar.
              </li>
              <li>
                <strong>No Ingestion:</strong> We do not read, store, or monitor
                your existing calendar appointments, private events, or contact
                lists.
              </li>
              <li>
                <strong>Data Isolation:</strong> Information obtained via Google
                APIs is never shared with third-party aviation data providers
                (e.g., FlightRadar24, FlightAware).
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
              3. Third-Party Data Sharing
            </h2>
            <p>
              To populate flight data, the App communicates with third-party
              aviation APIs. These requests are limited to public flight
              identifiers. We do not sell, rent, or trade your data to any third
              party for marketing or advertising purposes. We may disclose
              information only if required by law or to protect our legal
              rights.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
              4. Data Storage and Security
            </h2>
            <p>
              Your flight logs and personal data are primarily stored locally on
              your device. For integrations (e.g., Google Calendar), we utilize
              OAuth 2.0 authentication protocols. We never see or store your
              Google account password. While we implement industry-standard
              security measures, no method of electronic storage is 100% secure,
              and we cannot guarantee absolute security.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
              5. Data Retention and Deletion
            </h2>
            <p>
              We retain your data only as long as necessary to provide the
              App&apos;s services. Users may delete their locally stored data at
              any time by clearing the App&apos;s cache or uninstalling the App.
              To revoke the App&apos;s access to your Google Calendar, you may
              do so via your Google Account Security settings.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
              6. Children&apos;s Privacy
            </h2>
            <p>
              The App is not intended for use by individuals under the age of
              13. We do not knowingly collect personal information from
              children. If we become aware of such collection, we will take
              immediate steps to delete the data.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
              7. Changes to this Policy
            </h2>
            <p>
              We reserve the right to modify this Privacy Policy at any time.
              Significant changes will be notified via an in-app alert or by
              updating the &quot;Effective Date&quot; at the top of this page.
            </p>
          </div>

          <div className="pt-6 border-t border-gray-200 text-center">
            <p className="text-[12px] text-gray-500">
              For privacy-related inquiries, contact:{" "}
              <strong>me@fernandomendez.io</strong>
            </p>
          </div>
        </section>
      </article>
    </div>
  );
}
