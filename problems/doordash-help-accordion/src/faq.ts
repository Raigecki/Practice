export type Faq = { id: string; question: string; answer: string; disabled?: boolean };
export type FaqSection = { id: string; title: string; faqs: Faq[] };

export const sections: FaqSection[] = [
  {
    id: "orders",
    title: "Orders",
    faqs: [
      { id: "late", question: "My order is late. What can I do?", answer: "Check live tracking in the app. If it's more than 20 minutes past the estimate, contact support for a credit." },
      { id: "missing", question: "An item is missing from my order", answer: "Open the order, tap Help, and select the missing items. Refunds go to your original payment method." },
      { id: "cancel", question: "Can I cancel after the store accepts?", answer: "You can cancel, but you may be charged for items the store already prepared." },
    ],
  },
  {
    id: "payments",
    title: "Payments",
    faqs: [
      { id: "refund-time", question: "How long do refunds take?", answer: "Credits are instant. Card refunds take 5–7 business days." },
      { id: "giftcards", question: "Can I pay with a gift card?", answer: "Gift cards are being migrated to a new system and are temporarily unavailable.", disabled: true },
      { id: "split", question: "Can I split a payment?", answer: "Group orders let each person pay for their own items." },
    ],
  },
  {
    id: "dashpass",
    title: "DashPass",
    faqs: [
      { id: "what", question: "What is DashPass?", answer: "A membership with $0 delivery fees and reduced service fees on eligible orders." },
      { id: "pause", question: "Can I pause my membership?", answer: "Yes, for up to 3 months from Account → DashPass → Manage." },
    ],
  },
];
