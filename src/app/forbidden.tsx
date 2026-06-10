import { SystemErrorPage } from '@/components/ui/SystemErrorPage';

/** 当 Server Component / Route Handler 中调用 `forbidden()` 时展示；需开启 `experimental.authInterrupts`。 */
export default function Forbidden() {
  return <SystemErrorPage variant="403" />;
}
