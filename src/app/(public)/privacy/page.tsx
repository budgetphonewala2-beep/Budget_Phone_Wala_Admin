import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | BudgetPhonewala",
  description: "How the BudgetPhonewala app collects, uses and protects your information.",
  robots: { index: true, follow: true },
};

const UPDATED = "18 October 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-neutral-500">Last updated: {UPDATED}</p>
      <p>
        This policy explains what the <strong>BudgetPhonewala</strong> mobile app (the &quot;app&quot;) and the shop BudgetPhonewala, Pandharpur,
        Maharashtra (&quot;we&quot;, &quot;us&quot;) do with your information when you browse phones, place an order, or ask us to buy or exchange your phone.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your email address and, if you create an account with email, a password (stored only as a salted hash by our authentication provider; we cannot read it). If you use Google sign-in we receive your email address and name from Google.</li>
        <li><strong>Profile and delivery details:</strong> your name, mobile number and the delivery addresses you save, so we can deliver your order and contact you about it.</li>
        <li><strong>Orders and payments:</strong> the phones you order, prices, delivery or pickup choice, order status, and payment status. Online payments are processed by Razorpay; <strong>we never see or store your card, UPI or bank details</strong>.</li>
        <li><strong>Cart, wishlist and preferences:</strong> phones you save, and your notification choices.</li>
        <li><strong>Sell or exchange enquiries:</strong> the phone details and photos you choose to send, your contact details and the offers we make.</li>
        <li><strong>Warranty and return requests:</strong> what you tell us about a problem and our replies.</li>
        <li><strong>App error reports:</strong> if the app hits an unexpected error, it sends a short report with the app version, Android/iOS platform, the screen or action that failed, and a scrubbed technical message. Emails, tokens and long numbers are removed before storage. These help us fix bugs and are kept for 90 days.</li>
      </ul>
      <p>The app does not use advertising, does not track you across other apps or websites, and does not collect your precise location, contacts, SMS or call history. It asks for access to your photos or camera only when you choose to attach a photo to a sell or exchange enquiry.</p>

      <h2>2. How we use it</h2>
      <ul>
        <li>To create and secure your account and keep you signed in.</li>
        <li>To process, deliver and support your orders, returns and warranty claims.</li>
        <li>To prevent fraud and misuse (for example, limits on repeated requests).</li>
        <li>To send you order updates. We send marketing messages only if you opt in, and you can turn them off in the app (Profile &gt; Notification preferences).</li>
        <li>To find and fix errors in the app.</li>
      </ul>

      <h2>3. Who we share it with</h2>
      <p>We do not sell your personal information. We share it only with service providers that help us run the shop, and only as needed:</p>
      <ul>
        <li><strong>Supabase</strong> (database, authentication and file storage hosting) stores your account and order data.</li>
        <li><strong>Razorpay</strong> processes online payments and may collect payment and device information under its own privacy policy.</li>
        <li><strong>Google</strong> if you choose Google sign-in.</li>
        <li><strong>Delivery partners</strong> receive your name, address and phone number to deliver your order.</li>
        <li>Authorities or courts when the law requires it.</li>
      </ul>

      <h2>4. Security</h2>
      <p>Data is sent over encrypted connections (HTTPS). Access to customer data is restricted so that each customer can see only their own information, and shop staff can see only what their role needs. No system is perfectly secure, but we work to protect your information and fix problems promptly.</p>

      <h2>5. How long we keep it</h2>
      <p>We keep account and order information while your account is active. Order, payment and invoice records may need to be kept for the period required by Indian accounting and tax law even after you delete your account; in that case they are kept without your name and contact details wherever the law allows. Error reports are deleted after 90 days.</p>

      <h2>6. Your choices and rights</h2>
      <ul>
        <li><strong>Access and correction:</strong> view and edit your profile and addresses in the app (Profile).</li>
        <li><strong>Export:</strong> request a copy of your data in the app (Profile &gt; Privacy and data).</li>
        <li><strong>Deletion:</strong> delete your account from the app (Profile &gt; Privacy and data) or on the web at <a href="/delete-account">/delete-account</a>. We remove or anonymise your personal data as described in section 5.</li>
        <li><strong>Notifications:</strong> change them any time in the app.</li>
      </ul>

      <h2>7. Children</h2>
      <p>The app is meant for adults who can enter into a purchase. It is not directed at children under 18, and we do not knowingly collect their information.</p>

      <h2>8. Changes</h2>
      <p>If we change this policy we will update the date above and, for important changes, tell you in the app.</p>

      <h2>9. Contact</h2>
      <p>BudgetPhonewala, Chowk, Bhadule Rd, Navi Peth, Chouphala, Pandharpur, Maharashtra 413304. Phone or WhatsApp +91 98500 07981. Email budgetphonewala@gmail.com.</p>
    </>
  );
}
