"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { estimateTokens } from "@/lib/utils/token-estimation";

/**
 * Token 估算测试页面
 * 用于验证估算算法准确性
 */
export default function TokenTestPage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<number | null>(null);
  const [details, setDetails] = useState<string[]>([]);

  // 计算 token
  const calculateTokens = () => {
    // 直接估算整个输入
    const tokens = estimateTokens(input);

    // 生成明细
    const breakdown: string[] = [];
    breakdown.push(`总字符数: ${input.length}`);

    // 分析字符构成
    let ascii = 0, nonAscii = 0;
    for (const c of input) {
      if (c.charCodeAt(0) < 128) ascii++;
      else nonAscii++;
    }
    breakdown.push(`ASCII字符: ${ascii} (≈${Math.ceil(ascii/4)} tokens)`);
    breakdown.push(`非ASCII字符: ${nonAscii} (≈${Math.ceil(nonAscii/1.5)} tokens)`);

    setDetails(breakdown);
    setResult(tokens);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和说明 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Token 估算测试</h1>
        <p className="text-muted-foreground mt-1">
          估算文本或请求JSON的Token数量
        </p>
      </div>

      {/* 说明 */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            估算规则：<br />
            • ASCII字符: 4字符 ≈ 1 token<br />
            • 非ASCII字符(中文): 1.5字符 ≈ 1 token<br />
            <br />
            粘贴完整请求JSON或纯文本进行估算
          </p>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {/* 输入框 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">请求内容</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="粘贴完整的请求JSON或纯文本..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={15}
              className="font-mono text-sm"
            />
          </CardContent>
        </Card>

        {/* 计算按钮 */}
        <Button onClick={calculateTokens} className="w-full">
          计算 Token
        </Button>

        {/* 计算结果 */}
        {result !== null && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-4">
                <span className="text-muted-foreground">估算结果: </span>
                <span className="text-2xl font-mono font-bold">{result}</span>
                <span className="text-muted-foreground"> tokens</span>
              </div>

              {/* 详细明细 */}
              {details.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-2">估算明细：</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {details.map((d, i) => (
                      <li key={i}>• {d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}