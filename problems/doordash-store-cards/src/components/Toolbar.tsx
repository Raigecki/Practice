interface Props {
  filters: Map<string, string> | undefined;
  onFilterChange: (key: string, value: string, add: boolean) => void;
  sortBy: string | undefined;
  onSortChange: (value: string) => void;
  fuzzySearch: string | undefined;
  onFuzzySearchChange: (value: string) => void;
}

export default function Toolbar(props: Props) {
  const {
    filters,
    onFilterChange,
    sortBy,
    onSortChange,
    fuzzySearch,
    onFuzzySearchChange,
  } = props;
  return (
    <div style={{ width: "100%", marginBottom: "12px" }}>
      <input
        type="text"
        style={{ width: "100%", padding: "8px", marginBottom: "12px" }}
        value={fuzzySearch}
        onChange={(e) => onFuzzySearchChange(e.target.value)}
        placeholder="Search..."
      />
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <select value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
          <option value="">Sort by</option>
          <option value="rating">Rating</option>
          <option value="price">Distance</option>
          <option value="delivery_time">Delivery Time</option>
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span>Is open:</span>
        </div>
        <input
          type="checkbox"
          checked={filters?.has("is_open") || false}
          onChange={(e) =>
            onFilterChange(
              "is_open",
              e.target.checked ? "true" : "false",
              e.target.checked,
            )
          }
        />
        <select
          value={filters?.has("price") ? filters.get("price") : ""}
          onChange={(e) =>
            onFilterChange("price", e.target.value, !!e.target.value)
          }
        >
          <option value="">Price</option>
          <option value="$">$</option>
          <option value="$$">$$</option>
          <option value="$$$">$$$</option>
        </select>
      </div>
    </div>
  );
}
