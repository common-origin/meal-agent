"use client";

import { useState, useEffect } from "react";
import styled from "styled-components";
import { Box, Button, Container, Dropdown, Stack, Typography } from "@common-origin/design-system";
import { tokens } from "@common-origin/design-system";
import { 
  getFamilySettings, 
  saveFamilySettings, 
  resetFamilySettings 
} from "@/lib/storage";
import type { FamilySettings } from "@/lib/types/settings";
import { CUISINE_OPTIONS, validateFamilySettings } from "@/lib/types/settings";
import { track } from "@/lib/analytics";

const PageLayout = styled.div`
 max-width: ${tokens.base.breakpoint.md};
 margin: 0 auto;
`

export default function SettingsPage() {
  const [settings, setSettings] = useState<FamilySettings>(getFamilySettings());
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    track('page_view', { page: '/settings' });
  }, []);

  const handleSave = () => {
    const validationErrors = validateFamilySettings(settings);
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const success = saveFamilySettings(settings);
    if (success) {
      setSaved(true);
      setErrors([]);
      // Track as override saved since user is customizing their preferences
      track('override_saved', { 
        cuisines: settings.cuisines.length,
        glutenFree: settings.glutenFreePreference,
        budgetRange: `${settings.budgetPerMeal.min}-${settings.budgetPerMeal.max}`,
      });
      
      // Hide success message after 3 seconds
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      resetFamilySettings();
      setSettings(getFamilySettings());
      track('override_saved', { reset: true });
    }
  };

  const toggleCuisine = (cuisineId: string) => {
    setSettings(prev => ({
      ...prev,
      cuisines: prev.cuisines.includes(cuisineId)
        ? prev.cuisines.filter(c => c !== cuisineId)
        : [...prev.cuisines, cuisineId]
    }));
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
    <main style={{ padding: 24 }}>
			<PageLayout>
				<Container>
					<Stack direction="column" gap="xl">
						{/* Header */}
						<Stack direction="column" gap="sm">
							<Typography variant="h1">Family Settings</Typography>
							<Typography variant="body">
								Configure your family&apos;s preferences for AI-powered meal planning
							</Typography>
						</Stack>

						{/* Success Message */}
						{saved && (
							<Box bg="success.subtle" border="success.default" borderRadius={3} p="md">
								<Typography variant="body" color="success">
									✅ Settings saved successfully!
								</Typography>
							</Box>
						)}

						{/* Errors */}
						{errors.length > 0 && (
							<Box bg="error.subtle" border="error.default" borderRadius={3} p="md">
								<Stack direction="column" gap="xs">
									<Typography variant="body" color="error">
										⚠️ Please fix the following errors:
									</Typography>
									{errors.map((error, i) => (
										<Typography key={i} variant="small" color="error">
											• {error}
										</Typography>
									))}
								</Stack>
							</Box>
						)}

						{/* Household Section */}
						<Box border="default" borderRadius={4} p="lg" bg="surface">
							<Stack direction="column" gap="md">
								<Typography variant="h3">Household</Typography>
								
								<Stack direction="column" gap="sm">
									<label>
										<Typography variant="subtitle">Adults</Typography>
										<input
											type="number"
											min="1"
											max="10"
											value={settings.adults}
											onChange={(e) => setSettings(prev => ({
												...prev,
												adults: parseInt(e.target.value) || 1,
												totalServings: parseInt(e.target.value) + prev.children.length
											}))}
											style={{
												width: '100px',
												padding: '8px',
												borderRadius: '4px',
												border: '1px solid #ccc',
												fontSize: '16px'
											}}
										/>
									</label>

									<Stack direction="column" gap="xs">
										<Typography variant="subtitle">Children ({settings.children.length})</Typography>
										{settings.children.map((child, index) => (
											<Stack key={index} direction="row" gap="sm" alignItems="center">
												<input
													type="number"
													min="0"
													max="18"
													value={child.age}
													onChange={(e) => updateChild(index, parseInt(e.target.value) || 0)}
													placeholder="Age"
													style={{
														width: '80px',
														padding: '8px',
														borderRadius: '4px',
														border: '1px solid #ccc',
														fontSize: '14px'
													}}
												/>
												<Typography variant="small">years old</Typography>
												<Button
													variant="secondary"
													size="small"
													onClick={() => removeChild(index)}
												>
													Remove
												</Button>
											</Stack>
										))}
										<Button variant="secondary" size="small" onClick={addChild}>
											+ Add Child
										</Button>
									</Stack>

									<Box bg="neutral.subtle" p="sm" borderRadius={3}>
										<Typography variant="small">
											Total servings: <strong>{settings.totalServings}</strong>
										</Typography>
									</Box>
								</Stack>
							</Stack>
						</Box>

						{/* Cuisine Preferences */}
						<Box border="default" borderRadius={4} p="lg" bg="surface">
							<Stack direction="column" gap="md">
								<Typography variant="h3">Cuisine Preferences</Typography>
								<Typography variant="small">
									Select your favorite cuisines ({settings.cuisines.length} selected)
								</Typography>
								
								<div style={{
									display: 'grid',
									gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
									gap: '12px'
								}}>
									{CUISINE_OPTIONS.map((cuisine) => (
										<button
											key={cuisine.id}
											onClick={() => toggleCuisine(cuisine.id)}
											style={{
												padding: '12px',
												borderRadius: '8px',
												border: settings.cuisines.includes(cuisine.id)
													? '2px solid #007bff'
													: '1px solid #ccc',
												backgroundColor: settings.cuisines.includes(cuisine.id)
													? '#e7f3ff'
													: 'white',
												cursor: 'pointer',
												fontSize: '14px',
												textAlign: 'center',
												transition: 'all 0.2s'
											}}
										>
											<div style={{ fontSize: '24px', marginBottom: '4px' }}>
												{cuisine.emoji}
											</div>
											{cuisine.label}
										</button>
									))}
								</div>
							</Stack>
						</Box>

						{/* Dietary Requirements */}
						<Box border="default" borderRadius={4} p="lg" bg="surface">
							<Stack direction="column" gap="md">
								<Typography variant="h3">Dietary Requirements</Typography>
								
								<Stack direction="column" gap="sm">
									<label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										<input
											type="checkbox"
											checked={settings.glutenFreePreference}
											onChange={(e) => setSettings(prev => ({
												...prev,
												glutenFreePreference: e.target.checked
											}))}
											style={{ width: '20px', height: '20px' }}
										/>
										<Typography variant="body">Prefer gluten-free options</Typography>
									</label>

									<label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										<input
											type="checkbox"
											checked={settings.proteinFocus}
											onChange={(e) => setSettings(prev => ({
												...prev,
												proteinFocus: e.target.checked
											}))}
											style={{ width: '20px', height: '20px' }}
										/>
										<Typography variant="body">Focus on high protein meals</Typography>
									</label>

									<label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										<input
											type="checkbox"
											checked={settings.leftoverFriendly}
											onChange={(e) => setSettings(prev => ({
												...prev,
												leftoverFriendly: e.target.checked
											}))}
											style={{ width: '20px', height: '20px' }}
										/>
										<Typography variant="body">Leftover-friendly meals</Typography>
									</label>
								</Stack>
							</Stack>
						</Box>

						{/* Budget & Time */}
						<Box border="default" borderRadius={4} p="lg" bg="surface">
							<Stack direction="column" gap="md">
								<Typography variant="h3">Budget & Time</Typography>
								
								<Stack direction="column" gap="sm">
									<label>
										<Typography variant="subtitle">
											Budget per meal: ${settings.budgetPerMeal.min} - ${settings.budgetPerMeal.max}
										</Typography>
										<Stack direction="row" gap="md" alignItems="center">
											<input
												type="range"
												min="10"
												max="50"
												value={settings.budgetPerMeal.min}
												onChange={(e) => setSettings(prev => ({
													...prev,
													budgetPerMeal: {
														...prev.budgetPerMeal,
														min: parseInt(e.target.value)
													}
												}))}
												style={{ flex: 1 }}
											/>
											<input
												type="range"
												min="10"
												max="50"
												value={settings.budgetPerMeal.max}
												onChange={(e) => setSettings(prev => ({
													...prev,
													budgetPerMeal: {
														...prev.budgetPerMeal,
														max: parseInt(e.target.value)
													}
												}))}
												style={{ flex: 1 }}
											/>
										</Stack>
									</label>

									<label>
										<Typography variant="subtitle">
											Max cooking time (weeknights): {settings.maxCookTime.weeknight} minutes
										</Typography>
										<input
											type="range"
											min="15"
											max="90"
											step="5"
											value={settings.maxCookTime.weeknight}
											onChange={(e) => setSettings(prev => ({
												...prev,
												maxCookTime: {
													...prev.maxCookTime,
													weeknight: parseInt(e.target.value)
												}
											}))}
											style={{ width: '100%' }}
										/>
									</label>

									<label>
										<Typography variant="subtitle">
											Max cooking time (weekends): {settings.maxCookTime.weekend} minutes
										</Typography>
										<input
											type="range"
											min="15"
											max="120"
											step="5"
											value={settings.maxCookTime.weekend}
											onChange={(e) => setSettings(prev => ({
												...prev,
												maxCookTime: {
													...prev.maxCookTime,
													weekend: parseInt(e.target.value)
												}
											}))}
											style={{ width: '100%' }}
										/>
									</label>
								</Stack>
							</Stack>
						</Box>

						{/* Batch Cooking */}
						<Box border="default" borderRadius={4} p="lg" bg="surface">
							<Stack direction="column" gap="md">
								<Typography variant="h3">Batch Cooking</Typography>
								
								<label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
									<input
										type="checkbox"
										checked={settings.batchCooking.enabled}
										onChange={(e) => setSettings(prev => ({
											...prev,
											batchCooking: {
												...prev.batchCooking,
												enabled: e.target.checked
											}
										}))}
										style={{ width: '20px', height: '20px' }}
									/>
									<Typography variant="body">Enable batch cooking</Typography>
								</label>

								{settings.batchCooking.enabled && (
									<Stack direction="column" gap="sm">
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
								)}
							</Stack>
						</Box>

						{/* Actions */}
						<Stack direction="row" gap="md" justifyContent="space-between">
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
			</PageLayout>
    </main>
  );
}
