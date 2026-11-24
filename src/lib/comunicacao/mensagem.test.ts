import { describe, expect, it } from 'vitest';
import {
  camposPendentes,
  contatoDoUsuario,
  emailsValidos,
  enderecoDoSistema,
  lerModoEnvio,
  linkEmail,
  linkWhatsapp,
  numeroWhatsapp,
  preencherCampos,
  saudacao,
  textoParaEmail,
} from './mensagem';

describe('campos a preencher', () => {
  it('lista campos sem repetir e na ordem', () => {
    expect(camposPendentes('Olá, {{nome}}! {{turma}} e {{nome}}', 'Assunto {{data}}')).toEqual(['nome', 'turma', 'data']);
    expect(camposPendentes('sem campos [EMERGÊNCIA]')).toEqual([]);
  });

  it('substitui só os preenchidos', () => {
    expect(preencherCampos('Olá, {{nome}}! Turma {{turma}}.', { nome: ' Maria ', turma: '' })).toBe('Olá, Maria! Turma {{turma}}.');
  });

  it('saudação com nome ou campo', () => {
    expect(saudacao('equipe da CAE', 'destinatário')).toBe('Olá, equipe da CAE!');
    expect(saudacao(null, 'destinatário na CAE')).toBe('Olá, {{destinatário na CAE}}!');
    expect(saudacao('  ', 'x')).toBe('Olá, {{x}}!');
  });
});

describe('e-mail', () => {
  it('tira a formatação do WhatsApp', () => {
    expect(textoParaEmail('Turma: *REDES-2*\n_Aviso no painel._ e snake_case_nome')).toBe('Turma: REDES-2\nAviso no painel. e snake_case_nome');
  });

  it('valida um ou vários endereços', () => {
    expect(emailsValidos('cae@ifce.edu.br')).toBe(true);
    expect(emailsValidos('a@ifce.edu.br, b@ifce.edu.br')).toBe(true);
    expect(emailsValidos('a@ifce')).toBe(false);
    expect(emailsValidos('a b@ifce.edu.br')).toBe(false);
    expect(emailsValidos('')).toBe(false);
  });

  it('monta mailto com assunto e corpo em CRLF, sem destinatário inválido', () => {
    expect(linkEmail({ para: 'cae@ifce.edu.br', assunto: 'Aviso — turma', texto: 'Olá *A*\nok' })).toBe(
      'mailto:cae@ifce.edu.br?subject=Aviso%20%E2%80%94%20turma&body=Ol%C3%A1%20A%0D%0Aok',
    );
    expect(linkEmail({ para: 'invalido', assunto: 'x', texto: 'y' })).toBe('mailto:?subject=x&body=y');
    expect(linkEmail({ para: null, assunto: 'x', texto: 'y' })).toBe('mailto:?subject=x&body=y');
  });
});

describe('WhatsApp e contato', () => {
  it('link com ou sem número', () => {
    expect(linkWhatsapp('Olá *turma*\nok')).toBe('https://wa.me/?text=Ol%C3%A1%20*turma*%0Aok');
    expect(linkWhatsapp('oi', '5588999990000')).toBe('https://wa.me/5588999990000?text=oi');
  });

  it('número normalizado', () => {
    expect(numeroWhatsapp('(88) 99999-0000')).toBe('5588999990000');
    expect(numeroWhatsapp('123')).toBeNull();
  });

  it('respeita quem não quer WhatsApp', () => {
    expect(contatoDoUsuario({ email: 'a@ifce.edu.br', whatsapp: '5588999990000', usaWhatsapp: false })).toEqual({ para: 'a@ifce.edu.br', whatsapp: null, aceitaWhatsapp: false });
    expect(contatoDoUsuario({ email: 'a@ifce.edu.br', whatsapp: '88999990000', usaWhatsapp: true }).whatsapp).toBe('5588999990000');
  });

  it('modo de envio e endereço do sistema', () => {
    expect(lerModoEnvio('EMAIL_MANUAL')).toBe('EMAIL_MANUAL');
    expect(lerModoEnvio('WEBHOOK_AUTO')).toBeNull();
    expect(enderecoDoSistema('/grade/minha', 'https://sgc.ifce.edu.br/')).toBe('https://sgc.ifce.edu.br/grade/minha');
    expect(enderecoDoSistema('/grade/minha', '')).toBeNull();
  });
});
