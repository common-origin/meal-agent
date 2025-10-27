"use client";

import { useEffect, useState } from "react";
import { Stack, Typography } from "@common-origin/design-system";
import { toggleFavorite, isFavorite } from "@/lib/storage";

type RecipePageProps = {
  params: Promise<{ id: string }>;
};

export default function RecipePage({ params }: RecipePageProps) {
  const [id, setId] = useState<string>("");
  const [favorited, setFavorited] = useState(false);
  
  useEffect(() => {
    params.then((resolvedParams) => {
      setId(resolvedParams.id);
      setFavorited(isFavorite(resolvedParams.id));
    });
  }, [params]);

  const handleFavoriteClick = () => {
    toggleFavorite(id);
    setFavorited(!favorited);
  };
  
  return (
    <main style={{ padding: 24, position: "relative" }}>
      {/* Heart toggle button */}
      {id && (
        <button
          onClick={handleFavoriteClick}
          style={{
            position: "absolute",
            top: "24px",
            right: "24px",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "32px",
            padding: "4px",
            lineHeight: 1
          }}
          aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
        >
          {favorited ? "❤️" : "🤍"}
        </button>
      )}

      <Stack direction="column" gap="lg">
        <Typography variant="h1">Recipe {id}</Typography>
        <Typography variant="body">
          Recipe details, provenance information, and external link will appear here.
        </Typography>
        <Typography variant="body">
          Attribution and source tracking coming soon...
        </Typography>
      </Stack>
    </main>
  );
}