import { Stack, Typography } from "@common-origin/design-system";

export default function OnboardingPage() {
  return (
    <main style={{ padding: 24 }}>
      <Stack direction="column" gap="lg">
        <Typography variant="h1">Welcome to Meal Agent</Typography>
        <Typography variant="body">
          Let&apos;s get started with your family meal planning journey.
        </Typography>
        <Typography variant="body">
          Multi-step onboarding flow coming soon...
        </Typography>
      </Stack>
    </main>
  );
}