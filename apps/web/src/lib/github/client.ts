/**
 * GitHub API Client for Recipe Storage
 * 
 * Handles authentication, repo management, and file operations
 * for storing custom recipes in a GitHub repository.
 */

import type { Recipe } from '../types/recipe';
import type {
  GitHubUser,
  GitHubRepo,
  GitHubFileContent,
  GitHubRateLimit,
  GitHubError,
} from './types';

const GITHUB_API_BASE = 'https://api.github.com';
const RECIPE_FILE_PATH = 'custom-recipes.json';

export class GitHubClient {
  private token: string;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * Test if the GitHub token is valid
   */
  async testConnection(): Promise<{ success: boolean; user?: GitHubUser; error?: string }> {
    try {
      const response = await fetch(`${GITHUB_API_BASE}/user`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const error: GitHubError = await response.json();
        return {
          success: false,
          error: error.message || 'Authentication failed',
        };
      }

      const user: GitHubUser = await response.json();
      return { success: true, user };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Check if the repository exists
   */
  async checkRepo(): Promise<{ exists: boolean; repo?: GitHubRepo; error?: string }> {
    try {
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${this.owner}/${this.repo}`,
        { headers: this.getHeaders() }
      );

      if (response.status === 404) {
        return { exists: false };
      }

      if (!response.ok) {
        const error: GitHubError = await response.json();
        return { exists: false, error: error.message };
      }

      const repo: GitHubRepo = await response.json();
      return { exists: true, repo };
    } catch (error) {
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Create a new repository
   */
  async createRepo(isPrivate = true): Promise<{ success: boolean; repo?: GitHubRepo; error?: string }> {
    try {
      const response = await fetch(`${GITHUB_API_BASE}/user/repos`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name: this.repo,
          description: 'Personal recipe collection for Meal Agent',
          private: isPrivate,
          auto_init: true, // Initialize with README
        }),
      });

      if (!response.ok) {
        const error: GitHubError = await response.json();
        return { success: false, error: error.message };
      }

      const repo: GitHubRepo = await response.json();
      return { success: true, repo };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Get recipes from GitHub
   */
  async getRecipes(): Promise<{ recipes: Recipe[]; sha?: string; error?: string }> {
    try {
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${this.owner}/${this.repo}/contents/${RECIPE_FILE_PATH}`,
        { headers: this.getHeaders() }
      );

      // File doesn't exist yet (first time)
      if (response.status === 404) {
        return { recipes: [] };
      }

      if (!response.ok) {
        const error: GitHubError = await response.json();
        return { recipes: [], error: error.message };
      }

      const fileContent: GitHubFileContent = await response.json();
      
      // Decode base64 content
      const decodedContent = atob(fileContent.content);
      const recipes: Recipe[] = JSON.parse(decodedContent);

      return { recipes, sha: fileContent.sha };
    } catch (error) {
      return {
        recipes: [],
        error: error instanceof Error ? error.message : 'Failed to parse recipes',
      };
    }
  }

  /**
   * Save recipes to GitHub
   */
  async saveRecipes(
    recipes: Recipe[],
    sha?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const content = JSON.stringify(recipes, null, 2);
      const encodedContent = btoa(content);

      const body: Record<string, unknown> = {
        message: sha
          ? `Update recipes (${recipes.length} total)`
          : 'Initialize recipe collection',
        content: encodedContent,
      };

      // If file exists, we need the SHA to update it
      if (sha) {
        body.sha = sha;
      }

      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${this.owner}/${this.repo}/contents/${RECIPE_FILE_PATH}`,
        {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error: GitHubError = await response.json();
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save recipes',
      };
    }
  }

  /**
   * Check API rate limit
   */
  async checkRateLimit(): Promise<{ limit?: GitHubRateLimit; error?: string }> {
    try {
      const response = await fetch(`${GITHUB_API_BASE}/rate_limit`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return { error: 'Failed to check rate limit' };
      }

      const data = await response.json();
      return { limit: data.rate };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Get authentication headers
   */
  private getHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  }
}

/**
 * Helper function to validate GitHub token format
 */
export function isValidGitHubToken(token: string): boolean {
  // GitHub Personal Access Tokens start with 'ghp_' (new format)
  // or are 40-character hex strings (classic format)
  return (
    token.startsWith('ghp_') ||
    (token.length === 40 && /^[a-f0-9]+$/i.test(token))
  );
}

/**
 * Helper function to parse repo full name into owner/repo
 */
export function parseRepoFullName(fullName: string): { owner: string; repo: string } | null {
  const parts = fullName.trim().split('/');
  if (parts.length !== 2) {
    return null;
  }
  return {
    owner: parts[0],
    repo: parts[1],
  };
}
