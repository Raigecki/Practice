import { useState } from "react";
import Accordion from "./components/acccordion/Accordion";
import { sections } from "./faq";

// Build the help center here using the Accordion you write in components/Accordion.tsx.
export default function App() {
  const [refundState, setRefundState] = useState(null);
  return (
    <main>
      <h1>Part 4</h1>
      <Accordion>
        <Accordion.Toolbar />
        {sections.map((section) => (
          <Accordion.Item key={section.id} value={section.id}>
            <Accordion.Trigger>{section.title}</Accordion.Trigger>
            <Accordion.Content>
              <Accordion type="multiple">
                <Accordion.Toolbar />
                {section.faqs.map((faq) => (
                  <Accordion.Item
                    key={faq.id}
                    value={faq.id}
                    disabled={faq.disabled}
                  >
                    <Accordion.Trigger>{faq.question}</Accordion.Trigger>
                    <Accordion.Content>{faq.answer}</Accordion.Content>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion>

      <h1>Help Center</h1>
      <pre>{JSON.stringify(sections, null, 2)}</pre>
      {sections.map((section) => {
        if (section.id === "payments") {
          return null;
        } else {
          return (
            <div key={section.id}>
              <h2>{section.title}</h2>
              <Accordion type="multiple">
                {section.faqs.map((faq) => (
                  <Accordion.Item key={faq.id} value={faq.id}>
                    <Accordion.Trigger>{faq.question}</Accordion.Trigger>
                    <Accordion.Content>{faq.answer}</Accordion.Content>
                  </Accordion.Item>
                ))}
              </Accordion>
            </div>
          );
        }
      })}
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <h2>{sections.find((s) => s.id === "payments").title}</h2>
        <button onClick={() => setRefundState("refund-time")}>
          Toggle refunds
        </button>
      </div>
      <Accordion
        value={refundState}
        onValueChange={(currentState) => setRefundState(currentState)}
      >
        {sections
          .find((s) => s.id === "payments")
          .faqs.map((faq) => (
            <Accordion.Item
              key={faq.id}
              value={faq.id}
              disabled={faq.id === "giftcards"}
            >
              <Accordion.Trigger>{faq.question}</Accordion.Trigger>
              <Accordion.Content>{faq.answer}</Accordion.Content>
            </Accordion.Item>
          ))}
      </Accordion>
    </main>
  );
}
