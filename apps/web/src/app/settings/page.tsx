"use client";

import { useState, useEffect } from "react";
import { Alert, Box, Button, Checkbox, Chip, Container, Dropdown, Modal, NumberInput, Slider, Stack, TextField, Typography } from "@common-origin/design-system";
import Main from "@/components/app/Main";import {
  getFamilySettings,
  saveFamilySettings,
  resetFamilySettings
} from "@/lib/hybridStorage";
import type { FamilySettings } from "@/lib/types/settings";
import { validateFamilySettings, DEFAULT_FAMILY_SETTINGS, DIETARY_TYPE_OPTIONS, MAX_RECIPE_RECIPIENTS, MAX_FLAVOR_PROFILE_LENGTH, MAX_SETTING_TEXT_LENGTH } from "@/lib/types/settings";
import { track } from "@/lib/analytics";
import SettingsSection, { SettingsField, SettingsForm } from "@/components/app/SettingsSection";
import ColesExtensionSettings from "@/components/app/ColesExtensionSettings";

/**
 * Adults is a choice of 1 to 4 (#196). A household saved with more (validation
 * allows up to 10) keeps its number as an extra option rather than a blank field.
 */
function adultOptions(current: number): { id: string; label: string }[] {
  const counts = current > 4 ? [1, 2, 3, 4, current] : [1, 2, 3, 4];
  return counts.map((n) => ({ id: String(n), label: String(n) }));
}

/** The weekly planning reminder's fixed time (#196). */
const REMINDER_TIME = '09:00';

export default function SettingsPage() {
  const [settings, setSettings] = useState<FamilySettings>(DEFAULT_FAMILY_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [icsUrl, setIcsUrl] = useState<string | null>(null);
  const [icsError, setIcsError] = useState<string | null>(null);

  useEffect(() => {
    track('page_view', { page: '/settings' });

    // Load settings from Supabase
    const loadSettings = async () => {
      const loadedSettings = await getFamilySettings();
      setSettings(loadedSettings);
    };
    loadSettings();

    // Load the calendar feed URL (only available for signed-in households —
    // an unauthenticated/local-only user has no server-side plan to poll)
    const loadIcsUrl = async () => {
      try {
        const res = await fetch('/api/household/ics-url');
        const body = await res.json();
        if (res.ok) {
          setIcsUrl(body.icsUrl);
        } else {
          setIcsError(body.error ?? 'Could not load calendar link.');
        }
      } catch {
        setIcsError('Could not load calendar link.');
      }
    };
    loadIcsUrl();
  }, []);

  const copyIcsUrl = () => {
    if (!icsUrl) return;
    navigator.clipboard.writeText(icsUrl);
    alert('Calendar link copied to clipboard!');
  };

  const handleSave = async () => {
    const validationErrors = validateFamilySettings(settings);
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      // Scroll to top to show errors
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // The reminder is always at 9am (#196): there's no time to pick, so an older saved time is replaced.
    const success = await saveFamilySettings({ ...settings, weeklyReminderTime: REMINDER_TIME });
    if (success) {
      setSaved(true);
      setErrors([]);
      // Track as override saved since user is customizing their preferences
      track('override_saved', { 
        cuisines: settings.cuisines.length,
        glutenFree: settings.glutenFreePreference,
        budgetRange: `${settings.budgetPerMeal.min}-${settings.budgetPerMeal.max}`,
      });
      
      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Hide success message after 3 seconds
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      await resetFamilySettings();
      const resetSettings = await getFamilySettings();
      setSettings(resetSettings);
      track('override_saved', { reset: true });
    }
  };

  // "Add child" opens a dialog to pick the new child's age (#196).
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [newChildAge, setNewChildAge] = useState(5);

  const openAddChild = () => {
    setNewChildAge(5);
    setAddChildOpen(true);
  };

  const confirmAddChild = () => {
    setSettings(prev => ({
      ...prev,
      children: [...prev.children, { age: newChildAge }],
      totalServings: prev.totalServings + 1,
    }));
    setAddChildOpen(false);
  };

  const removeChild = (index: number) => {
    setSettings(prev => ({
      ...prev,
      children: prev.children.filter((_, i) => i !== index),
      totalServings: Math.max(1, prev.totalServings - 1),
    }));
  };

  // Recipe recipients (people you can email recipes to). "Add recipient" opens a dialog (#196).
  const [addRecipientOpen, setAddRecipientOpen] = useState(false);
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const recipients = settings.recipeRecipients ?? [];
  const recipientsAtCap = recipients.length >= MAX_RECIPE_RECIPIENTS;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const canAddRecipient =
    !recipientsAtCap &&
    newRecipientName.trim().length > 0 &&
    emailRe.test(newRecipientEmail.trim()) &&
    !recipients.some(r => r.email.toLowerCase() === newRecipientEmail.trim().toLowerCase());
  // Why the email can't be added yet, once something is typed
  const newEmail = newRecipientEmail.trim();
  const newRecipientEmailError =
    newEmail.length === 0 ? undefined
    : !emailRe.test(newEmail) ? 'Enter a valid email address'
    : recipients.some(r => r.email.toLowerCase() === newEmail.toLowerCase()) ? 'Already a recipient'
    : undefined;

  const openAddRecipient = () => {
    setNewRecipientName('');
    setNewRecipientEmail('');
    setAddRecipientOpen(true);
  };

  const confirmAddRecipient = () => {
    if (!canAddRecipient) return;
    setSettings(prev => ({
      ...prev,
      recipeRecipients: [...(prev.recipeRecipients ?? []), { name: newRecipientName.trim(), email: newRecipientEmail.trim() }],
    }));
    setAddRecipientOpen(false);
  };

  const removeRecipient = (index: number) => {
    setSettings(prev => ({
      ...prev,
      recipeRecipients: (prev.recipeRecipients ?? []).filter((_, i) => i !== index),
    }));
  };

  return (
    <>
			<Main maxWidth="960px">
				<Container>
					<Stack direction="column" gap="xl">
						{/* Header */}
						<Stack direction="column" gap="sm">
							<Typography variant="h1">Settings</Typography>
							<Typography variant="body">
								Configure your family&apos;s preferences for AI-powered meal planning
							</Typography>
						</Stack>

					{/* Success Message */}
					{saved && (
						<Alert 
							variant="success" 
							dismissible 
							onDismiss={() => setSaved(false)}
						>
							Settings saved successfully!
						</Alert>
					)}

					{/* Errors */}
					{errors.length > 0 && (
						<Alert variant="error" title="Please fix the following errors:">
							<Stack direction="column" gap="xs">
								{errors.map((error, i) => (
									<Typography key={i} variant="small">
										• {error}
									</Typography>
								))}
							</Stack>
						</Alert>
					)}

						{/* Each section: title and description left, inputs right, one card with dividers (#196) */}
						<SettingsForm>
							<SettingsSection
								title="Household"
								description="Who you're cooking for. New recipes are written for the total servings."
							>
								<Stack direction="column" gap="2xl">
									<SettingsField>
										<Dropdown
											label="Adults"
											value={String(settings.adults)}
											onChange={(value) => {
												const numValue = Number(value);
												setSettings(prev => ({
													...prev,
													adults: numValue,
													totalServings: numValue + prev.children.length
												}));
											}}
											options={adultOptions(settings.adults)}
										/>
									</SettingsField>
									<Stack direction="column" gap="2xl">
										{/* One card per child, as Recipe sharing lists its recipients (#196) */}
										{settings.children.length > 0 && (
											<Stack direction="column" gap="sm">
												{settings.children.map((child, index) => (
													<Box
														key={index}
														border="default"
														borderRadius="md"
														p="md"
														bg="color.fill.muted"
													>
														<Stack direction="row" gap="md" justifyContent="space-between" alignItems="center">
															<Stack direction="column" gap="xs">
																<Typography variant="body"><strong>Child {index + 1}</strong></Typography>
																<Typography variant="small" color="subdued">Age {child.age}</Typography>
															</Stack>
															<Button
																variant="secondary"
																size="small"
																onClick={() => removeChild(index)}
																aria-label={`Remove child ${index + 1}`}
															>
																Remove
															</Button>
														</Stack>
													</Box>
												))}
											</Stack>
										)}
										{/* Adding a child opens a dialog to pick their age (#196) */}
										<Stack direction="row">
											<Button variant="secondary" size="medium" iconName="add" onClick={openAddChild}>
												Add child
											</Button>
										</Stack>
										<Modal
											isOpen={addChildOpen}
											onClose={() => setAddChildOpen(false)}
											title="Add a child"
											size="small"
											actions={[
												{ label: 'Cancel', onClick: () => setAddChildOpen(false), variant: 'secondary' },
												{ label: 'Add child', onClick: confirmAddChild, variant: 'primary' },
											]}
										>
											<NumberInput
												label="Age"
												min={0}
												max={18}
												value={newChildAge}
												onChange={(value) => setNewChildAge(typeof value === 'number' ? value : 0)}
												placeholder="Child's age"
											/>
										</Modal>
									</Stack>

									{/* One string: the chip is a flex box, so separate text and <strong> nodes lost their space */}
									<Box>
										<Chip>{`Total servings: ${settings.totalServings}`}</Chip>
									</Box>
								</Stack>
							</SettingsSection>

							<SettingsSection
								title="Dietary requirements"
								description="Set your primary diet type and any additional preferences"
							>
								<Stack direction="column" gap="2xl">
									<SettingsField>
										<Dropdown
											label="Primary diet"
											helperText="This determines the types of recipes we'll suggest"
											value={settings.dietaryType}
											onChange={(value) => setSettings(prev => ({
												...prev,
												dietaryType: value as FamilySettings['dietaryType']
											}))}
											options={DIETARY_TYPE_OPTIONS.map(opt => ({ id: opt.id, label: opt.label }))}
										/>
									</SettingsField>
									<Stack direction="column" gap="sm">
										<Typography variant="label">Additional preferences</Typography>

										<Checkbox
											label="Prefer gluten-free options"
											checked={settings.glutenFreePreference}
											onChange={(e) => setSettings(prev => ({
												...prev,
												glutenFreePreference: e.target.checked
											}))}
										/>

										<Checkbox
											label="Dairy-free"
											checked={settings.dairyFree}
											onChange={(e) => setSettings(prev => ({
												...prev,
												dairyFree: e.target.checked
											}))}
										/>

										<Checkbox
											label="Focus on high protein meals"
											checked={settings.proteinFocus}
											onChange={(e) => setSettings(prev => ({
												...prev,
												proteinFocus: e.target.checked
											}))}
										/>

										<Checkbox
											label="Leftover-friendly meals"
											checked={settings.leftoverFriendly}
											onChange={(e) => setSettings(prev => ({
												...prev,
												leftoverFriendly: e.target.checked
											}))}
										/>
									</Stack>
								</Stack>
							</SettingsSection>

							<SettingsSection
								title="Cooking profile"
								description="Help us understand your cooking preferences and skill level"
							>
								<Stack direction="column" gap="2xl">
									<Box>
										<SettingsField>
											<Dropdown
												label="Spice tolerance"
												helperText="How spicy can your meals be?"
												value={settings.spiceTolerance}
												onChange={(value) => setSettings(prev => ({
													...prev,
													spiceTolerance: value as 'very_mild' | 'mild' | 'medium' | 'hot' | 'loves_hot'
												}))}
												options={[
													{ id: 'very_mild', label: 'Very Mild (no spice)' },
													{ id: 'mild', label: 'Mild (a little kick)' },
													{ id: 'medium', label: 'Medium (moderate heat)' },
													{ id: 'hot', label: 'Hot (bring the heat!)' },
													{ id: 'loves_hot', label: 'Loves Hot (extra spicy)' }
												]}
											/>
										</SettingsField>
									</Box>

									<Box>
										<SettingsField>
											<Dropdown
												label="Cooking skill"
												helperText="How comfortable are you following recipes?"
												value={settings.cookingSkill}
												onChange={(value) => setSettings(prev => ({
													...prev,
													cookingSkill: value as 'beginner' | 'intermediate' | 'confident_home_cook' | 'advanced'
												}))}
												options={[
													{ id: 'beginner', label: 'Beginner (new to cooking)' },
													{ id: 'intermediate', label: 'Intermediate (comfortable with basics)' },
													{ id: 'confident_home_cook', label: 'Confident Home Cook' },
													{ id: 'advanced', label: 'Advanced (love a challenge)' }
												]}
											/>
										</SettingsField>
									</Box>

									<Box>
										<SettingsField>
											<Dropdown
												label="Effort preference"
												helperText="How much time and clean-up is okay on most nights?"
												value={settings.effortPreference}
												onChange={(value) => setSettings(prev => ({
													...prev,
													effortPreference: value as 'minimal_clean_up' | 'balanced' | 'happy_to_spend_time_on_weekends'
												}))}
												options={[
													{ id: 'minimal_clean_up', label: 'Minimal Clean-up (one-pot meals)' },
													{ id: 'balanced', label: 'Balanced (reasonable effort)' },
													{ id: 'happy_to_spend_time_on_weekends', label: 'Happy to spend time on weekends' }
												]}
											/>
										</SettingsField>
									</Box>

									<Box>
										<SettingsField>
											<TextField
												label="Flavor profile description"
												helperText="Describe your family&apos;s taste preferences in a few words"
												value={settings.flavorProfileDescription}
												maxLength={MAX_FLAVOR_PROFILE_LENGTH}
												onChange={(e) => setSettings(prev => ({
													...prev,
													flavorProfileDescription: e.target.value
												}))}
												placeholder="e.g., fresh & herby, avoids heavy cream"
											/>
										</SettingsField>
									</Box>
								</Stack>
							</SettingsSection>

							<SettingsSection
								title="Location & seasonality"
								description="Used for ingredient availability and seasonal preferences"
							>
								<Stack direction="column" gap="2xl">
									<SettingsField>
										<TextField
											label="City"
											value={settings.location.city}
											maxLength={MAX_SETTING_TEXT_LENGTH}
											onChange={(e) => setSettings(prev => ({
												...prev,
												location: {
													...prev.location,
													city: e.target.value
												}
											}))}
											placeholder="e.g., Melbourne"
										/>
									</SettingsField>

									<SettingsField>
										<TextField
											label="Country"
											value={settings.location.country}
											maxLength={MAX_SETTING_TEXT_LENGTH}
											onChange={(e) => setSettings(prev => ({
												...prev,
												location: {
													...prev.location,
													country: e.target.value
												}
											}))}
											placeholder="e.g., Australia"
										/>
									</SettingsField>

									<Box>
										<SettingsField>
											<Dropdown
												label="Hemisphere"
												helperText="Affects seasonal ingredient recommendations"
												value={settings.location.hemisphere}
												onChange={(value) => setSettings(prev => ({
													...prev,
													location: {
														...prev.location,
														hemisphere: value as 'northern' | 'southern'
													}
												}))}
												options={[
													{ id: 'northern', label: 'Northern Hemisphere' },
													{ id: 'southern', label: 'Southern Hemisphere' }
												]}
											/>
										</SettingsField>
									</Box>
								</Stack>
							</SettingsSection>

							<SettingsSection
								title="Budget & time"
								description="What a dinner should cost and how long it can take. The plan's budget is the max per meal times its dinners."
							>
								<Stack direction="column" gap="2xl">
									<Slider
										label={`Budget per meal (min): $${settings.budgetPerMeal.min}`}
										min={10}
										max={50}
										value={settings.budgetPerMeal.min}
										onChange={(value: number) => setSettings(prev => ({
											...prev,
											budgetPerMeal: {
												...prev.budgetPerMeal,
												min: value
											}
										}))}
									/>

									<Slider
										label={`Budget per meal (max): $${settings.budgetPerMeal.max}`}
										min={10}
										max={50}
										value={settings.budgetPerMeal.max}
										onChange={(value: number) => setSettings(prev => ({
											...prev,
											budgetPerMeal: {
												...prev.budgetPerMeal,
												max: value
											}
										}))}
									/>

									<Slider
										label={`Max cooking time (weeknights): ${settings.maxCookTime.weeknight} minutes`}
										min={15}
										max={90}
										step={5}
										value={settings.maxCookTime.weeknight}
										onChange={(value: number) => setSettings(prev => ({
											...prev,
											maxCookTime: {
												...prev.maxCookTime,
												weeknight: value
											}
										}))}
									/>

									<Slider
										label={`Max cooking time (weekends): ${settings.maxCookTime.weekend} minutes`}
										min={15}
										max={120}
										step={5}
										value={settings.maxCookTime.weekend}
										onChange={(value: number) => setSettings(prev => ({
											...prev,
											maxCookTime: {
												...prev.maxCookTime,
												weekend: value
											}
										}))}
									/>
								</Stack>
							</SettingsSection>

							<SettingsSection
								title="Batch cooking"
								description="Cook in bulk on one day and eat from it across the week."
							>
								<Stack direction="column" gap="2xl">
									<Checkbox
										label="Enable batch cooking"
										checked={settings.batchCooking.enabled}
										onChange={(e) => setSettings(prev => ({
											...prev,
											batchCooking: {
												...prev.batchCooking,
												enabled: e.target.checked
											}
										}))}
									/>

									{settings.batchCooking.enabled && (
										<Stack direction="column" gap="2xl">
											<SettingsField>
												<Dropdown
													label="Frequency"
													value={settings.batchCooking.frequency}
													onChange={(value) => setSettings(prev => ({
														...prev,
														batchCooking: {
															...prev.batchCooking,
															frequency: value as 'weekly' | 'biweekly' | 'none'
														}
													}))}
													options={[
														{ id: 'weekly', label: 'Weekly' },
														{ id: 'biweekly', label: 'Bi-weekly' },
														{ id: 'none', label: 'None' }
													]}
												/>
											</SettingsField>

											<SettingsField>
												<Dropdown
													label="Preferred day"
													value={settings.batchCooking.preferredDay}
													onChange={(value) => setSettings(prev => ({
														...prev,
														batchCooking: {
															...prev.batchCooking,
															preferredDay: value as 'sunday' | 'saturday' | 'friday'
														}
													}))}
													options={[
														{ id: 'sunday', label: 'Sunday' },
														{ id: 'saturday', label: 'Saturday' },
														{ id: 'friday', label: 'Friday' }
													]}
												/>
											</SettingsField>
										</Stack>
									)}
								</Stack>
							</SettingsSection>

							<SettingsSection
								title="Pantry ingredients priority"
								description="Control how the AI prioritizes ingredients you already have in your pantry/fridge when generating meal plans."
							>
								<SettingsField>
									<Dropdown
										label="Priority Level"
										helperText="High plans meals around the ingredients you have. Low uses them when they suit a meal. Perishable items are always prioritized, to reduce food waste."
										value={settings.pantryPreference}
										onChange={(value) => setSettings(prev => ({
											...prev,
											pantryPreference: value as 'hard' | 'soft'
										}))}
										options={[
											{ id: 'hard', label: 'High' },
											{ id: 'soft', label: 'Low' }
										]}
									/>
								</SettingsField>
							</SettingsSection>

							<SettingsSection
								title="Weekly planning reminder"
								description="Set when you'd like to be reminded to plan your weekly meals and create your shopping list."
							>
								<SettingsField>
									<Dropdown
										label="Reminder Day"
										helperText="You'll be reminded at 9am that day. This will be used for future email/SMS notifications to help you stay on track with your meal planning routine."
										value={settings.weeklyReminderDay || 'saturday'}
										onChange={(value) => setSettings(prev => ({
											...prev,
											weeklyReminderDay: value as 'saturday' | 'sunday' | 'monday'
										}))}
										options={[
											{ id: 'saturday', label: 'Saturday' },
											{ id: 'sunday', label: 'Sunday' },
											{ id: 'monday', label: 'Monday' }
										]}
									/>
								</SettingsField>
							</SettingsSection>

							<SettingsSection
								title="Recipe sharing"
								description={`People you can email a recipe to from the recipe page. Up to ${MAX_RECIPE_RECIPIENTS} recipients.`}
							>
								<Stack direction="column" gap="2xl">
									{recipients.length > 0 && (
										<Stack direction="column" gap="sm">
											{recipients.map((r, i) => (
												<Box
													key={`${r.email}-${i}`}
													border="default"
													borderRadius="md"
													p="md"
													bg="color.fill.muted"
												>
													<Stack direction="row" gap="md" justifyContent="space-between" alignItems="center">
														{/* Shrinks, and wraps a long email, so Remove stays inside the card on a phone */}
														<div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
															<Stack direction="column" gap="xs">
																<Typography variant="body"><strong>{r.name}</strong></Typography>
																<Typography variant="small" color="subdued">{r.email}</Typography>
															</Stack>
														</div>
														<Button
															variant="secondary"
															size="small"
															onClick={() => removeRecipient(i)}
														>
															Remove
														</Button>
													</Stack>
												</Box>
											))}
										</Stack>
									)}

									{recipientsAtCap ? (
										<Typography variant="small" color="subdued">
											You&apos;ve reached the maximum of {MAX_RECIPE_RECIPIENTS} recipients. Remove one to add another.
										</Typography>
									) : (
										<>
											{/* Adding a recipient opens a dialog, as Add child does (#196) */}
											<Stack direction="row">
												<Button variant="secondary" size="medium" iconName="add" onClick={openAddRecipient}>
													Add recipient
												</Button>
											</Stack>
											<Modal
												isOpen={addRecipientOpen}
												onClose={() => setAddRecipientOpen(false)}
												title="Add a recipient"
												size="small"
												actions={[
													{ label: 'Cancel', onClick: () => setAddRecipientOpen(false), variant: 'secondary' },
													{ label: 'Add recipient', onClick: confirmAddRecipient, variant: 'primary', disabled: !canAddRecipient },
												]}
											>
												<Stack direction="column" gap="2xl">
													<TextField
														label="Name"
														value={newRecipientName}
														onChange={(e) => setNewRecipientName(e.target.value)}
														placeholder="e.g., Sarah"
													/>
													<TextField
														label="Email"
														type="email"
														value={newRecipientEmail}
														onChange={(e) => setNewRecipientEmail(e.target.value)}
														placeholder="sarah@example.com"
														error={newRecipientEmailError}
													/>
												</Stack>
											</Modal>
										</>
									)}
								</Stack>
							</SettingsSection>

							<SettingsSection
								title="Calendar Sync"
								description={
									<>
										Subscribe to this link from a calendar app to see this week&apos;s meals automatically —
										works with{' '}
										<a href="https://github.com/derekantrican/GAS-ICS-Sync" target="_blank" rel="noreferrer">
											GAS-ICS-Sync
										</a>{' '}
										for a fully automatic Google Calendar sync. Treat this link like a password: anyone with it can see your meal plan.
									</>
								}
							>
								{icsUrl ? (
									/* Laid out like a recipient card, without the grey fill (#196) */
									<Box border="default" borderRadius="md" p="md">
										<Stack direction="row" gap="md" justifyContent="space-between" alignItems="center">
											<div style={{ minWidth: 0 }}>
												<Stack direction="column" gap="xs">
													<Typography variant="body"><strong>Calendar link</strong></Typography>
													<div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
														<Typography variant="small" color="subdued">{icsUrl}</Typography>
													</div>
												</Stack>
											</div>
											<Button variant="secondary" size="small" onClick={copyIcsUrl}>
												Copy link
											</Button>
										</Stack>
									</Box>
								) : (
									<Typography color="subdued">
										{icsError ?? 'Loading your calendar link…'}
									</Typography>
								)}
							</SettingsSection>

							<ColesExtensionSettings />
						</SettingsForm>

						{/* Actions */}
						<Stack direction="row" gap="md" justifyContent="flex-end">
							<Button
								variant="secondary"
								size="large"
								onClick={handleReset}
							>
								Reset to Defaults
							</Button>
							<Button
								variant="primary"
								size="large"
								onClick={handleSave}
							>
								Save Settings
							</Button>
						</Stack>
					</Stack>
				</Container>
			</Main>
    </>
  );
}
