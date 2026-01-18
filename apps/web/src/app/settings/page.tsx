"use client";

import { useState, useEffect } from "react";
import { Alert, Box, Button, Checkbox, Chip, Container, Divider, Dropdown, NumberInput, Slider, Stack, TextField, Typography } from "@common-origin/design-system";
import Main from "@/components/app/Main";import { 
  getFamilySettings, 
  saveFamilySettings, 
  resetFamilySettings 
} from "@/lib/storageAsync";
import type { FamilySettings } from "@/lib/types/settings";
import { validateFamilySettings, DEFAULT_FAMILY_SETTINGS, DIETARY_TYPE_OPTIONS } from "@/lib/types/settings";
import { track } from "@/lib/analytics";

export default function SettingsPage() {
  const [settings, setSettings] = useState<FamilySettings>(DEFAULT_FAMILY_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    track('page_view', { page: '/settings' });
    
    // Load settings from Supabase
    const loadSettings = async () => {
      const loadedSettings = await getFamilySettings();
      setSettings(loadedSettings);
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    const validationErrors = validateFamilySettings(settings);
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      // Scroll to top to show errors
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const success = await saveFamilySettings(settings);
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

  const addChild = () => {
    setSettings(prev => ({
      ...prev,
      children: [...prev.children, { age: 5 }],
      totalServings: prev.totalServings + 1,
    }));
  };

  const removeChild = (index: number) => {
    setSettings(prev => ({
      ...prev,
      children: prev.children.filter((_, i) => i !== index),
      totalServings: Math.max(1, prev.totalServings - 1),
    }));
  };

  const updateChild = (index: number, age: number) => {
    setSettings(prev => ({
      ...prev,
      children: prev.children.map((child, i) => 
        i === index ? { age } : child
      )
    }));
  };

  return (
    <>
			<Main maxWidth="md">
				<Container>
					<Stack direction="column" gap="xl">
						{/* Header */}
						<Stack direction="column" gap="sm">
							<Typography variant="h1">Family settings</Typography>
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
					)}						{/* Household Section */}
						<Box border="default" borderRadius="lg" p="lg" bg="default">
							<Stack direction="column" gap="md">
								<Typography variant="h3">Household</Typography>
								<Box maxWidth="420px">
									<Stack direction="column" gap="lg">
										<NumberInput
											label="Adults"
											min={1}
											max={10}
											value={settings.adults}
											onChange={(value) => {
												const numValue = typeof value === 'number' ? value : 1;
												setSettings(prev => ({
													...prev,
													adults: numValue,
													totalServings: numValue + prev.children.length
												}));
											}}
										/>
									</Stack>
								</Box>
								<Divider size="small" />
								<Box maxWidth="420px">
									<Stack direction="column" gap="lg">
										<Stack direction="column" gap="lg">
											<Typography variant="subtitle">Children ({settings.children.length})</Typography>
											{settings.children.map((child, index) => (
												<Stack key={index} direction="row" gap="sm" alignItems="flex-end">
													<NumberInput
														label="Age"
														min={0}
														max={18}
														value={child.age}
														onChange={(value) => {
															const numValue = typeof value === 'number' ? value : 0;
															updateChild(index, numValue);
														}}
														placeholder="Child's age"
													/>
													<Box>
														<Button
															variant="naked"
															size="large"
															onClick={() => removeChild(index)}
															aria-label="Remove child"
														>
															Remove
														</Button>
													</Box>
												</Stack>
											))}
											<Box my="md">
												<Button variant="secondary" onClick={addChild}>
													Add child
												</Button>
											</Box>
										</Stack>

										<Chip variant="emphasis">
											Total servings: <strong>{settings.totalServings}</strong>
										</Chip>
									</Stack>
								</Box>
							</Stack>
						</Box>

						{/* Dietary requirements */}
						<Box border="default" borderRadius="lg" p="lg" bg="default">
							<Stack direction="column" gap="lg">
								<Stack direction="column" gap="sm">
									<Typography variant="h3">Dietary requirements</Typography>
									<Typography variant="small" color="subdued">
										Set your primary diet type and any additional preferences
									</Typography>
								</Stack>
								
								<Box maxWidth="420px">
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
								</Box>

								<Divider size="small" />

								<Stack direction="column" gap="sm">
									<Typography variant="subtitle">Additional preferences</Typography>
									
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
						</Box>

						{/* Cooking Profile */}
						<Box border="default" borderRadius="lg" p="lg" bg="default">
							<Stack direction="column" gap="2xl">
								<Stack direction="column" gap="md">
									<Typography variant="h3">Cooking profile</Typography>
									<Typography variant="small" color="subdued">
										Help us understand your cooking preferences and skill level
									</Typography>
								</Stack>
								
								<Box maxWidth="500px">
									<Stack direction="column" gap="lg">
										<Box>
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
										</Box>

										<Box>
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
										</Box>

										<Box>
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
										</Box>

										<Box>
											<TextField
												label="Flavor profile description"
												helperText="Describe your family&apos;s taste preferences in a few words"
												value={settings.flavorProfileDescription}
												onChange={(e) => setSettings(prev => ({
													...prev,
													flavorProfileDescription: e.target.value
												}))}
												placeholder="e.g., fresh & herby, avoids heavy cream"
											/>
										</Box>
									</Stack>
								</Box>
							</Stack>
						</Box>

						{/* Location & Seasonality */}
						<Box border="default" borderRadius="lg" p="lg" bg="default">
							<Stack direction="column" gap="2xl">
								<Stack direction="column" gap="md">
									<Typography variant="h3">Location & seasonality</Typography>
									<Typography variant="small" color="subdued">
										Used for ingredient availability and seasonal preferences
									</Typography>
								</Stack>
								
								<Box maxWidth="500px">
									<Stack direction="column" gap="lg">
										<TextField
											label="City"
											value={settings.location.city}
											onChange={(e) => setSettings(prev => ({
												...prev,
												location: {
													...prev.location,
													city: e.target.value
												}
											}))}
											placeholder="e.g., Melbourne"
										/>

										<TextField
											label="Country"
											value={settings.location.country}
											onChange={(e) => setSettings(prev => ({
												...prev,
												location: {
													...prev.location,
													country: e.target.value
												}
											}))}
											placeholder="e.g., Australia"
										/>

										<Box>
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
										</Box>
									</Stack>
								</Box>
							</Stack>
						</Box>

						{/* Budget & Time */}
						<Box border="default" borderRadius="lg" p="lg" bg="default">
							<Stack direction="column" gap="md">
								<Typography variant="h3">Budget & time</Typography>
								
								<Stack direction="column" gap="xl">
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
							</Stack>
						</Box>

						{/* Batch Cooking */}
						<Box border="default" borderRadius="lg" p="lg" bg="default">
							<Stack direction="column" gap="md">
								<Typography variant="h3">Batch cooking</Typography>
								
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
									<Box maxWidth="400px">
										<Stack direction="column" gap="lg">
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
										</Stack>
									</Box>
								)}
							</Stack>
						</Box>

						{/* Pantry Preference */}
						<Box border="default" borderRadius="lg" p="lg" bg="default">
							<Box maxWidth="500px">
								<Stack direction="column" gap="2xl">
									<Stack direction="column" gap="md">
										<Typography variant="h3">Pantry ingredients priority</Typography>
										<Typography variant="body">
											Control how the AI prioritizes ingredients you already have in your pantry/fridge when generating meal plans.
										</Typography>
									</Stack>
									
									<Dropdown
										label="Priority Level"
										helperText="Perishable items you add to your pantry list will automatically be prioritized regardless of this setting to help reduce food waste."
										value={settings.pantryPreference}
										onChange={(value) => setSettings(prev => ({
											...prev,
											pantryPreference: value as 'hard' | 'soft'
										}))}
										options={[
											{ id: 'hard', label: 'High Priority - Strongly prefer recipes using these ingredients' },
											{ id: 'soft', label: 'Low Priority - Consider these ingredients if suitable' }
										]}
									/>
								</Stack>
							</Box>
						</Box>

						{/* Weekly Planning Reminder */}
						<Box border="default" borderRadius="lg" p="lg" bg="default">
							<Box maxWidth="500px">
								<Stack direction="column" gap="2xl">
									<Stack direction="column" gap="md">
										<Typography variant="h3">Weekly planning reminder</Typography>
										<Typography variant="body">
											Set when you&apos;d like to be reminded to plan your weekly meals and create your shopping list.
										</Typography>
									</Stack>
									
									<Stack direction="row" gap="md">
										<Dropdown
											label="Reminder Day"
											helperText="This will be used for future email/SMS notifications to help you stay on track with your meal planning routine."
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

										<input
											type="time"
											value={settings.weeklyReminderTime || '18:00'}
											onChange={(e) => setSettings(prev => ({
												...prev,
												weeklyReminderTime: e.target.value
											}))}
											style={{
												padding: '8px 12px',
												border: '1px solid #ccc',
												borderRadius: '4px',
												fontSize: '14px',
											}}
										/>
									</Stack>
								</Stack>
							</Box>
						</Box>


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
