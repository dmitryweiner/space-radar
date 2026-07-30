import type { CardDefinition } from './types';

interface CardVisibilityMenuProps {
  registry: CardDefinition[];
  visibleIds: string[];
  onToggle: (id: string) => void;
}

export function CardVisibilityMenu({ registry, visibleIds, onToggle }: CardVisibilityMenuProps) {
  return (
    <ul className="card-visibility-menu">
      {registry.map((card) => (
        <li key={card.id}>
          <label>
            <input
              type="checkbox"
              checked={visibleIds.includes(card.id)}
              onChange={() => onToggle(card.id)}
            />
            {card.title}
          </label>
        </li>
      ))}
    </ul>
  );
}
