/**
 * Recipe email template — renders a cook-ready recipe view for email clients.
 *
 * Uses @react-email/components so styles are inlined for broad client support
 * (Gmail, Apple Mail, Outlook). Layout mirrors the in-app recipe page sections:
 * header, metadata, nutrition, ingredients, numbered instructions, source.
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { Recipe } from '@/lib/types/recipe';

export interface RecipeEmailProps {
  recipe: Recipe;
  recipientName: string;
  senderName: string;
  senderNote?: string;
}

function parseInstructionWithHeading(instruction: string): { heading: string | null; body: string } {
  const match = instruction.match(/^\*\*([^*]+)\*\*:?\s*/);
  if (match) {
    return { heading: match[1].trim(), body: instruction.slice(match[0].length).trim() };
  }
  return { heading: null, body: instruction };
}

function formatIngredient(ing: Recipe['ingredients'][number]): string {
  const parts: string[] = [];
  if (ing.qty > 0) parts.push(String(ing.qty));
  if (ing.unit && ing.unit !== 'unit') parts.push(ing.unit);
  parts.push(ing.name);
  return parts.join(' ');
}

// Palette — kept self-contained so the template doesn't depend on design tokens
const colors = {
  text: '#111827',
  subdued: '#6b7280',
  border: '#e5e7eb',
  surface: '#f9fafb',
  accent: '#111827',
  link: '#2563eb',
};

const styles = {
  body: {
    backgroundColor: '#ffffff',
    color: colors.text,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    margin: 0,
    padding: 0,
  } as const,
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '24px',
  } as const,
  intro: {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
  } as const,
  noteCallout: {
    borderLeft: `3px solid ${colors.accent}`,
    backgroundColor: '#ffffff',
    padding: '12px 16px',
    marginTop: '12px',
    fontStyle: 'italic',
    color: colors.text,
  } as const,
  h1: { fontSize: '28px', lineHeight: '34px', fontWeight: 700, margin: '0 0 8px 0' } as const,
  h2: { fontSize: '20px', lineHeight: '26px', fontWeight: 700, margin: '0 0 12px 0' } as const,
  meta: { color: colors.subdued, fontSize: '14px', margin: '0 0 16px 0' } as const,
  sectionBox: {
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    padding: '16px',
    margin: '0 0 16px 0',
  } as const,
  nutritionGrid: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    margin: '0',
  } as const,
  nutritionCell: {
    border: `1px solid ${colors.border}`,
    padding: '12px',
    textAlign: 'center' as const,
    width: '25%',
  } as const,
  overline: {
    fontSize: '11px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: colors.subdued,
    margin: '0 0 4px 0',
  } as const,
  nutritionValue: { fontSize: '16px', fontWeight: 600, margin: 0 } as const,
  ingredient: { fontSize: '15px', lineHeight: '22px', margin: '0 0 6px 0' } as const,
  stepRow: {
    margin: '0 0 14px 0',
  } as const,
  stepNumber: {
    display: 'inline-block',
    width: '24px',
    height: '24px',
    lineHeight: '24px',
    borderRadius: '999px',
    backgroundColor: colors.accent,
    color: '#ffffff',
    textAlign: 'center' as const,
    fontWeight: 700,
    fontSize: '13px',
    marginRight: '8px',
    verticalAlign: 'top',
  } as const,
  stepBody: { fontSize: '15px', lineHeight: '22px', margin: 0, display: 'inline' } as const,
  footer: { fontSize: '12px', color: colors.subdued, margin: '24px 0 0 0' } as const,
};

export default function RecipeEmail({
  recipe,
  recipientName,
  senderName,
  senderNote,
}: RecipeEmailProps) {
  const chef = recipe.source?.chef || '';
  const isAIGenerated = recipe.id.startsWith('custom-ai-');
  const metaParts: string[] = [];
  if (recipe.timeMins) metaParts.push(`${recipe.timeMins} mins`);
  if (recipe.serves) metaParts.push(`Serves ${recipe.serves}`);
  if (recipe.costPerServeEst) metaParts.push(`$${recipe.costPerServeEst.toFixed(2)} per serve`);

  return (
    <Html>
      <Head />
      <Preview>{`${senderName} sent you a recipe: ${recipe.title}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.intro}>
            <Text style={{ margin: '0 0 4px 0', fontSize: '15px' }}>Hi {recipientName},</Text>
            <Text style={{ margin: 0, fontSize: '15px' }}>
              <strong>{senderName}</strong> sent you a recipe.
            </Text>
            {senderNote && senderNote.trim() && (
              <div style={styles.noteCallout}>
                <Text style={{ margin: 0, fontSize: '14px' }}>&ldquo;{senderNote.trim()}&rdquo;</Text>
              </div>
            )}
          </Section>

          <Heading style={styles.h1}>{recipe.title}</Heading>
          {metaParts.length > 0 && <Text style={styles.meta}>{metaParts.join(' • ')}</Text>}

          {recipe.nutrition && (
            <Section style={{ margin: '0 0 16px 0' }}>
              <table style={styles.nutritionGrid} cellPadding={0} cellSpacing={0}>
                <tbody>
                  <tr>
                    <td style={styles.nutritionCell}>
                      <Text style={styles.overline}>CALORIES</Text>
                      <Text style={styles.nutritionValue}>{recipe.nutrition.calories} kcal</Text>
                    </td>
                    <td style={styles.nutritionCell}>
                      <Text style={styles.overline}>PROTEIN</Text>
                      <Text style={styles.nutritionValue}>{recipe.nutrition.protein}g</Text>
                    </td>
                    <td style={styles.nutritionCell}>
                      <Text style={styles.overline}>CARBS</Text>
                      <Text style={styles.nutritionValue}>{recipe.nutrition.carbs}g</Text>
                    </td>
                    <td style={styles.nutritionCell}>
                      <Text style={styles.overline}>FAT</Text>
                      <Text style={styles.nutritionValue}>{recipe.nutrition.fat}g</Text>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
          )}

          <Section style={styles.sectionBox}>
            <Heading as="h2" style={styles.h2}>
              Ingredients
            </Heading>
            {recipe.ingredients.map((ing, i) => (
              <Text key={i} style={styles.ingredient}>
                • {formatIngredient(ing)}
              </Text>
            ))}
          </Section>

          {recipe.instructions && recipe.instructions.length > 0 && (
            <Section style={styles.sectionBox}>
              <Heading as="h2" style={styles.h2}>
                Instructions
              </Heading>
              {recipe.instructions.map((instruction, i) => {
                const { heading, body } = parseInstructionWithHeading(instruction);
                return (
                  <div key={i} style={styles.stepRow}>
                    <span style={styles.stepNumber}>{i + 1}</span>
                    <Text style={styles.stepBody}>
                      {heading && (
                        <>
                          <strong>{heading}</strong>{' '}
                        </>
                      )}
                      {body}
                    </Text>
                  </div>
                );
              })}
            </Section>
          )}

          <Hr style={{ borderColor: colors.border, margin: '24px 0' }} />

          <Text style={styles.footer}>
            {isAIGenerated ? (
              <>AI-generated recipe based on family preferences.</>
            ) : (
              <>
                Recipe from {chef || 'unknown source'}
                {recipe.source?.url && (
                  <>
                    {' • '}
                    <Link href={recipe.source.url} style={{ color: colors.link }}>
                      View original
                    </Link>
                  </>
                )}
              </>
            )}
          </Text>
          <Text style={styles.footer}>Shared with you via meal-agent.</Text>
        </Container>
      </Body>
    </Html>
  );
}
