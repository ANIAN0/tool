import '@testing-library/jest-dom';

// Jest 环境中需要显式加载 Web API globals
// Node.js 内置了这些，但 Jest 的测试环境可能需要手动注入
const { TextDecoder, TextEncoder } = require('util');
global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;

// 确保 Request/Response 可用（Node.js 18+ 内置）
// 如果 Jest 环境缺少，从 undici 加载
if (typeof global.Request === 'undefined') {
  try {
    const { Request, Response, Headers } = require('undici');
    global.Request = Request;
    global.Response = Response;
    global.Headers = Headers;
  } catch (e) {
    // 如果 undici 加载失败，尝试使用 Node.js 内置
    console.warn('Failed to load undici, using Node.js built-in fetch globals');
  }
}

// 添加 Web Streams API polyfill（ai SDK 需要 TransformStream）
// Node.js 16+ 内置了 stream/web 模块
if (typeof global.TransformStream === 'undefined') {
  try {
    // Node.js 内置的 Web Streams API
    const { TransformStream, ReadableStream, WritableStream } = require('stream/web');
    global.TransformStream = TransformStream;
    global.ReadableStream = ReadableStream;
    global.WritableStream = WritableStream;
  } catch (e) {
    // 如果 stream/web 加载失败，尝试 undici
    try {
      const undiciPath = require.resolve('undici');
      const { TransformStream, ReadableStream, WritableStream } = require(undiciPath);
      global.TransformStream = TransformStream;
      global.ReadableStream = ReadableStream;
      global.WritableStream = WritableStream;
    } catch (e2) {
      console.warn('Failed to load Web Streams API, some tests may fail');
    }
  }
}