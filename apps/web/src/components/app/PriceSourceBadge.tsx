/**
 * PriceSourceBadge Component
 * Shows the source of price information (API, Static, Category estimate)
 */

import { Chip, Tag } from "@common-origin/design-system";

interface PriceSourceBadgeProps {
  source: 'api' | 'static' | 'category';
  livePrice?: boolean;
}

export default function PriceSourceBadge({ source, livePrice }: PriceSourceBadgeProps) {
  if (source === 'api' && livePrice) {
    return (
      <Tag variant="success">Live price</Tag>
    );
  }
  
  if (source === 'static') {
    return (
      <Tag variant="interactive" border={false}>Static price</Tag>
    );
  }
  
  return (
    <Tag variant="default">Estimated price</Tag>
  );
}
