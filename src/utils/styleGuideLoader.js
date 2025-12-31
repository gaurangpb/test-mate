const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Style Guide Loader
 * Loads and validates test style guide from test folder
 */
class StyleGuideLoader {
  /**
   * Default style guide
   */
  getDefaultStyleGuide() {
    return {
      formatting: {
        actionFormat: 'imperative',
        expectedResultFormat: 'declarative',
        stepGranularity: 'medium',
        maxStepsPerTest: 10,
        minStepsPerTest: 3
      },
      terminology: {
        preference: 'business',
        technicalTermsAllowed: false,
        domainSpecificTerms: []
      },
      structure: {
        includeSetupSteps: true,
        includeTeardownSteps: false,
        verificationRequired: true
      },
      examples: {
        goodAction: 'Navigate to the account summary page',
        badAction: 'Call the getAccountSummary() method'
      }
    };
  }

  /**
   * Search for test-style-guide.json recursively in directory tree
   * @param {string} dir - Directory to search
   * @param {Set<string>} visited - Set of visited directories to avoid cycles
   * @returns {Promise<string|null>} Path to style guide file or null if not found
   */
  async findStyleGuideFile(dir, visited = new Set()) {
    if (!dir || !fsSync.existsSync(dir)) {
      return null;
    }

    const resolvedDir = path.resolve(dir);
    
    // Avoid infinite loops
    if (visited.has(resolvedDir)) {
      return null;
    }
    visited.add(resolvedDir);

    try {
      // Check current directory first
      const styleGuidePath = path.join(resolvedDir, 'test-style-guide.json');
      if (fsSync.existsSync(styleGuidePath)) {
        return styleGuidePath;
      }

      // Search recursively in subdirectories
      const entries = await fs.readdir(resolvedDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Skip common directories that shouldn't contain config files
          const skipDirs = ['node_modules', '.git', 'bin', 'obj', 'packages', '.vs', '.idea'];
          if (skipDirs.includes(entry.name)) {
            continue;
          }

          const subDir = path.join(resolvedDir, entry.name);
          const found = await this.findStyleGuideFile(subDir, visited);
          if (found) {
            return found;
          }
        }
      }

      return null;
    } catch (error) {
      // Silently continue searching other directories
      return null;
    }
  }

  /**
   * Load style guide from test folder
   * Searches recursively within the provided path for test-style-guide.json
   * @param {string} repoPath - Path to test repository
   * @returns {Promise<Object>} Style guide object
   */
  async loadStyleGuide(repoPath) {
    if (!repoPath) {
      return this.getDefaultStyleGuide();
    }

    try {
      // Search for style guide file recursively
      const styleGuidePath = await this.findStyleGuideFile(repoPath);

      if (!styleGuidePath) {
        console.log(`Style guide not found in ${repoPath} or subdirectories, using default`);
        return this.getDefaultStyleGuide();
      }

      // Read and parse file
      const content = await fs.readFile(styleGuidePath, 'utf-8');
      const styleGuide = JSON.parse(content);

      // Validate and merge with default
      const validated = this.validateAndMerge(styleGuide);

      console.log(`Style guide loaded from ${styleGuidePath}`);
      return validated;
    } catch (error) {
      console.warn(`Error loading style guide: ${error.message}`);
      console.warn('Using default style guide');
      return this.getDefaultStyleGuide();
    }
  }

  /**
   * Validate style guide structure and merge with defaults
   * @param {Object} styleGuide - Style guide to validate
   * @returns {Object} Validated and merged style guide
   */
  validateAndMerge(styleGuide) {
    const defaultGuide = this.getDefaultStyleGuide();
    const merged = { ...defaultGuide };

    // Merge formatting
    if (styleGuide.formatting) {
      merged.formatting = {
        ...defaultGuide.formatting,
        ...styleGuide.formatting
      };
    }

    // Merge terminology
    if (styleGuide.terminology) {
      merged.terminology = {
        ...defaultGuide.terminology,
        ...styleGuide.terminology
      };
    }

    // Merge structure
    if (styleGuide.structure) {
      merged.structure = {
        ...defaultGuide.structure,
        ...styleGuide.structure
      };
    }

    // Merge examples
    if (styleGuide.examples) {
      merged.examples = {
        ...defaultGuide.examples,
        ...styleGuide.examples
      };
    }

    return merged;
  }

  /**
   * Build style guide instructions for AI prompt
   * @param {Object} styleGuide - Style guide object
   * @returns {string} Formatted instructions for prompt
   */
  buildStyleGuideInstructions(styleGuide) {
    if (!styleGuide) {
      return '';
    }

    let instructions = '\n\n=== TEST DOCUMENTATION STYLE GUIDE ===\n';
    instructions += 'Follow these style guidelines when generating test documentation:\n\n';

    // Formatting rules
    if (styleGuide.formatting) {
      instructions += 'FORMATTING RULES:\n';
      instructions += `- Action format: ${styleGuide.formatting.actionFormat || 'imperative'}\n`;
      instructions += `- Expected result format: ${styleGuide.formatting.expectedResultFormat || 'declarative'}\n`;
      instructions += `- Step granularity: ${styleGuide.formatting.stepGranularity || 'medium'}\n`;
      instructions += `- Minimum steps per test: ${styleGuide.formatting.minStepsPerTest || 3}\n`;
      instructions += `- Maximum steps per test: ${styleGuide.formatting.maxStepsPerTest || 10}\n\n`;
    }

    // Terminology rules
    if (styleGuide.terminology) {
      instructions += 'TERMINOLOGY RULES:\n';
      instructions += `- Language preference: ${styleGuide.terminology.preference || 'business'}\n`;
      instructions += `- Technical terms allowed: ${styleGuide.terminology.technicalTermsAllowed ? 'yes' : 'no'}\n`;
      if (styleGuide.terminology.domainSpecificTerms && styleGuide.terminology.domainSpecificTerms.length > 0) {
        instructions += `- Domain-specific terms to use: ${styleGuide.terminology.domainSpecificTerms.join(', ')}\n`;
      }
      instructions += '\n';
    }

    // Structure rules
    if (styleGuide.structure) {
      instructions += 'STRUCTURE RULES:\n';
      instructions += `- Include setup steps: ${styleGuide.structure.includeSetupSteps ? 'yes' : 'no'}\n`;
      instructions += `- Include teardown steps: ${styleGuide.structure.includeTeardownSteps ? 'yes' : 'no'}\n`;
      instructions += `- Verification required: ${styleGuide.structure.verificationRequired ? 'yes' : 'no'}\n\n`;
    }

    // Examples
    if (styleGuide.examples) {
      instructions += 'EXAMPLES:\n';
      if (styleGuide.examples.goodAction) {
        instructions += `- Good action: "${styleGuide.examples.goodAction}"\n`;
      }
      if (styleGuide.examples.badAction) {
        instructions += `- Bad action (avoid): "${styleGuide.examples.badAction}"\n`;
      }
      instructions += '\n';
    }

    instructions += '=== END STYLE GUIDE ===\n';

    return instructions;
  }
}

// Export singleton instance
const styleGuideLoader = new StyleGuideLoader();
module.exports = styleGuideLoader;

