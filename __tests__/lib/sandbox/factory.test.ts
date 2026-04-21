// __tests__/lib/sandbox/factory.test.ts

/**
 * 沙盒工厂函数测试
 * 验证工厂函数返回正确实现，以及mock替换能力
 */

import {
  createSandboxInstance,
  createSandboxSession,
  createSandboxToolProvider,
  setMockSandboxSession,
  setMockToolProvider,
  clearAllMocks,
} from '@/lib/sandbox/factory';
import type {
  SandboxSessionInterface,
  SandboxToolProviderInterface,
  SandboxToolContext,
} from '@/lib/sandbox/interface';
import type { ExecResult, ExecParams, ReadFileParams, WriteFileParams } from '@/lib/sandbox/types';

// ==================== Mock实现 ====================

/**
 * Mock沙盒会话实现
 * 用于测试工厂函数的mock替换能力
 */
class MockSandboxSession implements SandboxSessionInterface {
  // 记录方法调用，便于测试验证
  execCalls: ExecParams[] = [];
  readFileCalls: ReadFileParams[] = [];
  writeFileCalls: WriteFileParams[] = [];
  heartbeatCalls: string[] = [];
  getStatusCalls: string[] = [];

  // 预设返回值
  mockExecResult: ExecResult = {
    stdout: 'mock stdout',
    stderr: '',
    exitCode: 0,
    duration: 100,
  };
  mockReadResult: string = 'mock file content';

  async exec(params: ExecParams): Promise<ExecResult> {
    // 记录调用参数
    this.execCalls.push(params);
    return this.mockExecResult;
  }

  async readFile(params: ReadFileParams): Promise<string> {
    // 记录调用参数
    this.readFileCalls.push(params);
    return this.mockReadResult;
  }

  async writeFile(params: WriteFileParams): Promise<void> {
    // 记录调用参数
    this.writeFileCalls.push(params);
  }

  async heartbeat(sessionId: string): Promise<void> {
    // 记录调用参数
    this.heartbeatCalls.push(sessionId);
  }

  async getStatus(sessionId: string): Promise<{ status: string; lastActivity: number }> {
    // 记录调用参数
    this.getStatusCalls.push(sessionId);
    return { status: 'active', lastActivity: Date.now() };
  }
}

/**
 * Mock工具提供者实现
 * 用于测试工厂函数的mock替换能力
 */
class MockToolProvider implements SandboxToolProviderInterface {
  // 记录方法调用
  getToolsCalls: SandboxToolContext[] = [];
  isAvailableCalls: number = 0;

  // 预设返回值
  mockAvailable: boolean = true;
  mockTools: Record<string, unknown> = {
    mockBash: { description: 'Mock bash tool' },
    mockRead: { description: 'Mock read tool' },
    mockWrite: { description: 'Mock write tool' },
  };

  getToolsWithContext(context: SandboxToolContext): Record<string, unknown> {
    // 记录调用参数
    this.getToolsCalls.push(context);
    return this.mockTools;
  }

  isAvailable(): boolean {
    // 记录调用次数
    this.isAvailableCalls++;
    return this.mockAvailable;
  }
}

// ==================== 测试用例 ====================

describe('createSandboxInstance', () => {
  // 每个测试后清除mock
  afterEach(() => {
    clearAllMocks();
  });

  describe('默认实现', () => {
    test('应该返回包含session和toolProvider的实例', () => {
      // 测试工厂函数返回完整实例结构
      const instance = createSandboxInstance();

      // 验证返回结构包含session和toolProvider
      expect(instance).toHaveProperty('session');
      expect(instance).toHaveProperty('toolProvider');
    });

    test('返回的session应该实现SandboxSessionInterface', () => {
      // 测试session实例是否具有所有必需方法
      const instance = createSandboxInstance();
      const session = instance.session;

      // 验证所有接口方法存在
      expect(typeof session.exec).toBe('function');
      expect(typeof session.readFile).toBe('function');
      expect(typeof session.writeFile).toBe('function');
      expect(typeof session.heartbeat).toBe('function');
      expect(typeof session.getStatus).toBe('function');
    });

    test('返回的toolProvider应该实现SandboxToolProviderInterface', () => {
      // 测试toolProvider实例是否具有所有必需方法
      const instance = createSandboxInstance();
      const toolProvider = instance.toolProvider;

      // 验证所有接口方法存在
      expect(typeof toolProvider.getToolsWithContext).toBe('function');
      expect(typeof toolProvider.isAvailable).toBe('function');
    });

    test('多次调用应该返回独立的session实例', () => {
      // 测试工厂函数每次调用创建新实例
      const instance1 = createSandboxInstance();
      const instance2 = createSandboxInstance();

      // session应该是不同实例（每次new DefaultSandboxSession）
      expect(instance1.session).not.toBe(instance2.session);
    });

    test('toolProvider每次调用应该返回新实例', () => {
      // 测试工厂函数每次调用创建新的toolProvider
      const instance1 = createSandboxInstance();
      const instance2 = createSandboxInstance();

      // toolProvider应该是不同实例（每次new DefaultToolProvider）
      expect(instance1.toolProvider).not.toBe(instance2.toolProvider);
    });
  });

  describe('mock替换', () => {
    test('设置mockSession后应该返回mock实例', () => {
      // 创建mock实例
      const mockSession = new MockSandboxSession();

      // 设置mock
      setMockSandboxSession(mockSession);

      // 创建实例，应该使用mock
      const instance = createSandboxInstance();

      // 验证返回的是mock实例
      expect(instance.session).toBe(mockSession);
    });

    test('设置mockToolProvider后应该返回mock实例', () => {
      // 创建mock实例
      const mockProvider = new MockToolProvider();

      // 设置mock
      setMockToolProvider(mockProvider);

      // 创建实例，应该使用mock
      const instance = createSandboxInstance();

      // 验证返回的是mock实例
      expect(instance.toolProvider).toBe(mockProvider);
    });

    test('同时设置两个mock应该都生效', () => {
      // 创建两个mock实例
      const mockSession = new MockSandboxSession();
      const mockProvider = new MockToolProvider();

      // 设置mock
      setMockSandboxSession(mockSession);
      setMockToolProvider(mockProvider);

      // 创建实例
      const instance = createSandboxInstance();

      // 验证两个mock都生效
      expect(instance.session).toBe(mockSession);
      expect(instance.toolProvider).toBe(mockProvider);
    });

    test('清除mock后应该返回默认实现', () => {
      // 先设置mock
      const mockSession = new MockSandboxSession();
      setMockSandboxSession(mockSession);

      // 清除mock
      clearAllMocks();

      // 创建实例，应该返回默认实现
      const instance = createSandboxInstance();

      // 验证不是mock实例
      expect(instance.session).not.toBe(mockSession);
    });
  });
});

describe('createSandboxSession', () => {
  afterEach(() => {
    clearAllMocks();
  });

  test('默认返回SandboxSessionInterface实现', () => {
    // 测试独立工厂函数返回正确类型
    const session = createSandboxSession();

    // 验证接口方法存在
    expect(typeof session.exec).toBe('function');
    expect(typeof session.readFile).toBe('function');
    expect(typeof session.writeFile).toBe('function');
    expect(typeof session.heartbeat).toBe('function');
    expect(typeof session.getStatus).toBe('function');
  });

  test('设置mock后返回mock实例', () => {
    // 测试mock替换能力
    const mockSession = new MockSandboxSession();
    setMockSandboxSession(mockSession);

    const session = createSandboxSession();

    // 验证返回mock实例
    expect(session).toBe(mockSession);
  });

  test('清除mock后恢复默认实现', () => {
    // 测试mock清除能力
    const mockSession = new MockSandboxSession();
    setMockSandboxSession(mockSession);
    clearAllMocks();

    const session = createSandboxSession();

    // 验证恢复默认实现
    expect(session).not.toBe(mockSession);
  });
});

describe('createSandboxToolProvider', () => {
  afterEach(() => {
    clearAllMocks();
  });

  test('默认返回SandboxToolProviderInterface实现', () => {
    // 测试独立工厂函数返回正确类型
    const provider = createSandboxToolProvider();

    // 验证接口方法存在
    expect(typeof provider.getToolsWithContext).toBe('function');
    expect(typeof provider.isAvailable).toBe('function');
  });

  test('设置mock后返回mock实例', () => {
    // 测试mock替换能力
    const mockProvider = new MockToolProvider();
    setMockToolProvider(mockProvider);

    const provider = createSandboxToolProvider();

    // 验证返回mock实例
    expect(provider).toBe(mockProvider);
  });

  test('传入session参数（当前未使用但接口支持）', () => {
    // 测试工厂函数接受session参数（为后续扩展预留）
    const mockSession = new MockSandboxSession();

    // 调用工厂函数传入session
    const provider = createSandboxToolProvider(mockSession);

    // 验证返回正确类型
    expect(typeof provider.getToolsWithContext).toBe('function');
    expect(typeof provider.isAvailable).toBe('function');
  });
});

describe('mock功能验证', () => {
  afterEach(() => {
    clearAllMocks();
  });

  test('mock session可以正常调用并记录', async () => {
    // 验证mock实例的方法调用记录功能
    const mockSession = new MockSandboxSession();
    setMockSandboxSession(mockSession);

    const instance = createSandboxInstance();

    // 调用mock方法
    const result = await instance.session.exec({
      sessionId: 'test-session',
      userId: 'test-user',
      code: 'echo hello',
      language: 'bash',
    });

    // 验证返回预设值
    expect(result.stdout).toBe('mock stdout');

    // 验证调用被记录
    expect(mockSession.execCalls.length).toBe(1);
    expect(mockSession.execCalls[0].code).toBe('echo hello');
  });

  test('mock toolProvider可以正常调用并记录', async () => {
    // 验证mock实例的方法调用记录功能
    const mockProvider = new MockToolProvider();
    setMockToolProvider(mockProvider);

    const instance = createSandboxInstance();

    // 调用mock方法
    const context: SandboxToolContext = {
      conversationId: 'test-conversation',
      userId: 'test-user',
    };

    const tools = instance.toolProvider.getToolsWithContext(context);
    const available = instance.toolProvider.isAvailable();

    // 验证返回预设值
    expect(available).toBe(true);
    expect(tools).toHaveProperty('mockBash');

    // 验证调用被记录
    expect(mockProvider.getToolsCalls.length).toBe(1);
    expect(mockProvider.getToolsCalls[0].conversationId).toBe('test-conversation');
    expect(mockProvider.isAvailableCalls).toBe(1);
  });

  test('多次设置mock会替换之前的mock', () => {
    // 测试mock替换能力
    const mock1 = new MockSandboxSession();
    const mock2 = new MockSandboxSession();

    // 设置第一个mock
    setMockSandboxSession(mock1);
    const instance1 = createSandboxInstance();
    expect(instance1.session).toBe(mock1);

    // 设置第二个mock替换
    setMockSandboxSession(mock2);
    const instance2 = createSandboxInstance();
    expect(instance2.session).toBe(mock2);

    // 验证第一个mock不再被使用
    expect(instance2.session).not.toBe(mock1);
  });
});