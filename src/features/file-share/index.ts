import type { ToolModule } from '@/lib/types';
import MainComponent from './components/Main';

export const metadata: ToolModule = {
  id: 'file-share',
  name: '文件分享',
  description: '上传图片、视频、语音文件，生成临时URL，文件超过24小时自动删除',
  type: 'private-tools',
  tags: ['文件', '分享', '临时链接'],
  isActive: true,
  apiPrefix: '/api/tools/file-share',
  docs: { enabled: true },
};

export default MainComponent;
