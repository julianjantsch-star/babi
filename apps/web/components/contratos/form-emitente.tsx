'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Plus, Pencil } from 'lucide-react';
import { salvarEmitente } from '@/app/actions/contratos';
import { Modal } from '@/components/ui/modal';
import { Botao } from '@/components/ui/button';
import { Campo, Selecao } from '@/components/ui/campos';
import { Aviso } from '@/components/ui/cards';
import { Alternador } from '@/components/ui/alternador';
import { TIPOS_PESSOA, type Emitente, type TipoPessoa } from '@/lib/types';

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending} className="w-full" tamanho="lg">
      {pending ? 'Salvando…' : 'Salvar emitente'}
    </Botao>
  );
}

export function FormEmitente({ emitente }: { emitente?: Emitente }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useFormState(salvarEmitente, undefined);
  const [tipo, setTipo] = useState<TipoPessoa>(emitente?.tipo_pessoa ?? 'PF');
  const editando = !!emitente;

  return (
    <>
      {editando ? (
        <Botao variante="fantasma" tamanho="sm" onClick={() => setAberto(true)}>
          <Pencil className="h-4 w-4" /> Editar
        </Botao>
      ) : (
        <Botao variante="secundario" tamanho="sm" onClick={() => setAberto(true)}>
          <Plus className="h-4 w-4" /> Novo emitente
        </Botao>
      )}

      <Modal aberto={aberto} aoFechar={() => setAberto(false)}
        titulo={editando ? 'Editar emitente' : 'Novo emitente'}>
        <form action={acao} className="space-y-4">
          {emitente && <input type="hidden" name="id" value={emitente.id} />}
          <input type="hidden" name="tipo_pessoa" value={tipo} />

          {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
          {estado?.ok && <Aviso tom="sucesso">{estado.ok}</Aviso>}

          <Aviso tom="info">
            Estes são os seus dados, que entram no lado da <strong>contratada</strong>
            {' '}do contrato. A escolha entre PF e PJ também define a origem da
            conta a receber.
          </Aviso>

          <div>
            <p className="rotulo">Tipo de pessoa</p>
            <Alternador<TipoPessoa> nome="Tipo de pessoa" valor={tipo}
              aoMudar={setTipo} opcoes={TIPOS_PESSOA} compacto />
          </div>

          <Campo rotulo={tipo === 'PF' ? 'Nome completo' : 'Razão social'}
            name="nome" defaultValue={emitente?.nome} required maxLength={200} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo={tipo === 'PF' ? 'CPF' : 'CNPJ'} name="documento"
              inputMode="numeric" defaultValue={emitente?.documento ?? ''} required />
            <Campo rotulo="CRO" name="cro" defaultValue={emitente?.cro ?? ''}
              dica="Aparece na linha de assinatura." />
          </div>

          {tipo === 'PF' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="RG" name="rg" defaultValue={emitente?.rg ?? ''} />
              <Campo rotulo="Qualificação" name="qualificacao"
                defaultValue={emitente?.qualificacao ?? ''}
                placeholder="brasileira, casada, Cirurgiã Dentista"
                dica="Como aparece no preâmbulo." />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Quem assina pela empresa" name="representante"
                defaultValue={emitente?.representante ?? ''} />
              <Campo rotulo="CPF de quem assina" name="representante_doc"
                inputMode="numeric" defaultValue={emitente?.representante_doc ?? ''} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="E-mail" name="email" type="email"
              defaultValue={emitente?.email ?? ''} />
            <Campo rotulo="Telefone" name="telefone" type="tel"
              defaultValue={emitente?.telefone ?? ''} />
          </div>

          <details className="rounded-xl border border-slate-200 p-3" open={!editando}>
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Endereço do consultório
            </summary>
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Campo rotulo="CEP" name="cep" inputMode="numeric"
                  defaultValue={emitente?.cep ?? ''} />
                <Campo rotulo="Logradouro" name="logradouro" className="sm:col-span-2"
                  defaultValue={emitente?.logradouro ?? ''} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Campo rotulo="Número" name="numero" defaultValue={emitente?.numero ?? ''} />
                <Campo rotulo="Complemento" name="complemento"
                  defaultValue={emitente?.complemento ?? ''} />
                <Campo rotulo="Bairro" name="bairro" defaultValue={emitente?.bairro ?? ''} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Campo rotulo="Município" name="municipio"
                  defaultValue={emitente?.municipio ?? ''} className="sm:col-span-2" />
                <Selecao rotulo="UF" name="uf" defaultValue={emitente?.uf ?? ''}>
                  <option value="">—</option>
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
                    'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
                    .map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </Selecao>
              </div>
            </div>
          </details>

          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" name="padrao" defaultChecked={emitente?.padrao}
              className="h-4.5 w-4.5 rounded border-slate-300 text-brand-600" />
            Pré-selecionar este emitente no formulário de contrato
          </label>

          <Salvar />
        </form>
      </Modal>
    </>
  );
}
