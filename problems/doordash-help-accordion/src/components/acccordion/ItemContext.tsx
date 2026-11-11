import { createContext, ReactNode, useContext, useEffect, useId } from "react";
import { useAccordionContext } from "./AccordionContext";

type ItemContextType = {
  triggerId: string;
  contentId: string;
  disabled: boolean;
  value: string;
};
const ItemContext = createContext<ItemContextType | undefined>(undefined);

interface Props {
  value: string;
  disabled: boolean;
  children: ReactNode;
}
export function ItemProvider({ value, disabled, children }: Props) {
  const id = useId();
  const triggerId = `trigger-${id}`;
  const { registerItem, unregisterItem } = useAccordionContext();

  useEffect(() => {
    registerItem(id, triggerId, value, disabled);
    return () => unregisterItem(id);
  }, [id, triggerId, value, disabled]);

  return (
    <ItemContext
      value={{
        triggerId: triggerId,
        contentId: `content-${id}`,
        value,
        disabled,
      }}
    >
      {children}
    </ItemContext>
  );
}

export function useItemContext() {
  const ctx = useContext(ItemContext);
  if (!ctx) {
    throw new Error(
      "Accordion.Trigger and Accordion.Content must be used inside Accordion.Item",
    );
  }
  return ctx;
}
