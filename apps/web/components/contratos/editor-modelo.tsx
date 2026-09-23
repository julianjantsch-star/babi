'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { salvarModelo } from '@/app/actions/contratos';
import { Botao } from '@/components/ui/button';
import { Campo } from '@/components/ui/campos';
import { Cartao, CartaoTitulo, Aviso } from '@/components/ui/cards';
import { Etiqueta } from '@/components/ui/badge';
import { marcadoresUsados } from '@/lib/contratos/campos';
import type { ModeloContratoRegistro } from '@/lib/types';

/** Campos que o sistema sabe preencher. Fora desta lista, o contrato trava. */
const CAMPOS_DISPONIVEIS = [
  ['CONTRATADO_NOME', 'Nome de quem presta o serviço'],
  ['CONTRATADO_QUALIFICACAO', 'Ex.: brasileira, casada, Cirurgiã Dentista'],
  ['CONTRATADO_DOCUMENTO', 'CPF ou CNPJ do emitente'],
  ['CONTRATADO_RG', 'RG do emitente'],
  ['CONTRATADO_CRO', 'Registro no CRO'],
  ['CONTRATADO_ENDERECO', 'Endereço do consultório'],
  ['CONTRATADO_REPRESENTANTE', 'Quem assina pela PJ'],
  ['CONTRATANTE_NOME', 'Nome de quem contrata'],
  ['CONTRATANTE_DOCUMENTO', 'CPF ou CNPJ do contratante'],
  ['CONTRATANTE_ENDERECO', 'Endereço do contratante'],
  ['CONTRATANTE_TELEFONE', 'Telefone do contratante'],
  ['CONTRATANTE_EMAIL', 'E-mail do contratante'],
  ['PACIENTE_NOME', 'Paciente (cai no contratante se não informado)'],
  ['VALOR_TOTAL', 'Ex.: R$ 4.800,00'],
  ['VALOR_TOTAL_EXTENSO', 'Ex.: quatro mil e oitocentos reais'],
  ['FORMA_PAGAMENTO', 'Frase completa: valor, parcelas e vencimento'],
  ['NUM_PARCELAS', 'Quantidade de parcelas'],
  ['PRIMEIRO_VENCIMENTO', 'Data do primeiro vencimento'],
  ['CIDADE', 'Cidade de assinatura'],
  ['DATA_CONTRATO', 'Ex.: 23/09/2026'],
  ['DATA_EXTENSO', 'Ex.: 23 de setembro de 2026'],
  ['DATA_LOCAL', 'Ex.: Blumenau, 23 de setembro de 2026.'],
  ['ASSINATURAS', 'Bloco com as linhas de assinatura das duas partes'],
] as const;

const CONHECIDOS: ReadonlySet<string> = new Set<string>(
  CAMPOS_DISPONIVEIS.map(([campo]) => campo),
);

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending}>
      {pending ? 'Salvando…' : 'Salvar modelo'}
    </Botao>
  );
}

export function EditorModelo({ modelo }: { modelo: ModeloContratoRegistro }) {
  const [estado, acao] = useFormState(salvarModelo, undefined);
  const [corpo, setCorpo] = useState(modelo.corpo);

  const usados = marcadoresUsados(corpo);
  const invalidos = usados.filter((c) => !CONHECIDOS.has(c));

  return (
    <Cartao>
      <CartaoTitulo
        titulo={modelo.titulo}
        descricao={`Versão ${modelo.versao}`}
        acao={modelo.completo
          ? <Etiqueta tom="verde">Completo</Etiqueta>
          : <Etiqueta tom="ambar">Incompleto</Etiqueta>}
      />

      <form action={acao} className="space-y-4 p-4 sm:p-5">
        <input type="hidden" name="chave" value={modelo.chave} />

        {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
        {estado?.ok && <Aviso tom="sucesso">{estado.ok}</Aviso>}

        {invalidos.length > 0 && (
          <Aviso tom="erro">
            Campos que o sistema não conhece:{' '}
            {invalidos.map((c) => `{{${c}}}`).join(', ')}. Com eles no texto,
            a emissão do contrato é recusada.
          </Aviso>
        )}

        <Campo rotulo="Título do contrato" name="titulo"
          defaultValue={modelo.titulo} required maxLength={200} />

        <div>
          <label htmlFor={`corpo-${modelo.chave}`} className="rotulo">
            Texto do contrato
          </label>
          <textarea
            id={`corpo-${modelo.chave}`}
            name="corpo"
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={22}
            required
            spellCheck
            className="campo font-mono text-xs leading-relaxed"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            <strong># </strong>título centralizado ·{' '}
            <strong>## </strong>título de cláusula ·{' '}
            <strong>~</strong> linha centralizada · linha em branco separa
            parágrafos. Linhas seguidas viram um parágrafo só.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm">
          <input type="checkbox" name="completo" defaultChecked={modelo.completo}
            className="mt-0.5 h-4.5 w-4.5 rounded border-slate-300 text-brand-600" />
          <span className="text-slate-700">
            Texto conferido e completo
            <span className="block text-xs text-slate-500">
              Enquanto isto estiver desmarcado, todo contrato gerado sai
              carimbado como rascunho.
            </span>
          </span>
        </label>

        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            Campos disponíveis ({CAMPOS_DISPONIVEIS.length})
          </summary>
          <ul className="mt-3 space-y-1.5">
            {CAMPOS_DISPONIVEIS.map(([campo, desc]) => (
              <li key={campo} className="flex flex-wrap items-baseline gap-2 text-xs">
                <code className={`rounded px-1.5 py-0.5 font-mono ${
                  usados.includes(campo as string)
                    ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {`{{${campo}}}`}
                </code>
                <span className="text-slate-500">{desc}</span>
              </li>
            ))}
          </ul>
        </details>

        <Salvar />
      </form>
    </Cartao>
  );
}
