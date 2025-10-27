# GitHub Documentation Folder

This folder contains all project planning documents, Copilot instructions, and development guidelines for the Meal Agent project.

## Files

### Core Documentation
- **`PROJECT_INSTRUCTIONS.md`** - High-level project requirements and vision
- **`COPILOT_BUILD.md`** - Initial build session notes and architecture decisions

### Development Plans
- **`INDEXER_ENHANCEMENT_PLAN.md`** - Recipe indexer improvement roadmap (Active)
  - Tasks, phases, and success metrics for improving recipe extraction

### Workflows
- **`workflows/ci.yml`** - GitHub Actions CI/CD pipeline

## Organization Guidelines

**All planning and instruction documents should be stored in `.github/`** to maintain a clean project root and centralize development documentation.

### What Goes Here:
✅ Copilot prompts and instructions  
✅ Enhancement plans and roadmaps  
✅ Architecture decision records (ADRs)  
✅ Development workflows and processes  
✅ Project management documentation  

### What Doesn't Go Here:
❌ User-facing documentation (goes in root `README.md`)  
❌ API documentation (goes with code)  
❌ Design system token audits (goes in `/tokens`)  
❌ Script-specific docs (goes in `/scripts/README.md`)  

## Contributing

When creating new planning documents:
1. Use descriptive, UPPERCASE names (e.g., `FEATURE_PLAN.md`)
2. Include date and status at the top
3. Link to related issues/PRs when applicable
4. Update this README to list the new document
