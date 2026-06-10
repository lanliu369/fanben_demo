'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, User } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('请输入账号');
      return;
    }
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    localStorage.setItem('fanben-auth', JSON.stringify({
      username: username.trim(),
      loggedInAt: new Date().toISOString(),
    }));
    setLoading(false);
    router.push('/');
  };

  return (
    <div
      style={{
        height: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: '"Inter", "PingFang SC", "HarmonyOS Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: 'radial-gradient(circle at 50% 0%, rgba(22,100,255,0.06), transparent 35%), linear-gradient(180deg, #f7f9fc, #f3f5f9)',
      }}
    >
      {/* 缓慢呼吸光效 */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            top: '-10%',
            left: '20%',
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(22,100,255,0.08) 0%, transparent 60%)',
            filter: 'blur(80px)',
            animation: 'breathe 8s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-5%',
            right: '10%',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(100,116,139,0.06) 0%, transparent 60%)',
            filter: 'blur(70px)',
            animation: 'breathe 10s ease-in-out infinite reverse',
          }}
        />
      </div>

      {/* 内容容器 */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 440,
          paddingLeft: 20,
          paddingRight: 20,
        }}
      >
        {/* 品牌区 */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: 32,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: 12,
              color: '#94a3b8',
            }}
          >
            Enterprise AI Platform
          </p>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              lineHeight: 1.3,
            }}
          >
            招标文件范本编制工具
          </h1>
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              color: '#94a3b8',
              letterSpacing: '0.02em',
            }}
          >
            标准化流程 · AI 辅助编制 · 企业级协同
          </p>
        </div>

        {/* 登录卡片 */}
        <div
          style={{
            background: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 10px 40px rgba(15,23,42,0.06), 0 2px 12px rgba(15,23,42,0.04)',
            padding: '32px',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 0.6s cubic-bezier(0.25, 0.1, 0.25, 1) 0.08s',
          }}
        >
          <form
            onSubmit={handleLogin}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {/* 账号 */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 6,
                  color: '#475569',
                }}
              >
                账号
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#cbd5e1',
                    pointerEvents: 'none',
                  }}
                >
                  <User style={{ width: 18, height: 18 }} strokeWidth={1.5} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入账号"
                  autoComplete="username"
                  style={{
                    width: '100%',
                    height: 44,
                    paddingLeft: 42,
                    paddingRight: 16,
                    fontSize: 15,
                    color: '#0f172a',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (e.currentTarget !== document.activeElement) {
                      e.currentTarget.style.borderColor = 'rgba(22,100,255,0.25)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (e.currentTarget !== document.activeElement) {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)';
                    e.currentTarget.style.background = '#fff';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.background = '#fff';
                  }}
                />
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 6,
                  color: '#475569',
                }}
              >
                密码
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#cbd5e1',
                    pointerEvents: 'none',
                  }}
                >
                  <Lock style={{ width: 18, height: 18 }} strokeWidth={1.5} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    height: 44,
                    paddingLeft: 42,
                    paddingRight: 42,
                    fontSize: 15,
                    color: '#0f172a',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (e.currentTarget !== document.activeElement) {
                      e.currentTarget.style.borderColor = 'rgba(22,100,255,0.25)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (e.currentTarget !== document.activeElement) {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)';
                    e.currentTarget.style.background = '#fff';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.background = '#fff';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#cbd5e1',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff style={{ width: 18, height: 18 }} strokeWidth={1.5} />
                  ) : (
                    <Eye style={{ width: 18, height: 18 }} strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div
                style={{
                  padding: '10px 16px',
                  borderRadius: 12,
                  fontSize: 14,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                }}
              >
                {error}
              </div>
            )}

            {/* 登录按钮 */}
            <div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  height: 44,
                  fontSize: 15,
                  fontWeight: 500,
                  color: '#fff',
                  background: '#1664FF',
                  borderRadius: 12,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(22,100,255,0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.background = '#3b82f6';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(22,100,255,0.25)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1664FF';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(22,100,255,0.18)';
                }}
              >
                {loading ? (
                  <>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    登录中...
                  </>
                ) : (
                  '登 录'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 底部版权 */}
        <div
          style={{
            marginTop: 32,
            textAlign: 'center',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.6s cubic-bezier(0.25, 0.1, 0.25, 1) 0.2s',
          }}
        >
          <p style={{ fontSize: 11, color: '#cbd5e1' }}>
            招标文件范本编制工具平台 v2.0
          </p>
          <p style={{ fontSize: 11, marginTop: 4, color: '#cbd5e1' }}>
            © 国家电力投资集团有限公司
          </p>
        </div>
      </div>

      {/* 全局动画 */}
      <style jsx global>{`
        @keyframes breathe {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            opacity: 0.8;
          }
          50% {
            transform: translate(20px, -10px) scale(1.05);
            opacity: 1;
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
