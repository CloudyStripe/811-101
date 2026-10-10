/** Content modules whose claims go to locator review. */
export interface ContentModule {
  name: string;
  content: unknown;
}

export const CONTENT_MODULES: readonly ContentModule[] = [];
