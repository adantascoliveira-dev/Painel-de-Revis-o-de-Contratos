'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { criarClienteNavegador } from '@/lib/supabase/browser';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [mensagemRecuperacao, setMensagemRecuperacao] = useState<string | null>(null);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setMensagemRecuperacao(null);
    setCarregando(true);
    const { error } = await criarClienteNavegador().auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      setErro('E-mail ou senha inválidos.');
      return;
    }
    router.push('/novo-documento');
    router.refresh();
  }

  async function recuperarSenha() {
    if (!email) {
      setErro('Informe o e-mail para recuperar a senha.');
      return;
    }
    setErro(null);
    setMensagemRecuperacao(null);
    setRecuperando(true);
    await criarClienteNavegador().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setRecuperando(false);
    // Mensagem genérica de propósito: não confirma se o e-mail existe na base.
    setMensagemRecuperacao('Se esse e-mail estiver cadastrado, enviamos um link para redefinir a senha.');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg)', padding: 20 }}>
      <div className="blueprint" style={{ width: 'min(420px, 100%)', padding: '36px 32px', background: '#FFFFFF' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <Image src="/assets/logo-horizontal.png" alt="Braga e Dantas Advogados" width={340} height={83} priority />
        </div>
        <h1 style={{ fontSize: 22, textAlign: 'center', marginBottom: 6 }}>Painel de revisão</h1>
        <p style={{ fontSize: 13, color: 'var(--color-muted)', textAlign: 'center', marginBottom: 24 }}>
          Entre com a sua conta do escritório.
        </p>
        <form onSubmit={entrar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label htmlFor="senha">Senha</label>
              <button
                type="button"
                onClick={recuperarSenha}
                disabled={recuperando}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 12,
                  color: 'var(--color-muted)',
                  cursor: recuperando ? 'default' : 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {recuperando ? 'Enviando…' : 'Esqueceu sua senha?'}
              </button>
            </div>
            <input
              id="senha"
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          {erro ? <div style={{ fontSize: 13, color: '#93342B' }}>{erro}</div> : null}
          {mensagemRecuperacao ? <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>{mensagemRecuperacao}</div> : null}
          <button type="submit" className="btn btn-primary btn-block" style={{ height: 42 }} disabled={carregando}>
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
