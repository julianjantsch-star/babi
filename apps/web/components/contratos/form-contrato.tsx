'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { FileText, ExternalLink } from 'lucide-react';
import { emitirContrato } from '@/app/actions/contratos';
import { Alternador } from '@/components/ui/alternador';
import { Botao } from '@/components/ui/button';
import { Campo, Selecao, AreaTexto } from '@/components/ui/campos';
import { Cartao, CartaoTitulo, Aviso } from '@/components/ui/cards';
import { moeda, data as fdata, hojeISO } from '@/lib/format';
import {
  MODELOS_CONTRATO, type ModeloContrato, type Cliente, type Emitente,
} from '@/lib/types';

function Emitir() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending} tamanho="lg" className="w-full sm:w-auto">
      {pending ? 'Gerando contrato…' : 'Gerar contrato e lançar no financeiro'}
    </Botao>
  );
}

function paraNumero(v: string) {
  const limpo = v.trim().replace(/\s/g, '');
  return Number(limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo);
}

/** Mesma divisão do contas a receber: o resto vai na primeira parcela. */
function simular(total: number, n: number, primeiroVenc: string) {
  if (!Number.isFinite(total) || total <= 0 || n < 1) return [];
  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / n);
  const resto = centavos - base * n;

  const [ano, mes, dia] = primeiroVenc.split('-').map(Number);
  if (!ano) return [];

  return Array.from({ length: Math.min(n, 120) }, (_, i) => {
    const d = new Date(Date.UTC(ano, mes - 1 + i, 1));
    const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(dia, ultimo));
    return {
      numero: i + 1,
      valor: (i === 0 ? base + resto : base) / 100,
      vencimento: d.toISOString().slice(0, 10),
    };
  });
}

interface Props {
  clientes: Pick<Cliente, 'id' | 'nome' | 'tipo_pessoa' | 'documento'>[];
  emitentes: Emitente[];
  modelosIncompletos: ModeloContrato[];
}

export function FormContrato({ clientes, emitentes, modelosIncompletos }: Props) {
  const [estado, acao] = useFormState(emitirContrato, undefined);

  const [modelo, setModelo] = useState<ModeloContrato>('ORTODONTICO');
  const [emitenteId, setEmitenteId] = useState(
    () => emitentes.find((e) => e.padrao)?.id ?? emitentes[0]?.id ?? '',
  );
  const [aVista, setAVista] = useState(false);
  const [valor, setValor] = useState('');
  const [parcelas, setParcelas] = useState('12');
  const [primeiroVenc, setPrimeiroVenc] = useState(hojeISO());

  const emitente = emitentes.find((e) => e.id === emitenteId);
  const total = paraNumero(valor);
  const n = aVista ? 1 : Number(parcelas) || 1;
  const previa = useMemo(() => simular(total, n, primeiroVenc), [total, n, primeiroVenc]);
  const incompleto = modelosIncompletos.includes(modelo);

  return (
    <form action={acao} className="grid gap-4 lg:grid-cols-5">
      <input type="hidden" name="modelo" value={modelo} />
      <input type="hidden" name="emitente_id" value={emitenteId} />
      <input type="hidden" name="a_vista" value={String(aVista)} />

      <div className="space-y-4 lg:col-span-3">
        {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
        {estado?.ok && (
          <Aviso tom="sucesso">
            {estado.ok}{' '}
            {estado.contratoId && (
              <a
                href={`/api/contratos/${estado.contratoId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline"
              >
                Abrir o PDF
              </a>
            )}
          </Aviso>
        )}

        <Cartao className="space-y-4 p-4 sm:p-5">
          <div>
            <p className="rotulo">Modelo do contrato</p>
            <Alternador<ModeloContrato>
              nome="Modelo do contrato"
              valor={modelo}
              aoMudar={setModelo}
              opcoes={MODELOS_CONTRATO.map((m) => ({
                value: m.value, label: m.label, hint: m.descricao,
              }))}
            />
            {incompleto && (
              <div className="mt-2">
                <Aviso tom="alerta">
                  Este modelo ainda não foi marcado como completo, então o PDF
                  sai carimbado como <strong>rascunho</strong>.{' '}
                  <Link href="/contratos/modelos" className="font-semibold underline">
                    Completar o texto
                  </Link>
                </Aviso>
              </div>
            )}
          </div>

          <div>
            <p className="rotulo">Quem presta o serviço</p>
            {emitentes.length === 0 ? (
              <Aviso tom="alerta">
                Nenhum emitente cadastrado.{' '}
                <Link href="/configuracoes" className="font-semibold underline">
                  Cadastrar em Configurações
                </Link>
              </Aviso>
            ) : (
              <>
                <Alternador
                  nome="Quem presta o serviço"
                  valor={emitenteId}
                  aoMudar={setEmitenteId}
                  opcoes={emitentes.map((e) => ({
                    value: e.id,
                    label: e.tipo_pessoa === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica',
                    hint: e.nome,
                  }))}
                  compacto
                />
                <p className="mt-2 text-xs text-slate-500">
                  A conta a receber nasce com a origem{' '}
                  <strong>{emitente?.tipo_pessoa === 'PJ' ? 'PJ' : 'PF'}</strong>,
                  acompanhando esta escolha.
                </p>
              </>
            )}
          </div>

          <Selecao rotulo="Cliente / contratante" name="cliente_id" required defaultValue="">
            <option value="" disabled>Selecione…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}{c.documento ? ` · ${c.documento}` : ''}
              </option>
            ))}
          </Selecao>

          <Campo
            rotulo="Paciente (se for diferente de quem assina)"
            name="paciente_nome"
            placeholder="Deixe vazio se o paciente é o próprio contratante"
            maxLength={200}
          />
        </Cartao>

        <Cartao className="space-y-4 p-4 sm:p-5">
          <Campo
            rotulo="Valor total do tratamento (R$)"
            name="valor_total"
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
          />

          <div>
            <p className="rotulo">Forma de pagamento</p>
            <Alternador<'vista' | 'parcelado'>
              nome="Forma de pagamento"
              valor={aVista ? 'vista' : 'parcelado'}
              aoMudar={(v) => setAVista(v === 'vista')}
              opcoes={[
                { value: 'vista', label: 'À vista' },
                { value: 'parcelado', label: 'Parcelado' },
              ]}
              compacto
            />
          </div>

          {!aVista && (
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
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo={aVista ? 'Data do pagamento' : '1º vencimento'}
              name="primeiro_vencimento"
              type="date"
              value={primeiroVenc}
              onChange={(e) => setPrimeiroVenc(e.target.value)}
              required
            />
            <Campo
              rotulo="Data do contrato"
              name="data_contrato"
              type="date"
              defaultValue={hojeISO()}
              required
            />
          </div>

          <Campo
            rotulo="Cidade de assinatura"
            name="cidade"
            defaultValue="Blumenau"
            required
          />

          <AreaTexto rotulo="Observações internas (não saem no contrato)"
            name="observacoes" maxLength={1000} />
        </Cartao>

        <Emitir />
      </div>

      <div className="lg:col-span-2">
        <Cartao className="lg:sticky lg:top-6">
          <CartaoTitulo
            titulo="O que será gerado"
            descricao={previa.length ? `${previa.length} parcela(s)` : undefined}
          />
          <div className="space-y-3 px-4 py-4 text-sm sm:px-5">
            <div className="flex items-start gap-2.5">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div>
                <p className="font-medium text-slate-900">
                  {MODELOS_CONTRATO.find((m) => m.value === modelo)?.label}
                </p>
                <p className="text-xs text-slate-500">
                  PDF pronto para imprimir e assinar
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div>
                <p className="font-medium text-slate-900">
                  Conta a receber de origem{' '}
                  {emitente?.tipo_pessoa === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                </p>
                <p className="text-xs text-slate-500">
                  {previa.length
                    ? `${previa.length} parcela(s) a partir de ${fdata(primeiroVenc)}`
                    : 'Informe o valor para ver as parcelas'}
                </p>
              </div>
            </div>
          </div>

          {previa.length > 0 && (
            <>
              <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto border-t
                border-slate-200">
                {previa.map((p) => (
                  <li key={p.numero}
                    className="flex items-center justify-between px-4 py-2 text-sm sm:px-5">
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
                  {moeda(previa.reduce((s, p) => s + p.valor, 0))}
                </span>
              </div>
            </>
          )}
        </Cartao>
      </div>
    </form>
  );
}
