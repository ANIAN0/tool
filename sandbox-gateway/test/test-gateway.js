// sandbox-gateway/test/test-gateway.js

'use strict';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY || 'test-key';
const TEST_SESSION_ID = 'test-session-001';
const TEST_USER_ID = 'test-user-001';

async function test() {
  console.log('=== Gateway API 测试 ===\n');

  // 1. 健康检查
  console.log('1. 健康检查...');
  const healthRes = await fetch(`${GATEWAY_URL}/health`);
  const health = await healthRes.json();
  console.log('   结果:', health);
  console.log(health.status === 'healthy' ? '   ✓ 通过' : '   ✗ 失败');

  // 2. 执行命令
  console.log('\n2. 执行命令测试...');
  const execRes = await fetch(`${GATEWAY_URL}/api/v1/sessions/${TEST_SESSION_ID}/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      userId: TEST_USER_ID,
      code: 'echo "Hello from sandbox"',
      language: 'bash',
    }),
  });
  const execResult = await execRes.json();
  console.log('   结果:', execResult);
  console.log(execResult.success ? '   ✓ 通过' : '   ✗ 失败');

  // 3. 写入文件
  console.log('\n3. 写入文件测试...');
  const writeRes = await fetch(`${GATEWAY_URL}/api/v1/sessions/${TEST_SESSION_ID}/write`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      userId: TEST_USER_ID,
      path: 'test-file.txt',
      content: 'This is a test file created by sandbox.',
    }),
  });
  const writeResult = await writeRes.json();
  console.log('   结果:', writeResult);
  console.log(writeResult.success ? '   ✓ 通过' : '   ✗ 失败');

  // 4. 读取文件
  console.log('\n4. 读取文件测试...');
  const readRes = await fetch(`${GATEWAY_URL}/api/v1/sessions/${TEST_SESSION_ID}/read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      userId: TEST_USER_ID,
      path: 'test-file.txt',
    }),
  });
  const readResult = await readRes.json();
  console.log('   结果:', readResult);
  console.log(readResult.success ? '   ✓ 通过' : '   ✗ 失败');

  // 5. 会话状态
  console.log('\n5. 会话状态测试...');
  const statusRes = await fetch(`${GATEWAY_URL}/api/v1/sessions/${TEST_SESSION_ID}/status`, {
    headers: { 'X-API-Key': API_KEY },
  });
  const status = await statusRes.json();
  console.log('   结果:', status);
  console.log(status.status === 'active' ? '   ✓ 通过' : '   ✗ 失败');

  console.log('\n=== 测试完成 ===');
}

test().catch(console.error);