export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <article className="max-w-3xl mx-auto bg-white p-8 md:p-12 shadow-sm rounded-xl border border-gray-100">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Terms of Service
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Effective Date: March 20, 2026
        </p>

        <section className="prose prose-emerald max-w-none text-gray-700 space-y-6 text-[14px] leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using the Pilot Logbook App (&quot;the App&quot;),
              you acknowledge that you have read, understood, and agree to be
              bound by these Terms of Service. These Terms constitute a legally
              binding agreement between you and Fernando Mendez
              (&quot;Developer&quot;).
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
              2. Aviation Compliance & Disclaimer
            </h2>
            <p>
              The App is provided as a supplemental record-keeping tool only.
              **The user acknowledges that the Pilot in Command (PIC) is the
              final authority** as to the operation of the aircraft and the
              accuracy of all flight logging required by the Federal Aviation
              Administration (FAA) or any other jurisdictional authority. The
              Developer makes no guarantee that the App meets the specific
              &quot;electronic record-keeping&quot; requirements of 14 CFR Part
              61 or similar regulations without independent verification by the
              user.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
              3. Limitation of Liability & No Warranty
            </h2>
            <p>
              THE APP IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS
              AVAILABLE&quot; BASIS. TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE
              DEVELOPER DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED. IN NO
              EVENT SHALL THE DEVELOPER BE LIABLE FOR ANY INDIRECT, PUNITIVE,
              INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING BUT NOT LIMITED TO
              LOSS OF FLIGHT DATA, LOSS OF PROFESSIONAL LICENSURE, OR FINES
              IMPOSED BY REGULATORY BODIES.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
              4. Indemnification
            </h2>
            <p>
              You agree to defend, indemnify, and hold harmless the Developer
              from and against any claims, liabilities, damages, losses, and
              expenses, including reasonable legal fees, arising out of or in
              any way connected with your access to or use of the App, or your
              violation of these Terms.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
              5. Intellectual Property
            </h2>
            <p>
              All rights, title, and interest in and to the App (excluding data
              provided by users or third-party APIs) are and will remain the
              exclusive property of the Developer. Nothing in these terms gives
              you a right to use the Developer&apos;s name, trademarks, logos,
              or domain names.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
              6. Third-Party Integrations & Data
            </h2>
            <p>
              The App relies on external APIs (Google, FlightRadar24,
              FlightAware). We are not responsible for the accuracy,
              completeness, or availability of data provided by these third
              parties. Usage of the Google Calendar export feature is further
              governed by the Google Terms of Service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
              7. Severability & Waiver
            </h2>
            <p>
              If any provision of these Terms is held to be invalid or
              unenforceable, the remaining provisions will remain in full force
              and effect. The failure of the Developer to enforce any right or
              provision of these Terms will not be deemed a waiver of such
              right.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
              8. Governing Law & Dispute Resolution
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with
              the laws of the State of Texas. Any legal action or proceeding
              arising under these Terms will be brought exclusively in the
              courts located in Denton County, Texas.
            </p>
          </div>

          <div className="pt-6 border-t border-gray-200 text-center">
            <p className="text-[12px] text-gray-400">
              Copyright © 2026 Fernando Mendez. All rights reserved.
            </p>
          </div>
        </section>
      </article>
    </div>
  );
}
