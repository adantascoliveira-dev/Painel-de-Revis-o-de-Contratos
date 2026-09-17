'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { criarClienteNavegador } from '@/lib/supabase/browser';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    // O link do e-mail de recuperação faz o Supabase criar uma sessão temporária
    // (evento PASSWORD_RECOVERY) só depois de processar o hash da URL no cliente.
    const supabase = criarClienteNavegador();
    const { data: assinatura } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') setPronto(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPronto(true);
    });
    return () => assinatura.subscription.unsubscribe();
  }, []);

  async function salvarNovaSenha(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    if (senha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (senha !== confirmacao) {
      setErro('As senhas não coincidem.');
      return;
    }
    setCarregando(true);
    const { error } = await criarClienteNavegador().auth.updateUser({ password: senha });
    setCarregando(false);
    if (error) {
      setErro('Não foi possível redefinir a senha. Peça um novo link e tente de novo.');
      return;
    }
    setConcluido(true);
    setTimeout(() => router.push('/login'), 2000);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg)', padding: 20 }}>
      <div className="blueprint" style={{ width: 'min(420px, 100%)', padding: '36px 32px', background: '#FFFFFF' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <Image src="/assets/logo-horizontal.png" alt="Braga e Dantas Advogados" width={340} height={83} priority />
        </div>
        <h1 style={{ fontSize: 22, textAlign: 'center', marginBottom: 6 }}>Redefinir senha</h1>

        {!pronto ? (
          <p style={{ fontSize: 13, color: 'var(--color-muted)', textAlign: 'center' }}>
            Abra esta página a partir do link enviado por e-mail para redefinir sua senha.
          </p>
        ) : concluido ? (
          <p style={{ fontSize: 13, color: 'var(--color-muted)', textAlign: 'center' }}>
            Senha redefinida. Redirecionando para o login…
          </p>
        ) : (
          <form onSubmit={salvarNovaSenha} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="field">
              <label htmlFor="senha">Nova senha</label>
              <input
                id="senha"
                className="input"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="confirmacao">Confirme a nova senha</label>
              <input
                id="confirmacao"
                className="input"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
              />
            </div>
            {erro ? <div style={{ fontSize: 13, color: '#93342B' }}>{erro}</div> : null}
            <button type="submit" className="btn btn-primary btn-block" style={{ height: 42 }} disabled={carregando}>
              {carregando ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
