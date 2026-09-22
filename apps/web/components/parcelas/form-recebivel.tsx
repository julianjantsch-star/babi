'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { criarRecebivel } from '@/app/actions/recebiveis';
import { Alternador } from '@/components/ui/alternador';
import { Botao } from '@/components/ui/button';
import { Campo, Selecao, AreaTexto } from '@/components/ui/campos';
import { Cartao, CartaoTitulo, Aviso } from '@/components/ui/cards';
import { moeda, data as fdata, hojeISO } from '@/lib/format';
import { ORIGENS, type OrigemFaturamento, type Cliente } from '@/lib/types';

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending} tamanho="lg" className="w-full sm:w-auto">
      {pending ? 'Lançando…' : 'Lançar conta a receber'}
    </Botao>
  );
}

/** Divide o total em N parcelas, jogando o resto dos centavos na primeira. */
function simular(total: number, n: number, primeiroVenc: string) {
  if (!Number.isFinite(total) || total <= 0 || n < 1) return [];
  const base = Math.floor((total * 100) / n) / 100;
  const resto = Math.round((total - base * n) * 100) / 100;

  const [ano, mes, dia] = primeiroVenc.split('-').map(Number);
  if (!ano) return [];

  return Array.from({ length: Math.min(n, 120) }, (_, i) => {
    const d = new Date(Date.UTC(ano, mes - 1 + i, 1));
    // Mantém o dia do vencimento, recuando quando o mês é mais curto.
    const ultimoDia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(dia, ultimoDia));
    return {
      numero: i + 1,
      valor: i === 0 ? Math.round((base + resto) * 100) / 100 : base,
      vencimento: d.toISOString().slice(0, 10),
    };
  });
}

function paraNumero(v: string) {
  const limpo = v.trim().replace(/\s/g, '');
  return Number(limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo);
}

export function FormRecebivel({
  clientes, travadoEmClinica,
}: {
  clientes: Pick<Cliente, 'id' | 'nome' | 'tipo_pessoa' | 'documento'>[];
  travadoEmClinica: boolean;
}) {
  const [estado, acao] = useFormState(criarRecebivel, undefined);
  const [origem, setOrigem] = useState<OrigemFaturamento>(
    travadoEmClinica ? 'CLINICA' : 'PF',
  );
  const [valor, setValor] = useState('');
  const [parcelas, setParcelas] = useState('1');
  const [primeiroVenc, setPrimeiroVenc] = useState(hojeISO());

  const previa = useMemo(
    () => simular(paraNumero(valor), Number(parcelas) || 1, primeiroVenc),
    [valor, parcelas, primeiroVenc],
  );
  const somaPrevia = previa.reduce((s, p) => s + p.valor, 0);

  return (
    <form action={acao} className="grid gap-4 lg:grid-cols-5">
      <input type="hidden" name="origem" value={origem} />

      <div className="space-y-4 lg:col-span-3">
        {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
        {estado?.ok && (
          <Aviso tom="sucesso">
            {estado.ok}{' '}
            <Link href="/recebiveis" className="font-semibold underline">
              Ver contas a receber
            </Link>
          </Aviso>
        )}

        <Cartao className="space-y-4 p-4 sm:p-5">
          {!travadoEmClinica ? (
            <div>
              <p className="rotulo">Origem do faturamento</p>
              <Alternador<OrigemFaturamento>
                nome="Origem do faturamento"
                valor={origem}
                aoMudar={setOrigem}
                opcoes={ORIGENS}
              />
              {origem === 'PJ' && (
                <p className="mt-2 text-xs text-brand-700">
                  Contas da origem PJ podem gerar NFS-e após o lançamento.
                </p>
              )}
            </div>
          ) : (
            <Aviso tom="info">
              Seu perfil lança exclusivamente contas da origem{' '}
              <strong>Clínica</strong>.
            </Aviso>
          )}

          <Selecao rotulo="Cliente / paciente" name="cliente_id" required defaultValue="">
            <option value="" disabled>Selecione…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} {c.documento ? `· ${c.documento}` : ''}
              </option>
            ))}
          </Selecao>
          <p className="-mt-2 text-xs text-slate-500">
            Não encontrou?{' '}
            <Link href="/clientes" className="font-medium text-brand-700 hover:underline">
              Cadastrar cliente
            </Link>
          </p>

          <Campo
            rotulo="Descrição do serviço"
            name="descricao"
            placeholder="Ex.: Tratamento ortodôntico — aparelho fixo"
            required
            maxLength={300}
          />
        </Cartao>

        <Cartao className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="Valor total (R$)"
              name="valor_total"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
            />
            <Campo
              rotulo="Número de parcelas"
              name="num_parcelas"
              type="number"
              min={1}
              max={120}
              value={parcelas}
              onChange={(e) => setParcelas(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="1º vencimento"
              name="primeiro_vencimento"
              type="date"
              value={primeiroVenc}
              onChange={(e) => setPrimeiroVenc(e.target.value)}
              required
            />
            <Campo
              rotulo="Competência"
              name="data_competencia"
              type="date"
              defaultValue={hojeISO()}
              dica="Data do atendimento/contrato."
            />
          </div>

          <AreaTexto rotulo="Observações (opcional)" name="observacoes" maxLength={1000} />
        </Cartao>

        <div className="flex gap-3">
          <Salvar />
          <Link href="/recebiveis" className="hidden sm:block">
            <Botao variante="secundario" tamanho="lg" type="button">Cancelar</Botao>
          </Link>
        </div>
      </div>

      {/* Prévia das parcelas: o operador confere antes de gravar. */}
      <div className="lg:col-span-2">
        <Cartao className="lg:sticky lg:top-6">
          <CartaoTitulo
            titulo="Prévia das parcelas"
            descricao={previa.length ? `${previa.length} parcela(s)` : undefined}
          />
          {previa.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              Informe o valor e o número de parcelas.
            </p>
          ) : (
            <>
              <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {previa.map((p) => (
                  <li key={p.numero}
                    className="flex items-center justify-between px-4 py-2.5 text-sm sm:px-5">
                    <span className="text-slate-500">
                      {p.numero}ª · {fdata(p.vencimento)}
                    </span>
                    <span className="font-semibold tabular-nums text-slate-900">
                      {moeda(p.valor)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-slate-200
                px-4 py-3 sm:px-5">
                <span className="text-sm font-semibold text-slate-700">Total</span>
                <span className="text-base font-bold tabular-nums text-slate-900">
                  {moeda(somaPrevia)}
                </span>
              </div>
            </>
          )}
        </Cartao>
      </div>
    </form>
  );
}
