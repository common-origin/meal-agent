import { NextResponse } from 'next/server';
import { GitHubClient } from '@/lib/github/client';

export async function POST(request: Request) {
  try {
    const { token, owner, repo } = await request.json();

    if (!token || !owner || !repo) {
      return NextResponse.json({ 
        error: 'Missing required fields: token, owner, repo' 
      }, { status: 400 });
    }

    const client = new GitHubClient(token, owner, repo);

    // Test authentication
    console.log('🔐 Testing GitHub authentication...');
    const authResult = await client.testConnection();
    if (!authResult.success) {
      return NextResponse.json({ 
        success: false,
        error: `Authentication failed: ${authResult.error}`,
        step: 'auth',
        details: 'Your GitHub token may be invalid or expired.'
      });
    }

    console.log(`✅ Authenticated as: ${authResult.user?.login}`);

    // Check repository exists
    console.log(`🔍 Checking repository: ${owner}/${repo}...`);
    const repoResult = await client.checkRepo();
    if (!repoResult.exists) {
      return NextResponse.json({ 
        success: false,
        error: 'Repository not found',
        step: 'repo',
        canCreate: true,
        details: `The repository ${owner}/${repo} does not exist. You can create it from the Settings page.`
      });
    }

    console.log(`✅ Repository found: ${repoResult.repo?.full_name}`);

    // Try to read recipes file
    console.log('📖 Checking for recipe file...');
    const recipesResult = await client.getRecipes();
    
    if (recipesResult.error) {
      return NextResponse.json({ 
        success: true,
        warning: true,
        user: authResult.user,
        repo: repoResult.repo,
        recipeCount: 0,
        hasRecipeFile: false,
        message: `Connected successfully! Recipe file (custom-recipes.json) not found in repository. It will be created automatically when you save your first recipe.`,
        details: {
          username: authResult.user?.login,
          repoName: repoResult.repo?.full_name,
          isPrivate: repoResult.repo?.private
        }
      });
    }

    console.log(`✅ Found ${recipesResult.recipes?.length || 0} recipes`);

    return NextResponse.json({ 
      success: true,
      user: authResult.user,
      repo: repoResult.repo,
      recipeCount: recipesResult.recipes?.length || 0,
      hasRecipeFile: true,
      message: `✅ Connected successfully! Found ${recipesResult.recipes?.length || 0} recipes in your GitHub repository.`,
      details: {
        username: authResult.user?.login,
        repoName: repoResult.repo?.full_name,
        isPrivate: repoResult.repo?.private,
        recipes: recipesResult.recipes?.map(r => ({ id: r.id, title: r.title }))
      }
    });

  } catch (error) {
    console.error('❌ GitHub connection test failed:', error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'unknown' 
    }, { status: 500 });
  }
}
