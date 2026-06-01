import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── componentes de layout ────────────────────────────────────────────────────

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.secao}>
      <Text style={styles.secaoTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragrafo}>{children}</Text>;
}

function Item({ children }: { children: React.ReactNode }) {
  return <Text style={styles.item}>{'• '}{children}</Text>;
}

function Destaque({ children }: { children: React.ReactNode }) {
  return <View style={styles.destaqueBox}><Text style={styles.destaqueTxt}>{children}</Text></View>;
}

function SubTitulo({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subTitulo}>{children}</Text>;
}

/** Linha de tabela com duas colunas */
function TabelaRow2({ tipo, finalidade, alt }: { tipo: string; finalidade: string; alt?: boolean }) {
  return (
    <View style={[styles.tRow, alt && styles.tRowAlt]}>
      <Text style={styles.tTipo}>{tipo}</Text>
      <Text style={styles.tFin}>{finalidade}</Text>
    </View>
  );
}

/** Card para tabela de 3 colunas (tipo / quando / finalidade) */
function TabelaCard3({ tipo, quando, finalidade }: { tipo: string; quando: string; finalidade: string }) {
  return (
    <View style={styles.tCard3}>
      <Text style={styles.tCard3Titulo}>{tipo}</Text>
      <Text style={styles.tCard3Label}>Quando é coletado</Text>
      <Text style={styles.tCard3Valor}>{quando}</Text>
      <Text style={styles.tCard3Label}>Finalidade</Text>
      <Text style={styles.tCard3Valor}>{finalidade}</Text>
    </View>
  );
}

/** Card para tabela de compartilhamento (4 colunas → card vertical) */
function TabelaCompart({ terceiro, dados, finalidade, local }: {
  terceiro: string; dados: string; finalidade: string; local: string;
}) {
  return (
    <View style={styles.compartCard}>
      <Text style={styles.compartTerceiro}>{terceiro}</Text>
      <Text style={styles.compartLabel}>Dados compartilhados</Text>
      <Text style={styles.compartValor}>{dados}</Text>
      <Text style={styles.compartLabel}>Finalidade</Text>
      <Text style={styles.compartValor}>{finalidade}</Text>
      <Text style={styles.compartLabel}>Servidores</Text>
      <Text style={styles.compartValor}>{local}</Text>
    </View>
  );
}

/** Card para base legal */
function BaseLegal({ finalidade, base }: { finalidade: string; base: string }) {
  return (
    <View style={styles.baseRow}>
      <Text style={styles.baseFin}>{finalidade}</Text>
      <Text style={styles.baseBase}>{base}</Text>
    </View>
  );
}

/** Card para direito LGPD */
function DireitoCard({ direito, descricao, como }: { direito: string; descricao: string; como: string }) {
  return (
    <View style={styles.direitoCard}>
      <Text style={styles.direitoTitulo}>{direito}</Text>
      <Text style={styles.direitoDesc}>{descricao}</Text>
      <Text style={styles.direitoComoLabel}>Como fazer</Text>
      <Text style={styles.direitoComo}>{como}</Text>
    </View>
  );
}

// ── componente principal ─────────────────────────────────────────────────────

export default function Privacidade() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltarBtn}>
          <Text style={styles.voltarTxt}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Privacidade</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={styles.capa}>
        <Text style={styles.capaApp}>eluus</Text>
        <Text style={styles.capaVersao}>Política de Privacidade</Text>
        <Text style={styles.capaData}>Versão 1.0 – 02 de maio de 2026</Text>
      </View>

      {/* ── 1 ── */}
      <Secao titulo="1. INFORMAÇÕES GERAIS">
        <P>A eluus Tecnologia, inscrita no CNPJ sob o nº 29.456.406/0001-65, com sede na Rua Antônio Roque, S/N – Várzea Grande – MT, é a Controladora dos seus dados pessoais, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018 – "LGPD").</P>
        <P>Esta Política explica:</P>
        <Item>Quais dados coletamos</Item>
        <Item>Como os utilizamos</Item>
        <Item>Com quem os compartilhamos</Item>
        <Item>Seus direitos sobre seus dados</Item>
        <P>Ao usar o aplicativo eluus, você concorda com esta Política.</P>
      </Secao>

      {/* ── 2 ── */}
      <Secao titulo="2. DADOS QUE COLETAMOS">
        <SubTitulo>2.1. Dados de cadastro (todos os usuários)</SubTitulo>
        <View style={styles.tabela}>
          <View style={styles.tHeader}>
            <Text style={styles.tHeaderTxt}>Dado</Text>
            <Text style={styles.tHeaderTxt}>Finalidade</Text>
          </View>
          <TabelaRow2 tipo="Nome completo" finalidade="Identificação do usuário" />
          <TabelaRow2 tipo="CPF" finalidade="Cadastro único, prevenção de fraudes e obrigações legais" alt />
          <TabelaRow2 tipo="Telefone" finalidade="Contato, recuperação de conta, notificações" />
          <TabelaRow2 tipo="Foto de perfil" finalidade="Identificação visual entre passageiro e motorista" alt />
          <TabelaRow2 tipo="E-mail" finalidade="Comunicação oficial, recuperação de senha" />
        </View>

        <SubTitulo>2.2. Dados do motorista</SubTitulo>
        <View style={styles.tabela}>
          <View style={styles.tHeader}>
            <Text style={styles.tHeaderTxt}>Dado</Text>
            <Text style={styles.tHeaderTxt}>Finalidade</Text>
          </View>
          <TabelaRow2 tipo="CNH (foto e número)" finalidade="Verificação de aptidão para dirigir" />
          <TabelaRow2 tipo="CRLV do veículo" finalidade="Verificação de regularidade do veículo" alt />
          <TabelaRow2 tipo="Selfie com documento" finalidade="Prova de identidade real (anti-fraude)" />
          <TabelaRow2 tipo="Comprovante de residência" finalidade="Confirmação de endereço (opcional, mas recomendado)" alt />
        </View>

        <SubTitulo>2.3. Dados de uso e localização</SubTitulo>
        <TabelaCard3
          tipo="Localização em tempo real (GPS)"
          quando="Durante toda a sessão do motorista (se online)"
          finalidade="Calcular distância, sugerir valor da corrida, permitir que o passageiro veja a localização do motorista"
        />
        <TabelaCard3
          tipo="Localização do passageiro"
          quando="No momento da solicitação da corrida"
          finalidade="Definir ponto de partida"
        />
        <TabelaCard3
          tipo="Histórico de rotas"
          quando="Durante a corrida"
          finalidade="Registrar trajeto, resolver disputas"
        />
        <TabelaCard3
          tipo="Status online/offline"
          quando="Em tempo real"
          finalidade="Mostrar disponibilidade do motorista"
        />

        <SubTitulo>2.4. Dados de interação</SubTitulo>
        <View style={styles.tabela}>
          <View style={styles.tHeader}>
            <Text style={styles.tHeaderTxt}>Dado</Text>
            <Text style={styles.tHeaderTxt}>Finalidade</Text>
          </View>
          <TabelaRow2 tipo="Mensagens do chat" finalidade="Comunicação durante a corrida (apagadas após 30 dias, exceto se houver denúncia)" />
          <TabelaRow2 tipo="Avaliações" finalidade="Reputação e qualidade do serviço" alt />
          <TabelaRow2 tipo="Histórico de corridas" finalidade="Registro para o usuário (não compartilhamos com terceiros)" />
          <TabelaRow2 tipo="Códigos de convite" finalidade="Controle de acesso e crescimento do app" alt />
        </View>

        <SubTitulo>2.5. Dados técnicos (automáticos)</SubTitulo>
        <Item>Dispositivo: modelo, sistema operacional, versão do app, identificador único</Item>
        <Item>Rede: tipo de conexão (Wi-Fi, 4G/5G)</Item>
        <Item>Logs de erro: para corrigir bugs (não associados a você diretamente)</Item>
      </Secao>

      {/* ── 3 ── */}
      <Secao titulo="3. BASE LEGAL PARA O TRATAMENTO (LGPD)">
        <P>Coletamos e usamos seus dados com base nas seguintes hipóteses legais:</P>
        <View style={styles.tabelaBase}>
          <BaseLegal finalidade="Cadastro e autenticação" base="Execução de contrato (Termos de Uso)" />
          <BaseLegal finalidade="Localização para corrida" base="Execução de contrato e interesse legítimo (segurança)" />
          <BaseLegal finalidade="Prevenção de fraudes" base="Interesse legítimo e cumprimento de obrigação legal" />
          <BaseLegal finalidade="Notificações push" base="Consentimento (você ativa no app)" />
          <BaseLegal finalidade="Verificação de documentos (motorista)" base="Cumprimento de obrigação legal (código de trânsito)" />
          <BaseLegal finalidade="Estatísticas e melhorias" base="Interesse legítimo (análise agregada, sem identificação direta)" />
        </View>
        <P>Você pode revogar seu consentimento a qualquer momento, exceto quando o tratamento for obrigatório por lei.</P>
      </Secao>

      {/* ── 4 ── */}
      <Secao titulo="4. COMPARTILHAMENTO COM TERCEIROS">
        <TabelaCompart
          terceiro="Google Firebase"
          dados="Autenticação, banco de dados em tempo real, armazenamento de fotos, push notifications"
          finalidade="Infraestrutura completa do app"
          local="Brasil / EUA (Google Cloud)"
        />
        <TabelaCompart
          terceiro="Google Maps API"
          dados="Endereços de origem/destino, cálculo de distância, geolocalização"
          finalidade="Autocomplete, cálculo de valor, navegação"
          local="Global (processado no Brasil quando possível)"
        />
        <TabelaCompart
          terceiro="Validador de documentos (futuro)"
          dados="CNH, CPF, selfie"
          finalidade="Verificação de autenticidade"
          local="A definir"
        />
        <Destaque>O eluus não vende, aluga ou compartilha seus dados com anunciantes ou terceiros para marketing.</Destaque>
      </Secao>

      {/* ── 5 ── */}
      <Secao titulo="5. ARMAZENAMENTO E SEGURANÇA">
        <SubTitulo>5.1. Onde os dados ficam?</SubTitulo>
        <Item>Banco de dados: Firebase (Google Cloud, região us-central1 ou southamerica-east1)</Item>
        <Item>Fotos e documentos: Firebase Storage</Item>

        <SubTitulo>5.2. Por quanto tempo guardamos?</SubTitulo>
        <View style={styles.tabela}>
          <View style={styles.tHeader}>
            <Text style={styles.tHeaderTxt}>Dado</Text>
            <Text style={styles.tHeaderTxt}>Retenção</Text>
          </View>
          <TabelaRow2 tipo="Dados de cadastro" finalidade="Enquanto a conta estiver ativa + 6 meses após exclusão" />
          <TabelaRow2 tipo="Localização de corridas" finalidade="12 meses (para resolver disputas)" alt />
          <TabelaRow2 tipo="Mensagens do chat" finalidade="30 dias (apagadas automaticamente)" />
          <TabelaRow2 tipo="Documentos do motorista" finalidade="Conta ativa + até 5 anos por exigência legal" alt />
        </View>

        <SubTitulo>5.3. Medidas de segurança</SubTitulo>
        <Item>Criptografia de dados em trânsito (TLS/SSL)</Item>
        <Item>Regras de segurança no Firebase (Firestore Security Rules)</Item>
        <Item>Acesso restrito aos administradores</Item>
        <Item>Recomendamos autenticação de dois fatores no e-mail administrativo</Item>
        <Destaque>Nenhum sistema é 100% seguro. Em caso de violação de dados, notificaremos os usuários e a ANPD dentro do prazo legal (até 48h em caso de risco elevado).</Destaque>
      </Secao>

      {/* ── 6 ── */}
      <Secao titulo="6. SEUS DIREITOS (LGPD – ART. 18)">
        <P>Você pode exercer gratuitamente os seguintes direitos. Prazo de resposta: até 15 dias (prorrogável por mais 15 dias).</P>
        <DireitoCard direito="Confirmação" descricao="Saber se tratamos seus dados" como="E-mail para contato@eluus.app" />
        <DireitoCard direito="Acesso" descricao="Obter cópia de todos os seus dados" como="Solicitação por e-mail" />
        <DireitoCard direito="Correção" descricao="Corrigir dados incompletos ou errados" como="Pelo próprio app (editar perfil) ou por e-mail" />
        <DireitoCard direito="Eliminação" descricao="Solicitar exclusão da conta e dados" como="No app (opção Excluir conta) ou por e-mail" />
        <DireitoCard direito="Portabilidade" descricao="Receber seus dados em formato estruturado" como="E-mail (fornecemos CSV/JSON)" />
        <DireitoCard direito="Revogação de consentimento" descricao="Retirar autorização para tratamentos que dependam de consentimento (ex.: notificações)" como="Nas configurações do app ou dispositivo" />
        <DireitoCard direito="Oposição" descricao="Opor-se a tratamento baseado em interesse legítimo" como="E-mail explicando o motivo" />
        <P>Importante: para excluir sua conta, todas as corridas pendentes devem estar finalizadas.</P>
      </Secao>

      {/* ── 7 ── */}
      <Secao titulo="7. DADOS DE CRIANÇAS E ADOLESCENTES">
        <P>O eluus não é destinado a menores de 18 anos desacompanhados.</P>
        <Item>Menores entre 16 e 18 anos: uso permitido somente com autorização expressa dos pais ou responsável legal, enviada para contato@eluus.app antes da primeira corrida.</Item>
        <Item>Menores de 16 anos: proibidos de usar o app, mesmo com autorização.</Item>
        <P>Não coletamos intencionalmente dados de menores sem consentimento. Se você souber de algum caso, avise-nos.</P>
      </Secao>

      {/* ── 8 ── */}
      <Secao titulo="8. TRANSFERÊNCIA INTERNACIONAL DE DADOS">
        <P>Seus dados podem ser transferidos para servidores do Google (Firebase) localizados nos Estados Unidos ou em outros países onde o Google opera. Essas transferências ocorrem com base em:</P>
        <Item>Cláusulas Contratuais Padrão da União Europeia (adotadas pelo Google)</Item>
        <Item>Garantias adequadas de segurança e privacidade</Item>
        <P>Ao usar o eluus, você consente com essa transferência.</P>
      </Secao>

      {/* ── 9 ── */}
      <Secao titulo="9. NOTIFICAÇÕES PUSH">
        <Item>Coletamos seu token de dispositivo para enviar notificações (ex.: "Motorista chegou", "Nova solicitação").</Item>
        <Item>Você pode desativar as notificações nas configurações do seu celular.</Item>
        <Item>Mesmo desativadas, o app continuará funcionando, mas você pode perder avisos importantes.</Item>
      </Secao>

      {/* ── 10 ── */}
      <Secao titulo="10. ALTERAÇÕES NESTA POLÍTICA">
        <P>Podemos atualizar esta Política a qualquer momento. Alterações relevantes serão comunicadas:</P>
        <Item>Por e-mail (para usuários cadastrados)</Item>
        <Item>Por meio de aviso no próprio aplicativo</Item>
        <P>A versão mais recente estará sempre disponível em Configurações {'>'} Privacidade.</P>
      </Secao>

      {/* ── 11 ── */}
      <Secao titulo="11. ENCARREGADO (DPO) E CONTATO">
        <P>Nos termos da LGPD (Art. 41), indicamos nosso Encarregado de Dados:</P>
        <View style={styles.contatoCard}>
          <Text style={styles.contatoLabel}>Nome</Text>
          <Text style={styles.contatoValor}>Administração eluus Tecnologia</Text>
          <Text style={styles.contatoLabel}>E-mail</Text>
          <Text style={styles.contatoValor}>contato@eluus.app</Text>
          <Text style={styles.contatoLabel}>Telefone / WhatsApp</Text>
          <Text style={styles.contatoValor}>(65) 98432-2755</Text>
          <Text style={styles.contatoLabel}>Endereço</Text>
          <Text style={styles.contatoValor}>Rua Antônio Roque, S/N – Várzea Grande – MT</Text>
        </View>
        <P>Use esses canais para exercer seus direitos, reportar suspeita de violação de dados ou fazer reclamações sobre privacidade.</P>
        <P>Você também pode reclamar diretamente na Autoridade Nacional de Proteção de Dados (ANPD) – www.gov.br/anpd</P>
      </Secao>

      {/* ── 12 ── */}
      <Secao titulo="12. CONSENTIMENTO">
        <P>Ao clicar em "ACEITO" ou continuar usando o eluus, você declara que:</P>
        <Item>Leu, compreendeu e concorda com esta Política de Privacidade.</Item>
        <Item>Autoriza a coleta e tratamento de seus dados conforme descrito.</Item>
        <Item>Consente com o compartilhamento mínimo necessário com os terceiros mencionados.</Item>
        <Destaque>Caso não concorde, não use o aplicativo e solicite a exclusão de sua conta pelo e-mail contato@eluus.app</Destaque>
      </Secao>

      {/* Declaração */}
      <View style={styles.aceiteCard}>
        <Text style={styles.aceiteTitulo}>Declaração de aceite</Text>
        <Text style={styles.aceiteTexto}>
          Ao utilizar o aplicativo eluus, declaro que li, compreendi e concordo com esta Política de Privacidade, autorizando o tratamento de meus dados conforme descrito.
        </Text>
        <Text style={styles.aceiteData}>
          Data do aceite: registrada automaticamente no primeiro acesso ao aplicativo.
        </Text>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

// ── estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0f14', padding: 24, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  voltarBtn: { backgroundColor: '#1a1f2e', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#2a3044' },
  voltarTxt: { color: '#94a3b8', fontSize: 13 },
  titulo: { color: '#fff', fontWeight: 'bold', fontSize: 18 },

  capa: { alignItems: 'center', marginBottom: 32, paddingVertical: 20, backgroundColor: '#1a1f2e', borderRadius: 16, borderWidth: 1, borderColor: '#2a3044', gap: 4 },
  capaApp: { fontSize: 26, fontWeight: 'bold', color: '#4a9eff', letterSpacing: 2 },
  capaVersao: { fontSize: 15, color: '#fff', fontWeight: '600' },
  capaData: { fontSize: 12, color: '#64748b' },

  secao: { marginBottom: 28 },
  secaoTitulo: { fontSize: 14, fontWeight: 'bold', color: '#4a9eff', letterSpacing: 0.5, marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1a1f2e' },
  subTitulo: { fontSize: 13, fontWeight: '700', color: '#fff', marginTop: 12, marginBottom: 8 },
  paragrafo: { fontSize: 13, color: '#94a3b8', lineHeight: 21, marginBottom: 10 },
  item: { fontSize: 13, color: '#94a3b8', lineHeight: 21, marginBottom: 6, paddingLeft: 8 },

  destaqueBox: { backgroundColor: '#1a140a', borderRadius: 12, padding: 14, marginVertical: 10, borderWidth: 1, borderColor: '#f59e0b' },
  destaqueTxt: { color: '#f59e0b', fontSize: 13, fontWeight: '600', lineHeight: 20 },

  // tabela 2 colunas
  tabela: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#2a3044', marginBottom: 12 },
  tHeader: { flexDirection: 'row', backgroundColor: '#1a1f2e', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tHeaderTxt: { flex: 1, color: '#4a9eff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderTopWidth: 1, borderTopColor: '#2a3044' },
  tRowAlt: { backgroundColor: '#111520' },
  tTipo: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '600' },
  tFin: { flex: 2, color: '#94a3b8', fontSize: 12, lineHeight: 18 },

  // tabela 3 colunas → card
  tCard3: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#2a3044' },
  tCard3Titulo: { color: '#fff', fontWeight: '700', fontSize: 13, marginBottom: 8 },
  tCard3Label: { color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 6 },
  tCard3Valor: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: 2 },

  // compartilhamento
  compartCard: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#2a3044' },
  compartTerceiro: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginBottom: 8 },
  compartLabel: { color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8 },
  compartValor: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: 2 },

  // base legal
  tabelaBase: { backgroundColor: '#1a1f2e', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#2a3044', marginBottom: 12 },
  baseRow: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2a3044' },
  baseFin: { color: '#fff', fontSize: 12, fontWeight: '600', marginBottom: 3 },
  baseBase: { color: '#94a3b8', fontSize: 12 },

  // direitos LGPD
  direitoCard: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderLeftWidth: 3, borderColor: '#2a3044', borderLeftColor: '#4a9eff' },
  direitoTitulo: { color: '#4a9eff', fontWeight: 'bold', fontSize: 13, marginBottom: 4 },
  direitoDesc: { color: '#fff', fontSize: 12, lineHeight: 18 },
  direitoComoLabel: { color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8 },
  direitoComo: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: 2 },

  // contato
  contatoCard: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a3044', gap: 2 },
  contatoLabel: { color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginTop: 10 },
  contatoValor: { color: '#4a9eff', fontWeight: '600', fontSize: 14 },

  // aceite
  aceiteCard: { backgroundColor: '#0f2a1a', borderRadius: 16, padding: 20, marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: '#22c55e', gap: 8 },
  aceiteTitulo: { color: '#22c55e', fontWeight: 'bold', fontSize: 14 },
  aceiteTexto: { color: '#94a3b8', fontSize: 13, lineHeight: 20 },
  aceiteData: { color: '#64748b', fontSize: 12, fontStyle: 'italic' },
});
