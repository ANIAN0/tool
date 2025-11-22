export type ToolType = 'public-tools' | 'private-tools';

export interface ToolModule {
  id: string;
  name: string;
  description: string;
  type: ToolType;
  icon?: string;
  tags: string[];
  isActive: boolean;
  apiPrefix?: string;
  docs: {
    enabled: boolean;
  };
}
