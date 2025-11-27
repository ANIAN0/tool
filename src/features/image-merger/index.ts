import type { ToolModule } from '@/lib/types';
import MainComponent from './components/Main';
import ApiDocComponent from './components/ApiDoc';

export const metadata: ToolModule = {
  id: 'image-merger',
  name: '图片拼接',
  description: '将多张图片按800px宽度从上到下拼接为一张图片',
  type: 'public-tools',
  icon: '🖼️',
  tags: ['图片', '拼接', '合并'],
  isActive: true,
  apiPrefix: '/api/tools/image-merger',
  docs: {
    enabled: true,
  },
};

export default MainComponent;
export const ApiDoc = ApiDocComponent;