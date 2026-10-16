import { describe, expect, it } from 'vitest';
import { identificarModalidade } from '@/lib/modelos/modalidade';

describe('identificarModalidade', () => {
  it('reconhece relação recorrente como contínuo', () => {
    const texto =
      'O contrato vigorará por 12 (doze) meses. A CONTRATANTE pagará o valor mensal de R$ 5.000,00, vinculado ao Relatório Mensal de Serviços. A prorrogação somente por aditivo.';
    expect(identificarModalidade(texto)).toBe('continuo');
  });

  it('reconhece evento ou projeto com fim definido como pontual', () => {
    const texto =
      'O serviço será prestado para o evento de 12 de dezembro, em montagem e desmontagem do palco. O valor global de R$ 8.000,00 será pago em parcela única após a conclusão do evento.';
    expect(identificarModalidade(texto)).toBe('pontual');
  });

  it('na dúvida (poucos sinais ou sinais empatados) devolve null', () => {
    expect(identificarModalidade('O prestador executará consultoria jurídica para a CONTRATANTE.')).toBeNull();
    expect(identificarModalidade('Evento de lançamento, no dia do evento. Valor mensal de R$ 1.000,00 e prorrogação por aditivo.')).toBeNull();
  });
});
