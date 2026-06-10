interface Window {
  DocsAPI?: {
    DocEditor: new (placeholderId: string, config: Record<string, unknown>) => {
      destroyEditor?: () => void;
      /** 触发转换下载；完成后触发 config.events.onDownloadAs */
      downloadAs?: (format: string) => void;
    };
  };
}
