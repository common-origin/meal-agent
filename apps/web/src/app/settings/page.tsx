"use client";

import { useState, useEffect } from "react";
import styled from "styled-components";
import { Box, Button, Checkbox, Chip, Container, Divider, Dropdown, NumberInput, Stack, TextField, Typography } from "@common-origin/design-system";
import { tokens } from "@common-origin/design-system";
import { 
  getFamilySettings, 
  saveFamilySettings, 
  resetFamilySettings 
} from "@/lib/storage";
import type { FamilySettings } from "@/lib/types/settings";
import { validateFamilySettings } from "@/lib/types/settings";
import { track } from "@/lib/analytics";
import { GitHubClient } from "@/lib/github/client";
import { RecipeLibrary } from "@/lib/library";

const PageLayout = styled.div`
 max-width: ${tokens.base.breakpoint.md};
 margin: 0 auto;
`

export default function SettingsPage() {
  const [settings, setSettings] = useState<FamilySettings>(getFamilySettings());
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [githubTesting, setGithubTesting] = useState(false);
  const [githubStatus, setGithubStatus] = useState<string>('');

  useEffect(() => {
    track('page_view', { page: '/settings' });
  }, []);

  const handleSave = () => {
    const validationErrors = validateFamilySettings(settings);
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      // Scroll to top to show errors
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      
      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
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

    const handleTestGitHubConnection = async () => {
    const { github } = settings;
    
    if (!github?.enabled || !github.token || !github.owner || !github.repo) {
      setGithubStatus('⚠️ Please fill in all GitHub fields');
      return;
    }

    setGithubTesting(true);
    setGithubStatus('🔄 Testing connection...');

    try {
      const client = new GitHubClient(github.token, github.owner, github.repo);
      
      // Test authentication
      const authResult = await client.testConnection();
      if (!authResult.success) {
        setGithubStatus(`❌ ${authResult.error}`);
        return;
      }

      // Check if repo exists
      const repoResult = await client.checkRepo();
      
      if (repoResult.exists) {
        setGithubStatus('✅ Connected successfully! Repository exists.');
      } else {
        setGithubStatus('✅ Connected! Repository not found. Click Create Repository.');
      }

      // Save settings after successful connection test
      saveFamilySettings(settings);
    } catch (error) {
      setGithubStatus(`❌ ${error instanceof Error ? error.message : 'Connection failed'}`);
    } finally {
      setGithubTesting(false);
    }
  };

  const handleCreateGitHubRepo = async () => {
    const github = settings.github;
    if (!github?.token || !github?.owner || !github?.repo) {
      return;
    }

    setGithubTesting(true);
    setGithubStatus('🔄 Creating repository...');

    try {
      const client = new GitHubClient(github.token, github.owner, github.repo);
      const result = await client.createRepo(true);
      
      if (!result.success) {
        setGithubStatus(`❌ ${result.error}`);
      } else {
        setGithubStatus('✅ Repository created successfully!');
      }
    } catch (error) {
      setGithubStatus(`❌ ${error instanceof Error ? error.message : 'Failed to create repo'}`);
    } finally {
      setGithubTesting(false);
    }
  };

  const handleSyncWithGitHub = async () => {
    setGithubTesting(true);
    setGithubStatus('🔄 Syncing recipes...');

    try {
      const result = await RecipeLibrary.syncWithGitHub();
      
      if (result.success) {
        setGithubStatus(`✅ Synced successfully! Added ${result.added || 0} recipes from GitHub`);
        
        // Update last synced timestamp
        const updatedSettings = {
          ...settings,
          github: {
            ...settings.github!,
            lastSynced: new Date().toISOString(),
          }
        };
        setSettings(updatedSettings);
        saveFamilySettings(updatedSettings);
      } else {
        setGithubStatus(`❌ ${result.error}`);
      }
    } catch (error) {
      setGithubStatus(`❌ ${error instanceof Error ? error.message : 'Sync failed'}`);
    } finally {
      setGithubTesting(false);
    }
  };

  const handleMigrateToGitHub = async () => {
    const customRecipes = RecipeLibrary.getCustomRecipes();
    
    if (customRecipes.length === 0) {
      setGithubStatus('⚠️ No recipes to migrate');
      return;
    }

    if (!confirm(`Migrate ${customRecipes.length} recipes to GitHub?`)) {
      return;
    }

    setGithubTesting(true);
    setGithubStatus(`🔄 Migrating ${customRecipes.length} recipes...`);

    try {
      const result = await RecipeLibrary.migrateToGitHub();
      
      if (result.success) {
        setGithubStatus(`✅ Migrated ${result.count} recipes to GitHub!`);
        
        // Update last synced timestamp
        const updatedSettings = {
          ...settings,
          github: {
            ...settings.github!,
            lastSynced: new Date().toISOString(),
          }
        };
        setSettings(updatedSettings);
        saveFamilySettings(updatedSettings);
      } else {
        setGithubStatus(`❌ ${result.error}`);
      }
    } catch (error) {
      setGithubStatus(`❌ ${error instanceof Error ? error.message : 'Migration failed'}`);
    } finally {
      setGithubTesting(false);
    }
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
							<Box bg="success-subtle" border="success" borderRadius="3" p="md">
								<Typography variant="body" color="success">
									Settings saved successfully!
								</Typography>
							</Box>
						)}

						{/* Errors */}
						{errors.length > 0 && (
							<Box bg="error-subtle" border="error" borderRadius="3" p="md">
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
						<Box border="default" borderRadius="4" p="lg" bg="default">
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
										<Divider size="small" />

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
													<Box mb="sm">
														<Button															
															variant="primary"
															size="small"
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
													Add Child
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

						{/* Dietary Requirements */}
						<Box border="default" borderRadius="4" p="lg" bg="default">
							<Stack direction="column" gap="md">
								<Typography variant="h3">Dietary Requirements</Typography>
								
								<Stack direction="column" gap="sm">
									<Checkbox
										label="Prefer gluten-free options"
										checked={settings.glutenFreePreference}
										onChange={(e) => setSettings(prev => ({
											...prev,
											glutenFreePreference: e.target.checked
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

						{/* Budget & Time */}
						<Box border="default" borderRadius="4" p="lg" bg="default">
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
						<Box border="default" borderRadius="4" p="lg" bg="default">
							<Stack direction="column" gap="md">
								<Typography variant="h3">Batch Cooking</Typography>
								
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
						<Box border="default" borderRadius="4" p="lg" bg="surface">
							<Stack direction="column" gap="md">
								<Typography variant="h3">Pantry Ingredients Priority</Typography>
								<Typography variant="body">
									Control how the AI prioritizes ingredients you already have in your pantry/fridge when generating meal plans.
								</Typography>
								
								<Dropdown
									label="Priority Level"
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

								<Typography variant="small">
									💡 Note: Perishable items you add to your pantry list will automatically be prioritized regardless of this setting to help reduce food waste.
								</Typography>
							</Stack>
						</Box>

						{/* Weekly Planning Reminder */}
						<Box border="default" borderRadius="4" p="lg" bg="surface">
							<Stack direction="column" gap="md">
								<Typography variant="h3">Weekly Planning Reminder</Typography>
								<Typography variant="body">
									Set when you&apos;d like to be reminded to plan your weekly meals and create your shopping list.
								</Typography>
								
								<Stack direction="row" gap="md">
									<Dropdown
										label="Reminder Day"
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

								<Typography variant="small">
									💡 This will be used for future email/SMS notifications to help you stay on track with your meal planning routine.
								</Typography>
							</Stack>
						</Box>

						{/* GitHub Recipe Sync */}
						<Box border="default" borderRadius="3" p="xl" bg="default">
							<Stack direction="column" gap="md">
								<Typography variant="h2">GitHub Recipe Sync</Typography>
								<Typography variant="body">
									Backup and sync your custom recipes to a GitHub repository. This keeps your recipes safe and accessible across devices.
								</Typography>

								<Checkbox
									label="Enable GitHub sync"
									checked={settings.github?.enabled || false}
									onChange={(e) => setSettings(prev => ({
										...prev,
										github: {
											...prev.github,
											enabled: e.target.checked,
											token: prev.github?.token || '',
											owner: prev.github?.owner || '',
											repo: prev.github?.repo || 'my-recipes',
											autoSync: prev.github?.autoSync || true,
										}
									}))}
								/>

								{settings.github?.enabled && (
									<Box maxWidth="400px">
										<Stack direction="column" gap="lg">
											<div>
												<div style={{ marginBottom: '4px' }}>
													<Typography variant="small">
														GitHub Personal Access Token
													</Typography>
												</div>
												<input
													type="password"
													value={settings.github?.token || ''}
													onChange={(e) => setSettings(prev => ({
														...prev,
														github: {
															...prev.github!,
															token: e.target.value,
														}
													}))}
													placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
													style={{
														width: '100%',
														padding: '12px 12px',
														borderRadius: '4px',
														border: '1px solid #ddd',
														fontSize: '14px',
														fontFamily: 'monospace',
													}}
												/>
												<div style={{ marginTop: '4px' }}>
													<Typography variant="small" color="subdued">
														<a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer" style={{ color: '#007bff' }}>
															Create a token
														</a> with &apos;repo&apos; scope
													</Typography>
												</div>
											</div>
											
											<TextField
												label="GitHub Username"
												type="text"
												value={settings.github?.owner || ''}
												onChange={(e) => setSettings(prev => ({
													...prev,
													github: {
														...prev.github!,
														owner: e.target.value,
													}
												}))}
												placeholder="your-username"
												style={{
													width: '100%',
												}}
											/>

											<Stack direction="column" gap="sm">
												<TextField
													label="Repository name"
													type="text"
													value={settings.github?.repo || ''}
													onChange={(e) => setSettings(prev => ({
														...prev,
														github: {
															...prev.github!,
															repo: e.target.value,
														}
													}))}
													placeholder="my-recipes"
													style={{
														width: '100%',
													}}
												/>

												<Stack direction="row" gap="sm" alignItems="center">
													<Button
														variant="secondary"
														size="small"
														onClick={handleTestGitHubConnection}
														disabled={githubTesting}
													>
														{githubTesting ? 'Testing...' : 'Test Connection'}
													</Button>
													
													{githubStatus.includes('not found') && (
														<Button
															variant="primary"
															size="small"
															onClick={handleCreateGitHubRepo}
															disabled={githubTesting}
														>
															Create Repository
														</Button>
													)}

													{githubStatus.includes('Connected') && (
														<>
															<Button
																variant="primary"
																size="small"
																onClick={handleSyncWithGitHub}
																disabled={githubTesting}
															>
																Sync Now
															</Button>
															<Button
																variant="secondary"
																size="small"
																onClick={handleMigrateToGitHub}
																disabled={githubTesting}
															>
																Migrate Recipes
															</Button>
														</>
													)}
												</Stack>
											</Stack>

											{githubStatus && (
												<div style={{ marginTop: '8px' }}>
													<Typography variant="small">
														{githubStatus}
													</Typography>
												</div>
											)}

											{settings.github?.lastSynced && (
												<Typography variant="small" color="subdued">
													Last synced: {new Date(settings.github.lastSynced).toLocaleString()}
												</Typography>
											)}

											<Checkbox
												label="Auto-sync when recipes change"
												checked={settings.github?.autoSync || false}
												onChange={(e) => setSettings(prev => ({
													...prev,
													github: {
														...prev.github!,
														autoSync: e.target.checked,
													}
												}))}
											/>
										</Stack>
									</Box>
								)}
							</Stack>
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
			</PageLayout>
    </main>
  );
}
