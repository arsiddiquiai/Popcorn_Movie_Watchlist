import type { ReactNode } from 'react'
import { Page, PageHeader } from '../components/layout/Page'

/**
 * Privacy and Terms.
 *
 * Reviewed and approved (24 August 2026). Professional/neutral tone
 * throughout, per the brief: no "hobby project" / "personal project" /
 * "shared with friends and family" framing. Not a substitute for review by
 * a lawyer if the product's legal exposure changes materially (e.g. actual
 * monetization launching — see the note below).
 *
 * The "Subscriptions & Payments" section is a STRUCTURAL PLACEHOLDER ONLY.
 * No payment feature exists in the product today. It is included so the
 * document's shape doesn't need a second rewrite the day payments ship, but
 * its specifics (actual pricing, actual cancellation mechanics, actual
 * refund window) are written generally and MUST be reviewed for accuracy
 * against whatever billing system is actually built, before that section is
 * ever treated as binding.
 */

const UPDATED = '24 August 2026'

function Prose({ children }: { children: ReactNode }) {
  return <div className="flex max-w-prose flex-col gap-5 font-ui text-sm leading-relaxed text-muted">{children}</div>
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-4 font-display text-lg font-semibold text-text">{children}</h2>
}

function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-accent-warm/25 bg-accent-warm/5 px-5 py-4 font-ui text-base leading-relaxed text-text">
      {children}
    </p>
  )
}

function PlaceholderNotice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-accent-cold/35 bg-accent-cold/5 px-5 py-4 font-ui text-xs leading-relaxed text-accent-cold">
      {children}
    </p>
  )
}

function Updated() {
  return <p className="mt-6 border-t border-border pt-5 font-mono text-[11px] text-muted-subtle">Last updated {UPDATED}</p>
}

export function Privacy() {
  return (
    <Page>
      <PageHeader title="Privacy" />
      <Prose>
        <Lead>
          This Privacy Policy explains what information Popcorn collects, how it is used, and the choices available
          to you. Popcorn stores only what is required to operate its features; your data is not sold, rented, or
          shared with advertisers.
        </Lead>

        <H2>Eligibility</H2>
        <p>
          Popcorn is intended for users aged 13 and older. By creating an account, you confirm that you meet this age
          requirement. If Popcorn becomes aware that an account belongs to a user under 13, that account may be
          suspended or removed.
        </p>

        <H2>Information collected</H2>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>Account information: your email address, used for authentication.</li>
          <li>Watchlist data: films you save, their status, ratings you assign, and optional review notes.</li>
          <li>
            AI interaction data: text you submit to AI-powered features (Pick For Me, Cinema Bridge, Taste DNA, the
            Movie Assistant) and the responses generated, retained to support usage limits and feature history.
          </li>
          <li>
            Bring-Your-Own-Key (BYOK) credentials, if provided: an API key for Anthropic, OpenAI, or Google Gemini
            that you choose to supply. See "Your own AI provider key" below for how this is handled.
          </li>
          <li>Feedback submissions, including an optional contact email if you provide one.</li>
        </ul>

        <H2>How information is used</H2>
        <p>
          Information is used solely to operate Popcorn's features: authenticating your account, maintaining your
          watchlist and ratings, generating AI recommendations, and enforcing usage limits. Popcorn does not use your
          data for advertising, and does not sell or rent personal information to third parties.
        </p>

        <H2>Your own AI provider key</H2>
        <p>
          If you supply a personal API key for Anthropic, OpenAI, or Google Gemini, it is encrypted before storage
          and is not retrievable through the application once saved — not by Popcorn's interface, and not by you. You
          may replace or remove a stored key at any time from Settings. When a personal key is present, requests to
          that provider are made using your credentials rather than Popcorn's shared key, and any usage costs are
          billed to your account with that provider.
        </p>

        <H2>Third-party service providers</H2>
        <p>Popcorn relies on the following third-party services to operate. Data passed to them is subject to their own privacy policies.</p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <span className="text-text">The Movie Database (TMDB)</span> — film metadata, imagery, and search results.
          </li>
          <li>
            <span className="text-text">Anthropic, OpenAI, and Google (Gemini)</span> — power the AI-driven
            recommendation features. Content you submit to these features is sent to the applicable provider to
            generate a response.
          </li>
          <li>
            <span className="text-text">Supabase</span> — database hosting and authentication.
          </li>
          <li>
            <span className="text-text">Resend</span> — delivers feedback submissions to Popcorn's operator by email.
          </li>
        </ul>

        <H2>Subscriptions &amp; Payments</H2>
        <PlaceholderNotice>
          Placeholder section — no paid tier exists in Popcorn today. This section describes the general shape of
          future billing terms and will require full review once a specific payment system is implemented; it is not
          binding until then.
        </PlaceholderNotice>
        <p>
          If Popcorn introduces paid subscription tiers, payment information will be processed by a third-party
          payment provider; Popcorn does not intend to store full payment card details directly. Pricing may change
          with advance notice. Subscriptions may generally be cancelled at any time, with access continuing through
          the remainder of the paid period. Refund eligibility, if any, will be described in the applicable pricing
          terms at the time a paid tier launches.
        </p>

        <H2>Data retention and deletion</H2>
        <p>
          Your data is retained for as long as your account is active. You may permanently delete your account at
          any time from <span className="text-text">Settings → Danger zone → Delete my account</span>. Deletion
          removes your profile, watchlist, ratings, AI interaction history, and any saved provider key. Feedback
          submissions are retained but disassociated from your account rather than deleted outright, so that product
          feedback is not lost. Deletion cannot be undone.
        </p>

        <H2>Changes to this policy</H2>
        <p>Material changes to this policy will be reflected by an updated date below.</p>

        <Updated />
      </Prose>
    </Page>
  )
}

export function Terms() {
  return (
    <Page>
      <PageHeader title="Terms of Use" />
      <Prose>
        <Lead>
          These Terms of Use govern your access to and use of Popcorn. By creating an account, you agree to these
          terms.
        </Lead>

        <H2>Eligibility</H2>
        <p>
          You must be at least 13 years old to use Popcorn. If you are between 13 and the age of legal majority in
          your jurisdiction, you should review these terms together with a parent or guardian before creating an
          account.
        </p>

        <H2>Acceptable use</H2>
        <p>
          You agree to use Popcorn lawfully and in accordance with these terms. You must not attempt to access
          another user's data, interfere with or disrupt the service, or use the AI features to generate unlawful,
          abusive, or harmful content.
        </p>

        <H2>Your content</H2>
        <p>
          You retain ownership of your watchlist entries, ratings, and review notes. You are responsible for content
          you submit. Popcorn stores this content solely to provide the service back to you.
        </p>

        <H2>AI-generated content</H2>
        <p>
          Popcorn's recommendation features are powered by third-party AI models and may occasionally produce
          inaccurate information — including mischaracterizing a film or, rarely, referencing one that does not
          exist. Recommendations should be treated as suggestions, not guarantees. Cinema Bridge validates each
          result against TMDB before displaying it, but no automated verification is exhaustive.
        </p>

        <H2>Your own AI provider key (BYOK)</H2>
        <p>
          Popcorn supports connecting a personal API key for Anthropic, OpenAI, or Google Gemini. If you choose to do
          so, usage through that key is billed directly by the applicable provider to your account, and you are
          responsible for those charges and for complying with that provider's own terms of service. Popcorn stores
          the key in encrypted form and uses it only to fulfill requests you initiate. Popcorn is not responsible for
          the availability, pricing, or behavior of third-party AI providers.
        </p>

        <H2>Subscriptions &amp; Payments</H2>
        <PlaceholderNotice>
          Placeholder section — no paid tier exists in Popcorn today. This section will require full legal review
          once a specific payment system is implemented; it is not binding until then.
        </PlaceholderNotice>
        <p>
          Should Popcorn introduce paid subscription tiers, applicable pricing, billing cadence, cancellation
          mechanics, and refund policy will be presented at the time of purchase and will supplement these terms.
          Continued use of a paid tier after a pricing change constitutes acceptance of the new price, subject to any
          notice period stated at that time.
        </p>

        <H2>Account termination and deletion</H2>
        <p>
          You may delete your account at any time from{' '}
          <span className="text-text">Settings → Danger zone → Delete my account</span>. This permanently removes
          your account and associated data as described in the Privacy Policy. Popcorn may suspend or terminate
          access for violation of these terms.
        </p>

        <H2>Disclaimer of warranty; limitation of liability</H2>
        <p>
          Popcorn is provided "as is" and "as available," without warranties of any kind, express or implied,
          including fitness for a particular purpose or non-infringement. Popcorn does not guarantee uninterrupted or
          error-free operation. To the maximum extent permitted by law, Popcorn and its operator are not liable for
          indirect, incidental, or consequential damages arising from use of the service. You are encouraged to
          maintain your own copy of important data using the CSV export available in Settings.
        </p>

        <H2>Changes to these terms</H2>
        <p>Material changes to these terms will be reflected by an updated date below.</p>

        <H2>Not affiliated</H2>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>

        <Updated />
      </Prose>
    </Page>
  )
}
