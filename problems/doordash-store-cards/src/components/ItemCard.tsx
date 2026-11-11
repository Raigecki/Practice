import type { Item } from "../hooks/use-get-catalog";

interface Props {
  item: Item;
}

export default function ItemCard({ item }: Props) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", flexDirection: "row" }}>
        <img
          src={item.imageUrl ?? undefined}
          alt={item.name}
          style={{ width: "200px", height: "200px", objectFit: "cover" }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontWeight: "bold",
              fontSize: "1rem",
              wordBreak: "break-word",
            }}
          >
            {item.name}
          </span>
          <div style={{ display: "flex", flexDirection: "row", gap: "4px" }}>
            <span>{item.rating}</span>
            <span>⭐</span>
            <span>{`(${item.reviewCount})`}</span>
            <span>{item.priceRange}</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: "4px",
              flexWrap: "wrap",
            }}
          >
            {item.cuisine.map((cuisine) => (
              <span
                style={{ border: "1px solid black", padding: "2px 4px" }}
                key={cuisine}
              >
                {cuisine}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "row", gap: "4px" }}>
            <span>{item.distanceMiles} mi;</span>
            <span>
              {item.deliveryTimeMinutes.min} - {item.deliveryTimeMinutes.max}{" "}
              mins
            </span>
          </div>
          <span
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.promo}
          </span>
        </div>
      </div>
    </div>
  );
}
