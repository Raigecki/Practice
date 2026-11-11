import { ReactNode } from "react";
import { useAccordionContext, AccordionProvider } from "./AccordionContext";
import { useItemContext, ItemProvider } from "./ItemContext";

type SingleProps = {
  type?: "single";
  value?: string | null;
  defaultValue?: string;
  onValueChange?: (value: string | null) => void;
};

type MultipleProps = {
  type: "multiple";
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
};

export type AccordionProps = (SingleProps | MultipleProps) & {
  children: ReactNode;
};

export default function Accordion({ children, ...rest }: AccordionProps) {
  return (
    <AccordionProvider {...rest}>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {children}
      </div>
    </AccordionProvider>
  );
}

export function Toolbar() {
  const { expandAll, collapseAll, count, size, accordionType } =
    useAccordionContext();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", gap: "4px" }}>
        {accordionType === "multiple" ? (
          <button onClick={() => expandAll()}>Expand all</button>
        ) : null}
        <button onClick={() => collapseAll()}>Collapse all</button>
      </div>

      <span>{`Current Open: ${count} of ${size}`}</span>
    </div>
  );
}

interface ItemProps {
  value: string;
  disabled?: boolean;
  children: ReactNode;
}
export function Item({ value, disabled = false, children }: ItemProps) {
  return (
    <ItemProvider value={value} disabled={disabled}>
      {children}
    </ItemProvider>
  );
}

interface TriggerProps {
  children: ReactNode;
}
export function Trigger({ children }: TriggerProps) {
  const { triggerId, contentId, value, disabled } = useItemContext();
  const { onTriggerClick, isOpen, getNextTrigger } = useAccordionContext();

  return (
    <button
      id={triggerId}
      disabled={disabled}
      aria-expanded={isOpen(value)}
      aria-controls={contentId}
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        border: "solid 1px #75767B",
        padding: "2px 4px",
        cursor: "pointer",
      }}
      onClick={() => onTriggerClick(value)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          getNextTrigger(triggerId, 1)?.focus();
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          getNextTrigger(triggerId, -1)?.focus();
        }
        if (e.key === "Home") {
          e.preventDefault();
          getNextTrigger(triggerId, 1, -1)?.focus();
        }
        if (e.key === "End") {
          e.preventDefault();
          getNextTrigger(triggerId, -1, 1)?.focus();
        }
      }}
    >
      {children}
    </button>
  );
}

interface ContentProps {
  children: ReactNode;
}
export function Content({ children }: ContentProps) {
  const { triggerId, contentId, value } = useItemContext();
  const { isOpen } = useAccordionContext();

  return isOpen(value) ? (
    <div
      id={contentId}
      aria-labelledby={triggerId}
      role="region"
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "4px 8px",
      }}
    >
      {children}
    </div>
  ) : null;
}

Accordion.Item = Item;
Accordion.Trigger = Trigger;
Accordion.Content = Content;
Accordion.Toolbar = Toolbar;
