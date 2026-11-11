import type { Item } from "../hooks/use-get-catalog";
import ItemCard from "./ItemCard";

interface Props {
  items: Item[];
}

export default function ItemsGrid({ items }: Props) {
  return (
    <div
      style={{
        display: "grid",
        width: "100%",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "16px",
      }}
    >
      {items.map((item) => {
        return <ItemCard key={item.id} item={item} />;
      })}
    </div>
  );
}
