"use client";

import { useEffect, useState } from "react";
import { Stack, Typography } from "@common-origin/design-system";

type RecipePageProps = {
  params: Promise<{ id: string }>;
};

export default function RecipePage({ params }: RecipePageProps) {
  const [id, setId] = useState<string>("");
  
  useEffect(() => {
    params.then((resolvedParams) => {
      setId(resolvedParams.id);
    });
  }, [params]);
  
  return (
    <main style={{ padding: 24 }}>
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