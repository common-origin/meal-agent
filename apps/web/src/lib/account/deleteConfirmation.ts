/**
 * What a user types to confirm deleting their account (#224): their email,
 * or DELETE for an account that has none.
 */
export function deleteConfirmation(email: string | null | undefined): string {
  return email || 'DELETE';
}
