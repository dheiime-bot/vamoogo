/**
 * RouteErrorBoundary — captura exceções de render em qualquer rota e mostra
 * uma tela amigável de recuperação no lugar de uma tela branca.
 *
 * Resetar a chave (via `useLocation().key`) faz o boundary tentar renderizar
 * novamente ao navegar, evitando que um erro em uma rota "trave" a navegação
 * para as demais.
 */
import { Component, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Quando muda, o boundary se reseta (ex.: navegação entre rotas). */
  resetKey?: string;
  /** Para onde o botão "Início" deve levar. */
  homePath?: string;
}

interface State {
  error: Error | null;
}

class ErrorBoundaryInner extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[RouteErrorBoundary] capturou erro:", error, info);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const homePath = this.props.homePath || "/";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-foreground">Algo deu errado</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Encontramos um problema ao carregar esta tela. Tente recarregar ou volte para o início.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            <RefreshCw className="h-4 w-4" /> Recarregar
          </button>
          <button
            onClick={() => {
              window.location.assign(homePath);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-muted px-4 py-2 text-sm font-bold text-foreground"
          >
            <Home className="h-4 w-4" /> Início
          </button>
        </div>
      </div>
    );
  }
}

/**
 * Wrapper funcional que injeta o `key` da rota atual para resetar o boundary
 * automaticamente ao navegar e detecta o app (motorista/passageiro/admin) para
 * o botão de "Início".
 */
const RouteErrorBoundary = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  // Detecta o app a partir do prefixo da rota.
  let homePath = "/";
  if (location.pathname.startsWith("/driver")) homePath = "/driver";
  else if (location.pathname.startsWith("/passenger")) homePath = "/passenger";
  else if (location.pathname.startsWith("/admin")) homePath = "/admin";
  return (
    <ErrorBoundaryInner resetKey={location.key} homePath={homePath}>
      {children}
    </ErrorBoundaryInner>
  );
};

export default RouteErrorBoundary;

// Mantém o hook útil mesmo se não usado (evita import lint).
export const _useNavigateForBoundary = useNavigate;