import { describe, expect, it } from 'vitest';
import { removerSecaoEmAberto } from '@/lib/fichas/secoes';

describe('removerSecaoEmAberto', () => {
  it('remove a seção EM ABERTO no formato "ROTULO:" e mantém as demais', () => {
    const md = [
      'POSIÇÕES:',
      '- PADRÃO: prazo de 30 meses',
      '',
      'EM ABERTO:',
      '- confirmar índice de reajuste com o sócio',
      '- multa de rescisão ainda em discussão',
      '',
      'VALIDADO POR: Anderson Dantas | DATA: 01/10/2026',
    ].join('\n');

    const limpo = removerSecaoEmAberto(md);
    expect(limpo).toContain('PADRÃO: prazo de 30 meses');
    expect(limpo).toContain('VALIDADO POR: Anderson Dantas');
    expect(limpo).not.toContain('índice de reajuste');
    expect(limpo).not.toContain('multa de rescisão');
    expect(limpo).not.toContain('EM ABERTO');
  });

  it('remove a seção em formato de título markdown', () => {
    const md = '## ALERTAS\n- DETECTAR: x\n\n## Em aberto\n- pendência\n\n## LIMITES E PARÂMETROS\n- prazo: 5 anos';
    const limpo = removerSecaoEmAberto(md);
    expect(limpo).toContain('DETECTAR: x');
    expect(limpo).toContain('prazo: 5 anos');
    expect(limpo).not.toContain('pendência');
  });

  it('remove EM ABERTO com conteúdo na mesma linha e com acento solto', () => {
    const md = 'ALERTAS:\n- a\nEM ABERTO: tudo isto some\nREDAÇÃO E TOM: formal';
    const limpo = removerSecaoEmAberto(md);
    expect(limpo).not.toContain('tudo isto some');
    expect(limpo).toContain('REDAÇÃO E TOM: formal');
  });

  it('não altera ficha sem a seção', () => {
    const md = 'POSIÇÕES:\n- PADRÃO: x';
    expect(removerSecaoEmAberto(md)).toBe(md);
  });
});
