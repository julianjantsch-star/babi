'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useTransition, useState } from 'react';
import { salvarConfiguracoes } from '@/app/actions/config';
import { esquecerDispositivos } from '@/app/actions/auth';
import { Botao } from '@/components/ui/button';
import { Campo, Selecao } from '@/components/ui/campos';
import { Cartao, CartaoTitulo, Aviso } from '@/components/ui/cards';

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending} tamanho="lg">
      {pending ? 'Salvando…' : 'Salvar configurações'}
    </Botao>
  );
}

type Config = Record<string, string | number | boolean | null>;

export function FormConfig({ config }: { config: Config }) {
  const [estado, acao] = useFormState(salvarConfiguracoes, undefined);
  const texto = (k: string) => String(config[k] ?? '');

  return (
    <form action={acao} className="space-y-4">
      {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tom="sucesso">{estado.ok}</Aviso>}

      <Cartao>
        <CartaoTitulo titulo="Prestador"
          descricao="Dados que aparecem na NFS-e emitida" />
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <Campo rotulo="Razão social" name="razao_social" defaultValue={texto('razao_social')} />
          <Campo rotulo="Nome fantasia" name="nome_fantasia"
            defaultValue={texto('nome_fantasia')} />
          <Campo rotulo="CNPJ" name="cnpj" inputMode="numeric" defaultValue={texto('cnpj')} />
          <Campo rotulo="Inscrição municipal" name="inscricao_municipal"
            defaultValue={texto('inscricao_municipal')} />
          <Campo rotulo="Código IBGE do município" name="cod_municipio"
            inputMode="numeric" defaultValue={texto('cod_municipio')}
            dica="7 dígitos, do município onde o serviço é prestado." />
          <Campo rotulo="CNAE" name="cnae" defaultValue={texto('cnae')} />
        </div>
      </Cartao>

      <Cartao>
        <CartaoTitulo titulo="Tributação e NFS-e" />
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <Campo rotulo="Item da lista de serviços" name="item_lista_servico"
            defaultValue={texto('item_lista_servico')}
            dica="Odontologia costuma ser 04.12 — confirme com a contabilidade." />
          <Campo rotulo="Alíquota de ISS (%)" name="aliquota_iss" inputMode="decimal"
            defaultValue={
              config.aliquota_iss != null
                ? String(Number(config.aliquota_iss) * 100) : ''
            }
            dica="Ex.: 2 para 2%." />
          <Campo rotulo="Série do RPS" name="serie_rps" defaultValue={texto('serie_rps')} />
          <Selecao rotulo="Ambiente" name="ambiente_nfse"
            defaultValue={texto('ambiente_nfse') || 'HOMOLOGACAO'}>
            <option value="HOMOLOGACAO">Homologação (testes)</option>
            <option value="PRODUCAO">Produção (nota com valor fiscal)</option>
          </Selecao>
          <Campo rotulo="Regime tributário" name="regime_tributario"
            defaultValue={texto('regime_tributario')} />

          <div className="space-y-3 sm:col-span-2">
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" name="optante_simples"
                defaultChecked={!!config.optante_simples}
                className="h-4.5 w-4.5 rounded border-slate-300 text-brand-600" />
              Optante pelo Simples Nacional
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" name="iss_retido"
                defaultChecked={!!config.iss_retido}
                className="h-4.5 w-4.5 rounded border-slate-300 text-brand-600" />
              ISS retido na fonte pelo tomador
            </label>
          </div>
        </div>
      </Cartao>

      <Salvar />
    </form>
  );
}

export function BotaoEsquecerDispositivos() {
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {msg && <Aviso tom="sucesso">{msg}</Aviso>}
      <Botao
        variante="secundario"
        carregando={pendente}
        onClick={() => iniciar(async () => {
          const r = await esquecerDispositivos();
          setMsg(r?.ok ?? r?.erro ?? null);
        })}
      >
        Esquecer todos os dispositivos
      </Botao>
    </div>
  );
}
