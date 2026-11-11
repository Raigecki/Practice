import { useState } from "react";
import Toolbar from "./Toolbar";
import useGetCatalog from "../hooks/use-get-catalog";
import ItemsGrid from "./ItemsGrid";

export default function Catalog() {
  const { items, isLoading, error } = useGetCatalog();
  const [sortBy, setSortBy] = useState<string>();
  const [fuzzySearch, setFuzzySearch] = useState<string>();
  const [filters, setFilters] = useState<Map<string, string>>();

  const _items = items
    .filter((item) => {
      if (
        filters?.has("is_open") &&
        filters.get("is_open") === "true" &&
        !item.isOpen
      ) {
        return false;
      }
      if (
        filters?.has("price") &&
        filters.get("price") !== "" &&
        item.priceRange !== filters.get("price")
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return (b.rating || 0) - (a.rating || 0);
        case "price":
          return a.distanceMiles - b.distanceMiles;
        case "delivery_time":
          return a.deliveryTimeMinutes.min - b.deliveryTimeMinutes.min;
        default:
          return 0;
      }
    });

  function handleFilterChange(key: string, value: string, add: boolean) {
    setFilters((prevFilters) => {
      if (add) {
        const newFilters = new Map(prevFilters);
        newFilters.set(key, value);
        return newFilters;
      } else {
        const newFilters = new Map(prevFilters);
        newFilters.delete(key);
        return newFilters;
      }
    });
  }

  function handleSortChange(value: string) {
    setSortBy(value);
  }

  function handleFuzzySearchChange(value: string) {
    setFuzzySearch(value);
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }
  if (error) {
    return <div>Error: {error}</div>;
  }
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
      }}
    >
      <Toolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        fuzzySearch={fuzzySearch}
        onFuzzySearchChange={handleFuzzySearchChange}
      />
      <ItemsGrid items={_items} />
    </div>
  );
}
