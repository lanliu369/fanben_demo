import { NextResponse } from 'next/server';
import { callbackPublicBaseFromEnv, probeCallbackPublicBase } from '@/lib/wpsCallbackHealth';

/** 供范本编辑页加载金山 WPS WebOffice JSSDK 初始化参数（须在控制台创建应用并完成回调） */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sdkUrl =
    process.env.NEXT_PUBLIC_WPS_WEBOFFICE_SDK_URL?.trim() ||
    '/vendor/web-office-sdk-solution-v2.0.7.umd.js';
  const appId = process.env.WPS_WEBOFFICE_APP_ID?.trim() ?? '';
  const endpoint =
    process.env.WPS_WEBOFFICE_ENDPOINT?.trim() || 'https://o.wpsgo.com';
  const token = process.env.WPS_WEBOFFICE_TOKEN?.trim();
  const callbackPublicBase = callbackPublicBaseFromEnv();
  const callbackPublicBaseReachable = callbackPublicBase
    ? await probeCallbackPublicBase(callbackPublicBase)
    : false;

  return NextResponse.json({
    sdkUrl,
    appId,
    fileId: id,
    officeType: 'w',
    endpoint,
    ...(token ? { token } : {}),
    /** 控制台「回调地址」填公网可访问的服务根；文档路径以 `/v3/3rd` 为后缀（见官方文档） */
    callbackGatewaySuffix: '/v3/3rd',
    ...(callbackPublicBase ? { callbackGatewayExample: `${callbackPublicBase}/v3/3rd` } : {}),
    callbackPublicBaseConfigured: Boolean(callbackPublicBase),
    callbackPublicBaseReachable,
    ...(callbackPublicBase ? { callbackPublicBaseUrl: callbackPublicBase } : {}),
    /** appId 与 JSSDK 地址齐备时才可初始化（详见控制台 https://solution.wps.cn/console） */
    configured: Boolean(appId && sdkUrl),
  });
}
