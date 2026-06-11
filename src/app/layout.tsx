import type { Metadata } from "next";
import "./globals.css";
import { GlobalLoadingProvider } from "@/components/ui/GlobalLoading";
import { ChunkLoadRecovery } from "@/components/ui/ChunkLoadRecovery";

export const metadata: Metadata = {
  title: "招标文件范本编制工具平台",
  description: "政企采购领域的招标文件范本和招标文件编制系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full bg-gray-50 antialiased">
        <GlobalLoadingProvider>
          <ChunkLoadRecovery />
          {children}
        </GlobalLoadingProvider>
      </body>
    </html>
  );
}
