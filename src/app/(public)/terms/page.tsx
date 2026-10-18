import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use | BudgetPhonewala",
  description: "Terms for using the BudgetPhonewala app and buying phones from the shop.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Use</h1>
      <p className="text-sm text-neutral-500">Last updated: 18 October 2026</p>
      <p>
        These terms apply when you use the BudgetPhonewala app and buy from the shop. This is plain-language starter text prepared for the shop; the owner should have it
        reviewed by a lawyer before relying on it.
      </p>
      <h2>Buying a phone</h2>
      <ul>
        <li>Every phone is a single used device. The price, condition grade, battery health and accessories shown for that phone are what you buy.</li>
        <li>When you start checkout we hold the phone for a short time. If payment is not completed in that time the hold is released and someone else can buy it.</li>
        <li>The final price, delivery charge and any discount are calculated by our server at checkout and shown before you pay.</li>
        <li>An order is confirmed only after your payment is verified (or, for cash on delivery, accepted by the shop).</li>
      </ul>
      <h2>Warranty and returns</h2>
      <p>Warranty and return terms shown on each phone and on your order apply. Requests are made in the app and reviewed by the shop.</p>
      <h2>Your account</h2>
      <p>Keep your sign-in details private. You must give correct delivery and contact details. We may refuse service or cancel orders for misuse, repeated failed deliveries or suspected fraud.</p>
      <h2>Selling or exchanging your phone</h2>
      <p>An estimate in the app is not a final offer. The final offer is made by the shop after inspecting the phone.</p>
      <h2>Contact</h2>
      <p>BudgetPhonewala, Pandharpur, Maharashtra. +91 98500 07981. budgetphonewala2@gmail.com.</p>
    </>
  );
}
