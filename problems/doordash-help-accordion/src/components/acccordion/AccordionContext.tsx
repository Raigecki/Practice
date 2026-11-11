import { createContext, ReactNode, useContext, useRef, useState } from "react";
import { AccordionProps } from "./Accordion";

type AccordionContextType = {
  isOpen: (value: string) => boolean;
  onTriggerClick: (value: string) => void;
  registerItem: (
    itemId: string,
    triggerId: string,
    value: string,
    disabled: boolean,
  ) => void;
  unregisterItem: (itemId: string) => void;
  getNextTrigger: (
    id: string,
    dir: 1 | -1,
    anchor?: 1 | -1,
  ) => HTMLButtonElement | null;
  expandAll: () => void;
  collapseAll: () => void;
  count: number;
  size: number;
  accordionType: "single" | "multiple";
};

type ItemInfo = {
  itemId: string;
  triggerId: string;
  value: string;
  disabled: boolean;
};

const AccordionContext = createContext<AccordionContextType | undefined>(
  undefined,
);

function normalizeValues(value: string | string[] | null | undefined) {
  if (!value) {
    return [];
  } else if (typeof value === "string") {
    return [value];
  } else return value;
}

export function AccordionProvider({
  type,
  value: outsideValue,
  defaultValue,
  onValueChange,
  children,
}: AccordionProps) {
  const _defaultValue = normalizeValues(defaultValue);
  const _value = normalizeValues(outsideValue);

  const items = useRef<Record<string, ItemInfo>>({});
  const [currentOpen, setCurrentOpen] = useState<string[]>(_defaultValue);
  const [size, setSize] = useState(0);
  const state = outsideValue !== undefined ? _value : currentOpen;

  function handleTriggerClick(value: string) {
    const next =
      type === "multiple"
        ? state.includes(value)
          ? state.filter((v) => v !== value)
          : [...state, value]
        : state.includes(value)
          ? []
          : [value];

    setCurrentOpen(next);
    if (type === "multiple") {
      onValueChange?.(next);
    } else {
      onValueChange?.(next[0] ?? null);
    }
  }

  const handleIsOpen = (value: string) => state.includes(value);

  const handleExpandAll = () => {
    const nonDisabled = Object.values(items.current).filter(
      (item) => !item.disabled,
    );
    const nonDisabledValues = nonDisabled.map((item) => item.value);
    console.log("nonDisabledValues:", nonDisabledValues);
    setCurrentOpen(nonDisabledValues);
    if (type === "multiple") {
      onValueChange?.(nonDisabledValues);
    } else {
      onValueChange?.(nonDisabledValues[0] ?? null);
    }
  };

  const handleCollapseAll = () => {
    setCurrentOpen([]);
    if (type === "multiple") {
      onValueChange?.([]);
    } else {
      onValueChange?.(null);
    }
  };

  const registerItem = (
    itemId: string,
    triggerId: string,
    value: string,
    disabled: boolean,
  ) => {
    items.current[itemId] = {
      itemId,
      triggerId,
      value,
      disabled,
    };
    setSize(Object.keys(items.current).length);
  };
  const unregisterItem = (id: string) => {
    delete items.current[id];
    setSize(Object.keys(items.current).length);
  };

  const getNextTrigger = (id: string, dir: number, anchor?: number) => {
    const currentItems = Object.values(items.current);
    const n = currentItems.length;

    let i;
    if (anchor !== undefined) {
      anchor > 0 ? (i = n) : (i = -1);
    } else {
      i = currentItems.findIndex((item) => item["triggerId"] === id);
      //i = triggers.current.indexOf(id);
    }
    for (let step = 0; step < n; step++) {
      i = (i + dir + n) % n;
      const currId = currentItems[i].triggerId;
      const element = document.getElementById(
        currId,
      ) as HTMLButtonElement | null;
      if (element && !element.disabled) {
        return element;
      }
    }
    return null;
  };

  const contextValue = {
    isOpen: handleIsOpen,
    onTriggerClick: handleTriggerClick,
    registerItem,
    unregisterItem,
    getNextTrigger,
    expandAll: handleExpandAll,
    collapseAll: handleCollapseAll,
    count: state.length,
    size,
    accordionType: type ?? "single",
  };
  return <AccordionContext value={contextValue}>{children}</AccordionContext>;
}

export function useAccordionContext() {
  const ctx = useContext(AccordionContext);
  if (!ctx) {
    throw new Error(
      "Accordion.Item/Trigger/Content must be used inside <Accordion>",
    );
  }
  return ctx;
}
